import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";

export const getCurrentUser = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || session.user.banned) return null;
  // Better Auth reads the session and its current user from the database.
  // Cookie caching stays disabled: role changes and revoked sessions apply immediately.
  const { id, name, email, emailVerified, role, avatarUrl, coinBalance } =
    session.user;
  return {
    id,
    name,
    email,
    emailVerified,
    role,
    avatarUrl: avatarUrl ?? null,
    coinBalance: coinBalance ?? 0,
  };
});
export async function requireUser() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/giris");
  return actor;
}
