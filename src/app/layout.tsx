import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Satır — Bir satır, bin dünya", template: "%s · Satır" },
  description:
    "Yeni hikâyeler keşfet, sevdiğin yazarları takip et ve kendi dünyanı yaz. Her hikâye bir satırla başlar.",
  metadataBase: new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000"),
};
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <html lang="tr">
      <body>
        <a href="#main-content" className="skip-link">
          İçeriğe geç
        </a>
        <Shell user={user ? { name: user.name, role: user.role } : null}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
