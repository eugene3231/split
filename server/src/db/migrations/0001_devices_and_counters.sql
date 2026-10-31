CREATE TABLE devices (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  last_seen_day TEXT NOT NULL
);

CREATE TABLE daily_counters (
  day TEXT NOT NULL,
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (day, bucket, key)
);
