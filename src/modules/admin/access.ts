import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";

// Layouts persist across navigation, so every data entry point checks too.
export const requireAdmin = cache(async () => {
  const actor = await requireUser();
  if (actor.role !== "admin" || !actor.emailVerified) notFound();
  return actor;
});
