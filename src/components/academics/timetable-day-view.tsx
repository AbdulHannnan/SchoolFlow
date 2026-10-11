"use client";

import { useState } from "react";
import type { Weekday } from "@prisma/client";

import { cn } from "@/lib/utils";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteTimetableEntryAction } from "@/app/teachers/actions";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/timetable";

type Entry = {
  id: string;
  day: Weekday;
  period: number;
  subject: { name: string };
  class: { name: string };
};

/**
 * A teacher's timetable with selectable day tabs. Picking a day shows that day's
 * periods as Period / Subject / Class rows. The full week is passed in; filtering
 * happens on the client so switching days is instant.
 */
export function TimetableDayView({ entries }: { entries: Entry[] }) {
  const [day, setDay] = useState<Weekday>("MON");
  const rows = entries.filter((e) => e.day === day).sort((a, b) => a.period - b.period);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {WEEKDAYS.map((d) => {
          const count = entries.filter((e) => e.day === d).length;
          const active = d === day;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              aria-pressed={active}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {WEEKDAY_LABELS[d]}
              {count > 0 ? <span className="ml-1 text-xs opacity-70">({count})</span> : null}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No periods on {WEEKDAY_LABELS[day]}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="w-16 py-2 pr-3 font-medium">Period</th>
                <th className="py-2 pr-3 font-medium">Subject</th>
                <th className="py-2 pr-3 font-medium">Class</th>
                <th className="w-10 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{e.period}</td>
                  <td className="py-2 pr-3 font-medium">{e.subject.name}</td>
                  <td className="py-2 pr-3">{e.class.name}</td>
                  <td className="py-2">
                    <DeleteButton
                      action={deleteTimetableEntryAction}
                      id={e.id}
                      label={`${WEEKDAY_LABELS[e.day]} period ${e.period}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
