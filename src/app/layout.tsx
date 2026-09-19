import type { Metadata } from "next";
import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { ShellAccount, ShellAdminLink } from "@/components/shell-account";
import { ButtonSkeleton } from "@/components/loading-skeletons";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Satır — Bir satır, bin dünya", template: "%s · Satır" },
  description:
    "Yeni hikâyeler keşfet, sevdiğin yazarları takip et ve kendi dünyanı yaz. Her hikâye bir satırla başlar.",
  metadataBase: new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000"),
};
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        <a href="#main-content" className="skip-link">
          İçeriğe geç
        </a>
        <Shell
          account={
            <Suspense fallback={<ButtonSkeleton label="Hesap yükleniyor" />}>
              <ShellAccount />
            </Suspense>
          }
          mobileAdmin={
            <Suspense fallback={null}>
              <ShellAdminLink mobile />
            </Suspense>
          }
          footerAdmin={
            <Suspense fallback={null}>
              <ShellAdminLink />
            </Suspense>
          }
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
