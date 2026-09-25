"use client";
import { Node } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as ProseNode } from "@tiptap/pm/model";
import {
  chapterImageId,
  MAX_CHAPTER_IMAGES,
} from "@/modules/publishing/image-content";

function countImages(doc: ProseNode) {
  let count = 0;
  doc.descendants((node) => {
    if (node.type.name === "image") count++;
  });
  return count;
}

/**
 * Only our media identifiers enter the document; never arbitrary image URLs.
 * The editor itself refuses any change that would push the chapter past
 * MAX_CHAPTER_IMAGES — toolbar, paste, drag-and-drop or duplicating the
 * existing image alike. The server enforces the same limit (parseContent).
 */
export function createChapterImageExtension(
  source: (id: string) => string,
  onLimit?: () => void,
) {
  return Node.create({
    name: "image",
    group: "block",
    atom: true,
    draggable: true,
    addAttributes() {
      return {
        imageId: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-chapter-image"),
        },
        alt: {
          default: "",
          parseHTML: (element) => element.getAttribute("alt") ?? "",
        },
      };
    },
    parseHTML() {
      return [
        {
          tag: "img[data-chapter-image]",
          getAttrs: (element) =>
            chapterImageId.safeParse(element.getAttribute("data-chapter-image"))
              .success
              ? null
              : false,
        },
      ];
    },
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("chapterImageLimit"),
          filterTransaction(transaction, state) {
            if (!transaction.docChanged) return true;
            const after = countImages(transaction.doc);
            // Never block edits that do not add images (e.g. an older draft
            // that already had more, or deleting one).
            if (after <= MAX_CHAPTER_IMAGES || after <= countImages(state.doc))
              return true;
            onLimit?.();
            return false;
          },
        }),
      ];
    },
    renderHTML({ node }) {
      return [
        "img",
        {
          src: source(node.attrs.imageId),
          "data-chapter-image": node.attrs.imageId,
          alt: node.attrs.alt,
          class: "chapter-inline-image",
        },
      ];
    },
  });
}
