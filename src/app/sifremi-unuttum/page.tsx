import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Şifre yenile", robots: { index: false } };
export default function Forgot() {
  return <AuthForm mode="forgot" />;
}
