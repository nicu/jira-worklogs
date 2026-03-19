export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

export function formatElapsed(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const JIRA_DURATION_UNITS = {
  h: 3600,
  m: 60,
  s: 1,
} as const;

export function formatDurationInput(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / JIRA_DURATION_UNITS.h);
  const minutes = Math.floor((safeSeconds % JIRA_DURATION_UNITS.h) / JIRA_DURATION_UNITS.m);
  const seconds = safeSeconds % JIRA_DURATION_UNITS.m;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (seconds > 0) {
    parts.push(`${seconds}s`);
  }

  return parts.length > 0 ? parts.join(" ") : "0m";
}

function parseClockDurationInput(value: string): number | null {
  const match = value.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (!match) {
    return null;
  }

  if (match[3] != null) {
    return Number(match[1]) * JIRA_DURATION_UNITS.h + Number(match[2]) * JIRA_DURATION_UNITS.m + Number(match[3]);
  }

  return Number(match[1]) * JIRA_DURATION_UNITS.m + Number(match[2]);
}

export function parseDurationInput(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const clockDuration = parseClockDurationInput(normalized);
  if (clockDuration != null) {
    return clockDuration;
  }

  let totalSeconds = 0;
  let matchedAtLeastOneToken = false;
  const remainder = normalized.replace(
    /(\d+(?:\.\d+)?)\s*([hms])/g,
    (_, amount, unit: keyof typeof JIRA_DURATION_UNITS) => {
      matchedAtLeastOneToken = true;
      totalSeconds += Number(amount) * JIRA_DURATION_UNITS[unit];
      return "";
    },
  );

  if (!matchedAtLeastOneToken || remainder.replace(/[\s,]+/g, "").length > 0) {
    return null;
  }

  return Math.round(totalSeconds);
}

function buildValidDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

export function formatDateInputValue(date: Date): string {
  const normalized = startOfDay(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, "0");
  const day = String(normalized.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string, referenceDate = new Date()): Date | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "today") {
    return startOfDay(referenceDate);
  }

  if (normalized === "yesterday") {
    return shiftDateByDays(referenceDate, -1);
  }

  const yearFirstMatch = normalized.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yearFirstMatch) {
    return buildValidDate(Number(yearFirstMatch[1]), Number(yearFirstMatch[2]), Number(yearFirstMatch[3]));
  }

  const dottedOrDashedDayFirstMatch = normalized.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/);
  if (dottedOrDashedDayFirstMatch) {
    return buildValidDate(
      Number(dottedOrDashedDayFirstMatch[3]),
      Number(dottedOrDashedDayFirstMatch[2]),
      Number(dottedOrDashedDayFirstMatch[1]),
    );
  }

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);

    if (first > 12 && second <= 12) {
      return buildValidDate(year, second, first);
    }

    if (second > 12 && first <= 12) {
      return buildValidDate(year, first, second);
    }

    return null;
  }

  return null;
}

export function startOfDay(date: Date): Date {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

export function shiftDateByDays(date: Date, amount: number): Date {
  const nextDate = startOfDay(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

export function getDayBounds(localDay: string): { start: Date; end: Date } {
  const [year, month, day] = localDay.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

export function formatJiraStartedAt(startedAtUtc: string, tzOffsetMin: number): string {
  const utcDate = new Date(startedAtUtc);
  const localWallClock = new Date(utcDate.getTime() + tzOffsetMin * 60 * 1000);

  const year = localWallClock.getUTCFullYear();
  const month = String(localWallClock.getUTCMonth() + 1).padStart(2, "0");
  const day = String(localWallClock.getUTCDate()).padStart(2, "0");
  const hours = String(localWallClock.getUTCHours()).padStart(2, "0");
  const minutes = String(localWallClock.getUTCMinutes()).padStart(2, "0");
  const seconds = String(localWallClock.getUTCSeconds()).padStart(2, "0");
  const milliseconds = String(localWallClock.getUTCMilliseconds()).padStart(3, "0");

  const offsetSign = tzOffsetMin >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(tzOffsetMin);
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
  const offsetMinutes = String(absoluteOffset % 60).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${offsetSign}${offsetHours}${offsetMinutes}`;
}

function isSameDay(left: Date, right: Date): boolean {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

export function formatDayLabel(date: Date): string {
  const today = startOfDay(new Date());

  if (isSameDay(date, today)) {
    return "Today";
  }

  if (isSameDay(date, shiftDateByDays(today, -1))) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}
