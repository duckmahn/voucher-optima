# Cloudflare Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Supabase with a Cloudflare Worker API (Hono + D1 + R2), add Shopee/OG product image auto-fetch and manual image upload, wire NextAuth in Next.js as the JWT issuer.

**Architecture:** Cloudflare Worker in `worker/` directory exposes a REST API; Next.js frontend replaces all `supabase.*` calls with `apiFetch()` that attaches a NextAuth JWT. The Worker validates the JWT, then reads/writes D1 (SQLite) and R2 (images).

**Tech Stack:** Hono, Cloudflare Workers, D1, R2, Wrangler CLI, next-auth, TypeScript

---

## Prerequisites (do once, manually)

1. Install Wrangler globally: `npm install -g wrangler`
2. Login: `wrangler login`
3. Create D1 database: `wrangler d1 create voucher-optima` → copy the `database_id` into `wrangler.toml`
4. Create R2 bucket: `wrangler r2 bucket create voucher-optima-images`

---

### Task 1: Scaffold the Worker project

**Files:**
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/wrangler.toml`
- Create: `worker/src/index.ts`

**Step 1: Create worker directory and package.json**

```bash
mkdir -p worker/src/middleware worker/src/routes worker/src/lib
```

`worker/package.json`:
```json
{
  "name": "voucher-optima-worker",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:migrate:local": "wrangler d1 execute voucher-optima --local --file=./schema.sql",
    "db:migrate:remote": "wrangler d1 execute voucher-optima --remote --file=./schema.sql"
  },
  "dependencies": {
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241205.0",
    "wrangler": "^3.99.0",
    "typescript": "^5"
  }
}
```

**Step 2: Create tsconfig.json**

`worker/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

**Step 3: Create wrangler.toml**

`worker/wrangler.toml`:
```toml
name = "voucher-optima-worker"
main = "src/index.ts"
compatibility_date = "2024-12-05"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "voucher-optima"
database_id = "REPLACE_WITH_YOUR_DATABASE_ID"

[[r2_buckets]]
binding = "R2"
bucket_name = "voucher-optima-images"
```

**Step 4: Create the Hono entry point**

`worker/src/index.ts`:
```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { vouchersRoute } from './routes/vouchers';
import { comparisonsRoute } from './routes/comparisons';
import { productRoute } from './routes/product';
import { imagesRoute } from './routes/images';
import { authMiddleware } from './middleware/auth';

export type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  NEXTAUTH_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type'] }));
app.use('/vouchers/*', authMiddleware);
app.use('/comparisons/*', authMiddleware);
app.use('/product/*', authMiddleware);
app.use('/images/upload', authMiddleware);

app.route('/vouchers', vouchersRoute);
app.route('/comparisons', comparisonsRoute);
app.route('/product', productRoute);
app.route('/images', imagesRoute);

app.get('/health', (c) => c.json({ ok: true }));

export default app;
```

**Step 5: Install dependencies and verify TypeScript**

```bash
cd worker && npm install
npx tsc --noEmit
```
Expected: no errors (index.ts will error on missing route imports — that's fine for now, fix in next tasks)

**Step 6: Commit**

```bash
git add worker/
git commit -m "feat: scaffold cloudflare worker project"
```

---

### Task 2: D1 schema migration

**Files:**
- Create: `worker/schema.sql`

**Step 1: Write schema**

`worker/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS vouchers (
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
  product_image TEXT
);

CREATE TABLE IF NOT EXISTS saved_comparisons (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  created_at TEXT DEFAULT (datetime('now')),
  user_id    TEXT NOT NULL,
  data       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vouchers_user    ON vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_user ON saved_comparisons(user_id);
```

**Step 2: Apply to local D1**

```bash
cd worker && npm run db:migrate:local
```
Expected: `🌀 Executing on local database voucher-optima ... Done`

**Step 3: Commit**

```bash
git add worker/schema.sql
git commit -m "feat: add d1 schema for vouchers and comparisons"
```

---

### Task 3: JWT auth middleware

**Files:**
- Create: `worker/src/lib/verify-session-token.ts`
- Create: `worker/src/middleware/auth.ts`

> **Correction:** an earlier version of this plan verified the token as a plain HS256-signed
> JWS (split on `.` into header/payload/signature, HMAC-verify). That does not work — Auth.js
> v5's `jwt` session strategy encrypts the cookie as a **JWE** (`alg: "dir"`, `enc:
> "A256CBC-HS512"`, 5 dot-separated segments), not a signed JWS. An HS256 verifier throws
> `Invalid token format` on every real token (`alg: "dir"` leaves the JWE's second segment
> empty), so it always 401s. See `@auth/core/jwt.js`'s `encode`/`decode`/
> `getDerivedEncryptionKey` for the reference implementation this reverse-engineers. The
> decryption key is derived via HKDF-SHA256 from the secret, salted with the *session cookie's
> name* — which differs between HTTP (`authjs.session-token`) and HTTPS
> (`__Secure-authjs.session-token`), so the Worker tries both unless the proxy tells it which
> one it read (see Task 11).

**Step 1: Write the pure token-verification module**

`worker/src/lib/verify-session-token.ts`:
```ts
import { jwtDecrypt } from 'jose';

const CONTENT_ENC_ALG = 'A256CBC-HS512';

async function deriveEncryptionKey(secret: string, salt: string): Promise<Uint8Array> {
  const info = `Auth.js Generated Encryption Key (${salt})`;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      info: new TextEncoder().encode(info),
    },
    keyMaterial,
    64 * 8 // 64 bytes required for A256CBC-HS512
  );
  return new Uint8Array(bits);
}

const SESSION_COOKIE_SALTS = ['authjs.session-token', '__Secure-authjs.session-token'] as const;

export async function verifyNextAuthSessionToken(
  token: string,
  secret: string,
  cookieNameHint?: string
): Promise<{ sub: string }> {
  const salts = cookieNameHint ? [cookieNameHint] : SESSION_COOKIE_SALTS;
  let lastError: unknown;
  for (const salt of salts) {
    try {
      const encryptionKey = await deriveEncryptionKey(secret, salt);
      const { payload } = await jwtDecrypt(token, encryptionKey, {
        keyManagementAlgorithms: ['dir'],
        contentEncryptionAlgorithms: [CONTENT_ENC_ALG],
      });
      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new Error('Missing sub claim');
      }
      return { sub: payload.sub };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Invalid session token');
}
```

Add `jose` as a Worker dependency (`npm install jose` in `worker/`) — it's the only new
runtime dependency this requires; no full `next-auth`/`@auth/core` import needed on the
Worker side.

**Step 2: Write the middleware**

`worker/src/middleware/auth.ts`:
```ts
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { Bindings } from '../index';
import { verifyNextAuthSessionToken } from '../lib/verify-session-token';

type Variables = { userId: string };

export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.slice(7);
    const cookieNameHint = c.req.header('X-Session-Cookie-Name') ?? undefined;
    try {
      const { sub } = await verifyNextAuthSessionToken(token, c.env.NEXTAUTH_SECRET, cookieNameHint);
      c.set('userId', sub);
      await next();
    } catch {
      throw new HTTPException(401, { message: 'Invalid or expired token' });
    }
  }
);
```

**Step 3: Set the secret for local dev**

```bash
# Create a .dev.vars file (gitignored) for local wrangler dev
echo 'NEXTAUTH_SECRET=dev-secret-change-in-production' > worker/.dev.vars
echo '.dev.vars' >> .gitignore
```

The placeholder value above must be replaced with the *same* value as `AUTH_SECRET` in the
root `.env.local` (Task 10) — `verifyNextAuthSessionToken` derives its decryption key from
this secret, so a mismatch between the two makes every token fail decryption and 401,
independently of whether the JWE-decoding logic itself is correct.

**Step 4: Verify TypeScript**

```bash
cd worker && npx tsc --noEmit
```
Expected: no errors

**Step 5: Commit**

```bash
git add worker/src/lib/verify-session-token.ts worker/src/middleware/auth.ts worker/.dev.vars .gitignore
git commit -m "feat: add jwt auth middleware for worker"
```

---

### Task 4: Vouchers routes

**Files:**
- Create: `worker/src/routes/vouchers.ts`

**Step 1: Write routes**

`worker/src/routes/vouchers.ts`:
```ts
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Bindings } from '../index';

type Variables = { userId: string };

export const vouchersRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

vouchersRoute.get('/', async (c) => {
  const userId = c.get('userId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM vouchers WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();
  return c.json(results);
});

vouchersRoute.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    percentage: number;
    min_condition: number;
    max_discount: number;
    code?: string;
    product_name?: string;
    product_price?: number;
    product_url?: string;
    product_image?: string;
  }>();

  const { percentage, min_condition, max_discount } = body;
  if (!percentage || !min_condition || !max_discount) {
    throw new HTTPException(400, { message: 'percentage, min_condition, max_discount are required' });
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO vouchers (user_id, percentage, min_condition, max_discount, code, product_name, product_price, product_url, product_image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `).bind(
    userId, percentage, min_condition, max_discount,
    body.code ?? null, body.product_name ?? null,
    body.product_price ?? null, body.product_url ?? null, body.product_image ?? null
  ).first();

  return c.json(result, 201);
});

vouchersRoute.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { meta } = await c.env.DB.prepare(
    'DELETE FROM vouchers WHERE id = ? AND user_id = ?'
  ).bind(id, userId).run();

  if (meta.changes === 0) throw new HTTPException(404, { message: 'Voucher not found' });
  return c.json({ deleted: true });
});
```

**Step 2: Verify TypeScript**

```bash
cd worker && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add worker/src/routes/vouchers.ts
git commit -m "feat: add vouchers crud routes"
```

---

### Task 5: Comparisons routes

**Files:**
- Create: `worker/src/routes/comparisons.ts`

**Step 1: Write routes**

`worker/src/routes/comparisons.ts`:
```ts
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Bindings } from '../index';

type Variables = { userId: string };

export const comparisonsRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

comparisonsRoute.get('/', async (c) => {
  const userId = c.get('userId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM saved_comparisons WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();
  return c.json(results.map(r => ({ ...r, data: JSON.parse(r.data as string) })));
});

comparisonsRoute.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  if (!body || typeof body !== 'object') {
    throw new HTTPException(400, { message: 'Request body required' });
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO saved_comparisons (user_id, data) VALUES (?, ?) RETURNING *'
  ).bind(userId, JSON.stringify(body)).first();

  return c.json({ ...result, data: body }, 201);
});

comparisonsRoute.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { meta } = await c.env.DB.prepare(
    'DELETE FROM saved_comparisons WHERE id = ? AND user_id = ?'
  ).bind(id, userId).run();

  if (meta.changes === 0) throw new HTTPException(404, { message: 'Comparison not found' });
  return c.json({ deleted: true });
});
```

**Step 2: Verify TypeScript**

```bash
cd worker && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add worker/src/routes/comparisons.ts
git commit -m "feat: add comparisons crud routes"
```

---

### Task 6: R2 image helpers

**Files:**
- Create: `worker/src/lib/r2.ts`

**Step 1: Write helpers**

`worker/src/lib/r2.ts`:
```ts
export async function uploadToR2(
  bucket: R2Bucket,
  userId: string,
  imageBytes: ArrayBuffer,
  ext: string = 'jpg'
): Promise<string> {
  const key = `images/${userId}/${crypto.randomUUID()}.${ext}`;
  await bucket.put(key, imageBytes, {
    httpMetadata: { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` },
  });
  return key;
}

export async function getFromR2(bucket: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}
```

**Step 2: Commit**

```bash
git add worker/src/lib/r2.ts
git commit -m "feat: add r2 upload/get helpers"
```

---

### Task 7: Shopee product fetcher

**Files:**
- Create: `worker/src/lib/shopee.ts`

**Step 1: Write Shopee fetcher**

`worker/src/lib/shopee.ts`:
```ts
export type ProductData = {
  name: string;
  price: number;      // in VND (Shopee stores price * 100000)
  imageUrl: string;
};

export function isShopeeUrl(url: string): boolean {
  return /shopee\.(vn|sg|co\.id|ph|com\.my|co\.th)/.test(url);
}

export async function fetchShopeeProduct(url: string): Promise<ProductData | null> {
  // Extract shopId and itemId from URL pattern: /i.SHOPID.ITEMID
  const match = url.match(/i\.(\d+)\.(\d+)/);
  if (!match) return null;

  const [, shopId, itemId] = match;
  const domain = url.match(/shopee\.[a-z.]+/)?.[0] ?? 'shopee.vn';
  const apiUrl = `https://${domain}/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`;

  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': `https://${domain}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) return null;

  const json = await res.json<{ data?: { item?: { name?: string; price?: number; images?: string[] } } }>();
  const item = json?.data?.item;
  if (!item) return null;

  const imageHash = item.images?.[0];
  if (!imageHash) return null;

  return {
    name: item.name ?? '',
    price: (item.price ?? 0) / 100000,  // Shopee stores price * 100000
    imageUrl: `https://cf.shopee.vn/file/${imageHash}`,
  };
}
```

**Step 2: Commit**

```bash
git add worker/src/lib/shopee.ts
git commit -m "feat: add shopee product fetcher"
```

---

### Task 8: OG scrape fallback

**Files:**
- Create: `worker/src/lib/og.ts`

**Step 1: Write OG scraper**

`worker/src/lib/og.ts`:
```ts
import { ProductData } from './shopee';

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function fetchOgProduct(url: string): Promise<Partial<ProductData> | null> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html',
    },
  });

  if (!res.ok) return null;

  const html = await res.text();

  const imageUrl = extractMeta(html, 'og:image') ?? extractMeta(html, 'twitter:image');
  const name = extractMeta(html, 'og:title') ?? extractMeta(html, 'twitter:title');

  if (!imageUrl) return null;

  return { name: name ?? undefined, imageUrl };
}
```

**Step 2: Commit**

```bash
git add worker/src/lib/og.ts
git commit -m "feat: add og scrape fallback for product images"
```

---

### Task 9: Product fetch + image upload routes

**Files:**
- Create: `worker/src/routes/product.ts`
- Create: `worker/src/routes/images.ts`

**Step 1: Write product fetch route**

`worker/src/routes/product.ts`:
```ts
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Bindings } from '../index';
import { isShopeeUrl, fetchShopeeProduct } from '../lib/shopee';
import { fetchOgProduct } from '../lib/og';
import { uploadToR2 } from '../lib/r2';

type Variables = { userId: string };

export const productRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

productRoute.post('/fetch', async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  if (!url) throw new HTTPException(400, { message: 'url is required' });

  const userId = c.get('userId');

  // 1. Fetch product data
  let productData: { name?: string; price?: number; imageUrl?: string } | null = null;

  if (isShopeeUrl(url)) {
    productData = await fetchShopeeProduct(url);
  }
  if (!productData) {
    productData = await fetchOgProduct(url);
  }
  if (!productData?.imageUrl) {
    return c.json({ name: productData?.name ?? null, price: productData?.price ?? null, imageKey: null });
  }

  // 2. Download image and upload to R2
  let imageKey: string | null = null;
  try {
    const imgRes = await fetch(productData.imageUrl);
    if (imgRes.ok) {
      const bytes = await imgRes.arrayBuffer();
      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      imageKey = await uploadToR2(c.env.R2, userId, bytes, ext);
    }
  } catch {
    // Image upload failure is non-fatal — return what we have
  }

  return c.json({
    name: productData.name ?? null,
    price: productData.price ?? null,
    imageKey,
  });
});
```

**Step 2: Write image upload + serve routes**

`worker/src/routes/images.ts`:
```ts
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Bindings } from '../index';
import { uploadToR2, getFromR2 } from '../lib/r2';

type Variables = { userId: string };

export const imagesRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Manual upload (auth required — set in index.ts middleware)
imagesRoute.post('/upload', async (c) => {
  const userId = c.get('userId');
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) throw new HTTPException(400, { message: 'file is required' });

  const bytes = await file.arrayBuffer();
  const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg';
  const imageKey = await uploadToR2(c.env.R2, userId, bytes, ext);

  return c.json({ imageKey }, 201);
});

// Serve image (no auth needed — keys are unguessable UUIDs)
imagesRoute.get('/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const object = await getFromR2(c.env.R2, key);
  if (!object) throw new HTTPException(404, { message: 'Image not found' });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
});
```

**Step 3: Verify TypeScript**

```bash
cd worker && npx tsc --noEmit
```
Expected: no errors

**Step 4: Test the worker locally**

```bash
cd worker && npm run dev
```

In another terminal:
```bash
# Health check
curl http://localhost:8787/health
# Expected: {"ok":true}
```

**Step 5: Commit**

```bash
git add worker/src/routes/product.ts worker/src/routes/images.ts
git commit -m "feat: add product fetch and image upload/serve routes"
```

---

### Task 10: NextAuth setup in Next.js

**Files:**
- Modify: `package.json` (root)
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `lib/auth.ts`

**Step 1: Install next-auth**

```bash
cd /Users/nguyenducmanh/Documents/voucher-optima
npm install next-auth@5
```

NextAuth v5 (Auth.js) uses a single `auth.ts` config file.

**Step 2: Create auth config**

`lib/auth.ts`:
```ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Expose the user's unique ID as `sub` in the token
      if (account) token.sub = token.sub ?? account.providerAccountId;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  session: { strategy: 'jwt' },
});
```

**Step 3: Create the API route**

`app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

**Step 4: Add env vars to .env.local**

```bash
cat >> .env.local << 'EOF'
AUTH_SECRET=your-secret-here-generate-with-openssl-rand-base64-32
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
WORKER_URL=http://localhost:8787
EOF
```

`WORKER_URL` is server-side only — it's read by the proxy route (Task 11) and never reaches the browser. Add `NEXT_PUBLIC_WORKER_URL` only if some client code needs to call the Worker directly, which this plan doesn't require.

Generate a secret: `openssl rand -base64 32`

**Step 5: Commit**

```bash
git add app/api/auth lib/auth.ts package.json package-lock.json
git commit -m "feat: add nextauth with google provider"
```

---

### Task 11: API fetch wrapper + server-side proxy

NextAuth v5's `session` object has no `accessToken` field — the JWT callback only ever sets `token.sub`/`session.user.id` (Task 10). So the JWT the Worker needs to verify is the session token itself, and the only place that can safely read it is the server (reading it in a client component means shipping the Worker URL and the raw session token to the browser). That's why this task has two parts: a Next.js route handler that runs server-side, reads the session cookie, and forwards the request to the Worker with the JWT attached — and a thin client helper that just calls that route.

**Files:**
- Create: `app/api/proxy/[...path]/route.ts`
- Create: `lib/api.ts`

**Step 1: Write the proxy route**

`app/api/proxy/[...path]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';

const WORKER_URL = process.env.WORKER_URL ?? '';

async function proxyRequest(req: NextRequest, path: string[]) {
  // NextAuth v5 stores the JWT in a cookie named 'authjs.session-token'
  const sessionToken = req.cookies.get('authjs.session-token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workerPath = '/' + path.join('/');
  const workerUrl = `${WORKER_URL}${workerPath}`;

  const forwardHeaders = new Headers();
  forwardHeaders.set('Authorization', `Bearer ${sessionToken}`);

  const contentType = req.headers.get('content-type');
  if (contentType) forwardHeaders.set('Content-Type', contentType);

  const workerRes = await fetch(workerUrl, {
    method: req.method,
    headers: forwardHeaders,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    // @ts-expect-error duplex is required for streaming body in Node.js fetch
    duplex: 'half',
  });

  return new Response(workerRes.body, {
    status: workerRes.status,
    headers: workerRes.headers,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(req, path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(req, path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(req, path);
}
```

**Step 2: Write the client fetch wrapper**

`lib/api.ts`:
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

There's no client-side `getToken`/`accessToken` handling anywhere — components never see the JWT or the Worker URL, they just call `apiFetchClient('/vouchers', options)`.

**Step 3: Commit**

```bash
git add app/api/proxy lib/api.ts
git commit -m "feat: add api fetch wrapper with server-side jwt proxy"
```

---

### Task 12: Replace Supabase in SavedVouchers component

**Files:**
- Modify: `components/saved-vouchers.tsx`

**Step 1: Read the current file**

Read `components/saved-vouchers.tsx` and note all `supabase.*` calls.

**Step 2: Replace with apiFetchClient**

Replace Supabase fetch/delete calls with:
```ts
// Fetch:
const res = await apiFetchClient('/vouchers');
const data = await res.json();

// Delete:
await apiFetchClient(`/vouchers/${id}`, { method: 'DELETE' });
```

No session/token handling is needed here — the proxy route from Task 11 attaches the JWT server-side.

**Step 3: Remove supabase import**

Delete the `import { supabase } from '@/lib/supabase'` line.

**Step 4: Commit**

```bash
git add components/saved-vouchers.tsx
git commit -m "feat: replace supabase with worker api in saved-vouchers"
```

---

### Task 13: Replace Supabase in SavedComparisons component

**Files:**
- Modify: `components/saved-comparisons.tsx`

Same pattern as Task 12 — replace `supabase.*` calls with `apiFetchClient('/comparisons', ...)`.

**Commit:**

```bash
git add components/saved-comparisons.tsx
git commit -m "feat: replace supabase with worker api in saved-comparisons"
```

---

### Task 14: Replace Supabase in OptimizationResult component

**Files:**
- Modify: `components/optimization-result.tsx`

Replace the `supabase.from('vouchers').insert(...)` save call with:
```ts
await apiFetchClient('/vouchers', {
  method: 'POST',
  body: JSON.stringify(voucherData),
});
```

**Commit:**

```bash
git add components/optimization-result.tsx
git commit -m "feat: replace supabase with worker api in optimization-result"
```

---

### Task 15: Replace Supabase in PriceComparison component

**Files:**
- Modify: `components/price-comparison.tsx`

Replace the `supabase.from('saved_comparisons').insert(...)` save call with:
```ts
await apiFetchClient('/comparisons', {
  method: 'POST',
  body: JSON.stringify(comparisonData),
});
```

**Commit:**

```bash
git add components/price-comparison.tsx
git commit -m "feat: replace supabase with worker api in price-comparison"
```

---

### Task 16: Add product image fetch to VoucherForm

**Files:**
- Modify: `components/voucher-form.tsx`

**Step 1: Read the current voucher form**

Read `components/voucher-form.tsx` — note the product URL input field.

**Step 2: Add auto-fetch on URL blur/submit**

When the user finishes typing in the product URL field, call `POST /product/fetch` and pre-fill `product_name`, `product_price`, and `product_image` fields:

```ts
async function handleUrlBlur(url: string) {
  if (!url) return;
  setFetchingProduct(true);
  try {
    const res = await apiFetchClient('/product/fetch', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
    const data = await res.json<{ name: string | null; price: number | null; imageKey: string | null }>();
    if (data.name) form.setValue('product_name', data.name);
    if (data.price) form.setValue('product_price', data.price);
    if (data.imageKey) form.setValue('product_image', data.imageKey);
  } finally {
    setFetchingProduct(false);
  }
}
```

**Step 3: Add manual image upload input**

Below the product image field, add:
```tsx
<input
  type="file"
  accept="image/*"
  onChange={async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/proxy/images/upload', {
      method: 'POST',
      body: formData,
    });
    const { imageKey } = await res.json<{ imageKey: string }>();
    form.setValue('product_image', imageKey);
  }}
/>
```

This goes through the same `/api/proxy/*` route as `apiFetchClient` (called directly here since it's `FormData`, not JSON) — no token is handled in the browser.

**Step 4: Show image preview**

If `product_image` is set (an R2 key), render it via the proxy so the request carries auth and the raw Worker URL stays server-side:
```tsx
{productImage && (
  <img
    src={`/api/proxy/images/${productImage}`}
    alt="Product"
    className="w-24 h-24 object-cover rounded"
  />
)}
```

**Step 5: Commit**

```bash
git add components/voucher-form.tsx
git commit -m "feat: add product image auto-fetch and manual upload to voucher form"
```

---

### Task 17: Remove Supabase, deploy Worker

**Step 1: Remove Supabase package**

```bash
npm uninstall @supabase/supabase-js
```

**Step 2: Delete supabase files**

```bash
rm lib/supabase.ts
```

**Step 3: Run TypeScript check on Next.js**

```bash
npx tsc --noEmit
```
Fix any remaining type errors.

**Step 4: Apply schema to remote D1**

```bash
cd worker && npm run db:migrate:remote
```

**Step 5: Set Worker secrets**

```bash
wrangler secret put NEXTAUTH_SECRET
# Enter the same value as AUTH_SECRET in .env.local
```

**Step 6: Deploy Worker**

```bash
cd worker && npm run deploy
```
Copy the deployed Worker URL and update `NEXT_PUBLIC_WORKER_URL` in your hosting env vars.

**Step 7: Update CLAUDE.md**

Update `CLAUDE.md` to reflect the new architecture (Worker in `worker/`, new env vars, etc.)

**Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete cloudflare migration, remove supabase"
```
