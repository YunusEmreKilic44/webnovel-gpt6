import "dotenv/config";
import { openDatabase } from "../src/db";
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error("Kullanım: npm run db:admin -- kayitli@adres.com");
const { db, close } = openDatabase();
try {
  await db.$transaction(async (tx) => {
    const [actor] = await tx.user.findMany({ where: { email: email } });
    if (!actor)
      throw new Error("Önce siteden bu e-posta adresiyle hesap oluşturun.");
    if (!actor.emailVerified)
      throw new Error("Önce e-posta adresini doğrulayın.");
    if (actor.banned)
      throw new Error(
        "Yönetici yetkisi vermeden önce hesabın banını kaldırın.",
      );
    await tx.user.updateMany({
      where: { id: actor.id },
      data: { role: "admin" },
    });
    await tx.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorId: actor.id,
        targetId: actor.id,
        action: "role.admin.granted.cli",
      },
    });
    console.log("Yönetici yetkisi verildi.");
  });
} finally {
  await close();
}
