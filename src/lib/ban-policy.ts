import "server-only";
import { APIError } from "better-auth/api";
import { getDb } from "@/db";

export async function assertSessionAllowed(userId: string) {
  const user = await getDb().user.findUnique({
    where: { id: userId },
    select: { banned: true },
  });
  if (user?.banned)
    throw new APIError("FORBIDDEN", {
      code: "BANNED_USER",
      message: "Hesabın banlandı. Ban kaldırılana kadar giriş yapamazsın.",
    });
}
