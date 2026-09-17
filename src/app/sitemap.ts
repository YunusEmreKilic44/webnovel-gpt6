import type { MetadataRoute } from "next";
import { getDb } from "@/db";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const published = await getDb().book.findMany({
    where: { status: "PUBLISHED", hidden: false },
    select: { slug: true, updatedAt: true },
    take: 49000,
  });
  return [
    { url: origin, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/kesfet`, changeFrequency: "daily", priority: 0.8 },
    ...published.map((book) => ({
      url: `${origin}/kitap/${book.slug}`,
      lastModified: book.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
