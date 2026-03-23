import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribe } from "../lib/cable";

// Subscribes to the CalendarRemindersChannel via Action Cable and
// invalidates React Query caches when calendar-related events arrive.
// Returns { connected } so callers can show a live-status indicator.
export function useCalendarChannel() {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const qcRef = useRef(qc);
  qcRef.current = qc;

  useEffect(() => {
    const unsubscribe = subscribe("CalendarRemindersChannel", {
      connected() {
        setConnected(true);
      },
      disconnected() {
        setConnected(false);
      },
      received(data) {
        const event = data?.event;
        if (!event) return;
        const q = qcRef.current;

        switch (event) {
          case "calendar_event_created":
          case "calendar_event_updated":
          case "calendar_event_deleted":
            q.invalidateQueries({ queryKey: ["calendar", "events"] });
            q.invalidateQueries({ queryKey: ["calendar", "summary"] });
            break;

          case "cron_job_updated":
          case "cron_job_destroyed":
            q.invalidateQueries({ queryKey: ["calendar", "cronJobs"] });
            q.invalidateQueries({ queryKey: ["calendar", "summary"] });
            break;

          case "calendar_sync_completed":
            q.invalidateQueries({ queryKey: ["calendar", "summary"] });
            q.invalidateQueries({ queryKey: ["calendar", "cronJobs"] });
            q.invalidateQueries({ queryKey: ["calendar", "events"] });
            break;

          default:
            break;
        }
      },
    });

    return unsubscribe;
  }, []);

  return { connected };
}
