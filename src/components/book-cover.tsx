import Image from "next/image";
import { cn } from "@/lib/utils";
import { coverPresets } from "@/lib/covers";
import type { Book } from "@/db/schema";
import { RemoteImage } from "./remote-image";

export function BookCover({
  title,
  author,
  cover,
  coverUrl,
  subtitle,
  className,
  sizes = "(max-width: 600px) 44vw, (max-width: 1000px) 28vw, 205px",
  eager = false,
}: {
  title: string;
  author?: string;
  cover: Book["cover"];
  /** Uploaded cover; shown as-is (it carries its own title art). */
  coverUrl?: string | null;
  subtitle?: string;
  className?: string;
  sizes?: string;
  eager?: boolean;
}) {
  const artwork = (coverPresets as readonly string[]).includes(cover)
    ? cover
    : "ember";
  const imageProps = {
    fill: true,
    sizes,
    loading: eager ? ("eager" as const) : ("lazy" as const),
    fetchPriority: eager ? ("high" as const) : undefined,
  };
  if (coverUrl)
    return (
      <div className={cn("book-cover", "has-upload", className)}>
        <RemoteImage src={coverUrl} alt={`${title} kapağı`} {...imageProps} />
      </div>
    );
  return (
    <div className={cn("book-cover", `cover-${artwork}`, className)}>
      <Image
        src={`/art/${artwork}.png`}
        alt={`${title} anime kapak illüstrasyonu`}
        quality={60}
        {...imageProps}
      />
      <div className="cover-caption">
        <span className="cover-series">SATIR ORIGINAL</span>
        <strong className="cover-title">{title}</strong>
        {subtitle && <span className="cover-subtitle">{subtitle}</span>}
        {author && <span className="cover-author">{author}</span>}
      </div>
    </div>
  );
}
