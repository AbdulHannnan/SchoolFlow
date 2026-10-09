import { Suspense } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateFeeCategoryForm } from "@/components/fees/create-fee-category-form";
import { CreateFeeStructureForm } from "@/components/fees/create-fee-structure-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteFeeCategoryAction, deleteFeeStructureAction } from "@/app/fees/actions";
import { requireRole } from "@/server/auth/dal";
import { listClassesWithSections } from "@/server/academics/classes";
import { listFeeCategories, listFeeStructures } from "@/server/fees/structure";
import { FEE_FREQUENCY_LABELS, formatPKR } from "@/lib/money";

export const metadata: Metadata = {
  title: "Fees - School Management",
};

export default function FeesPage() {
  return (
    <AppShell title="Fee Structure">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <FeesContent />
      </Suspense>
    </AppShell>
  );
}

async function FeesContent() {
  await requireRole("HEAD");
  const [categories, classes, structures] = await Promise.all([
    listFeeCategories(),
    listClassesWithSections(),
    listFeeStructures(),
  ]);
  const classOptions = classes.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fee categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CreateFeeCategoryForm />
          {categories.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((c) => (
                <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
                  {c.name}
                  <DeleteButton
                    action={deleteFeeCategoryAction}
                    id={c.id}
                    label={`category ${c.name}`}
                  />
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No categories yet. Add one (e.g. Tuition) to start defining fees.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a fee</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-muted-foreground text-sm">Add a category first.</p>
          ) : (
            <CreateFeeStructureForm categories={categories} classes={classOptions} />
          )}
        </CardContent>
      </Card>

      {structures.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {structures.length} {structures.length === 1 ? "fee" : "fees"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y">
              {structures.map((fee) => (
                <li key={fee.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium">
                      {formatPKR(fee.amount)}
                      <span className="text-muted-foreground ml-2 font-normal">
                        {FEE_FREQUENCY_LABELS[fee.frequency]}
                      </span>
                    </p>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{fee.category.name}</Badge>
                      <span>{fee.class ? fee.class.name : "All classes"}</span>
                      {fee.label ? <span>- {fee.label}</span> : null}
                    </div>
                  </div>
                  <DeleteButton
                    action={deleteFeeStructureAction}
                    id={fee.id}
                    label={fee.label ?? `${fee.category.name} fee`}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
