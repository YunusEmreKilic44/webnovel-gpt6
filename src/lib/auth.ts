import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getDb } from "@/db";
import { isLocalPreview } from "./auth-preview";
import { assertSessionAllowed } from "./ban-policy";
export { isLocalPreview } from "./auth-preview";
async function sendEmail(to: string, subject: string, url: string) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new Error("E-posta servisi henüz yapılandırılmadı.");
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text: `${subject}\n\n${url}\n\nBu işlemi sen başlatmadıysan bu e-postayı yok sayabilirsin.`,
    }),
  });
  if (!result.ok) throw new Error("E-posta gönderilemedi.");
}
function createAuth() {
  const skipVerification =
    isLocalPreview() && process.env.DEV_SKIP_EMAIL_VERIFICATION === "true";
  if (
    !process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET.length < 32
  )
    throw new Error("En az 32 karakterli BETTER_AUTH_SECRET gerekli.");
  return betterAuth({
    appName: "Satır",
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "reader", input: false },
        banned: { type: "boolean", defaultValue: false, input: false },
        // Read with the session so the header avatar needs no extra query.
        avatarUrl: { type: "string", required: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      requireEmailVerification: !skipVerification,
      sendResetPassword: async ({ user, url }) =>
        sendEmail(user.email, "Satır · Şifreni yenile", url),
    },
    emailVerification: {
      sendOnSignUp: !skipVerification,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) =>
        sendEmail(user.email, "Satır · E-postanı doğrula", url),
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            await assertSessionAllowed(session.userId);
          },
        },
      },
      user: {
        create: {
          before: async (value) => ({
            data: { ...value, emailVerified: skipVerification },
          }),
        },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7 },
    rateLimit: { enabled: true, window: 60, max: 60 },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
