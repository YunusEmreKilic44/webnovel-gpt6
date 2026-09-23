import "server-only";
import { getDb } from "@/db";
import { requireAdmin } from "@/modules/admin/access";

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
    take: 50,
  });
}
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
