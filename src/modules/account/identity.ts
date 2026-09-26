import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/modules/publishing/policies";

export const userNameInput = z.string().trim().min(2).max(60);
export const nameTakenMessage = "Bu kullanıcı adı zaten kullanılıyor.";

export async function validateUserName(
  db: Pick<Prisma.TransactionClient, "user">,
  raw: unknown,
  userId?: string,
) {
  const parsed = userNameInput.safeParse(raw);
  if (!parsed.success)
    throw new DomainError("INVALID_NAME", "Görünen adın 2–60 karakter olmalı.");
  const existing = await db.user.findUnique({
    where: { name: parsed.data },
    select: { id: true },
  });
  if (existing && existing.id !== userId)
    throw new DomainError("NAME_TAKEN", nameTakenMessage);
  return parsed.data;
}

/** The database constraint also protects simultaneous writes after validation. */
export function isNameConflict(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  if (error.code !== "P2002") return false;
  const meta = "meta" in error ? JSON.stringify(error.meta) : "";
  return /user_name_unique|"name"/.test(meta ?? "");
}
