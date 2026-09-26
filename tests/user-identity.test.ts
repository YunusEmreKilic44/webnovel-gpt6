import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { createLocalDatabase } from "./support/database";
import { migrateLocal, migrationFiles } from "./support/migrate";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { getAuthorProfile } from "@/modules/catalog/queries";
import { updateUser } from "@/modules/admin/service";
import { isNameConflict } from "@/modules/account/identity";
import { generateMetadata } from "@/app/yazar/[slug]/page";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/auth-preview", () => ({ isLocalPreview: () => true }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock("next/navigation", () => ({
  permanentRedirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const client = new PGlite();
const { db, close } = createLocalDatabase(client);
const origin = "http://localhost:3000";

beforeAll(async () => {
  vi.mocked(getDb).mockReturnValue(db);
  vi.stubEnv("BETTER_AUTH_URL", origin);
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "identity-tests-only-secret-at-least-32-characters",
  );
  vi.stubEnv("DEV_SKIP_EMAIL_VERIFICATION", "true");
  await migrateLocal(client);
  (await getAuth().$context).rateLimit.enabled = false;
});
afterAll(async () => {
  await close();
  vi.unstubAllEnvs();
});

function request(path: string, body: object, cookie = "") {
  return getAuth().handler(
    new Request(`${origin}/api/auth/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie },
      body: JSON.stringify(body),
    }),
  );
}

describe("Kullanıcı kimliği", () => {
  it("profil metadata'sında slug kullanır ve eski ID adreslerini yönlendirir", async () => {
    const user = await db.user.create({
      data: {
        id: "legacy-profile-id",
        name: "Profil Yazarı",
        email: "profile-author@example.test",
      },
    });
    expect(
      await generateMetadata({ params: Promise.resolve({ slug: user.slug }) }),
    ).toMatchObject({
      alternates: { canonical: `/yazar/${user.slug}` },
    });
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: user.id }) }),
    ).rejects.toThrow(`REDIRECT:/yazar/${user.slug}`);
    await db.user.update({ where: { id: user.id }, data: { banned: true } });
    for (const slug of [user.slug, user.id, "missing-profile"]) {
      expect(
        await generateMetadata({ params: Promise.resolve({ slug }) }),
      ).toEqual({ title: "Yazar bulunamadı" });
    }
  });
  it("kayıtta adı doğrular, benzersiz tutar ve slug alanını istemciye açmaz", async () => {
    const body = {
      email: "signup@example.test",
      password: "test-password-123",
      name: "  Işık Şen  ",
    };
    const forged = await request("sign-up/email", { ...body, slug: "forged" });
    expect(forged.status).toBe(400);
    expect(await forged.json()).toMatchObject({ code: "FIELD_NOT_ALLOWED" });
    const response = await request("sign-up/email", body);
    expect(response.status, await response.clone().text()).toBe(200);
    const user = await db.user.findUniqueOrThrow({
      where: { email: body.email },
    });
    expect(user).toMatchObject({ name: "Işık Şen", slug: "isik-sen" });
    const duplicate = await request("sign-up/email", {
      ...body,
      email: "duplicate@example.test",
    });
    expect(duplicate.status).toBe(400);
    expect(await duplicate.json()).toMatchObject({ code: "NAME_TAKEN" });
    expect(
      await db.user.findUnique({ where: { email: "duplicate@example.test" } }),
    ).toBeNull();
    const invalid = await request("sign-up/email", {
      ...body,
      email: "invalid@example.test",
      name: " ",
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: "INVALID_NAME" });

    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    await db.user.create({
      data: { id: "taken", name: "Alınmış Ad", email: "taken@example.test" },
    });
    const conflict = await request(
      "update-user",
      { name: "Alınmış Ad" },
      cookie,
    );
    expect(conflict.status).toBe(400);
    expect(await conflict.json()).toMatchObject({ code: "NAME_TAKEN" });
    expect(
      (await request("update-user", { name: user.name }, cookie)).status,
    ).toBe(200);
    expect(
      (
        await request(
          "update-user",
          { name: "Yeni Ad", slug: "forged" },
          cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (await request("update-user", { name: "Yeni Ad" }, cookie)).status,
    ).toBe(200);
    expect(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
    ).toMatchObject({ name: "Yeni Ad", slug: "isik-sen" });
  });

  it("Türkçe/aksanlı adları dönüştürür, çakışmaları ve boş slugları çözer", async () => {
    const names = ["Çağrı Üçöz", "Cagri Ucoz", "Cagri-Ucoz-2", "Émile", "🎉🎉"];
    const users = [];
    for (const [index, name] of names.entries()) {
      users.push(
        await db.user.create({
          data: {
            id: `slug-test-${index}`,
            name,
            email: `slug-${index}@example.test`,
          },
        }),
      );
    }
    expect(users.map((user) => user.slug)).toEqual([
      "cagri-ucoz",
      "cagri-ucoz-2",
      "cagri-ucoz-2-2",
      "emile",
      "yazar",
    ]);
    const first = users[0];
    await db.user.update({
      where: { id: first.id },
      data: { name: "Değişen Ad" },
    });
    expect((await getAuthorProfile(first.slug))?.user).toMatchObject({
      id: first.id,
      name: "Değişen Ad",
    });
    expect(await getAuthorProfile(first.id)).toBeNull();
    await expect(
      db.user.update({ where: { id: first.id }, data: { slug: "changed" } }),
    ).rejects.toThrow("immutable");
    await db.user.update({ where: { id: first.id }, data: { banned: true } });
    expect(await getAuthorProfile(first.slug)).toBeNull();
  });

  it("eşzamanlı aynı ad yazımlarını DB kısıtıyla engeller", async () => {
    const results = await Promise.allSettled(
      [1, 2].map((n) =>
        db.user.create({
          data: {
            id: `race-${n}`,
            name: "Aynı Ad",
            email: `race-${n}@example.test`,
          },
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(
      rejected?.status === "rejected" && isNameConflict(rejected.reason),
    ).toBe(true);
  });

  it("yönetici güncellemesinde çakışmayı açıklar ve işlemi geri alır", async () => {
    const admin = await db.user.create({
      data: {
        id: "identity-admin",
        name: "Kimlik Yöneticisi",
        email: "identity-admin@example.test",
        role: "admin",
        emailVerified: true,
      },
    });
    const target = await db.user.create({
      data: {
        id: "admin-target",
        name: "Hedef Okur",
        email: "admin-target@example.test",
      },
    });
    await expect(
      updateUser(db, admin, {
        id: target.id,
        name: admin.name,
        role: "reader",
        reason: "Kimlik kontrolü testi",
      }),
    ).rejects.toMatchObject({ code: "NAME_TAKEN" });
    expect(
      await db.user.findUniqueOrThrow({ where: { id: target.id } }),
    ).toMatchObject({ name: target.name, slug: target.slug });
    expect(await db.auditLog.count({ where: { targetId: target.id } })).toBe(0);
  });
});

describe("Kimlik migration'ı", () => {
  it("mevcut adları ve ilişkileri korur; çakışan slugları doldurur", async () => {
    const legacy = new PGlite();
    try {
      const migrations = await migrationFiles();
      const index = migrations.findIndex(
        (m) => m.name === "20261006000000_user_identity",
      );
      for (const migration of migrations.slice(0, index))
        await legacy.exec(migration.sql);
      await legacy.exec(`INSERT INTO "user" (id, name, email) VALUES
        ('legacy-1', 'Şule', 'legacy1@example.test'),
        ('legacy-2', 'Sule', 'legacy2@example.test');
        INSERT INTO author_follows (follower_id, author_id) VALUES ('legacy-2', 'legacy-1');`);
      await legacy.exec(migrations[index].sql);
      expect(
        (await legacy.query('SELECT id, name, slug FROM "user" ORDER BY id'))
          .rows,
      ).toEqual([
        { id: "legacy-1", name: "Şule", slug: "sule" },
        { id: "legacy-2", name: "Sule", slug: "sule-2" },
      ]);
      expect(
        (await legacy.query("SELECT * FROM author_follows")).rows,
      ).toHaveLength(1);
    } finally {
      await legacy.close();
    }
  });

  it("yinelenen mevcut adları sessizce değiştirmez", async () => {
    const legacy = new PGlite();
    try {
      const migrations = await migrationFiles();
      const index = migrations.findIndex(
        (m) => m.name === "20261006000000_user_identity",
      );
      for (const migration of migrations.slice(0, index))
        await legacy.exec(migration.sql);
      await legacy.exec(
        `INSERT INTO "user" (id, name, email) VALUES ('dup-1', 'Ad', 'dup1@example.test'), ('dup-2', 'Ad', 'dup2@example.test')`,
      );
      await expect(legacy.exec(migrations[index].sql)).rejects.toThrow(
        "Duplicate user names",
      );
      expect((await legacy.query('SELECT name FROM "user"')).rows).toEqual([
        { name: "Ad" },
        { name: "Ad" },
      ]);
    } finally {
      await legacy.close();
    }
  });
});
