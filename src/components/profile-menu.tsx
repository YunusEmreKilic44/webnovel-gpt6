"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  Feather,
  Library,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  UserRound,
  Wallet,
  Bell,
} from "./icons";
import { SignOut } from "./sign-out";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { RemoteImage } from "./remote-image";

type MenuUser = {
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  coinBalance: number;
  unreadNotifications: number;
  showWallet: boolean;
};

export function ProfileMenu({ user }: { user: MenuUser }) {
  const pathname = usePathname();
  return <AccountMenu key={pathname} user={user} />;
}

function AccountMenu({ user }: { user: MenuUser }) {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const lastOnOpen = useRef(false);
  const links = [
    { href: "/profil", label: "Profilim", icon: UserRound },
    {
      href: "/bildirimler",
      label: user.unreadNotifications
        ? `Bildirimler · ${user.unreadNotifications} yeni`
        : "Bildirimler",
      icon: Bell,
    },
    ...(user.showWallet
      ? [
          {
            href: "/cuzdan",
            label: `Cüzdanım · ${user.coinBalance.toLocaleString("tr-TR")} coin`,
            icon: Wallet,
          },
        ]
      : []),
    { href: "/ayarlar", label: "Ayarlar", icon: Settings2 },
    { href: "/kutuphanem", label: "Kütüphanem", icon: Library },
    { href: "/studio", label: "Yazar stüdyosu", icon: Feather },
    {
      href: "/studio/istatistikler",
      label: "Yazar paneli",
      icon: LayoutDashboard,
    },
    ...(user.role === "admin"
      ? [{ href: "/admin", label: "Yönetim paneli", icon: ShieldCheck }]
      : []),
  ];
  useEffect(() => {
    if (!open) return;
    const items =
      root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (items?.length) items[lastOnOpen.current ? items.length - 1 : 0].focus();
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div
      className="profile-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={cn(
          "avatar profile-menu-trigger",
          user.avatarUrl && "has-image",
        )}
        aria-label="Hesabım"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={!hydrated}
        onClick={() => {
          lastOnOpen.current = false;
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            lastOnOpen.current = event.key === "ArrowUp";
            setOpen(true);
          }
        }}
      >
        {user.avatarUrl ? (
          <RemoteImage src={user.avatarUrl} alt="" fill sizes="40px" />
        ) : (
          user.name.charAt(0).toLocaleUpperCase("tr-TR")
        )}
      </button>
      {open && (
        <div className="profile-dropdown">
          <div className="profile-dropdown-heading">
            <Avatar name={user.name} url={user.avatarUrl} />
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <nav
            id={id}
            role="menu"
            aria-label="Hesap menüsü"
            onKeyDown={(event) => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
                return;
              event.preventDefault();
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  '[role="menuitem"]:not(:disabled)',
                ),
              );
              const current = items.indexOf(
                document.activeElement as HTMLElement,
              );
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : (current +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        items.length) %
                      items.length;
              items[next]?.focus();
            }}
          >
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                className="profile-menu-item"
                onClick={() => setOpen(false)}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
            <div className="profile-menu-divider" role="separator" />
            <SignOut
              className="profile-menu-item profile-menu-signout"
              role="menuitem"
            />
          </nav>
        </div>
      )}
    </div>
  );
}
