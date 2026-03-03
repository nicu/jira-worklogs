import type { JiraIssue } from "../jira/types";
import { query } from "./database";

type IssueRow = {
  id: string;
  key: string;
  source: string;
  summary: string;
  status_name: string;
  status_category_key: string;
  issuetype_icon_url: string;
  priority_name: string | null;
  priority_icon_url: string | null;
  assignee_display_name: string | null;
  assignee_avatar_url: string | null;
};

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

function nullable(value: string | null | undefined): string {
  return value != null ? `'${esc(value)}'` : "NULL";
}

function rowToIssue(row: IssueRow): JiraIssue {
  return {
    id: row.id,
    key: row.key,
    self: "",
    fields: {
      summary: row.summary,
      updated: "",
      created: "",
      status: {
        id: "",
        name: row.status_name,
        statusCategory: { id: 0, key: row.status_category_key, name: "" },
      },
      issuetype: { id: "", name: "", iconUrl: row.issuetype_icon_url },
      project: { id: "", key: "", name: "", avatarUrls: {} },
      priority: row.priority_icon_url ? { id: "", name: row.priority_name!, iconUrl: row.priority_icon_url } : null,
      assignee: row.assignee_avatar_url
        ? { accountId: "", displayName: row.assignee_display_name!, avatarUrls: { "32x32": row.assignee_avatar_url } }
        : null,
    },
  };
}

export async function getStoredIssues(source: "assigned" | "watched"): Promise<JiraIssue[]> {
  const rows = await query<IssueRow>(
    `SELECT * FROM issues WHERE source = '${source}' ORDER BY updated_at DESC, created_at DESC`,
  );
  return rows.map(rowToIssue);
}

export async function getLastFetch(source: "assigned" | "watched"): Promise<Date | null> {
  const rows = await query<{ last_fetched_at: string }>(
    `SELECT last_fetched_at FROM fetch_metadata WHERE source = '${source}'`,
  );
  if (rows.length === 0) return null;
  return new Date(rows[0].last_fetched_at);
}

function buildValues(issues: JiraIssue[], source: "assigned" | "watched"): string[] {
  return issues.map((i) => {
    const updated = i.fields.updated ?? "";
    const created = i.fields.created ?? "";
    const statusId = i.fields.status.id ?? "";
    const statusName = i.fields.status.name ?? "";
    const statusCatId = i.fields.status.statusCategory?.id ?? 0;
    const statusCatKey = i.fields.status.statusCategory?.key ?? "";
    const statusCatName = i.fields.status.statusCategory?.name ?? "";

    return `('${esc(i.id)}', '${esc(i.key)}', '${esc(i.self ?? "")}', '${source}', '${esc(
      i.fields.summary,
    )}', '${esc(updated)}', '${esc(created)}', '${esc(statusId)}', '${esc(statusName)}', ${statusCatId}, '${esc(
      statusCatKey,
    )}', '${esc(statusCatName)}', '${esc(i.fields.issuetype.id ?? "")}', '${esc(i.fields.issuetype.name ?? "")}', '${esc(i.fields.issuetype.iconUrl ?? "")}', '${esc(
      i.fields.project.id ?? "",
    )}', '${esc(i.fields.project.key ?? "")}', '${esc(i.fields.project.name ?? "")}', ${nullable(i.fields.priority?.id)}, ${nullable(
      i.fields.priority?.name,
    )}, ${nullable(i.fields.priority?.iconUrl)}, ${nullable(i.fields.assignee?.accountId)}, ${nullable(i.fields.assignee?.displayName)}, ${nullable(
      i.fields.assignee?.avatarUrls["32x32"],
    )})`;
  });
}

export async function saveIssues(assigned: JiraIssue[], watched: JiraIssue[]): Promise<void> {
  const assignedVals = buildValues(assigned, "assigned");
  const watchedVals = buildValues(watched, "watched");
  const all = [...assignedVals, ...watchedVals];
  if (all.length === 0) return;
  await query(`
    INSERT INTO issues (
      id, key, self, source, summary,
      updated_at, created_at,
      status_id, status_name, status_category_id, status_category_key, status_category_name,
      issuetype_id, issuetype_name, issuetype_icon_url,
      project_id, project_key, project_name,
      priority_id, priority_name, priority_icon_url,
      assignee_account_id, assignee_display_name, assignee_avatar_url
    )
    VALUES ${all.join(",")}
    ON CONFLICT(id) DO UPDATE SET
      key = excluded.key,
      self = excluded.self,
      source = excluded.source,
      summary = excluded.summary,
      updated_at = excluded.updated_at,
      created_at = excluded.created_at,
      status_id = excluded.status_id,
      status_name = excluded.status_name,
      status_category_id = excluded.status_category_id,
      status_category_key = excluded.status_category_key,
      status_category_name = excluded.status_category_name,
      issuetype_id = excluded.issuetype_id,
      issuetype_name = excluded.issuetype_name,
      issuetype_icon_url = excluded.issuetype_icon_url,
      project_id = excluded.project_id,
      project_key = excluded.project_key,
      project_name = excluded.project_name,
      priority_id = excluded.priority_id,
      priority_name = excluded.priority_name,
      priority_icon_url = excluded.priority_icon_url,
      assignee_account_id = excluded.assignee_account_id,
      assignee_display_name = excluded.assignee_display_name,
      assignee_avatar_url = excluded.assignee_avatar_url
  `);
  const now = new Date().toISOString();
  await query(`
    INSERT INTO fetch_metadata(source, last_fetched_at) VALUES ('assigned', '${now}')
    ON CONFLICT(source) DO UPDATE SET last_fetched_at = excluded.last_fetched_at;
    INSERT INTO fetch_metadata(source, last_fetched_at) VALUES ('watched', '${now}')
    ON CONFLICT(source) DO UPDATE SET last_fetched_at = excluded.last_fetched_at;
  `);
}
