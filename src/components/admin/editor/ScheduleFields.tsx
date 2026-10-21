"use client";

import { CalendarClock, Repeat, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScheduleRepeat } from "@/lib/types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n: number) => String(n).padStart(2, "0");

function parseLocal(v: string | null): Date | null {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function ordinal(n: number): string {
  const rem = n % 100;
  if (rem >= 11 && rem <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** Plain-English summary of a repeating window, e.g. "every year from 1 January 00:00 to 31 January 23:59". */
function describeWindow(start: Date, end: Date, repeat: Exclude<ScheduleRepeat, "none">): string {
  if (repeat === "weekly") {
    const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long" });
    return `every week from ${day(start)} ${time(start)} to ${day(end)} ${time(end)}`;
  }
  if (repeat === "monthly") {
    return `every month from the ${ordinal(start.getDate())} at ${time(start)} to the ${ordinal(end.getDate())} at ${time(end)}`;
  }
  const date = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `every year from ${date(start)} ${time(start)} to ${date(end)} ${time(end)}`;
}

/**
 * Optional "show from / show until" window for a slide, which can repeat
 * every week, month or year. Values are stored as datetime-local strings and
 * evaluated in the display's local time.
 */
export function ScheduleFields({
  startAt,
  endAt,
  repeat,
  onStartAt,
  onEndAt,
  onRepeat,
}: {
  startAt: string | null;
  endAt: string | null;
  repeat: ScheduleRepeat;
  onStartAt: (v: string | null) => void;
  onEndAt: (v: string | null) => void;
  onRepeat: (v: ScheduleRepeat) => void;
}) {
  const hasSchedule = !!(startAt || endAt || repeat !== "none");
  const start = parseLocal(startAt);
  const end = parseLocal(endAt);
  const repeating = repeat !== "none";
  const windowOk = !!(start && end && end > start);

  /** One-click "every year, for the whole of <month>". */
  function everyYearIn(month: number) {
    const year = new Date().getFullYear();
    const lastDay = new Date(year, month + 1, 0).getDate();
    onStartAt(`${year}-${pad(month + 1)}-01T00:00`);
    onEndAt(`${year}-${pad(month + 1)}-${pad(lastDay)}T23:59`);
    onRepeat("yearly");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <CalendarClock className="size-4 text-muted-foreground" />
          Schedule
        </Label>
        {hasSchedule && (
          <button
            type="button"
            onClick={() => {
              onStartAt(null);
              onEndAt(null);
              onRepeat("none");
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
            Clear
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Show from</span>
          <Input
            type="datetime-local"
            value={startAt ?? ""}
            onChange={(e) => onStartAt(e.target.value || null)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Show until</span>
          <Input
            type="datetime-local"
            value={endAt ?? ""}
            onChange={(e) => onEndAt(e.target.value || null)}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Repeat className="size-3" />
            Repeat
          </span>
          <Select value={repeat} onValueChange={(v) => onRepeat(v as ScheduleRepeat)}>
            <SelectTrigger aria-label="Repeat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Doesn&apos;t repeat</SelectItem>
              <SelectItem value="weekly">Every week</SelectItem>
              <SelectItem value="monthly">Every month</SelectItem>
              <SelectItem value="yearly">Every year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Quick: a whole month, every year</span>
          <Select value="" onValueChange={(v) => everyYearIn(Number(v))}>
            <SelectTrigger aria-label="Every year for a whole month">
              <SelectValue placeholder="Choose a month…" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>
                  Every {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {repeating && !windowOk ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          To repeat, set both &ldquo;Show from&rdquo; and &ldquo;Show until&rdquo; (until must be
          later) for the first time it should show.
        </p>
      ) : repeating && start && end ? (
        <p className="text-xs text-muted-foreground">
          Shows {describeWindow(start, end, repeat)}, starting{" "}
          {start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Leave blank to always show. The slide appears and expires automatically.
        </p>
      )}
    </div>
  );
}
