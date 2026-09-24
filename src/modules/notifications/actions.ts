"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { markAllNotificationsRead, markNotificationRead } from "./service";

// Plain form actions (no client state): opening is a POST, so link prefetching
// can never mark a notification read before the reader actually clicks it.

/** Marks the notification read and goes to what it is about. */
export async function openNotificationAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const target = await markNotificationRead(
    getDb(),
    user.id,
    String(form.get("id") ?? ""),
  );
  revalidatePath("/", "layout");
  // The reader page enforces access: premium chapters stay locked until unlocked.
  redirect(target ?? "/bildirimler");
}

export async function markNotificationReadAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  await markNotificationRead(getDb(), user.id, String(form.get("id") ?? ""));
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  await markAllNotificationsRead(getDb(), user.id);
  revalidatePath("/", "layout");
}
