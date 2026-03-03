import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, "../assets");
const DB_PATH = resolve(ASSETS_DIR, "database.db");

if (!existsSync(ASSETS_DIR)) mkdirSync(ASSETS_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    source TEXT NOT NULL,

    summary TEXT NOT NULL,
    status_name TEXT NOT NULL,
    status_category_key TEXT NOT NULL,

    issuetype_icon_url TEXT NOT NULL,

    priority_name TEXT,
    priority_icon_url TEXT,

    assignee_display_name TEXT,
    assignee_avatar_url TEXT
  );

  CREATE TABLE IF NOT EXISTS timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,

    started_at_utc TEXT NOT NULL,
    ended_at_utc TEXT,

    tz_offset_min INTEGER NOT NULL,
    local_day TEXT NOT NULL,

    type TEXT NOT NULL DEFAULT 'normal',
    adjustment_reason TEXT,

    duration_seconds INTEGER GENERATED ALWAYS AS (
      CASE
        WHEN ended_at_utc IS NOT NULL
        THEN strftime('%s', ended_at_utc) - strftime('%s', started_at_utc)
        ELSE NULL
      END
    ) VIRTUAL,

    version INTEGER DEFAULT 1,

    sync_status TEXT NOT NULL DEFAULT 'none',
    remote_id TEXT,
    remote_source TEXT,
    remote_duration_seconds INTEGER,
    remote_updated_at_utc TEXT,

    conflict_reason TEXT,

    created_at_utc TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at_utc TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

    FOREIGN KEY (task_id) REFERENCES issues(id)
  );

  CREATE INDEX IF NOT EXISTS idx_day ON timers(local_day);
  CREATE INDEX IF NOT EXISTS idx_running ON timers(ended_at_utc) WHERE ended_at_utc IS NULL;
  CREATE INDEX IF NOT EXISTS idx_sync ON timers(sync_status);

  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timer_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at_utc TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (timer_id) REFERENCES timers(id)
  );

  CREATE TABLE IF NOT EXISTS fetch_metadata (
    source TEXT PRIMARY KEY,
    last_fetched_at TEXT NOT NULL
  );
`);

db.close();

console.log(`Database written to ${DB_PATH}`);
