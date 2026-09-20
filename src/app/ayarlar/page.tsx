import { Suspense } from "react";
import { AccountNavigation } from "@/components/account-navigation";
import { BlockSkeleton } from "@/components/loading-skeletons";
import { ProfileSettings, ReadingSettings, SecuritySettings } from "./sections";

export const metadata = {
  title: "Ayarlar",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <div className="account-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span />
            TAM SANA GÖRE
          </div>
          <h1>
            Ayarlar<span className="accent-text">.</span>
          </h1>
          <p>Profilini, güvenliğini ve okuma deneyimini düzenle.</p>
        </div>
      </div>
      <AccountNavigation active="settings" />
      <Suspense fallback={<BlockSkeleton rows={4} />}>
        <ProfileSettings />
      </Suspense>
      <Suspense fallback={<BlockSkeleton rows={4} />}>
        <ReadingSettings />
      </Suspense>
      <Suspense fallback={<BlockSkeleton rows={4} />}>
        <SecuritySettings />
      </Suspense>
    </div>
  );
}
