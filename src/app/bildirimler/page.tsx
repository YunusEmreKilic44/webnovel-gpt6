import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getChapterPrice } from "@/modules/coins/service";
import {
  getNotifications,
  getUnreadCount,
} from "@/modules/notifications/service";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  openNotificationAction,
} from "@/modules/notifications/actions";
import { BookCover } from "@/components/book-cover";
import { BlockSkeleton } from "@/components/loading-skeletons";
import {
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  Coins,
  Flag,
  Library,
  LockKeyhole,
  XCircle,
} from "@/components/icons";
import {
  reportReasons,
  reportTargetLabels,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/reports";

export const metadata = {
  title: "Bildirimler",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ filtre?: string }> };

const timeFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

export default function NotificationsPage(props: Props) {
  return (
    <div className="account-page notifications-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span />
            SENİN İÇİN HABERLER
          </div>
          <h1>
            Bildirimler<span className="accent-text">.</span>
          </h1>
          <p>
            Yeni bölümler, başvuru kararların ve şikâyetlerinin sonuçları
            burada.
          </p>
        </div>
      </div>
      <Suspense
        fallback={<BlockSkeleton label="Bildirimler yükleniyor" rows={6} />}
      >
        <Notifications {...props} />
      </Suspense>
    </div>
  );
}

async function Notifications({ searchParams }: Props) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const filter = query.filtre === "okunmamis" ? "unread" : "all";
  const db = getDb();
  const [items, unread, price] = await Promise.all([
    getNotifications(db, user.id, { filter }),
    getUnreadCount(db, user.id),
    getChapterPrice(db),
  ]);
  return (
    <>
      <div className="notifications-toolbar">
        <nav className="segmented" aria-label="Bildirim filtresi">
          <Link
            href="/bildirimler"
            aria-current={filter === "all" ? "page" : undefined}
          >
            Tümü
          </Link>
          <Link
            href="/bildirimler?filtre=okunmamis"
            aria-current={filter === "unread" ? "page" : undefined}
          >
            Okunmamış{unread ? ` (${unread})` : ""}
          </Link>
        </nav>
        {unread > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button
              type="submit"
              className="button button-outline button-small"
            >
              <Check size={14} /> Tümünü okundu işaretle
            </button>
          </form>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <Bell size={32} />
          <h2>
            {filter === "unread"
              ? "Okunmamış bildirimin yok."
              : "Henüz bildirimin yok."}
          </h2>
          <p>
            Bir kitabı kütüphanene eklediğinde, yeni bölüm yayımlanınca sana
            haber veririz.
          </p>
          <Link href="/kutuphanem" className="button button-outline">
            <Library size={16} /> Kütüphaneme git
          </Link>
        </div>
      ) : (
        <ul className="notification-list">
          {items.map((item) => {
            const unreadItem = !item.readAt;
            const text = describe(item, price);
            return (
              <li
                key={item.id}
                className={cn("notification", unreadItem && "is-unread")}
              >
                <form
                  action={openNotificationAction}
                  className="notification-open"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit">
                    {item.book ? (
                      <BookCover
                        title={item.book.title}
                        cover={item.book.cover}
                        coverUrl={item.book.coverUrl}
                        sizes="44px"
                      />
                    ) : (
                      <span
                        className={cn("notification-icon", text.tone)}
                        aria-hidden="true"
                      >
                        <text.Icon size={20} />
                      </span>
                    )}
                    <span className="notification-text">
                      <span className="notification-title">{text.title}</span>
                      <span className="notification-chapter">{text.body}</span>
                      {text.note && (
                        <span className="notification-note">{text.note}</span>
                      )}
                      <span className="notification-meta">
                        <time dateTime={item.createdAt.toISOString()}>
                          {timeFormat.format(item.createdAt)}
                        </time>
                        {text.badge}
                      </span>
                    </span>
                    {unreadItem && (
                      <span className="notification-dot">
                        <span className="sr-only">Okunmamış</span>
                      </span>
                    )}
                  </button>
                </form>
                {unreadItem && (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      className="icon-button notification-mark"
                      aria-label="Bildirimi okundu işaretle"
                      title="Okundu işaretle"
                    >
                      <Check size={16} />
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

type Item = Awaited<ReturnType<typeof getNotifications>>[number];

/** Title, body and badge for each notification kind. */
function describe(item: Item, price: number) {
  const bookTitle = <strong>{item.book?.title ?? "Kitabın"}</strong>;
  if (item.type === "NEW_CHAPTER") {
    const chapter = item.chapter;
    return {
      Icon: Bell,
      tone: "",
      title: <>{bookTitle} kitabına yeni bölüm eklendi</>,
      body: chapter
        ? `Bölüm ${chapter.position} · ${chapter.publishedTitle}`
        : "Yeni bölüm",
      note: null,
      badge:
        chapter?.accessType === "PAID" ? (
          chapter.unlocked ? (
            <span className="label-pill">Açık</span>
          ) : (
            <span className="label-pill amber">
              <LockKeyhole size={11} /> Premium · <Coins size={11} /> {price}{" "}
              coin
            </span>
          )
        ) : null,
    };
  }
  if (item.type === "NEW_BOOK")
    return {
      Icon: BookOpen,
      tone: "",
      title: <>Takip ettiğin yazar yeni bir kitap yayımladı</>,
      body: item.book?.title ?? "Yeni kitap",
      note: null,
      badge: <span className="label-pill">Yeni kitap</span>,
    };
  if (
    item.type === "APPLICATION_APPROVED" ||
    item.type === "APPLICATION_REJECTED"
  ) {
    const approved = item.type === "APPLICATION_APPROVED";
    const premium = item.application?.type === "PREMIUM";
    return {
      Icon: approved ? CheckCircle2 : XCircle,
      tone: approved ? "is-good" : "is-bad",
      title: (
        <>
          {bookTitle} {premium ? "premium başvurun" : "yayın başvurun"}{" "}
          {approved ? "onaylandı" : "reddedildi"}
        </>
      ),
      body: approved
        ? premium
          ? "Artık yeni bölümlerini premium yapabilirsin."
          : "Kitabın yayında! İncelenen bölümlerin okurlarla buluştu."
        : "Düzenleme yapıp yeniden başvurabilirsin.",
      note: item.application?.note
        ? `Editör notu: ${item.application.note}`
        : null,
      badge: (
        <span className={cn("label-pill", !approved && "gray")}>
          {approved ? "Onaylandı" : "Reddedildi"}
        </span>
      ),
    };
  }
  const resolved = item.type === "REPORT_RESOLVED";
  const target = item.report
    ? (reportTargetLabels[item.report.targetType as ReportTargetType] ??
      "İçerik")
    : "İçerik";
  return {
    Icon: Flag,
    tone: resolved ? "is-good" : "",
    title: <>{target} hakkındaki şikâyetin sonuçlandı</>,
    body: resolved
      ? "İnceledik ve gerekli işlemi yaptık. Bildirdiğin için teşekkürler."
      : "İnceledik; topluluk kurallarına aykırı bir durum bulamadık. Yine de bildirdiğin için teşekkürler.",
    note: item.report
      ? `Şikâyet sebebin: ${reportReasons[item.report.reason as ReportReason] ?? item.report.reason}`
      : null,
    badge: (
      <span className={cn("label-pill", !resolved && "gray")}>
        {resolved ? "İşlem yapıldı" : "İhlal bulunmadı"}
      </span>
    ),
  };
}
