import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import * as schema from "@/db/schema";

export function isLocalPreview() {
  const hostname = new URL(
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
  ).hostname;
  return (
    process.env.LOCAL_DATABASE === "true" &&
    !process.env.DATABASE_URL &&
    ["localhost", "127.0.0.1"].includes(hostname)
  );
}
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
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "reader", input: false },
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
