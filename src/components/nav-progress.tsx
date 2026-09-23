"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// A navigation that resolves this fast would only make the bar flash.
const SHOW_AFTER_MS = 120;
// Nothing should stay pending this long. The bar must never get stuck on screen.
const GIVE_UP_AFTER_MS = 10000;

const locationKey = (pathname: string, search: string) =>
  `${pathname}?${new URLSearchParams(search)}`;

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  const current = `${pathname}?${searchParams}`;
  const settled = useRef(current);

  // A finished navigation always changes the rendered URL, which ends the wait.
  useEffect(() => {
    if (settled.current === current) return;
    settled.current = current;
    setPending(false);
    setVisible(false);
  }, [current]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const target = new URL(anchor.href, window.location.href);
      // Cross-origin links and same-page anchors never trigger a route change.
      if (target.origin !== window.location.origin) return;
      if (
        locationKey(target.pathname, target.search) ===
        locationKey(window.location.pathname, window.location.search)
      )
        return;
      setPending(true);
    }
    function onSubmit(event: SubmitEvent) {
      if (event.defaultPrevented) return;
      const form = event.target;
      // Server action forms post in place; only search-style forms navigate.
      if (!(form instanceof HTMLFormElement)) return;
      if (form.method.toLowerCase() !== "get") return;
      setPending(true);
    }
    function onPopState() {
      setPending(true);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const reveal = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    const giveUp = setTimeout(() => {
      setPending(false);
      setVisible(false);
    }, GIVE_UP_AFTER_MS);
    return () => {
      clearTimeout(reveal);
      clearTimeout(giveUp);
    };
  }, [pending]);

  return (
    <div
      className="nav-progress"
      data-active={pending && visible ? "true" : undefined}
      aria-hidden="true"
    />
  );
}
