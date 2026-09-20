import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/studio",
        "/hesap",
        "/profil",
        "/ayarlar",
        "/kutuphanem",
        "/oku/",
        "/giris",
        "/kayit",
        "/sifre",
      ],
    },
    sitemap: `${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/sitemap.xml`,
  };
}
