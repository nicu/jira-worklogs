import { query } from "./database";

export type TimerRow = {
  id: number;
  task_id: string;
  issue_key: string | null;
  issue_summary: string | null;
  issuetype_icon_url: string | null;
  started_at_utc: string;
  ended_at_utc: string | null;
  tz_offset_min: number;
  local_day: string;
  type: string;
  adjustment_reason: string | null;
  duration_seconds: number | null;
  sync_status: string;
  remote_id: string | null;
  remote_source: string | null;
  remote_duration_seconds: number | null;
  remote_updated_at_utc: string | null;
};

export type WorklogRow = {
  id: number;
  task_id: string;
  issue_key: string | null;
  issue_summary: string | null;
  issuetype_icon_url: string | null;
  started_at_utc: string;
  ended_at_utc: string | null;
  local_day: string;
  unsynced_local_duration_seconds: number;
  synced_local_duration_seconds: number;
  remote_duration_seconds: number;
  total_duration_seconds: number;
  is_synced: number;
};

export type RemoteTimerInput = {
  taskId: string;
  issueKey: string;
  issueSummary: string;
  issuetypeIconUrl: string;
  startedAtUtc: string;
  endedAtUtc: string;
  remoteId: string;
  remoteUpdatedAtUtc: string;
  remoteDurationSeconds: number;
};

export type SyncableTimerRow = TimerRow;

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

function nullable(value: string | null | undefined): string {
  return value != null ? `'${esc(value)}'` : "NULL";
}

export async function getActiveTimer(): Promise<TimerRow | null> {
  const rows = await query<TimerRow>(`
    SELECT
      t.id,
      t.task_id,
      COALESCE(t.issue_key, i.key) AS issue_key,
      COALESCE(t.issue_summary, i.summary) AS issue_summary,
      COALESCE(t.issuetype_icon_url, i.issuetype_icon_url) AS issuetype_icon_url,
      t.started_at_utc,
      t.ended_at_utc,
      t.tz_offset_min,
      t.local_day,
      t.type,
      t.adjustment_reason,
      t.duration_seconds,
      t.sync_status,
      t.remote_id,
      t.remote_source,
      t.remote_duration_seconds,
      t.remote_updated_at_utc
    FROM timers t
    LEFT JOIN issues i ON i.id = t.task_id
    WHERE t.ended_at_utc IS NULL AND COALESCE(t.remote_source, '') != 'jira'
    ORDER BY t.started_at_utc DESC
    LIMIT 1
  `);

  return rows[0] ?? null;
}

export async function getWorklogsForDay(localDay: string): Promise<WorklogRow[]> {
  return query<WorklogRow>(`
    SELECT
      aggregated.id,
      aggregated.task_id,
      aggregated.issue_key,
      aggregated.issue_summary,
      aggregated.issuetype_icon_url,
      aggregated.started_at_utc,
      aggregated.ended_at_utc,
      aggregated.local_day,
      aggregated.unsynced_local_duration_seconds,
      aggregated.synced_local_duration_seconds,
      aggregated.remote_duration_seconds,
      aggregated.unsynced_local_duration_seconds + MAX(aggregated.remote_duration_seconds, aggregated.synced_local_duration_seconds) AS total_duration_seconds,
      CASE
        WHEN aggregated.unsynced_local_duration_seconds = 0
          AND (aggregated.remote_duration_seconds > 0 OR aggregated.synced_local_duration_seconds > 0)
        THEN 1
        ELSE 0
      END AS is_synced
    FROM (
      SELECT
        MIN(t.id) AS id,
        t.task_id,
        COALESCE(MAX(NULLIF(t.issue_key, '')), MAX(i.key)) AS issue_key,
        COALESCE(MAX(NULLIF(t.issue_summary, '')), MAX(i.summary)) AS issue_summary,
        COALESCE(MAX(NULLIF(t.issuetype_icon_url, '')), MAX(i.issuetype_icon_url)) AS issuetype_icon_url,
        MIN(t.started_at_utc) AS started_at_utc,
        MAX(t.ended_at_utc) AS ended_at_utc,
        t.local_day,
        SUM(
          CASE
            WHEN COALESCE(t.remote_source, '') != 'jira' AND COALESCE(t.sync_status, '') != 'synced'
            THEN COALESCE(t.duration_seconds, 0)
            ELSE 0
          END
        ) AS unsynced_local_duration_seconds,
        SUM(
          CASE
            WHEN COALESCE(t.remote_source, '') != 'jira' AND COALESCE(t.sync_status, '') = 'synced'
            THEN COALESCE(t.duration_seconds, 0)
            ELSE 0
          END
        ) AS synced_local_duration_seconds,
        SUM(
          CASE
            WHEN COALESCE(t.remote_source, '') = 'jira'
            THEN COALESCE(t.duration_seconds, 0)
            ELSE 0
          END
        ) AS remote_duration_seconds
      FROM timers t
      LEFT JOIN issues i ON i.id = t.task_id
      WHERE t.local_day = '${esc(localDay)}'
      GROUP BY t.task_id
    ) aggregated
    -- Keep worklog rows in their original day order instead of bubbling the active timer to the top.
    ORDER BY aggregated.started_at_utc ASC, aggregated.id ASC
  `);
}

export function sumTotalSeconds(worklogs: WorklogRow[]): number {
  return worklogs.reduce((total, worklog) => total + worklog.total_duration_seconds, 0);
}

export function getLocalDay(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function stopActiveTimer(): Promise<void> {
  const now = new Date().toISOString();
  await query(`
    UPDATE timers
    SET ended_at_utc = '${esc(now)}', updated_at_utc = '${esc(now)}'
    WHERE ended_at_utc IS NULL AND COALESCE(remote_source, '') != 'jira'
  `);
}

export async function startTimer(
  taskId: string,
  details?: {
    issueKey?: string | null;
    issueSummary?: string | null;
    issuetypeIconUrl?: string | null;
  },
): Promise<void> {
  const alreadyActive = await query<{ id: number }>(
    `SELECT id FROM timers WHERE ended_at_utc IS NULL AND COALESCE(remote_source, '') != 'jira' AND task_id = '${esc(taskId)}' LIMIT 1`,
  );

  if (alreadyActive.length > 0) {
    return;
  }

  await stopActiveTimer();

  const now = new Date();
  const startedAt = now.toISOString();
  const localDay = getLocalDay(now);
  const tzOffsetMin = -now.getTimezoneOffset();

  await query(`
    INSERT INTO timers (
      task_id,
      issue_key,
      issue_summary,
      issuetype_icon_url,
      started_at_utc,
      tz_offset_min,
      local_day,
      type,
      sync_status
    )
    VALUES (
      '${esc(taskId)}',
      ${nullable(details?.issueKey)},
      ${nullable(details?.issueSummary)},
      ${nullable(details?.issuetypeIconUrl)},
      '${esc(startedAt)}',
      ${tzOffsetMin},
      '${esc(localDay)}',
      'normal',
      'local'
    )
  `);
}

export async function saveRemoteWorklogs(localDay: string, worklogs: RemoteTimerInput[]): Promise<void> {
  const safeLocalDay = esc(localDay);
  const values = worklogs.map((worklog) => {
    const startedAt = new Date(worklog.startedAtUtc);
    const tzOffsetMin = -startedAt.getTimezoneOffset();

    return `(
      '${esc(worklog.taskId)}',
      ${nullable(worklog.issueKey)},
      ${nullable(worklog.issueSummary)},
      ${nullable(worklog.issuetypeIconUrl)},
      '${esc(worklog.startedAtUtc)}',
      '${esc(worklog.endedAtUtc)}',
      ${tzOffsetMin},
      '${safeLocalDay}',
      'remote',
      'remote',
      '${esc(worklog.remoteId)}',
      'jira',
      ${worklog.remoteDurationSeconds},
      '${esc(worklog.remoteUpdatedAtUtc)}'
    )`;
  });

  await query(`
    DELETE FROM timers
    WHERE local_day = '${safeLocalDay}' AND remote_source = 'jira';
    ${
      values.length > 0
        ? `
    INSERT INTO timers (
      task_id,
      issue_key,
      issue_summary,
      issuetype_icon_url,
      started_at_utc,
      ended_at_utc,
      tz_offset_min,
      local_day,
      type,
      sync_status,
      remote_id,
      remote_source,
      remote_duration_seconds,
      remote_updated_at_utc
    )
    VALUES ${values.join(",")};
    `
        : ""
    }
  `);
}

export async function getSyncableTimersForIssueDay(taskId: string, localDay: string): Promise<SyncableTimerRow[]> {
  return query<SyncableTimerRow>(`
    SELECT
      t.id,
      t.task_id,
      COALESCE(t.issue_key, i.key) AS issue_key,
      COALESCE(t.issue_summary, i.summary) AS issue_summary,
      COALESCE(t.issuetype_icon_url, i.issuetype_icon_url) AS issuetype_icon_url,
      t.started_at_utc,
      t.ended_at_utc,
      t.tz_offset_min,
      t.local_day,
      t.type,
      t.adjustment_reason,
      t.duration_seconds,
      t.sync_status,
      t.remote_id,
      t.remote_source,
      t.remote_duration_seconds,
      t.remote_updated_at_utc
    FROM timers t
    LEFT JOIN issues i ON i.id = t.task_id
    WHERE t.task_id = '${esc(taskId)}'
      AND t.local_day = '${esc(localDay)}'
      AND t.ended_at_utc IS NOT NULL
      AND COALESCE(t.remote_source, '') != 'jira'
      AND COALESCE(t.sync_status, '') != 'synced'
      AND COALESCE(t.duration_seconds, 0) > 0
    ORDER BY t.started_at_utc ASC
  `);
}

export async function getSyncableTimersForDay(localDay: string): Promise<SyncableTimerRow[]> {
  return query<SyncableTimerRow>(`
    SELECT
      t.id,
      t.task_id,
      COALESCE(t.issue_key, i.key) AS issue_key,
      COALESCE(t.issue_summary, i.summary) AS issue_summary,
      COALESCE(t.issuetype_icon_url, i.issuetype_icon_url) AS issuetype_icon_url,
      t.started_at_utc,
      t.ended_at_utc,
      t.tz_offset_min,
      t.local_day,
      t.type,
      t.adjustment_reason,
      t.duration_seconds,
      t.sync_status,
      t.remote_id,
      t.remote_source,
      t.remote_duration_seconds,
      t.remote_updated_at_utc
    FROM timers t
    LEFT JOIN issues i ON i.id = t.task_id
    WHERE t.local_day = '${esc(localDay)}'
      AND t.ended_at_utc IS NOT NULL
      AND COALESCE(t.remote_source, '') != 'jira'
      AND COALESCE(t.sync_status, '') != 'synced'
      AND COALESCE(t.duration_seconds, 0) > 0
    ORDER BY t.task_id ASC, t.started_at_utc ASC
  `);
}

export async function markTimersAsSynced(
  mappings: Array<{
    id: number;
    remoteId: string;
    remoteUpdatedAtUtc: string;
  }>,
): Promise<void> {
  if (mappings.length === 0) {
    return;
  }

  const ids = mappings.map((mapping) => mapping.id).join(", ");
  const remoteIdCase = mappings.map((mapping) => `WHEN ${mapping.id} THEN '${esc(mapping.remoteId)}'`).join(" ");
  const remoteUpdatedCase = mappings
    .map((mapping) => `WHEN ${mapping.id} THEN '${esc(mapping.remoteUpdatedAtUtc)}'`)
    .join(" ");

  await query(`
    UPDATE timers
    SET
      sync_status = 'synced',
      remote_id = CASE id ${remoteIdCase} ELSE remote_id END,
      remote_updated_at_utc = CASE id ${remoteUpdatedCase} ELSE remote_updated_at_utc END,
      updated_at_utc = '${esc(new Date().toISOString())}'
    WHERE id IN (${ids})
  `);
}
