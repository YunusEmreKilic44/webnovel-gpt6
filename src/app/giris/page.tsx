import { AuthForm } from "@/components/auth-form";
import { isLocalPreview } from "@/lib/auth";
export const metadata = { title: "Giriş yap", robots: { index: false } };
export default function Login() {
  return <AuthForm mode="login" localPreview={isLocalPreview()} />;
}
