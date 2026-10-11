"use server";

import { refresh } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import {
  createClass,
  createSection,
  deleteClass,
  deleteSection,
  updateClass,
  updateSection,
} from "@/server/academics/classes";
import type { FormState } from "@/app/classes/form-state";

const classSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  level: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(20)])
    .transform((v) => (v === "" ? null : v)),
  classTeacherId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
});

const updateClassSchema = classSchema.extend({
  id: z.string().min(1, "Missing class"),
});

const sectionTeacherField = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

const sectionSchema = z.object({
  classId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(30),
  sectionTeacherId: sectionTeacherField,
});

const updateSectionSchema = z.object({
  id: z.string().min(1, "Missing section"),
  name: z.string().trim().min(1, "Name is required").max(30),
  sectionTeacherId: sectionTeacherField,
});

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function createClassAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = classSchema.safeParse({
    name: formData.get("name"),
    level: formData.get("level") ?? "",
    classTeacherId: formData.get("classTeacherId") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const hasSections = formData.get("hasSections") === "on";

  try {
    await createClass({ ...parsed.data, hasSections });
    refresh();
    return { status: "success", message: "Class added." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "That class already exists.",
        fieldErrors: { name: "Already exists" },
      };
    }
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function updateClassAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = updateClassSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    level: formData.get("level") ?? "",
    classTeacherId: formData.get("classTeacherId") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    await updateClass(parsed.data);
    refresh();
    return { status: "success", message: "Class updated." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "Another class already has that name.",
        fieldErrors: { name: "Already exists" },
      };
    }
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function createSectionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = sectionSchema.safeParse({
    classId: formData.get("classId"),
    name: formData.get("name"),
    sectionTeacherId: formData.get("sectionTeacherId") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    await createSection(parsed.data);
    refresh();
    return { status: "success", message: "Section added." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "That section already exists.",
        fieldErrors: { name: "Already exists" },
      };
    }
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function updateSectionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = updateSectionSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    sectionTeacherId: formData.get("sectionTeacherId") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    await updateSection(parsed.data);
    refresh();
    return { status: "success", message: "Section updated." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "Another section already has that name.",
        fieldErrors: { name: "Already exists" },
      };
    }
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function deleteClassAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteClass(id);
    refresh();
  }
}

export async function deleteSectionAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteSection(id);
    refresh();
  }
}
