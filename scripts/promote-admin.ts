import "dotenv/config";
import { eq } from "drizzle-orm";
import { openDatabase } from "../src/db";
import { auditLogs, user } from "../src/db/schema";
const email = process.argv[2]?.trim().toLowerCase();
if (!email)
  throw new Error(
    "Kullanım: npm run db:admin -- kayitli@adres.com (Yerel PGlite kullanırken web sunucusunu önce durdurun.)",
  );
const { db, close } = openDatabase();
try {
  await db.transaction(async (tx) => {
    const [actor] = await tx.select().from(user).where(eq(user.email, email));
    if (!actor)
      throw new Error("Önce siteden bu e-posta adresiyle hesap oluşturun.");
    if (!actor.emailVerified)
      throw new Error("Önce e-posta adresini doğrulayın.");
    await tx.update(user).set({ role: "admin" }).where(eq(user.id, actor.id));
    await tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actorId: actor.id,
      targetId: actor.id,
      action: "role.admin.granted.cli",
    });
    console.log("Yönetici yetkisi verildi.");
  });
} finally {
  await close();
}
