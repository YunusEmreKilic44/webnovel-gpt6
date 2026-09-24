import Link from "next/link";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { getChapterPrice } from "@/modules/coins/service";
import {
  ChevronDown,
  ChevronRight,
  Coins,
  LockKeyhole,
} from "@/components/icons";
import type { getPublicChapters } from "@/modules/catalog/queries";

type Chapters = Awaited<ReturnType<typeof getPublicChapters>>;

export async function PublicChapterList({ chapters }: { chapters: Chapters }) {
  if (!chapters.length)
    return <p className="notice">Henüz yayımlanmış bölüm yok.</p>;

  // The list itself is cached for everyone; price and the viewer's unlocks are
  // looked up per request, and only when the page has premium chapters.
  const premiumIds = chapters
    .filter((chapter) => chapter.accessType === "PAID")
    .map((chapter) => chapter.id);
  let price = 0;
  const unlocked = new Set<string>();
  if (premiumIds.length) {
    const db = getDb();
    const [chapterPrice, actor] = await Promise.all([
      getChapterPrice(db),
      getCurrentUser(),
    ]);
    price = chapterPrice;
    if (actor)
      for (const unlock of await db.chapterUnlock.findMany({
        where: { userId: actor.id, chapterId: { in: premiumIds } },
        select: { chapterId: true },
      }))
        unlocked.add(unlock.chapterId);
  }

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
              {chapter.accessType !== "PAID" ? (
                <ChevronRight size={14} />
              ) : unlocked.has(chapter.id) ? (
                <span className="label-pill">Açık</span>
              ) : (
                <span
                  className="label-pill amber"
                  title={`Premium bölüm · ${price} coin`}
                >
                  <LockKeyhole size={11} />
                  <Coins size={11} />
                  {price}
                </span>
              )}
            </Link>
          ))}
        </details>
      ))}
    </>
  );
}
