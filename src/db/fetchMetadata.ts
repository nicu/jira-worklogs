import { query } from "./database";

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

export async function getFetchTimestamp(source: string): Promise<Date | null> {
  const rows = await query<{ last_fetched_at: string }>(
    `SELECT last_fetched_at FROM fetch_metadata WHERE source = '${esc(source)}'`,
  );

  if (rows.length === 0) {
    return null;
  }

  return new Date(rows[0].last_fetched_at);
}

export async function setFetchTimestamp(source: string, at = new Date()): Promise<void> {
  const timestamp = at.toISOString();
  await query(`
    INSERT INTO fetch_metadata(source, last_fetched_at) VALUES ('${esc(source)}', '${esc(timestamp)}')
    ON CONFLICT(source) DO UPDATE SET last_fetched_at = excluded.last_fetched_at
  `);
}
