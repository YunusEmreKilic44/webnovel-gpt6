import "server-only";
import { getDb } from "@/db";
import { requireAdmin } from "@/modules/admin/access";
import { cache } from "react";

const slideSelect = {
  id: true,
  title: true,
  description: true,
  linkPath: true,
  linkLabel: true,
  imagePreset: true,
  imageUrl: true,
  imageAlt: true,
  published: true,
  position: true,
  updatedAt: true,
} as const;
const orderBy = [
  { position: "asc" as const },
  { createdAt: "asc" as const },
  { id: "asc" as const },
];

export async function getAnnouncements() {
  return getDb().announcement.findMany({
    where: { published: true },
    orderBy,
    select: { id: true, title: true, body: true, createdAt: true },
    take: 3,
  });
}
export const ANNOUNCEMENTS_PAGE_SIZE = 12;
export async function getAnnouncementArchive(requestedPage = 1) {
  const db = getDb();
  const total = await db.announcement.count({ where: { published: true } });
  const pages = Math.max(1, Math.ceil(total / ANNOUNCEMENTS_PAGE_SIZE));
  const page = Math.min(
    pages,
    Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1),
  );
  const rows = await db.announcement.findMany({
    where: { published: true },
    orderBy,
    select: { id: true, title: true, body: true, createdAt: true },
    skip: (page - 1) * ANNOUNCEMENTS_PAGE_SIZE,
    take: ANNOUNCEMENTS_PAGE_SIZE,
  });
  return { rows, page, pages, total };
}
export const getPublishedAnnouncement = cache(async (id: string) =>
  getDb().announcement.findFirst({ where: { id, published: true } }),
);
export async function getHomeSlides() {
  const slides = await getDb().homeSlide.findMany({
    where: { published: true },
    select: slideSelect,
    orderBy,
    take: 20,
  });
  return slides.map(({ updatedAt, ...slide }) => ({
    ...slide,
    imageUrl: slideImageUrl({ ...slide, updatedAt }),
  }));
}
/** Cloudinary URL when uploaded; otherwise the route serving legacy bytes or the preset. */
export function slideImageUrl(slide: {
  id: string;
  imageUrl: string | null;
  updatedAt: Date;
}) {
  return (
    slide.imageUrl ??
    `/api/slides/${slide.id}/image?v=${slide.updatedAt.getTime()}`
  );
}
export async function getAdminAnnouncements() {
  await requireAdmin();
  return getDb().announcement.findMany({ orderBy });
}
export async function getAdminSlides() {
  await requireAdmin();
  const db = getDb();
  // Legacy rows keep bytes in the DB; only their ids are read, never the data.
  const [slides, legacy] = await Promise.all([
    db.homeSlide.findMany({ select: slideSelect, orderBy }),
    db.homeSlide.findMany({
      where: { imageData: { not: null } },
      select: { id: true },
    }),
  ]);
  const legacyIds = new Set(legacy.map((slide) => slide.id));
  return slides.map((slide) => ({
    ...slide,
    hasImage: Boolean(slide.imageUrl) || legacyIds.has(slide.id),
    currentImageUrl: slideImageUrl(slide),
  }));
}
