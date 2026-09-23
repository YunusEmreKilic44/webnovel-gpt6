import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  getAuth: () => ({ api: { getSession: mocks.session } }),
}));
import { getCurrentUser } from "@/lib/session";

describe("Banlı oturumun uygulama erişimi", () => {
  it("oturum sağlayıcısı kayıt döndürse bile banlı kullanıcıyı kabul etmez", async () => {
    mocks.session.mockResolvedValue({
      user: { id: "banned", banned: true, role: "admin", emailVerified: true },
    });
    expect(await getCurrentUser()).toBeNull();
  });
  it("banlı olmayan kullanıcıyı kabul eder", async () => {
    mocks.session.mockResolvedValue({
      user: {
        id: "reader",
        name: "Okur",
        email: "reader@example.test",
        role: "reader",
        emailVerified: true,
        banned: false,
      },
    });
    expect(await getCurrentUser()).toMatchObject({
      id: "reader",
      role: "reader",
    });
  });
});
