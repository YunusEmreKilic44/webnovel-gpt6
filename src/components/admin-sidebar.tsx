"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Megaphone, Images, ToggleRight } from "lucide-react";
import {
  BookOpen,
  CheckCircle2,
  Coins,
  Flag,
  LayoutDashboard,
  List,
  MessageCircle,
  ShieldCheck,
  UserRound,
  ArrowLeft,
} from "./icons";

const links = [
  { href: "/admin", label: "Genel bakış", icon: LayoutDashboard },
  { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: UserRound },
  { href: "/admin/kitaplar", label: "Kitaplar", icon: BookOpen },
  { href: "/admin/basvurular", label: "Başvurular", icon: CheckCircle2 },
  { href: "/admin/yorumlar", label: "Yorumlar", icon: MessageCircle },
  { href: "/admin/raporlar", label: "Şikâyetler", icon: Flag },
  { href: "/admin/duyurular", label: "Duyurular", icon: Megaphone },
  { href: "/admin/slider", label: "Slider yönetimi", icon: Images },
  { href: "/admin/coin", label: "Coin ve ödemeler", icon: Coins },
  { href: "/admin/ozellikler", label: "Özellikler", icon: ToggleRight },
  { href: "/admin/islem-kaydi", label: "İşlem geçmişi", icon: List },
];
export function AdminSidebar({
  name,
  openReports = 0,
}: {
  name: string;
  /** Unresolved reports, shown as a badge on the reports link. */
  openReports?: number;
}) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  // On small screens the menu is a horizontal strip; keep the current page in view.
  useEffect(() => {
    const strip = nav.current;
    const current = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !current || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({
      left: current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2,
    });
  }, [pathname]);
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <ShieldCheck size={23} />
        <div>
          <strong>Yönetim paneli</strong>
          <span>Satır · Yönetici alanı</span>
        </div>
      </div>
      <nav ref={nav} aria-label="Yönetim menüsü">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/admin" && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
              {href === "/admin/raporlar" && openReports > 0 && (
                <span
                  className="admin-count"
                  aria-label={`${openReports} açık şikâyet`}
                >
                  {openReports > 99 ? "99+" : openReports}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="admin-sidebar-footer">
        <span>{name}</span>
        <Link href="/">
          <ArrowLeft size={15} />
          Siteye dön
        </Link>
      </div>
    </aside>
  );
}
