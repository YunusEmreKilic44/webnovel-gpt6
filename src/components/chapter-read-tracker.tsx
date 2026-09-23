"use client";

import { useEffect } from "react";

export function ChapterReadTracker({ chapterId }: { chapterId: string }) {
  useEffect(() => {
    let sent = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function trackWhenVisible() {
      clearTimeout(timer);
      if (sent || document.visibilityState !== "visible") return;
      // Only mounted, visible chapter bodies count; link prefetches never do.
      timer = setTimeout(() => {
        sent = true;
        void fetch(`/api/chapters/${encodeURIComponent(chapterId)}/read`, {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
        }).catch(() => {
          /* Analytics must not interrupt reading. */
        });
      }, 1000);
    }
    trackWhenVisible();
    document.addEventListener("visibilitychange", trackWhenVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", trackWhenVisible);
    };
  }, [chapterId]);
  return null;
}
