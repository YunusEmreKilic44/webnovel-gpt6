import "server-only";
import type { Database } from "@/db";
import type { Prisma } from "@/generated/prisma/client";

// Kept free of other module imports: publishing, coins and the studio all use
// it, and publishing ↔ admin ↔ coins would otherwise import each other.

type Reader = Database | Prisma.TransactionClient;

export const DEFAULT_PREMIUM_RULES = { minChapters: 10, minReads: 500 };

export async function getPremiumRules(db: Reader) {
  const settings = await db.coinSettings.findUnique({
    where: { id: 1 },
    select: { premiumMinChapters: true, premiumMinReads: true },
  });
  return settings
    ? {
        minChapters: settings.premiumMinChapters,
        minReads: settings.premiumMinReads,
      }
    : DEFAULT_PREMIUM_RULES;
}

/**
 * How far a book is from premium eligibility. Only what readers can see
 * counts: published, visible chapters and their recorded reads.
 */
export async function getPremiumProgress(db: Reader, bookId: string) {
  const visibleChapter = { bookId, status: "PUBLISHED", hidden: false };
  const [rules, chapters, reads] = await Promise.all([
    getPremiumRules(db),
    db.chapter.count({ where: visibleChapter }),
    db.chapterRead.count({ where: { chapter: visibleChapter } }),
  ]);
  return {
    ...rules,
    chapters,
    reads,
    eligible: chapters >= rules.minChapters && reads >= rules.minReads,
  };
}
