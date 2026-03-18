export function buildIssueLabel(issueKey: string | null | undefined, issueSummary: string | null | undefined): string {
  const key = issueKey?.trim();
  const summary = issueSummary?.trim();

  if (key && summary) {
    return `${key} - ${summary}`;
  }

  return key || summary || "Unknown Issue";
}

export function truncateText(value: string, maxLength: number): string {
  const normalized = value.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  if (maxLength <= 1) {
    return normalized.slice(0, Math.max(0, maxLength));
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}
