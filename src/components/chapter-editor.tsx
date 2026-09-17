"use client";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useRouter } from "next/navigation";
import { saveChapterAction } from "@/modules/publishing/actions";
import { initialActionState } from "@/lib/action-state";
import { wordCount } from "@/modules/publishing/content";
import { Check, LoaderCircle } from "./icons";
import {
  Bold,
  Italic,
  Heading2,
  Quote,
  List,
  Undo2,
  Redo2,
} from "lucide-react";

export function ChapterEditor({
  chapter,
}: {
  chapter: { id: string; title: string; content: JSONContent; version: number };
}) {
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Tüm değişiklikler kaydedildi.");
  const version = useRef(chapter.version);
  const changes = useRef(0);
  const inFlight = useRef(false);
  const router = useRouter();
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: false,
        underline: false,
      }),
      Placeholder.configure({ placeholder: "Her şey bir satırla başlar…" }),
    ],
    content: chapter.content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Bölüm metni",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => {
      changes.current++;
      setContent(editor.getJSON());
      setDirty(true);
      setError("");
    },
  });
  const save = useCallback(async () => {
    if (inFlight.current || !dirty || title.trim().length < 2 || error) return;
    inFlight.current = true;
    setPending(true);
    const revisionAtSave = changes.current;
    const form = new FormData();
    form.set("chapterId", chapter.id);
    form.set("title", title);
    form.set("content", JSON.stringify(content));
    form.set("version", String(version.current));
    try {
      const result = await saveChapterAction(initialActionState, form);
      if (result.ok && result.version) {
        version.current = result.version;
        setMessage("Taslak kaydedildi.");
        if (changes.current === revisionAtSave) setDirty(false);
        router.refresh();
      } else setError(result.message);
    } catch {
      setError(
        "Bağlantı kesildi. Metnin bu sayfada korunuyor; yeniden kaydetmeyi dene.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, [chapter.id, content, dirty, error, router, title]);
  useEffect(() => {
    if (!dirty || pending || error) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        await save();
      });
    }, 1800);
    return () => clearTimeout(timer);
  }, [dirty, pending, error, save]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || pending) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);
  return (
    <div>
      <label className="field" style={{ marginBottom: 20 }}>
        Bölüm başlığı
        <input
          value={title}
          maxLength={120}
          className="editor-title"
          onChange={(event) => {
            changes.current++;
            setTitle(event.target.value);
            setDirty(true);
            setError("");
          }}
        />
      </label>
      <div className="editor-toolbar">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          aria-label="Kalın"
          title="Kalın"
          className={editor?.isActive("bold") ? "is-active" : ""}
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          aria-label="İtalik"
          title="İtalik"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
          aria-label="Başlık"
          title="Başlık"
        >
          <Heading2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          aria-label="Alıntı"
          title="Alıntı"
        >
          <Quote size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          aria-label="Madde listesi"
          title="Madde listesi"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().undo().run()}
          aria-label="Geri al"
          title="Geri al"
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().redo().run()}
          aria-label="Yinele"
          title="Yinele"
        >
          <Redo2 size={16} />
        </button>
        <span className="editor-word-count">{wordCount(content)} kelime</span>
      </div>
      <EditorContent editor={editor} className="editor-content" />
      <div className="editor-actions">
        <div className="editor-footer" role="status">
          {pending
            ? "Kaydediliyor…"
            : dirty
              ? "Kaydedilmemiş değişiklikler var."
              : message}
          <br />
          Taslak değişiklikleri yayındaki metni değiştirmez.
        </div>
        <button
          className="button button-dark"
          disabled={pending || !dirty || title.trim().length < 2}
          onClick={() => {
            if (error) {
              setError("");
            } else
              startTransition(async () => {
                await save();
              });
          }}
        >
          {pending ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <Check size={15} />
          )}
          Taslağı kaydet
        </button>
      </div>
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
    </div>
  );
}
