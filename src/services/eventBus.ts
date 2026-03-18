import { useEffect, useRef } from "react";
import { LaunchType, LocalStorage, launchCommand } from "@raycast/api";

const EVENT_PREFIX = "jira-worklogs:event:";
const POLL_INTERVAL_MS = 1000;
export type EventTarget = "menubar" | "worklogs" | "select-issue";

type EventEnvelope = {
  ts: number;
};

export const WORKLOGS_CHANGED_EVENT = "worklogs-changed";

function getEventKey(event: string): string {
  return `${EVENT_PREFIX}${event}`;
}

export async function publishEvent(event: string, targets: EventTarget[] = []): Promise<void> {
  const payload: EventEnvelope = { ts: Date.now() };
  await LocalStorage.setItem(getEventKey(event), JSON.stringify(payload));

  for (const target of targets) {
    try {
      await launchCommand({ name: target, type: LaunchType.Background });
    } catch {
      // ignore failures for individual command refreshes
    }
  }
}

export function useEventSubscription(event: string, onEvent: () => void): void {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let cancelled = false;
    let lastSeen = 0;

    async function poll() {
      const raw = await LocalStorage.getItem<string>(getEventKey(event));
      if (!raw || cancelled) {
        return;
      }

      try {
        const data = JSON.parse(raw) as EventEnvelope;
        if (typeof data.ts === "number" && data.ts > lastSeen) {
          const shouldNotify = lastSeen !== 0;
          lastSeen = data.ts;
          if (shouldNotify) {
            onEventRef.current();
          }
        }
      } catch {
        // ignore malformed event payloads
      }
    }

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [event]);
}
