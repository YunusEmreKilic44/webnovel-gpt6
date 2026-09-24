import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { completeCoinOrder } from "@/modules/coins/service";

export const runtime = "nodejs";

// iyzico posts the buyer's browser here (form-encoded `token`) after payment.
// It is a cross-site POST, so no session cookie is expected: the token alone
// identifies the order, and completeCoinOrder verifies the payment with iyzico
// server-to-server before crediting anything.
export async function POST(request: NextRequest) {
  let status: "PAID" | "FAILED" | "PENDING" | "ERROR" = "ERROR";
  try {
    const form = await request.formData();
    const token = String(form.get("token") ?? "");
    if (token) {
      status = await completeCoinOrder(getDb(), token);
      revalidatePath("/cuzdan");
    }
  } catch (error) {
    console.error("coins.callback.failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  const result = {
    PAID: "basarili",
    FAILED: "basarisiz",
    PENDING: "beklemede",
    ERROR: "hata",
  }[status];
  // 303 turns iyzico's POST into a GET of the wallet page. The public origin
  // is used because behind a proxy request.nextUrl can be an internal host.
  const origin = process.env.BETTER_AUTH_URL || request.nextUrl.origin;
  return NextResponse.redirect(new URL(`/cuzdan?odeme=${result}`, origin), 303);
}
