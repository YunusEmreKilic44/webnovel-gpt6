import { Suspense } from "react";
import { requireAdmin } from "@/modules/admin/access";
import { AdminSidebar } from "@/components/admin-sidebar";
import { PageSkeleton } from "@/components/loading-skeletons";

export const metadata = {
  title: "Yönetim paneli",
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AuthorizedLayout>{children}</AuthorizedLayout>
    </Suspense>
  );
}
async function AuthorizedLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAdmin();
  return (
    <div className="admin-layout">
      <AdminSidebar name={actor.name} />
      <div className="admin-content">{children}</div>
    </div>
  );
}
