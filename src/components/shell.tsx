"use client";
import Link from "next/link";
import Form from "next/form";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { NavProgress } from "./nav-progress";
import { useHydrated } from "@/lib/use-hydrated";
import { BookOpen, Coins, Feather, Library, Menu, Search, X } from "./icons";

/** Coin store link; the server only renders it while the store is open. */
export function StoreNavLink({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const active = pathname === "/cuzdan";
  return (
    <Link
      href="/cuzdan"
      className={cn("nav-link", active && "active")}
      aria-current={active ? "page" : undefined}
    >
      {mobile && <Coins size={19} />}
      Coin mağazası
    </Link>
  );
}

export function Shell({
  children,
  account,
  storeLink,
  mobileStoreLink,
  mobileAdmin,
  footerAdmin,
}: {
  children: React.ReactNode;
  account: React.ReactNode;
  /** Feature-switched links, streamed from the server. */
  storeLink?: React.ReactNode;
  mobileStoreLink?: React.ReactNode;
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
  // NavProgress reads the query string, so it needs a boundary of its own.
  const progress = (
    <Suspense fallback={null}>
      <NavProgress />
    </Suspense>
  );
  if (pathname.startsWith("/oku/"))
    return (
      <>
        {progress}
        {children}
      </>
    );
  const links = [
    {
      href: "/kesfet",
      label: "Webnoveller",
      icon: BookOpen,
      active: pathname === "/kesfet",
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
      {progress}
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
            {storeLink}
          </nav>
          <Form action="/kesfet" className="search-box">
            <Search size={17} />
            <input
              name="q"
              aria-label="Hikâye, yazar veya etiket ara"
              placeholder="Hikâye, yazar veya etiket ara"
              maxLength={100}
            />
          </Form>
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
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={19} />
                  {label}
                </Link>
              ))}
              <div onClick={() => setOpen(false)}>{mobileStoreLink}</div>
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
