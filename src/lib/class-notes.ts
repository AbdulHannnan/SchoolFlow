import type { ClassNoteType } from "@prisma/client";

/**
 * Class-note presentation (Module 7.4 - class progress). Labels and themed
 * badge classes for each note type, shared by the HEAD entry form, the recent-
 * notes list and the all-classes dashboard so a type always reads the same.
 * Isomorphic (no server-only imports).
 */

export const CLASS_NOTE_TYPE_LABELS: Record<ClassNoteType, string> = {
  HEAD_VISIT: "Head visit",
  GENERAL: "General",
  ASSEMBLY: "Assembly",
  PARENT_COMMENT: "Parent comment",
};

export const CLASS_NOTE_TYPE_OPTIONS = (Object.keys(CLASS_NOTE_TYPE_LABELS) as ClassNoteType[]).map(
  (value) => ({ value, label: CLASS_NOTE_TYPE_LABELS[value] }),
);

export const CLASS_NOTE_TYPE_BADGE: Record<ClassNoteType, string> = {
  HEAD_VISIT:
    "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  GENERAL:
    "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  ASSEMBLY: "border-transparent bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  PARENT_COMMENT:
    "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

export function classNoteTypeLabel(type: ClassNoteType): string {
  return CLASS_NOTE_TYPE_LABELS[type] ?? type;
}
