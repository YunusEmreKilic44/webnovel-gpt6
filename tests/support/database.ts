import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "../../src/generated/prisma/client";

export function createLocalDatabase(client: PGlite) {
  const db = new PrismaClient({
    adapter: new PrismaPGlite(client),
    transactionOptions: { maxWait: 15000, timeout: 30000 },
  });
  return {
    db,
    close: async () => {
      await db.$disconnect();
      if (!client.closed) await client.close();
    },
  };
}
