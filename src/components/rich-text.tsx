import type { JSONContent } from "@tiptap/react";
import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import {
  chapterImageNode,
  chapterImageUrl,
} from "@/modules/publishing/image-content";
export function RichText({ content }: { content: JSONContent }) {
  function render(node: JSONContent, key: number): ReactNode {
    const children = node.content?.map(render);
    if (node.type === "text") {
      let text: ReactNode = node.text;
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") text = <strong>{text}</strong>;
        if (mark.type === "italic") text = <em>{text}</em>;
        if (mark.type === "strike") text = <s>{text}</s>;
        if (mark.type === "code") text = <code>{text}</code>;
      }
      return <Fragment key={key}>{text}</Fragment>;
    }
    switch (node.type) {
      case "image": {
        const image = chapterImageNode.safeParse(node);
        if (!image.success) return null;
        // The optimizer must not cache authenticated media or strip session cookies.
        return (
          <Image
            key={key}
            src={chapterImageUrl(image.data.attrs.imageId)}
            alt={image.data.attrs.alt}
            width={1200}
            height={800}
            unoptimized
            className="chapter-inline-image"
          />
        );
      }
      case "paragraph":
        return <p key={key}>{children || <br />}</p>;
      case "heading":
        return node.attrs?.level === 3 ? (
          <h3 key={key}>{children}</h3>
        ) : (
          <h2 key={key}>{children}</h2>
        );
      case "blockquote":
        return <blockquote key={key}>{children}</blockquote>;
      case "bulletList":
        return <ul key={key}>{children}</ul>;
      case "orderedList":
        return (
          <ol key={key} start={node.attrs?.start}>
            {children}
          </ol>
        );
      case "listItem":
        return <li key={key}>{children}</li>;
      case "hardBreak":
        return <br key={key} />;
      case "horizontalRule":
        return <hr key={key} />;
      default:
        return <Fragment key={key}>{children}</Fragment>;
    }
  }
  return <div className="prose-content">{content.content?.map(render)}</div>;
}
