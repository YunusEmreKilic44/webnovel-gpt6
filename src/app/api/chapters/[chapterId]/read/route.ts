import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { recordChapterRead } from "@/modules/analytics/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> },
) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
  const { chapterId } = await params;
  if (!chapterId || chapterId.length > 128) {
    return new NextResponse(null, { status: 400 });
  }
  const actor = await getCurrentUser();
  const existingVisitor = request.cookies.get("satir-reader")?.value;
  const visitorId =
    existingVisitor && /^[0-9a-f-]{36}$/i.test(existingVisitor)
      ? existingVisitor
      : randomUUID();
  await recordChapterRead(
    getDb(),
    chapterId,
    actor ? { userId: actor.id } : { visitorId },
  );
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Cache-Control", "no-store");
  if (!actor && visitorId !== existingVisitor) {
    response.cookies.set("satir-reader", visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
