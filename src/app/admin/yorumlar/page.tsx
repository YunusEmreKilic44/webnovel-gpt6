import { Suspense } from "react";
import Link from "next/link";
import { BlockSkeleton } from "@/components/loading-skeletons";
import {
  AdminHeading,
  AdminFilter,
  AdminPagination,
  AdminEmpty,
  VisibilityForm,
  fullDate,
} from "@/components/admin-ui";
import {
  adminFilters,
  getAdminComments,
  type SearchParams,
} from "@/modules/admin/queries";
import { commentVisibilityAction } from "@/modules/admin/actions";

export const metadata = { title: "Yorum yönetimi" };
export default function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<BlockSkeleton label="Yorumlar yükleniyor" rows={8} />}>
      <Comments searchParams={searchParams} />
    </Suspense>
  );
}
async function Comments({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = adminFilters(await searchParams);
  const { rows, total } = await getAdminComments(filters);
  return (
    <>
      <AdminHeading
        title="Yorumlar"
        description="Topluluk yorumlarını incele, gerektiğinde gizle veya yeniden görünür yap."
      />
      <AdminFilter
        path="/admin/yorumlar"
        filters={filters}
        placeholder="Yorum, kullanıcı veya kitap adı"
        options={[
          ["visible", "Görünür"],
          ["hidden", "Gizli"],
          ["spoiler", "Spoiler işaretli"],
        ]}
      />
      <div className="stack">
        {rows.length ? (
          rows.map((comment) => (
            <article className="panel admin-comment" key={comment.id}>
              <div className="analytics-section-heading">
                <div>
                  <Link
                    className="text-link"
                    href={`/admin/kullanicilar/${comment.user.id}`}
                  >
                    {comment.user.name}
                  </Link>
                  <span className="muted"> · </span>
                  <Link
                    className="text-link"
                    href={`/admin/kitaplar/${comment.book.id}`}
                  >
                    {comment.book.title}
                  </Link>
                </div>
                <time dateTime={comment.createdAt.toISOString()}>
                  {fullDate(comment.createdAt)}
                </time>
              </div>
              <div className="button-row">
                <span
                  className={`label-pill ${comment.hidden ? "amber" : "gray"}`}
                >
                  {comment.hidden ? "Gizli" : "Görünür"}
                </span>
                {comment.spoiler && (
                  <span className="label-pill amber">Spoiler</span>
                )}
              </div>
              <p className="admin-comment-body">{comment.body}</p>
              <VisibilityForm
                id={comment.id}
                hidden={comment.hidden}
                action={commentVisibilityAction}
                noun="Yorumu"
              />
            </article>
          ))
        ) : (
          <AdminEmpty />
        )}
      </div>
      <AdminPagination path="/admin/yorumlar" filters={filters} total={total} />
    </>
  );
}
