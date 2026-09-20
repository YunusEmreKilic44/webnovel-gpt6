import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Book } from "@/db/schema";

const covers = ["ember", "ocean", "forest", "violet", "sand", "rose"];
export function BookCover({
  title,
  author,
  cover,
  subtitle,
  className,
  sizes = "(max-width: 600px) 44vw, (max-width: 1000px) 28vw, 205px",
  eager = false,
}: {
  title: string;
  author?: string;
  cover: Book["cover"];
  subtitle?: string;
  className?: string;
  sizes?: string;
  eager?: boolean;
}) {
  const artwork = covers.includes(cover) ? cover : "ember";
  return (
    <div className={cn("book-cover", `cover-${artwork}`, className)}>
      <Image
        src={`/art/${artwork}.png`}
        alt={`${title} anime kapak illüstrasyonu`}
        fill
        sizes={sizes}
        quality={60}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
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
