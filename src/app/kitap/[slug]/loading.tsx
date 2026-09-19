import { BlockSkeleton } from "@/components/loading-skeletons";

export default function BookLoading() {
  return (
    <>
      <section className="book-detail-header">
        <div
          className="detail-cover skeleton skeleton-cover"
          aria-hidden="true"
        />
        <div className="detail-heading">
          <div className="skeleton skeleton-title" aria-hidden="true" />
          <BlockSkeleton label="Kitap yükleniyor" rows={4} />
        </div>
      </section>
      <BlockSkeleton label="Bölümler yükleniyor" rows={6} />
    </>
  );
}
