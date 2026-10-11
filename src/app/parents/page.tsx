import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addBoxClass } from "@/components/ui/add-box";
import { CreateParentForm } from "@/components/academics/create-parent-form";
import { LinkChildForm } from "@/components/academics/link-child-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { unlinkStudentAction } from "@/app/parents/actions";
import { requireRole } from "@/server/auth/dal";
import {
  listParents,
  getParentsByGradeOverview,
  listParentsByGrade,
} from "@/server/academics/parents";
import { listStudents } from "@/server/academics/students";
import { formatCnic } from "@/lib/students";

export const metadata: Metadata = {
  title: "Parents - School Management",
};

type SearchParams = Promise<{ classId?: string }>;

export default function ParentsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Parents">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <ParentsContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function ParentsContent({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("HEAD");
  const sp = await searchParams;

  if (sp.classId) {
    return <GradeParents classId={sp.classId} />;
  }
  return <ParentsOverview />;
}

async function ParentsOverview() {
  const [grades, parents, students] = await Promise.all([
    getParentsByGradeOverview(),
    listParents(),
    listStudents(),
  ]);

  const parentOptions = parents.map((p) => ({ id: p.id, name: p.name }));
  const studentOptions = students.map((s) => ({
    id: s.id,
    label: `${s.name} - ${s.class.name}${s.section ? ` ${s.section.name}` : ""}`,
  }));

  return (
    <div className="space-y-6">
      <Card className={addBoxClass}>
        <CardHeader>
          <CardTitle className="text-base">Add a parent</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateParentForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Link a child to a parent</CardTitle>
          <CardDescription>
            Linking a child places the parent under that child&apos;s grade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {parentOptions.length === 0 || studentOptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">Add a parent and a student first.</p>
          ) : (
            <LinkChildForm parents={parentOptions} students={studentOptions} />
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Grades</h2>
        {grades.length === 0 ? (
          <p className="text-muted-foreground text-sm">Add a class first.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grades.map((g) => (
              <Link
                key={g.id}
                href={`/parents?classId=${encodeURIComponent(g.id)}`}
                className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
              >
                <Card className="hover:border-primary/50 hover:bg-accent/40 h-full transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {g.name}
                      {g.level != null ? (
                        <span className="text-muted-foreground ml-2 text-sm font-normal">
                          level {g.level}
                        </span>
                      ) : null}
                    </CardTitle>
                    <CardDescription>
                      {g.parentCount} {g.parentCount === 1 ? "parent" : "parents"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function GradeParents({ classId }: { classId: string }) {
  const { class: cls, links } = await listParentsByGrade(classId);

  return (
    <div className="space-y-4">
      <Link
        href="/parents"
        className="text-muted-foreground hover:text-foreground -ml-1 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        All grades
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {cls.name} parents
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {links.length} {links.length === 1 ? "entry" : "entries"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No parents for this grade yet. Link a child to a parent on the overview.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-2 pr-3 font-medium">Parent</th>
                    <th className="py-2 pr-3 font-medium">CNIC</th>
                    <th className="py-2 pr-3 font-medium">Contact</th>
                    <th className="py-2 pr-3 font-medium">Child</th>
                    <th className="py-2 pr-3 font-medium">Grade</th>
                    <th className="w-10 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{l.parent.name}</td>
                      <td className="py-2 pr-3">
                        {l.parent.cnic ? formatCnic(l.parent.cnic) : "-"}
                      </td>
                      <td className="py-2 pr-3">{l.parent.phone ?? "-"}</td>
                      <td className="py-2 pr-3">{l.student.name}</td>
                      <td className="py-2 pr-3">{l.student.class.name}</td>
                      <td className="py-2">
                        <DeleteButton
                          action={unlinkStudentAction}
                          id={l.id}
                          label={`${l.parent.name}'s link to ${l.student.name}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
