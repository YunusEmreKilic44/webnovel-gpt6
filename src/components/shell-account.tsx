import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { ChevronRight, ShieldCheck } from "./icons";
import { ProfileMenu } from "./profile-menu";

export async function ShellAccount() {
  const user = await getCurrentUser();
  return user ? (
    <ProfileMenu
      user={{ name: user.name, email: user.email, role: user.role }}
    />
  ) : (
    <Link href="/giris" className="button button-dark button-small">
      Giriş yap <ChevronRight size={14} />
    </Link>
  );
}

export async function ShellAdminLink({ mobile = false }: { mobile?: boolean }) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return null;
  return (
    <Link href="/admin" className={mobile ? "nav-link" : undefined}>
      {mobile && <ShieldCheck size={19} />}
      Başvurular
    </Link>
  );
}
