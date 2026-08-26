# Cloudflare Migration Design

**Date:** 2026-04-15

## Goal

Migrate the backend from Supabase to Cloudflare Workers (API) + D1 (database) + R2 (image storage). Add product image auto-fetch (Shopee + OG fallback) and manual image upload. Next.js frontend stays unchanged except for the data layer.

---

## Architecture

```
┌─────────────────────────────┐      ┌───────────────────────────┐      ┌──────────────────────────────────┐
│   Next.js Frontend          │      │  Next.js API Proxy        │      │   Cloudflare Worker (API)        │
│   (client components)       │      │  /api/proxy/[...path]     │      │                                  │
│                             │ fetch│  (runs server-side)        │ HTTP │  Routes (Hono):                  │
│  - UI components (unchanged)├─────▶│  - reads NextAuth session   ├─────▶│  POST   /vouchers                │
│  - apiFetchClient(path)     │      │    cookie (JWT), never       │      │  GET    /vouchers                │
│    → /api/proxy${path}      │      │    sent to the browser       │      │  DELETE /vouchers/:id            │
│  - no token/Worker URL      │      │  - attaches                  │      │  POST   /comparisons             │
│    ever reaches the client  │      │    Authorization: Bearer     │      │  GET    /comparisons             │
└─────────────────────────────┘      └───────────────────────────┘      │  DELETE /comparisons/:id         │
                                                                          │  POST   /product/fetch ──▶ D1+R2 │
                                                                          │  POST   /images/upload ──▶ R2    │
                                                                          │  GET    /images/:key   ──▶ R2    │
                                                                          │                                  │
                                                                          │  Bindings: D1 (SQLite), R2       │
                                                                          └──────────────────────────────────┘
```

### Auth Flow

1. NextAuth in Next.js signs a session JWT, stored in the `authjs.session-token` cookie
2. Client components call `apiFetchClient(path, options)` from `lib/api.ts`, which does nothing but `fetch('/api/proxy' + path, options)` — no token handling on the client
3. `app/api/proxy/[...path]/route.ts` runs server-side, reads the `authjs.session-token` cookie directly off the incoming request, and forwards the request to `WORKER_URL` with `Authorization: Bearer <token>`
4. Worker validates the JWT using the same secret and extracts `sub` (user ID), scoping all DB queries to it
5. The Worker's URL and the raw JWT never reach the browser — `NEXT_PUBLIC_WORKER_URL` is not used for authenticated calls

---

## Worker Project Structure

```
worker/
├── wrangler.toml              # D1 + R2 bindings, routes
├── src/
│   ├── index.ts               # Hono app entry, global middleware
│   ├── middleware/
│   │   └── auth.ts            # JWT validation
│   ├── routes/
│   │   ├── vouchers.ts        # CRUD for vouchers
│   │   ├── comparisons.ts     # CRUD for comparisons
│   │   ├── product.ts         # Shopee/OG image fetch
│   │   └── images.ts          # R2 upload + serve
│   └── lib/
│       ├── shopee.ts          # Shopee URL parser + API call
│       ├── og.ts              # OG scrape fallback
│       └── r2.ts              # R2 put/get helpers
```

---

## D1 Schema

```sql
CREATE TABLE vouchers (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  created_at    TEXT DEFAULT (datetime('now')),
  user_id       TEXT NOT NULL,
  percentage    REAL NOT NULL,
  min_condition REAL NOT NULL,
  max_discount  REAL NOT NULL,
  code          TEXT,
  product_name  TEXT,
  product_price REAL,
  product_url   TEXT,
  product_image TEXT    -- R2 key or external URL
);

CREATE TABLE saved_comparisons (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  created_at TEXT DEFAULT (datetime('now')),
  user_id    TEXT NOT NULL,
  data       TEXT NOT NULL   -- JSON blob
);

CREATE INDEX idx_vouchers_user    ON vouchers(user_id);
CREATE INDEX idx_comparisons_user ON saved_comparisons(user_id);
```

---

## Image Fetch Flow

### POST /product/fetch

```
1. Worker receives { url: "https://shopee.vn/..." }
2. Detect platform:
   ├── Shopee URL? → parse i.SHOPID.ITEMID from path
   │     → call shopee.vn/api/v4/item/get?itemid=&shopid=
   │     → extract item.images[0], item.name, item.price
   └── Other URL? → fetch HTML with browser User-Agent
         → parse <meta property="og:image"> / og:title
3. Fetch image bytes from the extracted image URL
4. PUT to R2 with key: images/{userId}/{uuid}.jpg
5. Return { name, price, imageKey } to frontend
6. Frontend shows preview; imageKey stored in D1 on save
```

### POST /images/upload (manual)

```
1. Frontend sends multipart/form-data with image file
2. Worker reads file bytes
3. PUT to R2: images/{userId}/{uuid}.{ext}
4. Return { imageKey }
```

### GET /images/:key

Worker proxies R2 object with correct `Content-Type`. No public R2 bucket needed.

---

## Next.js Changes

### What gets added
- `next-auth` + `app/api/auth/[...nextauth]/route.ts`
- `app/api/proxy/[...path]/route.ts` — server-side route that reads the session cookie and attaches the JWT before forwarding to the Worker
- `lib/api.ts` — thin client fetch wrapper that calls the proxy

### What gets removed
- `lib/supabase.ts`
- `@supabase/supabase-js` dependency
- All `supabase.*` calls in components (replaced with `apiFetchClient`)

### app/api/proxy/[...path]/route.ts

```ts
const WORKER_URL = process.env.WORKER_URL ?? '';

async function proxyRequest(req: NextRequest, path: string[]) {
  const sessionToken = req.cookies.get('authjs.session-token')?.value;
  if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const forwardHeaders = new Headers();
  forwardHeaders.set('Authorization', `Bearer ${sessionToken}`);
  const contentType = req.headers.get('content-type');
  if (contentType) forwardHeaders.set('Content-Type', contentType);

  const workerRes = await fetch(`${WORKER_URL}/${path.join('/')}`, {
    method: req.method,
    headers: forwardHeaders,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    duplex: 'half',
  });
  return new Response(workerRes.body, { status: workerRes.status, headers: workerRes.headers });
}
// exported as GET/POST/DELETE handlers, each awaiting params and delegating to proxyRequest
```

### lib/api.ts

```ts
// Client-side fetch wrapper — routes through Next.js proxy at /api/proxy
// which attaches the NextAuth JWT server-side before forwarding to the Worker.
export async function apiFetchClient(
  path: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(`/api/proxy${path}`, options);
}
```

NextAuth v5's `session` object never has an `accessToken` field (only `session.user.id`, set from `token.sub`) — that's precisely why the JWT has to be read server-side from the cookie rather than passed around as `session.accessToken` on the client.

---

## Environment Variables

### Next.js (.env.local)
```
AUTH_SECRET=<shared-secret>
AUTH_GOOGLE_ID=<google-oauth-client-id>
AUTH_GOOGLE_SECRET=<google-oauth-client-secret>
WORKER_URL=https://your-worker.workers.dev        # server-side only, read by the proxy route
NEXT_PUBLIC_WORKER_URL=                            # optional — only if client code calls the Worker directly
```

### Worker (wrangler secrets)
```
NEXTAUTH_SECRET=<same-shared-secret>
```

### wrangler.toml bindings
```toml
[[d1_databases]]
binding = "DB"
database_name = "voucher-optima"
database_id = "<id>"

[[r2_buckets]]
binding = "R2"
bucket_name = "voucher-optima-images"
```
