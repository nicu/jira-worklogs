import { useEffect, useState } from "react";
import { Action, ActionPanel, Color, Icon, LaunchType, List, launchCommand, open } from "@raycast/api";
import { useIssues } from "./hooks/useIssues";
import { getIssueBrowseUrl } from "./jira/jira.service";
import { useStartTimer } from "./hooks/useStartTimer";
import type { JiraIssue } from "./jira/types";
import { searchIssuesInJira } from "./services/issues";

const STATUS_CATEGORY_COLOR: Record<string, Color> = {
  new: Color.Blue,
  indeterminate: Color.Yellow,
  done: Color.Green,
};

async function openWorklogs() {
  await launchCommand({ name: "worklogs", type: LaunchType.UserInitiated });
}

function matchesLocalIssue(issue: JiraIssue, query: string): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();
  return (
    issue.key.toLowerCase().includes(normalizedQuery) ||
    issue.fields.summary.toLowerCase().includes(normalizedQuery) ||
    issue.fields.project.key.toLowerCase().includes(normalizedQuery)
  );
}

function IssueListItem({ issue, onRefresh }: { issue: JiraIssue; onRefresh: () => void }) {
  const startTimer = useStartTimer();

  return (
    <List.Item
      icon={{ source: issue.fields.issuetype.iconUrl }}
      title={issue.key}
      subtitle={issue.fields.summary}
      actions={
        <ActionPanel>
          <Action
            title="Start Timer"
            icon={Icon.Play}
            onAction={() => startTimer(issue.id, issue.key, issue.fields.summary, issue.fields.issuetype.iconUrl)}
          />
          <Action
            title="Open Issue in Browser"
            icon={Icon.Globe}
            onAction={async () => open(await getIssueBrowseUrl(issue.key))}
          />
          <Action title="Open Worklogs" icon={Icon.List} onAction={openWorklogs} />
          <Action
            title="Refresh Issues"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={onRefresh}
          />
        </ActionPanel>
      }
      accessories={[
        issue.fields.assignee
          ? { icon: { source: issue.fields.assignee.avatarUrls["32x32"] }, tooltip: issue.fields.assignee.displayName }
          : {},
        {
          tag: {
            value: issue.fields.status.name,
            color: STATUS_CATEGORY_COLOR[issue.fields.status.statusCategory.key] ?? Color.SecondaryText,
          },
        },
        issue.fields.priority
          ? { icon: { source: issue.fields.priority.iconUrl }, tooltip: issue.fields.priority.name }
          : {},
      ]}
    />
  );
}

export default function Command() {
  const { assigned, watched, isLoading, error, refresh } = useIssues();
  const [searchText, setSearchText] = useState("");
  const [remoteIssues, setRemoteIssues] = useState<JiraIssue[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState<Error | undefined>();
  const [remoteSearchNonce, setRemoteSearchNonce] = useState(0);

  const trimmedSearchText = searchText.trim();
  const filteredAssigned = assigned.filter((issue) => matchesLocalIssue(issue, trimmedSearchText));
  const filteredWatched = watched.filter((issue) => matchesLocalIssue(issue, trimmedSearchText));
  const localMatchCount = filteredAssigned.length + filteredWatched.length;
  const shouldSearchRemote = !isLoading && trimmedSearchText.length > 0 && localMatchCount === 0;
  const isRemoteFallbackPending = shouldSearchRemote && remoteIssues.length === 0 && !remoteError;

  useEffect(() => {
    if (!shouldSearchRemote) {
      setRemoteIssues([]);
      setRemoteError(undefined);
      setIsSearchingRemote(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setIsSearchingRemote(true);
      setRemoteError(undefined);

      try {
        const issues = await searchIssuesInJira(trimmedSearchText);
        if (!cancelled) {
          setRemoteIssues(issues);
        }
      } catch (err) {
        if (!cancelled) {
          setRemoteIssues([]);
          setRemoteError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setIsSearchingRemote(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [remoteSearchNonce, shouldSearchRemote, trimmedSearchText]);

  function handleRefresh() {
    refresh();
    setRemoteSearchNonce((state) => state + 1);
  }

  const hasVisibleIssues = filteredAssigned.length > 0 || filteredWatched.length > 0 || remoteIssues.length > 0;

  if (!isLoading && !hasVisibleIssues && !isRemoteFallbackPending && !isSearchingRemote) {
    const isSearchingForIssue = trimmedSearchText.length > 0;
    const visibleError = shouldSearchRemote ? remoteError : error;

    return (
      <List
        isLoading={isLoading || isSearchingRemote}
        filtering={false}
        throttle
        searchText={searchText}
        onSearchTextChange={setSearchText}
        searchBarPlaceholder="Search Jira issues..."
      >
        <List.EmptyView
          icon={visibleError ? Icon.ExclamationMark : Icon.MagnifyingGlass}
          title={
            visibleError
              ? isSearchingForIssue
                ? "Couldn't Search Jira"
                : "Couldn't Load Jira Issues"
              : "No Issues Found"
          }
          description={
            visibleError
              ? visibleError.message
              : isSearchingForIssue
                ? `No local or Jira issues match "${trimmedSearchText}".`
                : "No assigned or watched Jira issues are available right now."
          }
          actions={
            <ActionPanel>
              <Action title="Refresh Issues" icon={Icon.ArrowClockwise} onAction={handleRefresh} />
              <Action title="Open Worklogs" icon={Icon.List} onAction={openWorklogs} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading || isSearchingRemote || isRemoteFallbackPending}
      filtering={false}
      throttle
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search Jira issues..."
    >
      {filteredAssigned.length > 0 ? (
        <List.Section title="Assigned" subtitle={String(filteredAssigned.length)}>
          {filteredAssigned.map((issue) => (
            <IssueListItem key={issue.id} issue={issue} onRefresh={handleRefresh} />
          ))}
        </List.Section>
      ) : null}
      {filteredWatched.length > 0 ? (
        <List.Section title="Watched" subtitle={String(filteredWatched.length)}>
          {filteredWatched.map((issue) => (
            <IssueListItem key={issue.id} issue={issue} onRefresh={handleRefresh} />
          ))}
        </List.Section>
      ) : null}
      {shouldSearchRemote && remoteIssues.length > 0 ? (
        <List.Section title="Jira Search" subtitle={String(remoteIssues.length)}>
          {remoteIssues.map((issue) => (
            <IssueListItem key={issue.id} issue={issue} onRefresh={handleRefresh} />
          ))}
        </List.Section>
      ) : null}
      {isRemoteFallbackPending ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="Searching Jira..."
          description={`No local matches for "${trimmedSearchText}". Searching Jira by key, title, and description.`}
        />
      ) : null}
    </List>
  );
}
