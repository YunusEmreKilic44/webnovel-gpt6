import { Suspense } from "react";
import Link from "next/link";
import { AdminHeading } from "@/components/admin-ui";
import { BlockSkeleton } from "@/components/loading-skeletons";
import { SlideForm, DeleteContentForm } from "@/components/site-content-forms";
import { RemoteImage } from "@/components/remote-image";
import { getAdminSlides } from "@/modules/site-content/queries";

export const metadata = { title: "Slider yönetimi" };
export default function Page() {
  return (
    <Suspense fallback={<BlockSkeleton label="Slaytlar yükleniyor" />}>
      <Slides />
    </Suspense>
  );
}
async function Slides() {
  const rows = await getAdminSlides();
  const published = rows.filter((slide) => slide.published);
  const nextPosition = Math.min(
    9999,
    Math.max(0, ...rows.map((slide) => slide.position)) + 1,
  );
  return (
    <>
      <AdminHeading
        title="Ana sayfa sliderı"
        description="Slider sayfalarını görüntüle, içeriklerini düzenle ve yayın sırasını belirle. Yayındaki sayfalar 6 saniyede bir otomatik değişir."
      />
      <div className="slider-admin-toolbar">
        <Link
          className="button button-outline"
          href="/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ana sayfada önizle ↗
        </Link>
        <a className="button button-dark" href="#new-slide">
          Yeni sayfa ekle
        </a>
      </div>
      <div className="slider-admin-stats" aria-label="Slider özeti">
        <div>
          <strong>{rows.length}</strong>
          <span>Toplam sayfa</span>
        </div>
        <div>
          <strong>{published.length}</strong>
          <span>Yayında</span>
        </div>
        <div>
          <strong>{rows.length - published.length}</strong>
          <span>Taslak</span>
        </div>
      </div>
      <p className="slider-admin-note">
        {published.length === 0
          ? "Yayında sayfa yok. Bir sayfayı düzenleyip ‘Ana sayfada yayımla’ seçeneğini işaretle."
          : published.length === 1
            ? "Ana sayfada 1 sayfa var. Otomatik geçiş için en az 2 sayfa yayımla."
            : `Ana sayfada ${published.length} sayfa sırayla gösteriliyor. Sayfa numaraları yalnızca yayındaki sayfalara aittir.`}
      </p>
      <div className="slider-admin-list" aria-label="Slider sayfaları">
        {rows.map((item) => {
          const pageNumber =
            published.findIndex((slide) => slide.id === item.id) + 1;
          return (
            <article
              className="panel slider-admin-card"
              key={`${item.id}:${item.updatedAt.getTime()}`}
              aria-label={item.title}
            >
              <div className="slider-admin-overview">
                <div className="slider-admin-image">
                  <RemoteImage
                    src={item.currentImageUrl}
                    alt={item.imageAlt || item.title}
                    fill
                    sizes="(max-width: 700px) 100vw, 280px"
                  />
                  <span className="slider-admin-page">
                    {item.published
                      ? `${pageNumber} / ${published.length}`
                      : "Taslak"}
                  </span>
                </div>
                <div className="slider-admin-copy">
                  <div className="slider-admin-badges">
                    <span
                      className={`label-pill ${item.published ? "" : "gray"}`}
                    >
                      {item.published
                        ? `${pageNumber}. sayfa · Yayında`
                        : "Taslak · Ana sayfada görünmüyor"}
                    </span>
                    <span className="label-pill gray">
                      Sıra: {item.position}
                    </span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.description || "Açıklama eklenmemiş."}</p>
                  {item.linkPath ? (
                    <Link className="text-link" href={item.linkPath}>
                      {item.linkLabel} → <span>{item.linkPath}</span>
                    </Link>
                  ) : (
                    <small>Bu sayfada bağlantı düğmesi yok.</small>
                  )}
                </div>
              </div>
              <div className="slider-admin-actions">
                <details className="content-editor slider-admin-edit">
                  <summary>Sayfayı düzenle</summary>
                  <SlideForm item={item} />
                </details>
                <DeleteContentForm kind="slide" id={item.id} />
              </div>
            </article>
          );
        })}
        {!rows.length && (
          <div className="admin-empty">
            Henüz slider sayfası yok. Aşağıdaki formdan ilk sayfanı ekle.
          </div>
        )}
      </div>
      <section
        className="panel slider-admin-new"
        id="new-slide"
        aria-labelledby="new-slide-heading"
      >
        <h2 id="new-slide-heading">Yeni sayfa ekle</h2>
        <p>
          Görseli ve metinleri seç. Ana sayfada görünmesi için yayın seçeneğini
          işaretle. En fazla 20 sayfa ekleyebilirsin.
        </p>
        {rows.length < 20 ? (
          <SlideForm defaultPosition={nextPosition} />
        ) : (
          <p role="status">
            20 sayfa sınırına ulaştın. Yeni sayfa eklemek için mevcut
            sayfalardan birini sil.
          </p>
        )}
      </section>
    </>
  );
}
