import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const slide = await getDb().homeSlide.findUnique({
    where: { id },
    select: { published: true, imageUrl: true, imagePreset: true },
  });
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!slide) return new Response(null, { status: 404, headers });
  if (!slide.published) {
    const actor = await getCurrentUser();
    if (!actor || actor.role !== "admin" || !actor.emailVerified)
      return new Response(null, { status: 404, headers });
  }
  if (slide.imageUrl)
    return new Response(null, {
      status: 307,
      headers: { ...headers, Location: slide.imageUrl },
    });
  // Legacy bytes are only loaded when there is no Cloudinary copy.
  const legacy = await getDb().homeSlide.findUnique({
    where: { id },
    select: { imageData: true },
  });
  if (!legacy?.imageData)
    return new Response(null, {
      status: 307,
      headers: {
        ...headers,
        Location: new URL(`/art/${slide.imagePreset}.png`, request.url).href,
      },
    });
  return new Response(new Uint8Array(legacy.imageData), {
    headers: { ...headers, "Content-Type": "image/webp" },
  });
}
