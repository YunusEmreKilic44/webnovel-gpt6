import { AuthForm } from "@/components/auth-form";
import { isLocalPreview } from "@/lib/auth";
export const metadata = { title: "Aramıza katıl", robots: { index: false } };
export default function Register() {
  return (
    <AuthForm
      mode="register"
      localPreview={
        isLocalPreview() && process.env.DEV_SKIP_EMAIL_VERIFICATION === "true"
      }
    />
  );
}
