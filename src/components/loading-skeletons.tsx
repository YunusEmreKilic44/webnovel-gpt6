export function BlockSkeleton({
  label = "İçerik yükleniyor",
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div className="loading-block" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div className="skeleton skeleton-line" key={i} />
        ))}
      </div>
    </div>
  );
}

export function BookGridSkeleton() {
  return (
    <div role="status" aria-label="Kitaplar yükleniyor">
      <span className="sr-only">Kitaplar yükleniyor</span>
      <div className="book-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i}>
            <div className="skeleton skeleton-cover" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line skeleton-short" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <section
      className="home-hero skeleton-hero"
      role="status"
      aria-label="Öne çıkan hikâye yükleniyor"
    >
      <div className="hero-inner">
        <div className="hero-copy">
          <span className="sr-only">Öne çıkan hikâye yükleniyor</span>
          <div aria-hidden="true">
            <div className="skeleton skeleton-line skeleton-short" />
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-button" />
          </div>
        </div>
        {/* Mirrors the edition badge of the loaded hero so the copy column
            keeps its width and nothing shifts when the data arrives. */}
        <div className="hero-edition" aria-hidden="true">
          <span>SPOTLIGHT</span>
          <strong>
            <span className="skeleton skeleton-edition" />
          </strong>
        </div>
      </div>
    </section>
  );
}

export function ButtonSkeleton({ label = "Yükleniyor" }: { label?: string }) {
  return (
    <span
      className="skeleton skeleton-button"
      role="status"
      aria-label={label}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="page-loading" aria-label="Sayfa yükleniyor" role="status">
      <span className="sr-only">Sayfa yükleniyor</span>
      <div className="skeleton skeleton-title" aria-hidden="true" />
      <BlockSkeleton />
    </div>
  );
}
