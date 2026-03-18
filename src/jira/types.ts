export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls: Record<string, string>;
  self?: string;
  active?: boolean;
  timeZone?: string;
}

export interface JiraStatusCategory {
  id: number;
  key: string;
  name: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: JiraStatusCategory;
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  avatarUrls: Record<string, string>;
}

export interface JiraIssuetype {
  id: string;
  name: string;
  iconUrl: string;
}

export interface JiraIssueFields {
  summary: string;
  status: JiraStatus;
  priority: JiraPriority | null;
  project: JiraProject;
  issuetype: JiraIssuetype;
  assignee: JiraUser | null;
  updated: string;
  created: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: JiraIssueFields;
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  total?: number;
  maxResults?: number;
  startAt?: number;
  isLast?: boolean;
  nextPageToken?: string;
}

export interface JiraAccessibleResource {
  id: string;
  name: string;
  url: string;
  scopes: string[];
  avatarUrl: string;
}

export type JiraCurrentUser = JiraUser;

export interface JiraWorklog {
  id: string;
  issueId: string;
  started: string;
  updated: string;
  timeSpent: string;
  timeSpentSeconds: number;
  author: JiraUser;
  updateAuthor: JiraUser;
}

export interface JiraPageOfWorklogs {
  startAt: number;
  maxResults: number;
  total: number;
  worklogs: JiraWorklog[];
}
