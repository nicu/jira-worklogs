import { faker } from "@faker-js/faker";

import type {
  JiraAccessibleResource,
  JiraIssue,
  JiraIssueFields,
  JiraIssuetype,
  JiraPriority,
  JiraProject,
  JiraSearchResponse,
  JiraStatus,
  JiraStatusCategory,
  JiraUser,
} from "../jira/types";

export function MockJiraUser(overrides: Partial<JiraUser> = {}): JiraUser {
  const result = {
    accountId: faker.lorem.words(),
    displayName: faker.lorem.words(),
    emailAddress: faker.helpers.maybe(() => faker.lorem.words()),
    avatarUrls: {
      "32x32": faker.image.personPortrait(),
    },
  };
  return { ...result, ...overrides };
}

export function MockJiraStatusCategory(overrides: Partial<JiraStatusCategory> = {}): JiraStatusCategory {
  const result = {
    id: faker.number.int(10000),
    key: faker.helpers.arrayElement(["indeterminate", "new", "done", "in-progress"]),
    name: faker.lorem.words(),
  };
  return { ...result, ...overrides };
}

export function MockJiraStatus(overrides: Partial<JiraStatus> = {}): JiraStatus {
  const result = {
    id: faker.lorem.words(),
    name: faker.helpers.arrayElement(["In Progress", "To Do", "Done"]),
    statusCategory: MockJiraStatusCategory(),
  };
  return { ...result, ...overrides };
}

export function MockJiraPriority(overrides: Partial<JiraPriority> = {}): JiraPriority {
  const result = {
    id: faker.lorem.words(),
    name: faker.helpers.arrayElement(["Low", "Medium", "High", "Critical"]),
    iconUrl:
      "data:image/svg+xml;base64," +
      btoa(
        faker.helpers.arrayElement([
          '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-signal-low-icon lucide-signal-low"><path d="M2 20h.01"/><path d="M7 20v-4"/></svg>',
          '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-signal-medium-icon lucide-signal-medium"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/></svg>',
          '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-signal-high-icon lucide-signal-high"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/></svg>',
          '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-signal-high-icon lucide-signal-high"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/></svg>',
        ]),
      ),
  };
  return { ...result, ...overrides };
}

export function MockJiraProject(overrides: Partial<JiraProject> = {}): JiraProject {
  const result = {
    id: faker.lorem.words(),
    key: faker.lorem.words(),
    name: faker.lorem.words(),
    avatarUrls: {},
  };
  return { ...result, ...overrides };
}

export function MockJiraIssuetype(overrides: Partial<JiraIssuetype> = {}): JiraIssuetype {
  const result = {
    id: faker.lorem.words(),
    name: faker.lorem.words(),
    iconUrl:
      "data:image/svg+xml;base64," +
      btoa(
        faker.helpers.arrayElement([
          '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-icon lucide-check"><path d="M20 6 9 17l-5-5"/></svg>',
          '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bug-icon lucide-bug"><path d="M12 20v-9"/><path d="M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z"/><path d="M14.12 3.88 16 2"/><path d="M21 21a4 4 0 0 0-3.81-4"/><path d="M21 5a4 4 0 0 1-3.55 3.97"/><path d="M22 13h-4"/><path d="M3 21a4 4 0 0 1 3.81-4"/><path d="M3 5a4 4 0 0 0 3.55 3.97"/><path d="M6 13H2"/><path d="m8 2 1.88 1.88"/><path d="M9 7.13V6a3 3 0 1 1 6 0v1.13"/></svg>',
        ]),
      ),
  };
  return { ...result, ...overrides };
}

export function MockJiraIssueFields(overrides: Partial<JiraIssueFields> = {}): JiraIssueFields {
  const result = {
    summary: faker.lorem.words({ min: 3, max: 20 }),
    status: MockJiraStatus(),
    priority: faker.helpers.arrayElement([null, MockJiraPriority()]),
    project: MockJiraProject(),
    issuetype: MockJiraIssuetype(),
    assignee: faker.helpers.arrayElement([null, MockJiraUser()]),
    updated: faker.lorem.words(),
    created: faker.lorem.words(),
  };
  return { ...result, ...overrides };
}

export function MockJiraIssue(overrides: Partial<JiraIssue> = {}): JiraIssue {
  const result = {
    id: faker.lorem.words(),
    key: faker.helpers.arrayElement(["PROJ-1", "PROJ-2", "PROJ-3"]),
    self: faker.lorem.words(),
    fields: MockJiraIssueFields(),
  };
  return { ...result, ...overrides };
}

export function MockJiraSearchResponse(overrides: Partial<JiraSearchResponse> = {}): JiraSearchResponse {
  const result = {
    issues: faker.helpers.multiple(() => MockJiraIssue()),
    total: faker.number.int(10000),
    maxResults: faker.number.int(10000),
    startAt: faker.number.int(10000),
  };
  return { ...result, ...overrides };
}

export function MockJiraAccessibleResource(overrides: Partial<JiraAccessibleResource> = {}): JiraAccessibleResource {
  const result = {
    id: faker.lorem.words(),
    name: faker.lorem.words(),
    url: faker.lorem.words(),
    scopes: faker.helpers.multiple(() => faker.lorem.words()),
    avatarUrl: faker.lorem.words(),
  };
  return { ...result, ...overrides };
}
