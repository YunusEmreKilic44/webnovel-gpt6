import Link from "next/link";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { getUnreadCount } from "@/modules/notifications/service";
import { Bell, ChevronRight, ShieldCheck } from "./icons";
import { ProfileMenu } from "./profile-menu";
import { StoreNavLink } from "./shell";
import { getFeatureFlags } from "@/modules/features/flags";

export async function ShellAccount() {
  const user = await getCurrentUser();
  if (!user)
    return (
      <Link href="/giris" className="button button-dark button-small">
        Giriş yap <ChevronRight size={14} />
      </Link>
    );
  const [unread, flags] = await Promise.all([
    getUnreadCount(getDb(), user.id),
    getFeatureFlags(),
  ]);
  return (
    <>
      <Link
        href="/bildirimler"
        className="icon-button notification-bell"
        aria-label={
          unread
            ? `Bildirimler, ${unread} okunmamış`
            : "Bildirimler, okunmamış yok"
        }
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
      <ProfileMenu
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          coinBalance: user.coinBalance,
          unreadNotifications: unread,
          // A balance stays reachable even while the store is closed.
          showWallet: flags.coinStore || user.coinBalance > 0,
        }}
      />
    </>
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

export async function ShellStoreLink({ mobile = false }: { mobile?: boolean }) {
  const { coinStore } = await getFeatureFlags();
  return coinStore ? <StoreNavLink mobile={mobile} /> : null;
}
