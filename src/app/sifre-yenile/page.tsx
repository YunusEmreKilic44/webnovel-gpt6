import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Yeni şifre", robots: { index: false } };
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <AuthForm mode="reset" token={(await searchParams).token} />;
}
