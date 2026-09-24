import { getCurrentUser } from "@/lib/session";
import { getFeatureFlags } from "@/modules/features/flags";
import Link from "next/link";
import { Settings2, UserRound, Wallet } from "./icons";

export async function AccountNavigation({
  active,
}: {
  active: "profile" | "settings" | "wallet";
}) {
  const [flags, user] = await Promise.all([
    getFeatureFlags(),
    getCurrentUser(),
  ]);
  // While the store is closed, only people who already hold coins see it.
  const showWallet =
    flags.coinStore || active === "wallet" || (user?.coinBalance ?? 0) > 0;
  return (
    <nav className="account-navigation" aria-label="Hesap sayfaları">
      <Link
        href="/profil"
        aria-current={active === "profile" ? "page" : undefined}
      >
        <UserRound size={17} />
        Profilim
      </Link>
      {showWallet && (
        <Link
          href="/cuzdan"
          aria-current={active === "wallet" ? "page" : undefined}
        >
          <Wallet size={17} />
          Cüzdanım
        </Link>
      )}
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
