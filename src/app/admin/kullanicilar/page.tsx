import { Suspense } from "react";
import Link from "next/link";
import { UserBanControl } from "@/components/user-ban-control";
import { requireAdmin } from "@/modules/admin/access";
import { BlockSkeleton } from "@/components/loading-skeletons";
import {
  AdminHeading,
  AdminFilter,
  AdminPagination,
  AdminTable,
  AdminEmpty,
  statusLabels,
  fullDate,
} from "@/components/admin-ui";
import {
  adminFilters,
  getAdminUsers,
  type SearchParams,
} from "@/modules/admin/queries";

export const metadata = { title: "Kullanıcı yönetimi" };
export default function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense
      fallback={<BlockSkeleton label="Kullanıcılar yükleniyor" rows={8} />}
    >
      <Users searchParams={searchParams} />
    </Suspense>
  );
}
async function Users({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = adminFilters(await searchParams);
  const actor = await requireAdmin();
  const { rows, total } = await getAdminUsers(filters);
  return (
    <>
      <AdminHeading
        title="Kullanıcılar"
        description="Hesapları düzenle, kullanıcıları banla veya banlarını kaldır."
      />
      <AdminFilter
        path="/admin/kullanicilar"
        filters={filters}
        placeholder="Ad veya e-posta"
        options={[
          ["banned", "Banlı kullanıcılar"],
          ["active", "Banlı olmayanlar"],
          ["admin", "Yöneticiler"],
          ["authors", "Kitabı olan yazarlar"],
          ["unverified", "E-postası doğrulanmamış"],
        ]}
      />
      {rows.length ? (
        <AdminTable label="Kullanıcı listesi">
          <thead>
            <tr>
              <th scope="col">Kullanıcı</th>
              <th scope="col">Rol</th>
              <th scope="col">Durum</th>
              <th scope="col">E-posta</th>
              <th scope="col">Kitap / Yorum</th>
              <th scope="col">Kayıt</th>
              <th scope="col">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id}>
                <th scope="row">
                  <Link
                    className="text-link"
                    href={`/admin/kullanicilar/${user.id}`}
                  >
                    {user.name}
                  </Link>
                  <small>{user.email}</small>
                </th>
                <td>{statusLabels[user.role] ?? user.role}</td>
                <td>
                  <span
                    className={`label-pill ${user.banned ? "amber" : "gray"}`}
                  >
                    {user.banned ? "Banlı" : "Aktif"}
                  </span>
                </td>
                <td>
                  <span
                    className={`label-pill ${user.emailVerified ? "" : "amber"}`}
                  >
                    {user.emailVerified ? "Doğrulandı" : "Bekliyor"}
                  </span>
                </td>
                <td>
                  {user._count.books} / {user._count.comments}
                </td>
                <td>{fullDate(user.createdAt)}</td>
                <td>
                  <div className="admin-user-actions">
                    <Link
                      className="button button-outline button-small"
                      href={`/admin/kullanicilar/${user.id}`}
                    >
                      Düzenle
                    </Link>
                    <UserBanControl
                      userId={user.id}
                      banned={user.banned}
                      self={actor.id === user.id}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      ) : (
        <AdminEmpty />
      )}
      <AdminPagination
        path="/admin/kullanicilar"
        filters={filters}
        total={total}
      />
    </>
  );
}
