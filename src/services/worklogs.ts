import { getFetchTimestamp, setFetchTimestamp } from "../db/fetchMetadata";
import {
  getLocalDay,
  getSyncableTimersForDay,
  getSyncableTimersForIssueDay,
  markTimersAsSynced,
  replaceUnsyncedLocalDurationForIssueDay,
  saveRemoteWorklogs,
  type RemoteTimerInput,
  type SyncableTimerRow,
} from "../db/timers";
import { createIssueWorklog, fetchIssueWorklogs, fetchIssues, getCurrentUser } from "../jira/jira.service";
import type { JiraIssue, JiraWorklog } from "../jira/types";
import { formatDurationInput, formatJiraStartedAt, getDayBounds } from "../utils/time";

const REMOTE_WORKLOGS_CACHE_TTL_MS = 5 * 60 * 1000;
const REMOTE_WORKLOGS_FETCH_PREFIX = "jira-worklogs";
const MIN_LOCAL_WORKLOG_SECONDS = 1;
const MIN_JIRA_WORKLOG_SECONDS = 60;

function getFetchSource(localDay: string): string {
  return `${REMOTE_WORKLOGS_FETCH_PREFIX}:${localDay}`;
}

function toJqlDate(localDay: string): string {
  return localDay.replace(/-/g, "/");
}

function toRemoteTimerInput(issue: JiraIssue, worklog: JiraWorklog, localDay: string): RemoteTimerInput | null {
  const startedAt = new Date(worklog.started);

  if (getLocalDay(startedAt) !== localDay) {
    return null;
  }

  const endedAt = new Date(startedAt.getTime() + worklog.timeSpentSeconds * 1000);

  return {
    taskId: issue.id,
    issueKey: issue.key,
    issueSummary: issue.fields.summary,
    issuetypeIconUrl: issue.fields.issuetype.iconUrl,
    startedAtUtc: startedAt.toISOString(),
    endedAtUtc: endedAt.toISOString(),
    remoteId: worklog.id,
    remoteUpdatedAtUtc: new Date(worklog.updated).toISOString(),
    remoteDurationSeconds: worklog.timeSpentSeconds,
  };
}

type SyncableWorklogGroup = {
  taskId: string;
  startedAtUtc: string;
  tzOffsetMin: number;
  totalDurationSeconds: number;
  timerIds: number[];
};

function normalizeJiraWorklogSeconds(totalDurationSeconds: number): number {
  return Math.max(MIN_JIRA_WORKLOG_SECONDS, Math.round(totalDurationSeconds));
}

function groupTimersIntoWorklogs(timers: SyncableTimerRow[]): SyncableWorklogGroup[] {
  const groups = new Map<string, SyncableWorklogGroup>();

  for (const timer of timers) {
    const durationSeconds = Math.max(0, Math.round(Number(timer.duration_seconds ?? 0)));
    if (durationSeconds < MIN_LOCAL_WORKLOG_SECONDS) {
      continue;
    }

    const existing = groups.get(timer.task_id);
    if (!existing) {
      groups.set(timer.task_id, {
        taskId: timer.task_id,
        startedAtUtc: timer.started_at_utc,
        tzOffsetMin: timer.tz_offset_min,
        totalDurationSeconds: durationSeconds,
        timerIds: [timer.id],
      });
      continue;
    }

    existing.totalDurationSeconds += durationSeconds;
    existing.timerIds.push(timer.id);

    if (new Date(timer.started_at_utc).getTime() < new Date(existing.startedAtUtc).getTime()) {
      existing.startedAtUtc = timer.started_at_utc;
      existing.tzOffsetMin = timer.tz_offset_min;
    }
  }

  return Array.from(groups.values()).sort((left, right) => {
    return new Date(left.startedAtUtc).getTime() - new Date(right.startedAtUtc).getTime();
  });
}

async function fetchWorklogIssuesForDay(localDay: string): Promise<JiraIssue[]> {
  const jql = `worklogDate = "${toJqlDate(localDay)}" ORDER BY updated DESC`;
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  while (true) {
    const page = await fetchIssues(jql, { maxResults: 50, nextPageToken });
    issues.push(...page.issues);

    if (page.isLast || !page.nextPageToken) {
      return issues;
    }

    nextPageToken = page.nextPageToken;
  }
}

async function fetchRemoteWorklogsForIssue(
  issue: JiraIssue,
  currentUserAccountId: string,
  startedAfter: number,
  startedBefore: number,
  localDay: string,
): Promise<RemoteTimerInput[]> {
  const remoteWorklogs: RemoteTimerInput[] = [];
  let startAt = 0;

  while (true) {
    const page = await fetchIssueWorklogs(issue.id, {
      startAt,
      maxResults: 100,
      startedAfter,
      startedBefore,
    });

    const matchingWorklogs = page.worklogs
      .filter((worklog) => worklog.author.accountId === currentUserAccountId)
      .map((worklog) => toRemoteTimerInput(issue, worklog, localDay))
      .filter((worklog): worklog is RemoteTimerInput => worklog != null);

    remoteWorklogs.push(...matchingWorklogs);

    startAt += page.worklogs.length;
    if (startAt >= page.total || page.worklogs.length === 0) {
      return remoteWorklogs;
    }
  }
}

export async function syncRemoteWorklogsForDay(localDay: string, forceRefresh = false): Promise<boolean> {
  const fetchSource = getFetchSource(localDay);

  if (!forceRefresh) {
    const lastFetch = await getFetchTimestamp(fetchSource);
    if (lastFetch && Date.now() - lastFetch.getTime() < REMOTE_WORKLOGS_CACHE_TTL_MS) {
      return false;
    }
  }

  const [currentUser, issues] = await Promise.all([getCurrentUser(), fetchWorklogIssuesForDay(localDay)]);
  const { start, end } = getDayBounds(localDay);
  const startedAfter = start.getTime();
  const startedBefore = end.getTime();

  const remoteWorklogs = (
    await Promise.all(
      issues.map((issue) =>
        fetchRemoteWorklogsForIssue(issue, currentUser.accountId, startedAfter, startedBefore, localDay),
      ),
    )
  ).flat();

  await saveRemoteWorklogs(localDay, remoteWorklogs);
  await setFetchTimestamp(fetchSource);
  return true;
}

async function createJiraWorklogsFromTimers(localDay: string, timers: SyncableTimerRow[]) {
  const worklogGroups = groupTimersIntoWorklogs(timers);

  if (worklogGroups.length === 0) {
    return { createdCount: 0, issueCount: 0 };
  }

  const successfulMappings: Array<{ id: number; remoteId: string; remoteUpdatedAtUtc: string }> = [];
  let successfulWorklogCount = 0;
  let firstError: Error | undefined;

  for (const worklog of worklogGroups) {
    try {
      const created = await createIssueWorklog(worklog.taskId, {
        started: formatJiraStartedAt(worklog.startedAtUtc, worklog.tzOffsetMin),
        timeSpentSeconds: normalizeJiraWorklogSeconds(worklog.totalDurationSeconds),
      });

      successfulMappings.push(
        ...worklog.timerIds.map((id) => ({
          id,
          remoteId: created.id,
          remoteUpdatedAtUtc: created.updated,
        })),
      );
      successfulWorklogCount += 1;
    } catch (error) {
      firstError = error instanceof Error ? error : new Error(String(error));
      break;
    }
  }

  if (successfulMappings.length > 0) {
    await markTimersAsSynced(successfulMappings);
    await syncRemoteWorklogsForDay(localDay, true);
  }

  if (firstError) {
    if (successfulMappings.length > 0) {
      throw new Error(
        `Saved ${successfulWorklogCount} worklog(s) before Jira returned an error: ${firstError.message}`,
      );
    }

    throw firstError;
  }

  return {
    createdCount: successfulWorklogCount,
    issueCount: new Set(worklogGroups.map((worklog) => worklog.taskId)).size,
  };
}

export async function saveIssueWorklogsToJira(taskId: string, localDay: string) {
  const timers = await getSyncableTimersForIssueDay(taskId, localDay);
  return createJiraWorklogsFromTimers(localDay, timers);
}

export async function saveDayWorklogsToJira(localDay: string) {
  const timers = await getSyncableTimersForDay(localDay);
  return createJiraWorklogsFromTimers(localDay, timers);
}

export async function updateIssueWorklogTotalDuration(
  taskId: string,
  localDay: string,
  totalDurationSeconds: number,
  minimumSyncedSeconds: number,
) {
  const safeTotalDurationSeconds = Math.max(0, Math.round(totalDurationSeconds));
  const safeMinimumSyncedSeconds = Math.max(0, Math.round(minimumSyncedSeconds));

  if (safeTotalDurationSeconds < safeMinimumSyncedSeconds) {
    throw new Error(`Minimum is ${formatDurationInput(safeMinimumSyncedSeconds)}`);
  }

  await replaceUnsyncedLocalDurationForIssueDay(taskId, localDay, safeTotalDurationSeconds - safeMinimumSyncedSeconds);

  return {
    totalDurationSeconds: safeTotalDurationSeconds,
    unsyncedLocalDurationSeconds: safeTotalDurationSeconds - safeMinimumSyncedSeconds,
  };
}
