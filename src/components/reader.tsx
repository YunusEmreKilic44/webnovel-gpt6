"use client";
import { useState, type ReactNode } from "react";
import { Minus, Plus, Circle } from "lucide-react";
import Link from "next/link";
import { ArrowLeft, Moon, Settings2, Sun } from "./icons";
import { useHydrated } from "@/lib/use-hydrated";

type ReaderProps = {
  bookId: string;
  bookTitle: string;
  bookSlug: string;
  title: string;
  chapterId: string;
  author: string;
  children: ReactNode;
  navigation: ReactNode;
  bookmark: ReactNode;
  position: number;
  volumeTitle: string;
  wordCount: number;
  initialTheme: "paper" | "sepia" | "dark";
  initialFontSize: number;
};
export function Reader(props: ReaderProps) {
  const hydrated = useHydrated();
  const [settings, setSettings] = useState(false);
  const [theme, setTheme] = useState(props.initialTheme);
  const [fontSize, setFontSize] = useState(props.initialFontSize);
  function changeTheme(value: typeof theme) {
    setTheme(value);
    document.cookie = `reader-theme=${value};path=/;max-age=31536000;SameSite=Lax`;
  }
  function changeFont(value: number) {
    const size = Math.max(16, Math.min(28, value));
    setFontSize(size);
    document.cookie = `reader-font=${size};path=/;max-age=31536000;SameSite=Lax`;
  }
  return (
    <div className="reader" data-theme={theme}>
      <header className="reader-topbar">
        <Link href={`/kitap/${props.bookSlug}`}>
          <ArrowLeft size={17} />
          {props.bookTitle}
        </Link>
        <span>satır.</span>
        <button
          className="icon-button"
          disabled={!hydrated}
          onClick={() => setSettings(!settings)}
          title="Okuma ayarları"
          aria-label="Okuma ayarları"
          aria-expanded={settings}
        >
          <Settings2 size={18} />
        </button>
      </header>
      {settings && (
        <div className="reader-settings">
          <span>Görünüm</span>
          <button
            onClick={() => changeTheme("paper")}
            className="icon-button"
            aria-label="Açık tema"
            title="Açık tema"
            aria-pressed={theme === "paper"}
          >
            <Sun size={17} />
          </button>
          <button
            onClick={() => changeTheme("sepia")}
            className="icon-button"
            aria-label="Sepya tema"
            title="Sepya tema"
            aria-pressed={theme === "sepia"}
          >
            <Circle size={17} fill="#d8c6a1" color="#907650" />
          </button>
          <button
            onClick={() => changeTheme("dark")}
            className="icon-button"
            aria-label="Koyu tema"
            title="Koyu tema"
            aria-pressed={theme === "dark"}
          >
            <Moon size={17} />
          </button>
          <span>Yazı boyutu</span>
          <button
            onClick={() => changeFont(fontSize - 2)}
            className="icon-button"
            aria-label="Yazıyı küçült"
            title="Yazıyı küçült"
          >
            <Minus size={17} />
          </button>
          <span>{fontSize}</span>
          <button
            onClick={() => changeFont(fontSize + 2)}
            className="icon-button"
            aria-label="Yazıyı büyüt"
            title="Yazıyı büyüt"
          >
            <Plus size={17} />
          </button>
        </div>
      )}
      <main id="main-content">
        <article className="reader-article" style={{ fontSize }}>
          <header>
            <span className="reader-chapter-tag">
              {props.volumeTitle.toLocaleUpperCase("tr-TR")} · BÖLÜM{" "}
              {props.position}
            </span>
            <h1>{props.title}</h1>
            <div className="reader-meta">
              <span>{props.author}</span>
            </div>
          </header>
          {props.children}
          <div className="reader-end">✦</div>
          {props.navigation}
        </article>
        <div className="reader-bottom">{props.bookmark}</div>
      </main>
    </div>
  );
}
