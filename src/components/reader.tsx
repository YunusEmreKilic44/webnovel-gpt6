"use client";
import { useState } from "react";
import Link from "next/link";
import type { JSONContent } from "@tiptap/react";
import { RichText } from "./rich-text";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  List,
  LockKeyhole,
  Moon,
  Settings2,
  Sun,
} from "./icons";
import { ActionForm, SubmitButton } from "./action-form";
import { interactAction } from "@/modules/community/actions";
import { money } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";

type ReaderProps = {
  bookId: string;
  bookTitle: string;
  bookSlug: string;
  title: string;
  chapterId: string;
  author: string;
  content: JSONContent | null;
  position: number;
  volumeTitle: string;
  wordCount: number;
  price: number;
  previous?: string;
  next?: string;
  loggedIn: boolean;
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
            aria-pressed={theme === "paper"}
          >
            <Sun size={17} />
          </button>
          <button
            onClick={() => changeTheme("sepia")}
            className="icon-button"
            aria-pressed={theme === "sepia"}
          >
            Sepya
          </button>
          <button
            onClick={() => changeTheme("dark")}
            className="icon-button"
            aria-label="Koyu tema"
            aria-pressed={theme === "dark"}
          >
            <Moon size={17} />
          </button>
          <span>Yazı boyutu</span>
          <button
            onClick={() => changeFont(fontSize - 2)}
            className="icon-button"
            aria-label="Yazıyı küçült"
          >
            A−
          </button>
          <span>{fontSize}</span>
          <button
            onClick={() => changeFont(fontSize + 2)}
            className="icon-button"
            aria-label="Yazıyı büyüt"
          >
            A+
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
              <span>
                {Math.max(1, Math.ceil(props.wordCount / 200))} dakika okuma
              </span>
            </div>
          </header>
          {props.content ? (
            <RichText content={props.content} />
          ) : (
            <div className="locked-chapter">
              <LockKeyhole size={35} />
              <h2>Hikâyenin bu bölümü premium.</h2>
              <p>
                Bu bölümün fiyatı {money(props.price)}.<br />
                Satın alma henüz kullanıma açılmadı. Şu an ödeme alınmıyor.
              </p>
              <Link
                href={`/kitap/${props.bookSlug}`}
                className="button button-outline"
              >
                Ücretsiz bölümlere dön
              </Link>
            </div>
          )}
          <div className="reader-end">✦</div>
          <nav className="reader-navigation">
            {props.previous ? (
              <Link
                href={`/oku/${props.previous}`}
                className="button button-outline"
              >
                <ArrowLeft size={15} />
                Önceki bölüm
              </Link>
            ) : (
              <span />
            )}
            {props.next ? (
              <Link href={`/oku/${props.next}`} className="button button-dark">
                Sonraki bölüm <ArrowRight size={15} />
              </Link>
            ) : (
              <Link
                href={`/kitap/${props.bookSlug}`}
                className="button button-dark"
              >
                Kitaba dön <List size={15} />
              </Link>
            )}
          </nav>
        </article>
        <div className="reader-bottom">
          {props.loggedIn && props.content && (
            <ActionForm action={interactAction}>
              <input type="hidden" name="bookId" value={props.bookId} />
              <input type="hidden" name="chapterId" value={props.chapterId} />
              <input type="hidden" name="intent" value="progress" />
              <SubmitButton className="button-outline">
                <Bookmark size={14} />
                Burada kaldığımı kaydet
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      </main>
    </div>
  );
}
