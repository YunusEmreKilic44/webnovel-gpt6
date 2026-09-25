import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getDb } from "@/db";
import { isLocalPreview } from "./auth-preview";
import { assertSessionAllowed } from "./ban-policy";
export { isLocalPreview } from "./auth-preview";
import { APIError } from "better-auth/api";
import { isEmailConfigured, sendEmail } from "./email";
/** Accounts must verify their email unless this is local development. */
export function emailVerificationRequired() {
  return !(
    isLocalPreview() && process.env.DEV_SKIP_EMAIL_VERIFICATION === "true"
  );
}
function createAuth() {
  const skipVerification = !emailVerificationRequired();
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
        // Never client-writable; only src/modules/coins changes it.
        coinBalance: { type: "number", defaultValue: 0, input: false },
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
          before: async (value) => {
            // Refuse accounts that could never be verified (no email service).
            if (!skipVerification && !isEmailConfigured())
              throw new APIError("SERVICE_UNAVAILABLE", {
                message:
                  "Kayıt şu an kapalı: doğrulama e-postası gönderilemiyor.",
                code: "EMAIL_SERVICE_UNAVAILABLE",
              });
            return { data: { ...value, emailVerified: skipVerification } };
          },
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
