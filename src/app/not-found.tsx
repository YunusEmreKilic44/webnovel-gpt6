import Link from "next/link";
import { BookOpen } from "@/components/icons";
export default function NotFound() {
  return (
    <div className="empty-state">
      <BookOpen size={38} />
      <h2>Bu sayfanın hikâyesi bulunamadı.</h2>
      <p>Bağlantı değişmiş olabilir veya bu içeriğe erişimin olmayabilir.</p>
      <Link href="/" className="button button-dark">
        Keşfetmeye dön
      </Link>
    </div>
  );
}
