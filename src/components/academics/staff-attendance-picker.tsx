"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Picks the date to mark staff attendance for. Navigation flows through the URL
 * (`/staff-attendance?date=YYYY-MM-DD`) so the roster (a server component) reads
 * the selection and it survives a refresh or shared link.
 */
export function StaffAttendancePicker({ date }: { date: string }) {
  const router = useRouter();
  const [day, setDay] = useState(date);

  function load(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/staff-attendance?date=${encodeURIComponent(day)}`);
  }

  return (
    <form onSubmit={load} className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
      <div className="space-y-2">
        <Label htmlFor="staff-att-date">Date</Label>
        <Input
          id="staff-att-date"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
        />
      </div>
      <Button type="submit">Load roster</Button>
    </form>
  );
}
