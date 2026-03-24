import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Calendar } from "lucide-react";
import { calendarApi } from "../../api/calendar";
import { cn } from "../../lib/utils";
import CalendarEventDetail from "./CalendarEventDetail";
import CronJobDetail from "./CronJobDetail";

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_DOT = {
  scheduled: "bg-blue-500",
  running:   "bg-yellow-500",
  completed: "bg-green-500",
  failed:    "bg-red-500",
  missed:    "bg-orange-500",
  cancelled: "bg-gray-500",
  idle:      "bg-blue-500",
  active:    "bg-yellow-500",
  paused:    "bg-gray-500",
};

const SOURCE_LABELS = {
  cron_job:      "Cron",
  task_run:      "Task",
  manual:        "Manual",
  proactive_job: "Proactive",
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateKey(iso) {
  return new Date(iso).toISOString().split("T")[0];
}

function formatWeekRange(startStr) {
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { month: "short", day: "numeric" };
  const startFmt = start.toLocaleDateString(undefined, opts);
  const endFmt = end.toLocaleDateString(undefined, { ...opts, year: "numeric" });
  return `${startFmt} \u2013 ${endFmt}`;
}

function getDaysOfWeek(weekStartStr) {
  const start = new Date(weekStartStr + "T00:00:00");
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

// ── Item card ────────────────────────────────────────────────────────────────
function ItemCard({ item, onClick }) {
  const dotColor = STATUS_DOT[item.status] || STATUS_DOT.scheduled;
  const sourceLabel = SOURCE_LABELS[item.source] || item.source || "";

  return (
    <div
      className="bg-gray-800 rounded p-1.5 mb-1 text-xs cursor-pointer hover:bg-gray-700 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
        <span className="text-gray-100 truncate font-medium">{item.title}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5 pl-3 text-gray-500">
        <span className="font-mono">{formatTime(item.starts_at)}</span>
        {sourceLabel && (
          <>
            <span>&middot;</span>
            <span className="px-1 py-0 rounded bg-gray-700 border border-gray-600 text-gray-400 text-[10px]">
              {sourceLabel}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function WeekCalendarView({ weekStart, onWeekChange }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedCronJob, setSelectedCronJob] = useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["calendar", "week", weekStart],
    queryFn: () => calendarApi.getWeek(weekStart),
  });

  const days = useMemo(() => getDaysOfWeek(weekStart), [weekStart]);
  const todayStr = useMemo(() => toISODate(new Date()), []);

  // Merge events + cron_occurrences and group by date
  const grouped = useMemo(() => {
    if (!data) return {};
    const allItems = [
      ...(data.events || []),
      ...(data.cron_occurrences || []),
    ];
    const groups = {};
    allItems.forEach((item) => {
      const key = item.starts_at ? dateKey(item.starts_at) : "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    // Sort each day by starts_at
    Object.values(groups).forEach((arr) =>
      arr.sort((a, b) => (a.starts_at || "").localeCompare(b.starts_at || ""))
    );
    return groups;
  }, [data]);

  function handlePrev() {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() - 7);
    onWeekChange(toISODate(d));
  }

  function handleNext() {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + 7);
    onWeekChange(toISODate(d));
  }

  function handleItemClick(item) {
    if (item.cron_job_id && !item.id?.toString().startsWith?.("cron-") === false) {
      // It's a cron occurrence — open CronJobDetail
      setSelectedCronJob({ id: item.cron_job_id, name: item.title, cron_expression: item.cron_expression, ...item });
    } else if (typeof item.id === "string" && item.id.startsWith("cron-")) {
      setSelectedCronJob({ id: item.cron_job_id, name: item.title, cron_expression: item.cron_expression, ...item });
    } else {
      setSelectedEvent(item);
    }
  }

  return (
    <div>
      {/* Navigation header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <h3 className="text-sm font-semibold text-white ml-2">
            {formatWeekRange(weekStart)}
          </h3>
        </div>
        <button
          onClick={() => {
            const now = new Date();
            const day = now.getDay();
            const sunday = new Date(now);
            sunday.setDate(sunday.getDate() - day);
            onWeekChange(toISODate(sunday));
          }}
          className="text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded border border-gray-700 hover:border-gray-600 transition-colors"
        >
          This Week
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-12 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading week...
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">
          <span className="text-sm text-red-400">{error?.message || "Failed to load week view"}</span>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-gray-800 rounded-xl overflow-hidden border border-gray-800">
          {days.map((day) => {
            const key = toISODate(day);
            const isToday = key === todayStr;
            const items = grouped[key] || [];

            return (
              <div
                key={key}
                className={cn(
                  "bg-gray-900 min-h-[200px] flex flex-col",
                  isToday && "ring-1 ring-inset ring-orange-500/30"
                )}
              >
                {/* Day header */}
                <div
                  className={cn(
                    "px-2 py-2 text-center border-b border-gray-800",
                    isToday ? "bg-orange-500/10" : "bg-gray-900"
                  )}
                >
                  <p className={cn("text-[10px] uppercase tracking-wide", isToday ? "text-orange-400" : "text-gray-500")}>
                    {WEEKDAY_NAMES[day.getDay()]}
                  </p>
                  <p className={cn("text-sm font-semibold", isToday ? "text-orange-300" : "text-gray-300")}>
                    {day.getDate()}
                  </p>
                </div>

                {/* Items */}
                <div className="flex-1 p-1 overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="text-[10px] text-gray-700 text-center mt-4">&mdash;</p>
                  ) : (
                    items.map((item, i) => (
                      <ItemCard
                        key={item.id || i}
                        item={item}
                        onClick={() => handleItemClick(item)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CalendarEventDetail
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
      <CronJobDetail
        job={selectedCronJob}
        open={!!selectedCronJob}
        onClose={() => setSelectedCronJob(null)}
      />
    </div>
  );
}
