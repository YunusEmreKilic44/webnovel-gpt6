import { AuthForm } from "@/components/auth-form";
import { emailVerificationRequired, isLocalPreview } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
export const metadata = { title: "Aramıza katıl", robots: { index: false } };
export default function Register() {
  const verification = emailVerificationRequired();
  return (
    <AuthForm
      mode="register"
      localPreview={isLocalPreview() && !verification}
      // Without an email service new accounts could never be verified.
      emailUnavailable={verification && !isEmailConfigured()}
    />
  );
}
