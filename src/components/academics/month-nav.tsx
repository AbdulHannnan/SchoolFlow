"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentMonth, shiftMonth } from "@/lib/attendance";

/**
 * Month stepper for the attendance views. Navigation flows through the URL
 * (`?month=YYYY-MM` on the current path) so the server view reads the period
 * and it survives refresh/sharing. Doesn't step past the current month.
 */
export function MonthNav({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const atCurrent = month >= currentMonth();

  const go = (m: string) => router.push(`${pathname}?month=${m}`);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Previous month"
        onClick={() => go(shiftMonth(month, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Input
        type="month"
        value={month}
        max={currentMonth()}
        onChange={(e) => e.target.value && go(e.target.value)}
        aria-label="Month"
        className="w-40"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Next month"
        disabled={atCurrent}
        onClick={() => go(shiftMonth(month, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
