"use client";
import { startTransition, useActionState, useRef, useState } from "react";
import { saveAnnouncementAction } from "@/modules/site-content/actions";
import { initialActionState } from "@/lib/action-state";
import {
  MAX_ANNOUNCEMENT_IMAGES,
  MAX_ANNOUNCEMENT_UPLOAD_BYTES,
  type AnnouncementBlock,
  type AnnouncementBlockInput,
} from "@/modules/site-content/announcement-content";
import { acceptedImageTypes, useImagePick } from "./use-image-pick";
import { RemoteImage } from "./remote-image";

export function AnnouncementEditorForm({
  children,
  blocks,
  editing,
}: {
  children: React.ReactNode;
  blocks: AnnouncementBlock[];
  editing: boolean;
}) {
  const [state, dispatch, pending] = useActionState(
    async (previous: typeof initialActionState, form: FormData) => {
      const result = await saveAnnouncementAction(previous, form);
      return { ...result, nonce: result.nonce ?? previous.nonce };
    },
    initialActionState,
  );
  const [fileError, setFileError] = useState("");
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const form = new FormData(event.currentTarget);
        const bytes = [...form.values()].reduce<number>(
          (sum, value) => sum + (value instanceof File ? value.size : 0),
          0,
        );
        if (bytes > MAX_ANNOUNCEMENT_UPLOAD_BYTES) {
          setFileError(
            "Bir kayıtta toplam en fazla 12 MB görsel yükleyebilirsin.",
          );
          return;
        }
        setFileError("");
        startTransition(() => dispatch(form));
      }}
    >
      <fieldset
        className="announcement-fields form-stack"
        disabled={pending}
        key={state.nonce ?? "initial"}
      >
        {children}
        <BlockEditor initialBlocks={blocks} />
        <button type="submit" className="button button-dark" disabled={pending}>
          {pending
            ? "Kaydediliyor…"
            : editing
              ? "Duyuruyu kaydet"
              : "Duyuru ekle"}
        </button>
      </fieldset>
      {(fileError || state.message) && (
        <p
          role="status"
          className={`form-message ${!fileError && state.ok ? "success" : "error"}`}
        >
          {fileError || state.message}
        </p>
      )}
    </form>
  );
}

type EditorBlock = AnnouncementBlockInput & {
  url?: string;
  width?: number;
  height?: number;
};
const newText = (text = ""): EditorBlock => ({
  type: "text",
  id: crypto.randomUUID(),
  text,
});

function BlockEditor({
  initialBlocks,
}: {
  initialBlocks: AnnouncementBlock[];
}) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(initialBlocks);
  const textareas = useRef(new Map<string, HTMLTextAreaElement>());
  const imageCount = blocks.filter((block) => block.type === "image").length;
  const imageLimit =
    imageCount >= MAX_ANNOUNCEMENT_IMAGES || blocks.length > 97;
  function patch(id: string, update: Partial<EditorBlock>) {
    setBlocks((current) =>
      current.map((block) =>
        block.id === id ? ({ ...block, ...update } as EditorBlock) : block,
      ),
    );
  }
  function move(index: number, direction: number) {
    setBlocks((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  }
  function insertImage(index: number) {
    const block = blocks[index];
    const image: EditorBlock = {
      type: "image",
      id: crypto.randomUUID(),
      alt: "",
    };
    const next = [...blocks];
    if (block?.type === "text") {
      const cursor =
        textareas.current.get(block.id)?.selectionStart ?? block.text.length;
      next.splice(
        index,
        1,
        { ...block, text: block.text.slice(0, cursor) },
        image,
        newText(block.text.slice(cursor)),
      );
    } else next.splice(index + 1, 0, image, newText());
    setBlocks(next);
  }
  return (
    <div className="announcement-editor">
      <input
        type="hidden"
        name="content"
        value={JSON.stringify(
          blocks.map((block) =>
            block.type === "text"
              ? { type: block.type, id: block.id, text: block.text }
              : { type: block.type, id: block.id, alt: block.alt },
          ),
        )}
      />
      <div className="field">
        <span>Duyuru içeriği</span>
        <small>
          Metinde bir yere tıkla, ardından “İmleç konumuna görsel ekle”
          düğmesine bas. Blokların sırasını oklarla değiştirebilirsin. Görsel
          eklemek isteğe bağlıdır.
        </small>
      </div>
      {blocks.map((block, index) => (
        <section
          className="announcement-edit-block"
          key={block.id}
          aria-label={`${index + 1}. ${block.type === "text" ? "metin" : "görsel"} bloğu`}
        >
          <div className="announcement-block-toolbar">
            <span>
              {index + 1}. {block.type === "text" ? "Metin" : "Görsel"}
            </span>
            <div className="button-row">
              <button
                type="button"
                className="button button-outline button-small"
                aria-label={`${index + 1}. bloğu yukarı taşı`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="button button-outline button-small"
                aria-label={`${index + 1}. bloğu aşağı taşı`}
                disabled={index === blocks.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="button button-outline button-small"
                disabled={blocks.length === 1}
                onClick={() =>
                  setBlocks((current) =>
                    current.filter((item) => item.id !== block.id),
                  )
                }
              >
                Bloğu kaldır
              </button>
            </div>
          </div>
          {block.type === "text" ? (
            <>
              <label className="field">
                Duyuru metni
                <textarea
                  ref={(node) => {
                    if (node) textareas.current.set(block.id, node);
                    else textareas.current.delete(block.id);
                  }}
                  value={block.text}
                  rows={6}
                  maxLength={20000}
                  onChange={(event) =>
                    patch(block.id, { text: event.target.value })
                  }
                />
              </label>
              <button
                type="button"
                className="button button-outline button-small"
                disabled={imageLimit}
                onClick={() => insertImage(index)}
              >
                İmleç konumuna görsel ekle
              </button>
            </>
          ) : (
            <ImageBlock
              block={block}
              onAlt={(alt) => patch(block.id, { alt })}
            />
          )}
        </section>
      ))}
      <div className="button-row">
        <button
          type="button"
          className="button button-outline button-small"
          disabled={blocks.length >= 100}
          onClick={() => setBlocks((current) => [...current, newText()])}
        >
          Metin ekle
        </button>
        <button
          type="button"
          className="button button-outline button-small"
          disabled={imageLimit}
          onClick={() =>
            setBlocks((current) => [
              ...current,
              { type: "image", id: crypto.randomUUID(), alt: "" },
              newText(),
            ])
          }
        >
          Sona görsel ekle
        </button>
      </div>
      <small>
        En fazla 8 görsel · Dosya başına 3 MB, bir kayıtta toplam 12 MB · Metin
        en fazla 20.000 karakter.
      </small>
    </div>
  );
}

function ImageBlock({
  block,
  onAlt,
}: {
  block: Extract<EditorBlock, { type: "image" }>;
  onAlt: (alt: string) => void;
}) {
  const { input, picked, error, onChange } = useImagePick();
  const src = picked?.url ?? block.url;
  return (
    <div className="form-stack">
      {src && (
        <RemoteImage
          className="announcement-image-preview"
          src={src}
          alt={block.alt || "Görsel önizlemesi"}
          width={block.width ?? 800}
          height={block.height ?? 450}
          sizes="(max-width: 800px) 100vw, 700px"
        />
      )}
      <label className="field">
        Görsel dosyası
        <input
          ref={input}
          type="file"
          name={`announcement-image-${block.id}`}
          accept={acceptedImageTypes}
          required={!block.url}
          onChange={onChange}
        />
        <small>
          JPG, PNG veya WebP.{" "}
          {block.url && "Dosya seçmezsen mevcut görsel korunur."}
        </small>
      </label>
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
      <label className="field">
        Görsel açıklaması (erişilebilirlik)
        <input
          value={block.alt}
          maxLength={200}
          onChange={(event) => onAlt(event.target.value)}
          placeholder="Görseli kısaca tanımla"
        />
      </label>
    </div>
  );
}
