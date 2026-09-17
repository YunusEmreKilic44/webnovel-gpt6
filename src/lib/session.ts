import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { getDb } from "@/db";

export const getCurrentUser = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const actor = await getDb().user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
    },
  });
  return actor ?? null;
});
export async function requireUser() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/giris");
  return actor;
}
