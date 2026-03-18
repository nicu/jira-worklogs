import { query } from "./database";

export type TimerRow = {
  id: number;
  task_id: string;
  issue_key: string | null;
  issue_summary: string | null;
  issuetype_icon_url: string | null;
  started_at_utc: string;
  ended_at_utc: string | null;
  local_day: string;
  type: string;
  adjustment_reason: string | null;
  duration_seconds: number | null;
  sync_status: string;
  remote_id: string | null;
};

export async function getActiveTimer(): Promise<TimerRow | null> {
  const rows = await query<TimerRow>(`
    SELECT
      t.id, t.task_id,
      i.key AS issue_key, i.summary AS issue_summary, i.issuetype_icon_url,
      t.started_at_utc, t.ended_at_utc, t.local_day, t.type, t.adjustment_reason,
      t.duration_seconds, t.sync_status, t.remote_id
    FROM timers t
    LEFT JOIN issues i ON i.id = t.task_id
    WHERE t.ended_at_utc IS NULL
    ORDER BY t.started_at_utc DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function getTodayTimers(localDay: string): Promise<TimerRow[]> {
  return query<TimerRow>(`
    SELECT
      MIN(t.id) AS id,
      t.task_id,
      i.key AS issue_key, i.summary AS issue_summary, i.issuetype_icon_url,
      MIN(t.started_at_utc) AS started_at_utc,
      MAX(t.ended_at_utc)   AS ended_at_utc,
      t.local_day, t.type,
      NULL AS adjustment_reason,
      SUM(t.duration_seconds) AS duration_seconds,
      t.sync_status, NULL AS remote_id
    FROM timers t
    LEFT JOIN issues i ON i.id = t.task_id
    WHERE t.local_day = '${localDay}'
    GROUP BY t.task_id
    ORDER BY MIN(t.started_at_utc) DESC
  `);
}

export function sumSeconds(timers: TimerRow[]): number {
  return timers.reduce((acc, t) => acc + (t.duration_seconds ?? 0), 0);
}

export function getLocalDay(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Stop the currently active timer (if any) by setting ended_at_utc to now. */
export async function stopActiveTimer(): Promise<void> {
  const now = new Date().toISOString();
  await query(`
    UPDATE timers
    SET ended_at_utc = '${now}', updated_at_utc = '${now}'
    WHERE ended_at_utc IS NULL
  `);
}

/** Start a new timer for the given task. Stops any currently active timer first.
 *  If the same task is already the active timer, does nothing (idempotent). */
export async function startTimer(taskId: string): Promise<void> {
  const alreadyActive = await query<{ id: number }>(
    `SELECT id FROM timers WHERE ended_at_utc IS NULL AND task_id = '${taskId}' LIMIT 1`,
  );
  if (alreadyActive.length > 0) return;

  await stopActiveTimer();
  const now = new Date();
  const startedAt = now.toISOString();
  const localDay = getLocalDay(now);
  const tzOffsetMin = -now.getTimezoneOffset();
  await query(`
    INSERT INTO timers (task_id, started_at_utc, tz_offset_min, local_day, type, sync_status)
    VALUES ('${taskId}', '${startedAt}', ${tzOffsetMin}, '${localDay}', 'normal', 'none')
  `);
}
