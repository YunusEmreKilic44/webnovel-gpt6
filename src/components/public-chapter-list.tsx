import Link from "next/link";
import { ChevronDown, ChevronRight, LockKeyhole } from "@/components/icons";
import { money } from "@/lib/utils";
import type { getPublicChapters } from "@/modules/catalog/queries";

type Chapters = Awaited<ReturnType<typeof getPublicChapters>>;

export function PublicChapterList({ chapters }: { chapters: Chapters }) {
  if (!chapters.length)
    return <p className="notice">Henüz yayımlanmış bölüm yok.</p>;

  const groups = new Map<string, Chapters>();
  for (const chapter of chapters) {
    const group = groups.get(chapter.volumeId);
    if (group) group.push(chapter);
    else groups.set(chapter.volumeId, [chapter]);
  }

  return (
    <>
      {[...groups].map(([volumeId, items]) => (
        <details className="chapter-group" open key={volumeId}>
          <summary>
            <ChevronDown size={14} />
            Cilt {items[0].volumePosition} · {items[0].volumeTitle}
            <small>{items.length} bölüm</small>
          </summary>
          {items.map((chapter) => (
            <Link
              href={`/oku/${chapter.id}`}
              className="chapter-row"
              key={chapter.id}
            >
              <span className="chapter-position">
                {String(chapter.position).padStart(2, "0")}
              </span>
              <span>{chapter.title}</span>
              {chapter.accessType === "PAID" ? (
                <span className="label-pill amber">
                  <LockKeyhole size={11} />
                  {money(chapter.priceMinor)}
                </span>
              ) : (
                <ChevronRight size={14} />
              )}
            </Link>
          ))}
        </details>
      ))}
    </>
  );
}
