import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { chapterImageId } from "@/modules/publishing/image-content";
import { getReadableChapterImage } from "@/modules/publishing/images";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Cookie",
  };
  if (!chapterImageId.safeParse(id).success)
    return new Response(null, { status: 404, headers });
  const actor = await getCurrentUser();
  const data = await getReadableChapterImage(getDb(), id, actor?.id ?? null);
  if (!data) return new Response(null, { status: 404, headers });
  return new Response(new Uint8Array(data), {
    headers: { ...headers, "Content-Type": "image/webp" },
  });
}
