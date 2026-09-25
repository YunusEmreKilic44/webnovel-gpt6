import { AuthForm } from "@/components/auth-form";
import { isEmailConfigured } from "@/lib/email";
export const metadata = { title: "Şifre yenile", robots: { index: false } };
export default function Forgot() {
  return <AuthForm mode="forgot" emailUnavailable={!isEmailConfigured()} />;
}
