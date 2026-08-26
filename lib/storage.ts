import { apiFetchClient } from "./api.ts";

export type SavedVoucher = {
  id: string;
  created_at: string;
  percentage: number;
  min_condition: number;
  max_discount: number;
  code: string | null;
  product_name: string | null;
  product_price: number | null;
  product_url: string | null;
  product_image: string | null;
};

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type FetchClient = (path: string, options?: RequestInit) => Promise<Response>;

export interface StorageDeps {
  store: KeyValueStore;
  fetchClient?: FetchClient;
}

export type NewVoucherInput = Omit<SavedVoucher, "id" | "created_at">;

export type StoreEntry = {
  storeName: string;
  basePrice: number;
  url?: string;
  finalPrice: number;
  discountAmount: number;
  voucher?: unknown;
};

export type ComparisonData = {
  title: string;
  stores: StoreEntry[];
};

export type SavedComparison = {
  id: string;
  created_at: string;
  data: ComparisonData;
};

const VOUCHERS_KEY = "voucher-optima:vouchers";
const COMPARISONS_KEY = "voucher-optima:comparisons";

// Real browser wiring — thin glue with no logic of its own, so it sits outside the
// tested contract above (tests inject their own store/fetchClient instead). `store` is a
// getter so `window.localStorage` is only touched when actually used, not at import time
// (this module can be imported during SSR, where `window` doesn't exist).
const defaultDeps: StorageDeps = {
  get store() {
    if (typeof window === "undefined") {
      throw new Error("Local storage is only available in the browser");
    }
    return window.localStorage;
  },
  fetchClient: apiFetchClient,
};

function readLocal<T>(key: string, store: KeyValueStore): T[] {
  const raw = store.getItem(key);
  return raw ? (JSON.parse(raw) as T[]) : [];
}

function writeLocal<T>(key: string, items: T[], store: KeyValueStore): void {
  store.setItem(key, JSON.stringify(items));
}

export async function listVouchers(
  isAuthed: boolean,
  deps: StorageDeps = defaultDeps
): Promise<SavedVoucher[]> {
  if (!isAuthed) return readLocal<SavedVoucher>(VOUCHERS_KEY, deps.store);
  const res = await deps.fetchClient!("/vouchers");
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
}

export async function saveVoucher(
  isAuthed: boolean,
  input: NewVoucherInput,
  deps: StorageDeps = defaultDeps
): Promise<void> {
  if (isAuthed) {
    const res = await deps.fetchClient!("/vouchers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Failed to save: ${res.status}`);
    return;
  }
  const items = readLocal<SavedVoucher>(VOUCHERS_KEY, deps.store);
  items.unshift({
    ...input,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  });
  writeLocal(VOUCHERS_KEY, items, deps.store);
}

export async function deleteVoucher(
  isAuthed: boolean,
  id: string,
  deps: StorageDeps = defaultDeps
): Promise<void> {
  if (isAuthed) {
    const res = await deps.fetchClient!(`/vouchers/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
    return;
  }
  const items = readLocal<SavedVoucher>(VOUCHERS_KEY, deps.store);
  writeLocal(
    VOUCHERS_KEY,
    items.filter((v) => v.id !== id),
    deps.store
  );
}

export async function listComparisons(
  isAuthed: boolean,
  deps: StorageDeps = defaultDeps
): Promise<SavedComparison[]> {
  if (!isAuthed) return readLocal<SavedComparison>(COMPARISONS_KEY, deps.store);
  const res = await deps.fetchClient!("/comparisons");
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
}

export async function saveComparison(
  isAuthed: boolean,
  data: ComparisonData,
  deps: StorageDeps = defaultDeps
): Promise<void> {
  if (isAuthed) {
    const res = await deps.fetchClient!("/comparisons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to save: ${res.status}`);
    return;
  }
  const items = readLocal<SavedComparison>(COMPARISONS_KEY, deps.store);
  items.unshift({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    data,
  });
  writeLocal(COMPARISONS_KEY, items, deps.store);
}

export async function deleteComparison(
  isAuthed: boolean,
  id: string,
  deps: StorageDeps = defaultDeps
): Promise<void> {
  if (isAuthed) {
    const res = await deps.fetchClient!(`/comparisons/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
    return;
  }
  const items = readLocal<SavedComparison>(COMPARISONS_KEY, deps.store);
  writeLocal(
    COMPARISONS_KEY,
    items.filter((c) => c.id !== id),
    deps.store
  );
}

const MIGRATION_FLAG_KEY = "voucher-optima:migrated";

export async function migrateLocalDataToAccount(deps: StorageDeps = defaultDeps): Promise<void> {
  if (deps.store.getItem(MIGRATION_FLAG_KEY) === "1") return;

  const localVouchers = readLocal<SavedVoucher>(VOUCHERS_KEY, deps.store);
  const localComparisons = readLocal<SavedComparison>(COMPARISONS_KEY, deps.store);

  try {
    for (const v of localVouchers) {
      await saveVoucher(
        true,
        {
          percentage: v.percentage,
          min_condition: v.min_condition,
          max_discount: v.max_discount,
          code: v.code,
          product_name: v.product_name,
          product_price: v.product_price,
          product_url: v.product_url,
          product_image: v.product_image,
        },
        deps
      );
    }
    for (const { data } of localComparisons) {
      await saveComparison(true, data, deps);
    }
  } catch {
    // Leave local data in place — migration will retry on next sign-in rather than
    // silently losing anything that failed to upload.
    return;
  }

  writeLocal<SavedVoucher>(VOUCHERS_KEY, [], deps.store);
  writeLocal<SavedComparison>(COMPARISONS_KEY, [], deps.store);
  deps.store.setItem(MIGRATION_FLAG_KEY, "1");
}
