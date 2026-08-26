import assert from "node:assert/strict";
import {
  listVouchers,
  saveVoucher,
  deleteVoucher,
  listComparisons,
  saveComparison,
  deleteComparison,
  migrateLocalDataToAccount,
} from "./storage.ts";

function createMemoryStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

function createFakeFetchClient(responder) {
  const calls = [];
  const fetchClient = async (path, options) => {
    calls.push({ path, options });
    return responder(path, options);
  };
  fetchClient.calls = calls;
  return fetchClient;
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test("listVouchers(false) returns [] from an empty local store", async () => {
  const store = createMemoryStore();
  const result = await listVouchers(false, { store });
  assert.deepEqual(result, []);
});

test("saveVoucher(false) assigns id/created_at and the voucher appears via listVouchers", async () => {
  const store = createMemoryStore();
  const input = {
    percentage: 10,
    min_condition: 100000,
    max_discount: 50000,
    code: "TEST10",
    product_name: null,
    product_price: null,
    product_url: null,
    product_image: null,
  };

  await saveVoucher(false, input, { store });
  const result = await listVouchers(false, { store });

  assert.equal(result.length, 1);
  assert.equal(typeof result[0].id, "string");
  assert.ok(result[0].id.length > 0);
  assert.equal(typeof result[0].created_at, "string");
  assert.equal(result[0].percentage, 10);
  assert.equal(result[0].code, "TEST10");
});

test("saveVoucher(false) orders vouchers newest-first", async () => {
  const store = createMemoryStore();
  const base = {
    percentage: 10,
    min_condition: 0,
    max_discount: 0,
    product_name: null,
    product_price: null,
    product_url: null,
    product_image: null,
  };

  await saveVoucher(false, { ...base, code: "FIRST" }, { store });
  await saveVoucher(false, { ...base, code: "SECOND" }, { store });

  const result = await listVouchers(false, { store });
  assert.deepEqual(result.map((v) => v.code), ["SECOND", "FIRST"]);
});

test("deleteVoucher(false) removes only the targeted voucher", async () => {
  const store = createMemoryStore();
  const base = {
    percentage: 10,
    min_condition: 0,
    max_discount: 0,
    product_name: null,
    product_price: null,
    product_url: null,
    product_image: null,
  };
  await saveVoucher(false, { ...base, code: "KEEP" }, { store });
  await saveVoucher(false, { ...base, code: "REMOVE" }, { store });

  const before = await listVouchers(false, { store });
  const toRemove = before.find((v) => v.code === "REMOVE");

  await deleteVoucher(false, toRemove.id, { store });

  const after = await listVouchers(false, { store });
  assert.deepEqual(after.map((v) => v.code), ["KEEP"]);
});

test("listVouchers(true) fetches /vouchers and returns the parsed JSON", async () => {
  const remoteVouchers = [{ id: "1", code: "REMOTE" }];
  const fetchClient = createFakeFetchClient(async () => Response.json(remoteVouchers));

  const result = await listVouchers(true, { store: createMemoryStore(), fetchClient });

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(fetchClient.calls[0].path, "/vouchers");
  assert.deepEqual(result, remoteVouchers);
});

test("listVouchers(true) throws when the response is not ok", async () => {
  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 401 }));

  await assert.rejects(
    () => listVouchers(true, { store: createMemoryStore(), fetchClient }),
    /401/
  );
});

test("saveVoucher(true) POSTs the input as JSON to /vouchers", async () => {
  const input = {
    percentage: 15,
    min_condition: 200000,
    max_discount: 80000,
    code: "REMOTE15",
    product_name: null,
    product_price: null,
    product_url: null,
    product_image: null,
  };
  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 201 }));

  await saveVoucher(true, input, { store: createMemoryStore(), fetchClient });

  assert.equal(fetchClient.calls.length, 1);
  const call = fetchClient.calls[0];
  assert.equal(call.path, "/vouchers");
  assert.equal(call.options.method, "POST");
  assert.deepEqual(JSON.parse(call.options.body), input);
});

test("saveVoucher(true) throws when the response is not ok", async () => {
  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 500 }));

  await assert.rejects(
    () => saveVoucher(true, {}, { store: createMemoryStore(), fetchClient }),
    /500/
  );
});

test("deleteVoucher(true) sends DELETE to /vouchers/:id", async () => {
  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 200 }));

  await deleteVoucher(true, "abc-123", { store: createMemoryStore(), fetchClient });

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(fetchClient.calls[0].path, "/vouchers/abc-123");
  assert.equal(fetchClient.calls[0].options.method, "DELETE");
});

test("deleteVoucher(true) throws when the response is not ok", async () => {
  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 404 }));

  await assert.rejects(
    () => deleteVoucher(true, "abc-123", { store: createMemoryStore(), fetchClient }),
    /404/
  );
});

test("listComparisons(false) returns [] from an empty local store", async () => {
  const result = await listComparisons(false, { store: createMemoryStore() });
  assert.deepEqual(result, []);
});

test("saveComparison(false) assigns id/created_at and appears via listComparisons", async () => {
  const store = createMemoryStore();
  const data = { title: "My Comparison", stores: [] };

  await saveComparison(false, data, { store });
  const result = await listComparisons(false, { store });

  assert.equal(result.length, 1);
  assert.equal(typeof result[0].id, "string");
  assert.ok(result[0].id.length > 0);
  assert.equal(typeof result[0].created_at, "string");
  assert.deepEqual(result[0].data, data);
});

test("deleteComparison(false) removes only the targeted comparison", async () => {
  const store = createMemoryStore();
  await saveComparison(false, { title: "Keep", stores: [] }, { store });
  await saveComparison(false, { title: "Remove", stores: [] }, { store });

  const before = await listComparisons(false, { store });
  const toRemove = before.find((c) => c.data.title === "Remove");

  await deleteComparison(false, toRemove.id, { store });

  const after = await listComparisons(false, { store });
  assert.deepEqual(after.map((c) => c.data.title), ["Keep"]);
});

test("listComparisons(true) fetches /comparisons and returns the parsed JSON", async () => {
  const remote = [{ id: "1", data: { title: "Remote", stores: [] } }];
  const fetchClient = createFakeFetchClient(async () => Response.json(remote));

  const result = await listComparisons(true, { store: createMemoryStore(), fetchClient });

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(fetchClient.calls[0].path, "/comparisons");
  assert.deepEqual(result, remote);
});

test("listComparisons(true) throws when the response is not ok", async () => {
  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 401 }));

  await assert.rejects(
    () => listComparisons(true, { store: createMemoryStore(), fetchClient }),
    /401/
  );
});

test("saveComparison(true) POSTs the data as JSON to /comparisons", async () => {
  const data = { title: "Remote Save", stores: [] };
  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 201 }));

  await saveComparison(true, data, { store: createMemoryStore(), fetchClient });

  assert.equal(fetchClient.calls.length, 1);
  const call = fetchClient.calls[0];
  assert.equal(call.path, "/comparisons");
  assert.equal(call.options.method, "POST");
  assert.deepEqual(JSON.parse(call.options.body), data);
});

test("saveComparison(true) throws when the response is not ok", async () => {
  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 500 }));

  await assert.rejects(
    () => saveComparison(true, { title: "x", stores: [] }, { store: createMemoryStore(), fetchClient }),
    /500/
  );
});

test("deleteComparison(true) sends DELETE to /comparisons/:id", async () => {
  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 200 }));

  await deleteComparison(true, "cmp-1", { store: createMemoryStore(), fetchClient });

  assert.equal(fetchClient.calls.length, 1);
  assert.equal(fetchClient.calls[0].path, "/comparisons/cmp-1");
  assert.equal(fetchClient.calls[0].options.method, "DELETE");
});

test("deleteComparison(true) throws when the response is not ok", async () => {
  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 404 }));

  await assert.rejects(
    () => deleteComparison(true, "cmp-1", { store: createMemoryStore(), fetchClient }),
    /404/
  );
});

test("migrateLocalDataToAccount() with no local data sets the flag and makes no network calls", async () => {
  const store = createMemoryStore();
  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 201 }));

  await migrateLocalDataToAccount({ store, fetchClient });

  assert.equal(fetchClient.calls.length, 0);
  assert.equal(store.getItem("voucher-optima:migrated"), "1");
});

test("migrateLocalDataToAccount() uploads local vouchers and clears them", async () => {
  const store = createMemoryStore();
  const base = {
    percentage: 10,
    min_condition: 0,
    max_discount: 0,
    product_name: null,
    product_price: null,
    product_url: null,
    product_image: null,
  };
  await saveVoucher(false, { ...base, code: "A" }, { store });
  await saveVoucher(false, { ...base, code: "B" }, { store });

  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 201 }));
  await migrateLocalDataToAccount({ store, fetchClient });

  const voucherPosts = fetchClient.calls.filter((c) => c.path === "/vouchers");
  assert.equal(voucherPosts.length, 2);
  const uploadedCodes = voucherPosts.map((c) => JSON.parse(c.options.body).code).sort();
  assert.deepEqual(uploadedCodes, ["A", "B"]);

  const remaining = await listVouchers(false, { store });
  assert.deepEqual(remaining, []);
  assert.equal(store.getItem("voucher-optima:migrated"), "1");
});

test("migrateLocalDataToAccount() uploads local comparisons and clears them", async () => {
  const store = createMemoryStore();
  await saveComparison(false, { title: "Local Comparison", stores: [] }, { store });

  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 201 }));
  await migrateLocalDataToAccount({ store, fetchClient });

  const comparisonPosts = fetchClient.calls.filter((c) => c.path === "/comparisons");
  assert.equal(comparisonPosts.length, 1);
  assert.deepEqual(JSON.parse(comparisonPosts[0].options.body), {
    title: "Local Comparison",
    stores: [],
  });

  const remaining = await listComparisons(false, { store });
  assert.deepEqual(remaining, []);
});

test("migrateLocalDataToAccount() is a no-op once already migrated", async () => {
  const store = createMemoryStore();
  store.setItem("voucher-optima:migrated", "1");
  await saveVoucher(false, {
    percentage: 10,
    min_condition: 0,
    max_discount: 0,
    code: "STILL-LOCAL",
    product_name: null,
    product_price: null,
    product_url: null,
    product_image: null,
  }, { store });

  const fetchClient = createFakeFetchClient(async () => new Response(null, { status: 201 }));
  await migrateLocalDataToAccount({ store, fetchClient });

  assert.equal(fetchClient.calls.length, 0);
  const remaining = await listVouchers(false, { store });
  assert.equal(remaining.length, 1);
});

test("migrateLocalDataToAccount() leaves local data intact and flag unset when an upload fails", async () => {
  const store = createMemoryStore();
  const base = {
    percentage: 10,
    min_condition: 0,
    max_discount: 0,
    product_name: null,
    product_price: null,
    product_url: null,
    product_image: null,
  };
  await saveVoucher(false, { ...base, code: "A" }, { store });
  await saveVoucher(false, { ...base, code: "B" }, { store });

  let callCount = 0;
  const fetchClient = createFakeFetchClient(async () => {
    callCount++;
    return new Response(null, { status: callCount === 1 ? 201 : 500 });
  });

  // Deliberately does not throw: saved-vouchers.tsx/saved-comparisons.tsx call this
  // inline before listing, and a throw would surface as a scary "failed to load" error
  // for what should be a silent retry-next-login.
  await migrateLocalDataToAccount({ store, fetchClient });

  const remaining = await listVouchers(false, { store });
  assert.equal(remaining.length, 2);
  assert.notEqual(store.getItem("voucher-optima:migrated"), "1");
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`PASS — ${name}`);
  } catch (err) {
    failures++;
    console.log(`FAIL — ${name}`);
    console.log(`  ${err.message}`);
  }
}
console.log(failures === 0 ? `\nALL ${tests.length} TESTS PASSED` : `\n${failures}/${tests.length} FAILED`);
process.exit(failures === 0 ? 0 : 1);
