# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Voucher Optima is a Next.js web app that calculates optimal purchase prices to maximize voucher/discount savings, with multi-store price comparison. The target market is Vietnamese users (currency: VND).

## Commands

```bash
# Next.js (project root)
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint check

# Cloudflare Worker (worker/)
cd worker
npm run dev                  # Local wrangler dev server
npm run deploy               # Deploy to Cloudflare
npm run db:migrate:local     # Apply schema to local D1
npm run db:migrate:remote    # Apply schema to remote D1
```

No test framework is configured.

## Environment Variables

Required in `.env.local` (Next.js root):
```
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
WORKER_URL=...                  # Server-side Worker URL (used by proxy)
NEXT_PUBLIC_WORKER_URL=...      # Client-visible Worker URL (if needed)
```

Worker secrets/bindings are configured via `worker/wrangler.toml` and `wrangler secret put`.

## Architecture

### Tech Stack
- **Next.js 16 App Router** with React 19 (client-heavy — most components are `"use client"`)
- **Tailwind CSS v4** (PostCSS plugin approach, not config file)
- **shadcn/ui** (New York style) — components live in `components/ui/`
- **NextAuth v5** (Auth.js beta) for Google OAuth authentication
- **Cloudflare Worker** (Hono framework) as the API backend
- **Cloudflare D1** (SQLite) for persistence
- **Cloudflare R2** for image storage
- **React Hook Form + Zod** for form validation
- **No state management library** — local `useState` with prop drilling

### Key Business Logic (`lib/utils.ts`)
All core calculations live here:
- `calculateOptimalRange()` — given voucher terms (percentage, min spend, max discount cap), computes the minimum spend to hit the discount cap, and generates recommendations
- `comparePrices()` — applies a voucher to multiple store prices and sorts by final price
- `formatVND()` — Vietnamese Dong formatting

### Data Flow
1. User fills `VoucherForm` → calls `calculateOptimalRange()` → result passed up to `page.tsx` via callback → passed down to `OptimizationResultDisplay`
2. User fills `PriceComparison` → calls `comparePrices()` → results displayed inline
3. Save buttons in `OptimizationResultDisplay` and `PriceComparison` call `apiFetchClient()` from `lib/api.ts`, which routes through the Next.js proxy to the Cloudflare Worker
4. `SavedVouchers` and `SavedComparisons` fetch data from the Worker via the same proxy

### API Proxy (`app/api/proxy/[...path]/route.ts`)
All client API requests go through this Next.js route handler. It:
- Reads the NextAuth session server-side and attaches the JWT as `Authorization: Bearer <token>`
- Forwards the request to `WORKER_URL` (environment variable)
- Streams the Worker response back to the client

Client code uses `apiFetchClient(path, options)` from `lib/api.ts`, which prepends `/api/proxy` to the path.

### Cloudflare Worker (`worker/`)
Built with **Hono** framework. Entry point: `worker/src/index.ts`.

Routes:
- `POST /auth/verify` — verifies NextAuth JWT and returns user info
- `GET/POST /vouchers` — list and create vouchers
- `GET/PUT/DELETE /vouchers/:id` — single voucher CRUD
- `GET/POST /comparisons` — list and create comparisons
- `GET/PUT/DELETE /comparisons/:id` — single comparison CRUD
- `POST /product/fetch` — scrape product info (Shopee + OG fallback)
- `POST /images/upload` — upload image to R2
- `GET /images/:key` — serve image from R2

Bindings (configured in `wrangler.toml`):
- `DB` — D1 database (SQLite)
- `R2` — R2 bucket for images

### Auth Flow
NextAuth (`app/api/auth/[...nextauth]/`) handles Google OAuth. On login, a JWT session is created. The Next.js proxy reads this session and forwards the token to the Worker, which verifies it and identifies the user for all DB operations.

### Database Schema (`worker/schema.sql` and `supabase_schema.sql` for reference)
Two tables:
- **vouchers** — stores voucher parameters plus optional product context (name, price, image, URL)
- **saved_comparisons** — stores comparison results

Rows are scoped per user via the `user_id` column (derived from the NextAuth JWT).

### Component Map
| Component | Purpose |
|---|---|
| `app/page.tsx` | Root page; orchestrates layout and state |
| `components/voucher-form.tsx` | Main input form (voucher terms + optional product) |
| `components/optimization-result.tsx` | Displays calculation output; handles save via Worker API |
| `components/price-comparison.tsx` | Multi-store comparison form and results |
| `components/saved-vouchers.tsx` | Fetches and lists saved vouchers from Worker API |
| `components/saved-comparisons.tsx` | Fetches and lists saved comparisons from Worker API |
| `components/ui/money-input.tsx` | Custom input with VND formatting |

### Key Library Files (`lib/`)
| File | Purpose |
|---|---|
| `lib/utils.ts` | Core voucher/comparison calculation logic |
| `lib/api.ts` | `apiFetchClient()` — routes all API calls through `/api/proxy` |
| `lib/auth.ts` | NextAuth config (Google provider) |

### Path Aliases
`@/*` maps to the project root (e.g., `@/lib/utils`, `@/components/ui/button`).
