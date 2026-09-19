"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";
import {
  BookOpen,
  Compass,
  Feather,
  Library,
  Menu,
  Search,
  TrendingUp,
  X,
} from "./icons";

export function Shell({
  children,
  account,
  mobileAdmin,
  footerAdmin,
}: {
  children: React.ReactNode;
  account: React.ReactNode;
  mobileAdmin: React.ReactNode;
  footerAdmin: React.ReactNode;
}) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLElement>("button, a")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
      if (event.key === "Tab") {
        const nodes =
          drawer.current?.querySelectorAll<HTMLElement>("a, button");
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (pathname.startsWith("/oku/")) return <>{children}</>;
  const links = [
    { href: "/", label: "Keşfet", icon: Compass, active: pathname === "/" },
    {
      href: "/kesfet",
      label: "Webnoveller",
      icon: BookOpen,
      active: pathname === "/kesfet",
    },
    {
      href: "/kesfet?sort=rating",
      label: "Sıralamalar",
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
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="Satır ana sayfa">
            <span className="brand-mark">
              <BookOpen size={24} strokeWidth={2.5} />
            </span>
            satır<span className="brand-dot">.</span>
            <span className="brand-category">WEBNOVEL</span>
          </Link>
          <nav className="desktop-nav" aria-label="Ana menü">
            {links.map(({ href, label, active }) => (
              <Link
                key={href}
                href={href}
                className={cn("nav-link", active && "active")}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <form action="/kesfet" className="search-box">
            <Search size={17} />
            <input
              name="q"
              aria-label="Hikâye veya yazar ara"
              placeholder="Hikâye veya yazar ara"
              maxLength={100}
            />
          </form>
          {account}
          <button
            ref={toggle}
            className="mobile-toggle icon-button"
            aria-label="Menüyü aç"
            aria-expanded={open}
            aria-controls="mobile-menu"
            disabled={!hydrated}
            onClick={() => setOpen(true)}
          >
            <Menu size={22} />
          </button>
        </div>
      </header>
      {open && (
        <>
          <div
            className="sidebar-backdrop"
            onClick={() => {
              setOpen(false);
              toggle.current?.focus();
            }}
          />
          <div
            ref={drawer}
            id="mobile-menu"
            className="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Gezinme menüsü"
          >
            <div className="drawer-heading">
              <span className="footer-brand">satır.</span>
              <button
                className="icon-button"
                aria-label="Menüyü kapat"
                onClick={() => {
                  setOpen(false);
                  toggle.current?.focus();
                }}
              >
                <X size={22} />
              </button>
            </div>
            <nav>
              {links.map(({ href, label, icon: Icon, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn("nav-link", active && "active")}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={19} />
                  {label}
                </Link>
              ))}
              <Link
                href="/studio"
                className="nav-link"
                onClick={() => setOpen(false)}
              >
                <Feather size={19} />
                Yazar stüdyosu
              </Link>
              <div onClick={() => setOpen(false)}>{mobileAdmin}</div>
            </nav>
          </div>
        </>
      )}
      <main id="main-content" className="page-content">
        {children}
      </main>
      <footer className="page-footer">
        <div>
          <Link href="/" className="footer-brand">
            satır<span>.</span>
          </Link>
          <p>Bir bölüm daha. Başka bir dünya.</p>
        </div>
        <nav aria-label="Alt menü">
          <Link href="/studio">
            <Feather size={15} />
            Yazar stüdyosu
          </Link>
          {footerAdmin}
          <Link href="/hakkinda">Hakkında</Link>
          <span>© {new Date().getFullYear()} Satır</span>
        </nav>
      </footer>
    </div>
  );
}
