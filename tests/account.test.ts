import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  update: vi.fn(),
  setCookie: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/db", () => ({ getDb: () => ({ user: { update: mocks.update } }) }));
vi.mock("@/modules/catalog/queries", () => ({ CATALOG_TAG: "catalog" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.setCookie }),
}));
import {
  updateProfile,
  updateReadingPreferences,
} from "@/modules/account/actions";
import { initialActionState } from "@/lib/action-state";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "current-user" });
  mocks.update.mockResolvedValue({});
});

describe("Hesap ayarlarının yetki sınırları", () => {
  it("oturumsuz kullanıcı adına veya tercihlere yazamaz", async () => {
    mocks.user.mockResolvedValue(null);
    const form = new FormData();
    form.set("name", "Yeni ad");
    expect((await updateProfile(initialActionState, form)).ok).toBe(false);
    expect((await updateReadingPreferences(initialActionState, form)).ok).toBe(
      false,
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
  it("gönderilen kullanıcı kimliğini ve rolü kullanmaz", async () => {
    const form = new FormData();
    form.set("name", "  Yeni Okur  ");
    form.set("userId", "another-user");
    form.set("role", "admin");
    expect((await updateProfile(initialActionState, form)).ok).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "current-user" },
      data: { name: "Yeni Okur", updatedAt: expect.any(Date) },
    });
  });
  it("boş adı veritabanına yazmaz", async () => {
    const form = new FormData();
    form.set("name", "   ");
    expect((await updateProfile(initialActionState, form)).ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("geçersiz okuma tercihlerini kaydetmez", async () => {
    const form = new FormData();
    form.set("theme", "sepia");
    form.set("font", "1000");
    expect((await updateReadingPreferences(initialActionState, form)).ok).toBe(
      false,
    );
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});
