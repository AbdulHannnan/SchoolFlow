import { Suspense } from "react";
import { HardHat } from "lucide-react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addBoxClass } from "@/components/ui/add-box";
import { CreateStaffForm } from "@/components/academics/create-staff-form";
import { StaffActions } from "@/components/academics/staff-actions";
import { requireRole } from "@/server/auth/dal";
import { listStaff } from "@/server/academics/staff";
import { staffRoleLabel } from "@/lib/staff";
import { formatPKR } from "@/lib/money";

export const metadata: Metadata = {
  title: "Staff - School Management",
};

export default function StaffPage() {
  return (
    <AppShell title="Staff">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <StaffContent />
      </Suspense>
    </AppShell>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-PK", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

async function StaffContent() {
  await requireRole("HEAD");
  const staff = await listStaff();
  const active = staff.filter((s) => s.isActive).length;

  return (
    <div className="space-y-6">
      <Card className={addBoxClass}>
        <CardHeader>
          <CardTitle className="text-base">Add a staff member</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateStaffForm />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <div className="bg-muted grid size-12 place-items-center rounded-xl">
          <HardHat className="size-6" />
        </div>
        <div>
          <p className="text-2xl font-semibold">{staff.length}</p>
          <p className="text-muted-foreground text-sm">
            {staff.length === 1 ? "staff member" : "staff members"}
            {staff.length > 0 ? ` (${active} active)` : ""}
          </p>
        </div>
      </div>

      {staff.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No staff yet. Add drivers, gardeners, clerks and other support workers above.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => (
            <Card key={member.id} className={member.isActive ? undefined : "opacity-70"}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{member.name}</CardTitle>
                    <p className="text-muted-foreground text-sm">
                      {staffRoleLabel(member.role, member.customRole)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {member.isActive ? null : <Badge variant="outline">Inactive</Badge>}
                    <StaffActions staff={member} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <DetailRow label="Phone" value={member.phone} />
                <DetailRow label="CNIC" value={member.cnic} />
                <DetailRow label="Address" value={member.address} />
                <DetailRow
                  label="Joined"
                  value={member.joiningDate ? dateFmt.format(new Date(member.joiningDate)) : null}
                />
                <DetailRow
                  label="Monthly salary"
                  value={member.monthlySalary ? formatPKR(member.monthlySalary) : null}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "-"}</span>
    </div>
  );
}
