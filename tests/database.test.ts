import { afterEach, describe, expect, it, vi } from "vitest";
import { openDatabase } from "@/db";
import { isLocalPreview } from "@/lib/auth-preview";

afterEach(() => vi.unstubAllEnvs());

describe("Neon bağlantısı ve geliştirme doğrulaması", () => {
  it("DATABASE_URL yokken yerel veritabanına dönmez", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("LOCAL_DATABASE", "true");
    expect(() => openDatabase()).toThrow("DATABASE_URL gerekli");
  });
  it("localhost geliştirmede Neon ile önizlemeye izin verir", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@neon.example/neondb");
    expect(isLocalPreview()).toBe(true);
  });
  it("üretimde geliştirme bayrağı doğrulamayı atlayamaz", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@neon.example/neondb");
    vi.stubEnv("E2E_TEST", "true");
    vi.stubEnv("DEV_SKIP_EMAIL_VERIFICATION", "true");
    expect(isLocalPreview()).toBe(false);
  });
  it("uzak uygulamada önizlemeyi kapatır", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BETTER_AUTH_URL", "https://satir.example");
    expect(isLocalPreview()).toBe(false);
  });
  it("üretim derlemesinde yalnız ayrı E2E veritabanıyla önizlemeye izin verir", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3100");
    vi.stubEnv("E2E_TEST", "true");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost/satir_e2e");
    expect(isLocalPreview()).toBe(true);
  });
});
