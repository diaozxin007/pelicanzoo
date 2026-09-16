-- The intake book. One row per pelican somebody has handed over the fence.
--
-- This is the source of truth for fed specimens; submissions/*.svg and the fed
-- half of data/scores.json are exported from here by `npm run sync` so the
-- static build keeps reading files and stays offline and reproducible.
--
-- The column is fed_by rather than by because BY is a SQLite keyword and a
-- quoted column name is a thing every query has to remember to quote.
CREATE TABLE IF NOT EXISTS feed (
  id             TEXT PRIMARY KEY,
  model          TEXT NOT NULL,
  fed_by         TEXT,
  note           TEXT,
  -- Sanitised at intake, by the same src/lib/sanitize-svg.js the browser and CI
  -- use. Nothing unsanitised is ever stored.
  svg            TEXT NOT NULL,
  -- sha256 of the sanitised svg. Same principle as the worker's roast cache:
  -- the same bytes get the same verdict, so a resubmission is not a re-roll.
  fingerprint    TEXT NOT NULL,
  observed       TEXT NOT NULL,
  -- pending -> the keeper has not looked at it yet. Nothing public is ever
  -- pending; only 'live' rows are exported into the repo.
  status         TEXT NOT NULL DEFAULT 'pending',
  score          INTEGER,
  review         TEXT,
  critic         TEXT,
  critic_version INTEGER,
  assessed       TEXT,
  -- The feeder's only key to their own row. Unguessable, so the receipt page
  -- needs no account and no login.
  token          TEXT NOT NULL,
  -- sha256(ip), truncated. Kept to count submissions per day, not to identify
  -- anyone; the address itself is never written down.
  ip_hash        TEXT,
  created_at     TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS feed_fingerprint ON feed(fingerprint);
CREATE UNIQUE INDEX IF NOT EXISTS feed_token       ON feed(token);
CREATE        INDEX IF NOT EXISTS feed_status      ON feed(status, created_at);
CREATE        INDEX IF NOT EXISTS feed_ip          ON feed(ip_hash, created_at);
