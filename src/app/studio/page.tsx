import { Suspense } from "react";
import Link from "next/link";
import { Plus, LayoutDashboard } from "@/components/icons";
import { BlockSkeleton } from "@/components/loading-skeletons";
import { StudioGreeting, StudioBooks } from "./sections";
export default function Studio() {
  return (
    <>
      <div className="studio-heading">
        <div>
          <div className="eyebrow">
            <span /> KELİMELERİN BURADA HAYAT BULUR
          </div>
          <h1>
            Yazar stüdyosu<span className="accent-text">.</span>
          </h1>
          <Suspense fallback={<p>Hikâyelerine kaldığın yerden devam et.</p>}>
            <StudioGreeting />
          </Suspense>
        </div>
        <div className="button-row">
          <Link href="/studio/istatistikler" className="button button-outline">
            <LayoutDashboard size={16} />
            Yazar paneli
          </Link>
          <Link href="/studio/yeni" className="button button-dark">
            <Plus size={16} />
            Yeni kitap
          </Link>
        </div>
      </div>
      <Suspense
        fallback={<BlockSkeleton label="Hikâyelerin yükleniyor" rows={8} />}
      >
        <StudioBooks />
      </Suspense>
    </>
  );
}
