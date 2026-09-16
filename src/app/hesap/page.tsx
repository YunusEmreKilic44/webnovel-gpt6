import { requireUser } from "@/lib/session";
import { SignOut } from "@/components/sign-out";
import Link from "next/link";
export const metadata = { title: "Hesabım", robots: { index: false } };
export default async function Account() {
  const user = await requireUser();
  return (
    <div className="auth-wrap">
      <div className="studio-heading">
        <div>
          <h1>Senin alanın.</h1>
          <p>İyi ki buradasın, {user.name}.</p>
        </div>
      </div>
      <div className="panel form-stack">
        <label className="field">
          Görünen adın
          <input value={user.name} readOnly />
        </label>
        <label className="field">
          E-posta adresin
          <input value={user.email} readOnly />
        </label>
        <span className="label-pill">
          {user.emailVerified
            ? "E-posta doğrulandı"
            : "E-posta doğrulaması bekleniyor"}
        </span>
        <Link href="/sifremi-unuttum" className="text-link">
          Şifreni değiştir
        </Link>
        <SignOut />
      </div>
    </div>
  );
}
