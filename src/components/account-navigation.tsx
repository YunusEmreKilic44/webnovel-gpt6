import Link from "next/link";
import { Settings2, UserRound } from "./icons";

export function AccountNavigation({
  active,
}: {
  active: "profile" | "settings";
}) {
  return (
    <nav className="account-navigation" aria-label="Hesap sayfaları">
      <Link
        href="/profil"
        aria-current={active === "profile" ? "page" : undefined}
      >
        <UserRound size={17} />
        Profilim
      </Link>
      <Link
        href="/ayarlar"
        aria-current={active === "settings" ? "page" : undefined}
      >
        <Settings2 size={17} />
        Ayarlar
      </Link>
    </nav>
  );
}
