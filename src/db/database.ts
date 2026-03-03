import { cpSync, existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { environment } from "@raycast/api";
import initSqlJs from "sql.js";

const DB_FILENAME = "database.db";
const WASM_FILENAME = "sql-wasm.wasm";

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
  return new SQL.Database(readFileSync(dbPath));
}

export async function query<T = unknown>(sql: string): Promise<T[]> {
  const db = await openDb();
  try {
    const [result] = db.exec(sql);
    if (db.getRowsModified() > 0) {
      await writeFile(dbPath, Buffer.from(db.export()));
    }
    if (!result) return [];
    return result.values.map((row) => Object.fromEntries(result.columns.map((col, i) => [col, row[i]])) as T);
  } finally {
    db.close();
  }
}
