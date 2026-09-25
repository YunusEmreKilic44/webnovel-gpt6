import Link from "next/link";
export default function NotFound() {
  return (
    <div className="panel empty-state">
      <h1>Duyuru bulunamadı</h1>
      <p>Bu duyuru kaldırılmış veya henüz yayımlanmamış olabilir.</p>
      <Link className="text-link" href="/duyurular">
        Tüm duyurulara dön →
      </Link>
    </div>
  );
}
