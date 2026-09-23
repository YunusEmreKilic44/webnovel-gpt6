import "server-only";
import { getDb } from "@/db";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "./access";

export type SearchParams = Record<string, string | string[] | undefined>;
export const PAGE_SIZE = 20;
export function adminFilters(params: SearchParams) {
  const text = (key: string) =>
    typeof params[key] === "string" ? params[key].trim().slice(0, 100) : "";
  const page = Number(text("page"));
  return {
    q: text("q"),
    filter: text("filter"),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1,
  };
}
export type Filters = ReturnType<typeof adminFilters>;
const paging = ({ page }: Filters) => ({
  skip: (page - 1) * PAGE_SIZE,
  take: PAGE_SIZE,
});
export const userSummary = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerified: true,
  createdAt: true,
  banned: true,
} as const;

export async function getAdminOverview() {
  await requireAdmin();
  const db = getDb();
  const [users, books, published, pending, hiddenComments, reads, recent] =
    await Promise.all([
      db.user.count(),
      db.book.count(),
      db.book.count({ where: { status: "PUBLISHED", hidden: false } }),
      db.application.count({ where: { status: "PENDING" } }),
      db.comment.count({ where: { hidden: true } }),
      db.chapterRead.count(),
      db.auditLog.findMany({
        select: {
          id: true,
          action: true,
          targetId: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 6,
      }),
    ]);
  return { users, books, published, pending, hiddenComments, reads, recent };
}
export async function getAdminUsers(filters: Filters) {
  await requireAdmin();
  const where: Prisma.UserWhereInput = {
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { email: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.filter === "banned"
      ? { banned: true }
      : filters.filter === "active"
        ? { banned: false }
        : filters.filter === "admin"
          ? { role: "admin" }
          : filters.filter === "unverified"
            ? { emailVerified: false }
            : filters.filter === "authors"
              ? { books: { some: {} } }
              : {}),
  };
  const [rows, total] = await Promise.all([
    getDb().user.findMany({
      where,
      select: {
        ...userSummary,
        _count: { select: { books: true, comments: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...paging(filters),
    }),
    getDb().user.count({ where }),
  ]);
  return { rows, total };
}
export async function getAdminUser(id: string) {
  await requireAdmin();
  return getDb().user.findUnique({
    where: { id },
    select: {
      ...userSummary,
      banReason: true,
      bannedAt: true,
      _count: {
        select: {
          books: true,
          comments: true,
          libraryEntries: true,
          sessions: { where: { expiresAt: { gt: new Date() } } },
        },
      },
      books: {
        select: { id: true, title: true, status: true, hidden: true },
        orderBy: { updatedAt: "desc" },
        take: 10,
      },
    },
  });
}
export async function getAdminBooks(filters: Filters) {
  await requireAdmin();
  const where: Prisma.BookWhereInput = {
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q, mode: "insensitive" } },
            { author: { name: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(filters.filter === "PUBLISHED"
      ? { status: "PUBLISHED", hidden: false }
      : filters.filter === "hidden"
        ? { hidden: true }
        : filters.filter === "featured"
          ? { featured: true }
          : ["PUBLISHED", "DRAFT", "APPROVED", "ARCHIVED"].includes(
                filters.filter,
              )
            ? { status: filters.filter }
            : {}),
  };
  const [rows, total] = await Promise.all([
    getDb().book.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        hidden: true,
        featured: true,
        genre: true,
        author: { select: { id: true, name: true } },
        _count: { select: { chapters: true, comments: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      ...paging(filters),
    }),
    getDb().book.count({ where }),
  ]);
  return { rows, total };
}
export async function getAdminBook(id: string) {
  await requireAdmin();
  const [book, reads, rating] = await Promise.all([
    getDb().book.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        genre: true,
        cover: true,
        coverUrl: true,
        status: true,
        storyStatus: true,
        hidden: true,
        featured: true,
        premiumStatus: true,
        author: { select: { id: true, name: true } },
        _count: {
          select: { chapters: true, libraryEntries: true, comments: true },
        },
      },
    }),
    getDb().chapterRead.count({ where: { chapter: { bookId: id } } }),
    getDb().rating.aggregate({
      where: { bookId: id },
      _avg: { score: true },
      _count: true,
    }),
  ]);
  return book ? { ...book, reads, rating } : null;
}
export async function getAdminChapters(bookId: string, filters: Filters) {
  await requireAdmin();
  return getDb().chapter.findMany({
    where: { bookId },
    select: {
      id: true,
      title: true,
      position: true,
      status: true,
      hidden: true,
      accessType: true,
      volume: { select: { title: true, position: true } },
      _count: { select: { reads: true } },
    },
    orderBy: [{ volume: { position: "asc" } }, { position: "asc" }],
    ...paging(filters),
  });
}
export async function getAdminComments(filters: Filters) {
  await requireAdmin();
  const where: Prisma.CommentWhereInput = {
    ...(filters.q
      ? {
          OR: [
            { body: { contains: filters.q, mode: "insensitive" } },
            { user: { name: { contains: filters.q, mode: "insensitive" } } },
            { book: { title: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(filters.filter === "hidden"
      ? { hidden: true }
      : filters.filter === "visible"
        ? { hidden: false }
        : filters.filter === "spoiler"
          ? { spoiler: true }
          : {}),
  };
  const [rows, total] = await Promise.all([
    getDb().comment.findMany({
      where,
      select: {
        id: true,
        body: true,
        hidden: true,
        spoiler: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
        book: { select: { id: true, title: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...paging(filters),
    }),
    getDb().comment.count({ where }),
  ]);
  return { rows, total };
}

export async function getAdminChapter(bookId: string, chapterId: string) {
  await requireAdmin();
  return getDb().chapter.findFirst({
    where: { id: chapterId, bookId },
    select: {
      id: true,
      title: true,
      publishedTitle: true,
      content: true,
      publishedContent: true,
      status: true,
      hidden: true,
      version: true,
      accessType: true,
      firstPublishedAt: true,
      book: { select: { id: true, title: true } },
      volume: { select: { title: true, position: true } },
      _count: { select: { reads: true } },
    },
  });
}
export async function getAdminApplications(filters: Filters) {
  await requireAdmin();
  const where: Prisma.ApplicationWhereInput = {
    ...(filters.q
      ? { book: { title: { contains: filters.q, mode: "insensitive" } } }
      : {}),
    ...(["PENDING", "APPROVED", "REJECTED"].includes(filters.filter)
      ? { status: filters.filter }
      : ["PUBLICATION", "PREMIUM"].includes(filters.filter)
        ? { type: filters.filter }
        : {}),
  };
  const [rows, total, pending] = await Promise.all([
    getDb().application.findMany({
      where,
      include: { book: { select: { author: { select: { name: true } } } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...paging(filters),
    }),
    getDb().application.count({ where }),
    getDb().application.count({ where: { status: "PENDING" } }),
  ]);
  return { rows, total, pending };
}
export async function getAdminAudit(filters: Filters) {
  await requireAdmin();
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.q
      ? {
          OR: [
            { targetId: { contains: filters.q, mode: "insensitive" } },
            { actor: { name: { contains: filters.q, mode: "insensitive" } } },
            { detail: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.filter ? { action: filters.filter } : {}),
  };
  const [rows, total] = await Promise.all([
    getDb().auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        targetId: true,
        detail: true,
        createdAt: true,
        actor: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...paging(filters),
    }),
    getDb().auditLog.count({ where }),
  ]);
  return { rows, total };
}
