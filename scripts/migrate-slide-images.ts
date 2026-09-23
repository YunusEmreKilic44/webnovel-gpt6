import "dotenv/config";
import { openDatabase } from "../src/db";
import {
  deleteImage,
  isCloudinaryConfigured,
  mediaFolder,
  uploadImage,
} from "../src/lib/cloudinary";

// Copies slide images still stored in Postgres (image_data) to Cloudinary,
// then clears the bytes. Safe to re-run: finished rows are skipped.
// Usage: npm run media:migrate-slides [-- --dry-run]
const dryRun = process.argv.includes("--dry-run");
if (!isCloudinaryConfigured())
  throw new Error(
    "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ve CLOUDINARY_API_SECRET tanımlı olmalı.",
  );
const { db, close } = openDatabase();
try {
  const pending = await db.homeSlide.findMany({
    where: { imageData: { not: null }, imageUrl: null },
    select: { id: true, title: true },
  });
  console.log(`${pending.length} slayt görseli taşınacak.`);
  for (const { id, title } of pending) {
    // One row at a time keeps at most a single image in memory.
    const row = await db.homeSlide.findUnique({
      where: { id },
      select: { imageData: true },
    });
    if (!row?.imageData) continue;
    if (dryRun) {
      console.log(`- ${title} (${row.imageData.length} bayt)`);
      continue;
    }
    const uploaded = await uploadImage(row.imageData, mediaFolder("slides"));
    const updated = await db.homeSlide.updateMany({
      where: { id, imageUrl: null },
      data: {
        imageUrl: uploaded.url,
        imagePublicId: uploaded.publicId,
        imageData: null,
      },
    });
    if (updated.count === 0) {
      // Changed from the admin panel meanwhile; keep that version.
      await deleteImage(uploaded.publicId);
      console.log(`~ ${title}: atlandı (bu sırada güncellenmiş)`);
    } else console.log(`✓ ${title} → ${uploaded.url}`);
  }
} finally {
  await close();
}
