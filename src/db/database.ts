import { cpSync, existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { environment } from "@raycast/api";
import initSqlJs, { type Database } from "sql.js";

const DB_FILENAME = "database.db";
const WASM_FILENAME = "sql-wasm.wasm";
let schemaChecked = false;

export const dbPath = join(environment.supportPath, DB_FILENAME);
const wasmPath = join(environment.supportPath, WASM_FILENAME);

function ensureFiles() {
  if (!existsSync(dbPath)) {
    cpSync(join(environment.assetsPath, DB_FILENAME), dbPath);
  }
  if (!existsSync(wasmPath)) {
    cpSync(join(environment.assetsPath, WASM_FILENAME), wasmPath);
  }
}

ensureFiles();

async function openDb() {
  const wasm = readFileSync(wasmPath);
  const SQL = await initSqlJs({
    wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer,
  });
  const db = new SQL.Database(readFileSync(dbPath));
  const didMigrate = schemaChecked ? false : ensureSchema(db);
  schemaChecked = true;
  return { db, didMigrate };
}

export async function query<T = unknown>(sql: string): Promise<T[]> {
  const { db, didMigrate } = await openDb();
  try {
    const [result] = db.exec(sql);
    if (didMigrate || db.getRowsModified() > 0) {
      await writeFile(dbPath, Buffer.from(db.export()));
    }
    if (!result) return [];
    return result.values.map((row) => Object.fromEntries(result.columns.map((col, i) => [col, row[i]])) as T);
  } finally {
    db.close();
  }
}

function ensureSchema(db: Database): boolean {
  let changed = false;

  if (!hasTable(db, "issues")) {
    db.run(`
      CREATE TABLE issues (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        self TEXT NOT NULL,
        source TEXT NOT NULL,
        summary TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status_id TEXT NOT NULL,
        status_name TEXT NOT NULL,
        status_category_id INTEGER NOT NULL,
        status_category_key TEXT NOT NULL,
        status_category_name TEXT NOT NULL,
        issuetype_id TEXT NOT NULL,
        issuetype_name TEXT NOT NULL,
        issuetype_icon_url TEXT NOT NULL,
        project_id TEXT NOT NULL,
        project_key TEXT NOT NULL,
        project_name TEXT NOT NULL,
        priority_id TEXT,
        priority_name TEXT,
        priority_icon_url TEXT,
        assignee_account_id TEXT,
        assignee_display_name TEXT,
        assignee_avatar_url TEXT
      )
    `);
    changed = true;
  }

  const issueColumns = getColumnNames(db, "issues");
  changed = ensureColumn(db, "issues", issueColumns, "self", "TEXT NOT NULL DEFAULT ''") || changed;
  changed = ensureColumn(db, "issues", issueColumns, "updated_at", "TEXT NOT NULL DEFAULT ''") || changed;
  changed = ensureColumn(db, "issues", issueColumns, "created_at", "TEXT NOT NULL DEFAULT ''") || changed;
  changed = ensureColumn(db, "issues", issueColumns, "status_id", "TEXT NOT NULL DEFAULT ''") || changed;
  changed = ensureColumn(db, "issues", issueColumns, "status_category_id", "INTEGER NOT NULL DEFAULT 0") || changed;
  changed = ensureColumn(db, "issues", issueColumns, "status_category_name", "TEXT NOT NULL DEFAULT ''") || changed;
  changed = ensureColumn(db, "issues", issueColumns, "issuetype_id", "TEXT NOT NULL DEFAULT ''") || changed;
  changed = ensureColumn(db, "issues", issueColumns, "issuetype_name", "TEXT NOT NULL DEFAULT ''") || changed;
  changed = ensureColumn(db, "issues", issueColumns, "project_id", "TEXT NOT NULL DEFAULT ''") || changed;
  changed = ensureColumn(db, "issues", issueColumns, "project_key", "TEXT NOT NULL DEFAULT ''") || changed;
  changed = ensureColumn(db, "issues", issueColumns, "project_name", "TEXT NOT NULL DEFAULT ''") || changed;
  changed = ensureColumn(db, "issues", issueColumns, "priority_id", "TEXT") || changed;
  changed = ensureColumn(db, "issues", issueColumns, "assignee_account_id", "TEXT") || changed;

  if (!hasTable(db, "timers")) {
    db.run(`
      CREATE TABLE timers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        issue_key TEXT,
        issue_summary TEXT,
        issuetype_icon_url TEXT,
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
        updated_at_utc TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )
    `);
    changed = true;
  }

  const timerColumns = getColumnNames(db, "timers");
  changed = ensureColumn(db, "timers", timerColumns, "issue_key", "TEXT") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "issue_summary", "TEXT") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "issuetype_icon_url", "TEXT") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "type", "TEXT NOT NULL DEFAULT 'normal'") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "adjustment_reason", "TEXT") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "version", "INTEGER DEFAULT 1") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "sync_status", "TEXT NOT NULL DEFAULT 'none'") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "remote_id", "TEXT") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "remote_source", "TEXT") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "remote_duration_seconds", "INTEGER") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "remote_updated_at_utc", "TEXT") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "conflict_reason", "TEXT") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "created_at_utc", "TEXT") || changed;
  changed = ensureColumn(db, "timers", timerColumns, "updated_at_utc", "TEXT") || changed;

  if (!hasTable(db, "fetch_metadata")) {
    db.run(`
      CREATE TABLE fetch_metadata (
        source TEXT PRIMARY KEY,
        last_fetched_at TEXT NOT NULL
      )
    `);
    changed = true;
  }

  if (!hasTable(db, "sync_queue")) {
    db.run(`
      CREATE TABLE sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timer_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_error TEXT,
        created_at_utc TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )
    `);
    changed = true;
  }

  if (!hasTable(db, "tasks")) {
    db.run(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT,
        created_at_utc TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )
    `);
    changed = true;
  }

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_day ON timers(local_day);
    CREATE INDEX IF NOT EXISTS idx_running ON timers(ended_at_utc) WHERE ended_at_utc IS NULL;
    CREATE INDEX IF NOT EXISTS idx_sync ON timers(sync_status);
  `);

  return changed;
}

function hasTable(db: Database, tableName: string): boolean {
  return db.exec(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${tableName}'`).length > 0;
}

function getColumnNames(db: Database, tableName: string): Set<string> {
  const [result] = db.exec(`PRAGMA table_info(${tableName})`);
  if (!result) {
    return new Set();
  }

  const nameIndex = result.columns.indexOf("name");
  return new Set(result.values.map((row) => String(row[nameIndex])));
}

function ensureColumn(db: Database, tableName: string, columns: Set<string>, columnName: string, definition: string): boolean {
  if (columns.has(columnName)) {
    return false;
  }

  db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  columns.add(columnName);
  return true;
}
