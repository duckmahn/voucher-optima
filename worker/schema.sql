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
