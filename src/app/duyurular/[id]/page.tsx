import Link from "next/link";
import { notFound } from "next/navigation";
import { AnnouncementBody } from "@/components/announcement-body";
import { getPublishedAnnouncement } from "@/modules/site-content/queries";
import { announcementExcerpt } from "@/modules/site-content/announcement-content";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const item = await getPublishedAnnouncement((await params).id);
  if (!item) return { title: "Duyuru bulunamadı" };
  return { title: item.title, description: announcementExcerpt(item.body) };
}
export default async function Page({ params }: Props) {
  const item = await getPublishedAnnouncement((await params).id);
  if (!item) notFound();
  return (
    <div className="announcements-page">
      <Link className="text-link" href="/duyurular">
        ← Tüm duyurular
      </Link>
      <article className="announcement-detail panel">
        <header className="page-heading">
          <div>
            <div className="eyebrow">
              <span /> DUYURU
            </div>
            <h1>{item.title}</h1>
            <time dateTime={item.createdAt.toISOString()}>
              {item.createdAt.toLocaleDateString("tr-TR", {
                dateStyle: "long",
                timeZone: "Europe/Istanbul",
              })}
            </time>
          </div>
        </header>
        <AnnouncementBody content={item.content} body={item.body} />
        {item.linkPath && (
          <Link className="button button-outline" href={item.linkPath}>
            {item.linkLabel} →
          </Link>
        )}
      </article>
    </div>
  );
}
