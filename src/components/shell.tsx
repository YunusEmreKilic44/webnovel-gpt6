"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";
import {
  BookOpen,
  ChevronRight,
  Compass,
  Feather,
  Library,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from "./icons";

type ShellUser = { name: string; role: string } | null;
export function Shell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: ShellUser;
}) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  if (pathname.startsWith("/oku/")) return <>{children}</>;
  const links = [
    { href: "/", label: "Keşfet", icon: Compass, active: pathname === "/" },
    {
      href: "/kesfet",
      label: "Tüm hikâyeler",
      icon: BookOpen,
      active: pathname === "/kesfet",
    },
    {
      href: "/kesfet?sort=rating",
      label: "Çok sevilenler",
      icon: TrendingUp,
      active: false,
    },
    {
      href: "/kutuphanem",
      label: "Kütüphanem",
      icon: Library,
      active: pathname === "/kutuphanem",
    },
  ];
  return (
    <div className="app-shell">
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Menüyü kapat"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={cn("sidebar", open && "is-open")}>
        <Link className="brand" href="/" onClick={() => setOpen(false)}>
          <span className="brand-mark">
            <BookOpen size={23} strokeWidth={1.7} />
          </span>
          satır<span className="brand-dot">.</span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Menüyü kapat"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <p className="nav-caption">HİKÂYELERİN DÜNYASI</p>
        <nav className="main-nav">
          {links.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              className={cn("nav-link", active && "active")}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} strokeWidth={1.7} />
              {label}
              {active && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="nav-divider" />
        <p className="nav-caption">SENİN ALANIN</p>
        <nav className="main-nav">
          <Link
            href="/studio"
            className={cn(
              "nav-link",
              pathname.startsWith("/studio") && "active",
            )}
            onClick={() => setOpen(false)}
          >
            <Feather size={19} strokeWidth={1.7} />
            Yazar stüdyosu
          </Link>
          {user?.role === "admin" && (
            <Link
              href="/admin"
              className={cn(
                "nav-link",
                pathname.startsWith("/admin") && "active",
              )}
              onClick={() => setOpen(false)}
            >
              <ShieldCheck size={19} />
              Başvurular
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="writer-invite">
            <Sparkles size={23} strokeWidth={1.4} />
            <h3>
              Senin hikâyen
              <br />
              nerede başlıyor?
            </h3>
            <p>
              İlk satırını yaz.
              <br />
              Yeni dünyalara kapı aç.
            </p>
            <Link href="/studio/yeni" onClick={() => setOpen(false)}>
              Yazmaya başla <ChevronRight size={15} />
            </Link>
          </div>
          <div className="sidebar-footer">
            Her hikâye bir satırla başlar.
            <span>© {new Date().getFullYear()} Satır</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-toggle icon-button"
            aria-label="Menüyü aç"
            disabled={!hydrated}
            onClick={() => setOpen(true)}
          >
            <Menu size={22} />
          </button>
          <form action="/kesfet" className="search-box">
            <Search size={18} />
            <input
              name="q"
              aria-label="Hikâye veya yazar ara"
              placeholder="Yeni bir hikâye, yeni bir dünya ara..."
              maxLength={100}
            />
            <span className="search-shortcut">Keşfet</span>
          </form>
          <div className="topbar-actions">
            <Link href="/studio/yeni" className="top-write">
              <Feather size={17} />
              Bir hikâye yaz
            </Link>
            <span className="topbar-divider" />
            {user ? (
              <Link href="/hesap" className="avatar" aria-label="Hesabım">
                {user.name.charAt(0).toLocaleUpperCase("tr-TR")}
              </Link>
            ) : (
              <Link href="/giris" className="button button-dark button-small">
                Giriş yap <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </header>
        <main id="main-content" className="page-content">
          {children}
        </main>
        <footer className="page-footer">
          <Link href="/" className="footer-brand">
            satır.
          </Link>
          <span>Okudukça büyüyen bir dünya.</span>
          <Link href="/hakkinda">
            Satır hakkında <ChevronRight size={12} />
          </Link>
        </footer>
      </div>
    </div>
  );
}
