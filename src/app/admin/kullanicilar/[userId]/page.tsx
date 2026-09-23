import { Suspense } from "react";
import Link from "next/link";
import { UserBanControl } from "@/components/user-ban-control";
import { notFound } from "next/navigation";
import { BlockSkeleton } from "@/components/loading-skeletons";
import { ActionForm, SubmitButton } from "@/components/action-form";
import {
  AdminHeading,
  AdminEmpty,
  ReasonField,
  statusLabels,
  fullDate,
} from "@/components/admin-ui";
import { getAdminUser } from "@/modules/admin/queries";
import { requireAdmin } from "@/modules/admin/access";
import {
  updateUserAction,
  revokeSessionsAction,
} from "@/modules/admin/actions";

export const metadata = { title: "Kullanıcı ayrıntıları" };
type Props = { params: Promise<{ userId: string }> };
export default function UserPage(props: Props) {
  return (
    <Suspense
      fallback={<BlockSkeleton label="Kullanıcı yükleniyor" rows={8} />}
    >
      <UserDetail {...props} />
    </Suspense>
  );
}
async function UserDetail({ params }: Props) {
  const [actor, user] = await Promise.all([
    requireAdmin(),
    params.then(({ userId }) => getAdminUser(userId)),
  ]);
  if (!user) notFound();
  const self = actor.id === user.id;
  return (
    <>
      <AdminHeading
        title={user.name}
        description={`${user.email} · Kayıt: ${fullDate(user.createdAt)}`}
        back={{ href: "/admin/kullanicilar", label: "Kullanıcılar" }}
      />
      <div className="admin-stat-grid">
        {[
          ["Kitap", user._count.books],
          ["Yorum", user._count.comments],
          ["Kütüphane", user._count.libraryEntries],
        ].map(([label, value]) => (
          <div className="admin-stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <h2>Hesap durumu · {user.banned ? "Banlı" : "Aktif"}</h2>
        {user.banned && (
          <p>
            Ban gerekçesi: {user.banReason}
            {user.bannedAt ? ` · ${fullDate(user.bannedAt)}` : ""}
          </p>
        )}
        <p>
          Banlanan kullanıcı giriş yapamaz, yorum veya beğeni ekleyemez ve yazar
          panelini kullanamaz.
        </p>
        <UserBanControl userId={user.id} banned={user.banned} self={self} />
      </section>
      <div className="admin-detail-grid">
        <section className="panel">
          <h2>Hesap bilgileri</h2>
          <p>
            E-posta {user.emailVerified ? "doğrulanmış" : "henüz doğrulanmamış"}
            . Rol değiştiğinde açık oturumlar kapatılır.
          </p>
          <ActionForm
            action={updateUserAction}
            className="form-stack"
            key={`${user.name}:${user.role}`}
          >
            <input type="hidden" name="id" value={user.id} />
            <label className="field">
              Görünen ad
              <input
                name="name"
                required
                minLength={2}
                maxLength={60}
                defaultValue={user.name}
              />
            </label>
            <label className="field">
              Rol
              <select name="role" defaultValue={user.role} disabled={self}>
                <option value="reader">Okur / Yazar</option>
                <option value="admin" disabled={!user.emailVerified}>
                  Yönetici
                </option>
              </select>
            </label>
            {self && (
              <>
                <input type="hidden" name="role" value="admin" />
                <p>Kendi yönetici yetkini bu ekrandan kaldıramazsın.</p>
              </>
            )}
            <ReasonField />
            <SubmitButton>Hesabı güncelle</SubmitButton>
          </ActionForm>
        </section>
        <section className="panel">
          <h2>Oturum güvenliği</h2>
          <p>
            {user._count.sessions} etkin oturum var. Tüm cihazlardaki oturumları
            kapatabilirsin. Kullanıcı banlı değilse tekrar giriş yapabilir.
          </p>
          <ActionForm action={revokeSessionsAction} className="form-stack">
            <input type="hidden" name="id" value={user.id} />
            <ReasonField />
            <SubmitButton
              className="button-danger"
              disabled={user._count.sessions === 0}
            >
              {self ? "Kendi oturumlarımı kapat" : "Tüm oturumları kapat"}
            </SubmitButton>
          </ActionForm>
        </section>
      </div>
      <section className="panel">
        <h2>Son güncellenen kitaplar</h2>
        {user.books.length ? (
          <ul className="admin-activity">
            {user.books.map((book) => (
              <li key={book.id}>
                <Link className="text-link" href={`/admin/kitaplar/${book.id}`}>
                  {book.title}
                </Link>
                <span className="label-pill gray">
                  {book.hidden ? "Gizli" : statusLabels[book.status]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <AdminEmpty text="Bu kullanıcının henüz kitabı yok." />
        )}
      </section>
    </>
  );
}
