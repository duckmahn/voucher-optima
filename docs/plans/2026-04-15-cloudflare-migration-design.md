# Cloudflare Migration Design

**Date:** 2026-04-15

## Goal

Migrate the backend from Supabase to Cloudflare Workers (API) + D1 (database) + R2 (image storage). Add product image auto-fetch (Shopee + OG fallback) and manual image upload. Next.js frontend stays unchanged except for the data layer.

---

## Architecture

```
┌─────────────────────────────┐      ┌──────────────────────────────────┐
│   Next.js Frontend          │      │   Cloudflare Worker (API)        │
│   (Vercel or CF Pages)      │      │                                  │
│                             │      │  Routes (Hono):                  │
│  - UI components (unchanged)│ HTTP │  POST   /vouchers                │
│  - NextAuth (issues JWT) ───┼─────▶│  GET    /vouchers                │
│  - fetch() with Bearer JWT  │      │  DELETE /vouchers/:id            │
│                             │      │  POST   /comparisons             │
└─────────────────────────────┘      │  GET    /comparisons             │
                                     │  DELETE /comparisons/:id         │
                                     │  POST   /product/fetch ──▶ D1+R2 │
                                     │  POST   /images/upload ──▶ R2    │
                                     │  GET    /images/:key   ──▶ R2    │
                                     │                                  │
                                     │  Bindings: D1 (SQLite), R2       │
                                     └──────────────────────────────────┘
```

### Auth Flow

1. NextAuth in Next.js signs a JWT using `NEXTAUTH_SECRET`
2. Frontend attaches it as `Authorization: Bearer <token>` on every request
3. Worker validates the JWT using the same `NEXTAUTH_SECRET`
4. Worker extracts `sub` (user ID) from the token payload and scopes all DB queries to it

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
- `lib/api.ts` — fetch wrapper that injects JWT

### What gets removed
- `lib/supabase.ts`
- `@supabase/supabase-js` dependency
- All `supabase.*` calls in components (replaced with `apiFetch`)

### lib/api.ts

```ts
import { getSession } from 'next-auth/react';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;

export async function apiFetch(path: string, options?: RequestInit) {
  const session = await getSession();
  return fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${session?.accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}
```

---

## Environment Variables

### Next.js (.env.local)
```
NEXTAUTH_SECRET=<shared-secret>
NEXTAUTH_URL=https://your-app.com
NEXT_PUBLIC_WORKER_URL=https://your-worker.workers.dev
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
