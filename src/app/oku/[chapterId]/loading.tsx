import { BlockSkeleton } from "@/components/loading-skeletons";

export default function ReaderLoading() {
  return (
    <div className="reader-loading">
      <div className="skeleton skeleton-title" aria-hidden="true" />
      <BlockSkeleton label="Bölüm yükleniyor" rows={10} />
    </div>
  );
}
