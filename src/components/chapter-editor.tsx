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
import { saveChapterAction } from "@/modules/publishing/actions";
import { initialActionState } from "@/lib/action-state";
import { wordCount } from "@/modules/publishing/content";
import {
  chapterImageIds,
  chapterImageUrl,
  MAX_CHAPTER_IMAGES,
  MAX_CHAPTER_UPLOAD_BYTES,
} from "@/modules/publishing/image-content";
import { createChapterImageExtension } from "./chapter-image-extension";
import { acceptedImageTypes } from "./use-image-pick";
import { Check, LoaderCircle } from "./icons";
import {
  Bold,
  Italic,
  Heading2,
  Quote,
  List,
  Undo2,
  Redo2,
  ImagePlus,
  Trash2,
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
  const [version, setVersion] = useState(chapter.version);
  const changes = useRef(0);
  const inFlight = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const imagePosition = useRef<number | null>(null);
  const [localImages] = useState(
    () => new Map<string, { file: File; url: string; saved: boolean }>(),
  );
  const [imageError, setImageError] = useState("");
  const [selectedImage, setSelectedImage] = useState<{
    imageId: string;
    alt: string;
  } | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: false,
        underline: false,
      }),
      Placeholder.configure({ placeholder: "Her şey bir satırla başlar…" }),
      createChapterImageExtension(
        (id) => localImages.get(id)?.url ?? chapterImageUrl(id),
        () =>
          setImageError(
            `Bir bölüme en fazla ${MAX_CHAPTER_IMAGES} resim ekleyebilirsin.`,
          ),
      ),
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
    onSelectionUpdate: ({ editor }) => {
      setSelectedImage(
        editor.isActive("image")
          ? {
              imageId: editor.getAttributes("image").imageId,
              alt: editor.getAttributes("image").alt ?? "",
            }
          : null,
      );
    },
  });
  useEffect(() => {
    const images = localImages;
    return () => {
      for (const image of images.values()) URL.revokeObjectURL(image.url);
    };
  }, [localImages]);
  const save = useCallback(async () => {
    if (inFlight.current || !dirty || title.trim().length < 2 || error) return;
    inFlight.current = true;
    setPending(true);
    const revisionAtSave = changes.current;
    const form = new FormData();
    form.set("chapterId", chapter.id);
    form.set("title", title);
    form.set("content", JSON.stringify(content));
    form.set("version", String(version));
    const includedImages: string[] = [];
    for (const id of new Set(chapterImageIds(content))) {
      const image = localImages.get(id);
      if (image && !image.saved) {
        form.set(`chapter-image-${id}`, image.file);
        includedImages.push(id);
      }
    }
    try {
      const result = await saveChapterAction(initialActionState, form);
      if (result.ok && result.version) {
        for (const id of includedImages) {
          const image = localImages.get(id);
          if (image) image.saved = true;
        }
        setVersion(result.version);
        setMessage("Taslak kaydedildi.");
        if (changes.current === revisionAtSave) setDirty(false);
      } else setError(result.message);
    } catch {
      setError(
        "Bağlantı kesildi. Metnin bu sayfada korunuyor; yeniden kaydetmeyi dene.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, [chapter.id, content, dirty, error, title, version, localImages]);
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
      {/* Publish the saved revision without waiting for server props to refresh. */}
      <input
        type="hidden"
        name="version"
        value={version}
        form={`publish-chapter-${chapter.id}`}
      />
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
          aria-label="Resim ekle"
          title="İmleç konumuna resim ekle (isteğe bağlı)"
          disabled={
            !editor || chapterImageIds(content).length >= MAX_CHAPTER_IMAGES
          }
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (!editor) return;
            imagePosition.current = editor.state.selection.from;
            imageInput.current?.click();
          }}
        >
          <ImagePlus size={16} /> Resim ekle
        </button>
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
      <input
        ref={imageInput}
        type="file"
        accept={acceptedImageTypes}
        className="sr-only"
        tabIndex={-1}
        aria-label="Bölüme eklenecek resim"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file || !editor) return;
          setImageError("");
          if (
            !acceptedImageTypes.split(",").includes(file.type) ||
            file.size > 3 * 1024 * 1024 ||
            !file.size
          ) {
            setImageError(
              "En fazla 3 MB boyutunda bir JPG, PNG veya WebP resmi seç.",
            );
            return;
          }
          const ids = chapterImageIds(editor.getJSON());
          if (ids.length >= MAX_CHAPTER_IMAGES) {
            setImageError(
              `Bir bölüme en fazla ${MAX_CHAPTER_IMAGES} resim ekleyebilirsin.`,
            );
            return;
          }
          const pendingBytes = [...new Set(ids)].reduce((sum, id) => {
            const image = localImages.get(id);
            return sum + (image && !image.saved ? image.file.size : 0);
          }, 0);
          if (pendingBytes + file.size > MAX_CHAPTER_UPLOAD_BYTES) {
            setImageError(
              "Bir bölüme en fazla 3 MB boyutunda tek resim yükleyebilirsin.",
            );
            return;
          }
          const imageId = crypto.randomUUID();
          const url = URL.createObjectURL(file);
          localImages.set(imageId, { file, url, saved: false });
          const at = Math.min(
            imagePosition.current ?? editor.state.selection.from,
            editor.state.doc.content.size,
          );
          const inserted = editor
            .chain()
            .focus()
            .insertContentAt(at, { type: "image", attrs: { imageId, alt: "" } })
            .run();
          if (!inserted) {
            URL.revokeObjectURL(url);
            localImages.delete(imageId);
            setImageError(
              "Resim eklenemedi. Metinde başka bir konum seçip tekrar dene.",
            );
          }
        }}
      />
      <p className="editor-image-help">
        Bölüm başına en fazla 1 resim ekleyebilirsin; resim isteğe bağlıdır ve
        taslakla kaydedilir. JPG, PNG veya WebP · En fazla 3 MB.
      </p>
      {imageError && (
        <p role="alert" className="form-message error">
          {imageError}
        </p>
      )}
      {selectedImage && (
        <div className="editor-image-controls">
          <label className="field">
            Resim açıklaması (erişilebilirlik)
            <input
              maxLength={200}
              value={selectedImage.alt}
              onChange={(event) => {
                const alt = event.target.value;
                setSelectedImage({ ...selectedImage, alt });
                editor?.commands.updateAttributes("image", { alt });
              }}
            />
          </label>
          <button
            type="button"
            className="button button-outline button-small"
            onClick={() => {
              editor?.chain().focus().deleteSelection().run();
              setSelectedImage(null);
            }}
          >
            <Trash2 size={14} /> Resmi kaldır
          </button>
        </div>
      )}
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
