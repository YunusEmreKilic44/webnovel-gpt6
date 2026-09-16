import { cn } from "@/lib/utils";
import type { Book } from "@/db/schema";

export function BookCover({
  title,
  author,
  cover,
  subtitle,
  className,
}: {
  title: string;
  author?: string;
  cover: Book["cover"];
  subtitle?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("book-cover", `cover-${cover}`, className)}
      aria-hidden="true"
    >
      <div className="cover-spine" />
      <div className="cover-border" />
      <div className="cover-top">BİR SATIR, BİN DÜNYA</div>
      <svg className="cover-art" viewBox="0 0 200 230" fill="none">
        <circle
          cx="100"
          cy="85"
          r="54"
          stroke="currentColor"
          strokeWidth=".6"
          opacity=".5"
        />
        <circle
          cx="100"
          cy="85"
          r="43"
          stroke="currentColor"
          strokeWidth=".5"
          opacity=".3"
        />
        <path
          d="M100 20L107 73L141 52L114 83L159 92L113 99L139 131L106 109L100 158L94 109L61 131L87 99L41 92L86 83L59 52L93 73Z"
          fill="currentColor"
          opacity=".7"
        />
        <circle cx="100" cy="90" r="9" fill="currentColor" />
        <path
          d="M0 207L39 147L69 179L106 126L149 174L175 143L200 194V230H0Z"
          fill="currentColor"
          opacity=".13"
        />
        <path
          d="M0 222L46 178L88 205L122 165L169 202L200 182V230H0Z"
          fill="currentColor"
          opacity=".18"
        />
        <path
          d="M30 52h8m-4-4v8M161 38h8m-4-4v8M155 131h6m-3-3v6M40 117h6m-3-3v6"
          stroke="currentColor"
          strokeWidth=".8"
        />
      </svg>
      <div className="cover-title">{title}</div>
      {subtitle && <div className="cover-subtitle">{subtitle}</div>}
      <div className="cover-author">{author}</div>
    </div>
  );
}
