import "server-only";
import { z } from "zod";
import type { Database } from "@/db";
import type { Actor } from "@/db/schema";
import { administrativeWrite, audit } from "@/modules/admin/service";
import { featureDefinitions, featureKeys, readFeatureFlags } from "./flags";

export const featureInput = z.object({
  key: z.enum(featureKeys),
  enabled: z.boolean(),
});

/** Turns a feature on or off; recorded in the audit log. */
export async function setFeatureFlag(
  db: Database,
  actor: Actor,
  raw: z.input<typeof featureInput>,
) {
  const input = featureInput.parse(raw);
  return administrativeWrite(db, actor, async (tx) => {
    const before = await readFeatureFlags(tx);
    const data = { [featureDefinitions[input.key].column]: input.enabled };
    await tx.coinSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: { ...data, updatedAt: new Date() },
    });
    await audit(
      tx,
      actor,
      "ADMIN_FEATURE_TOGGLED",
      input.key,
      `${featureDefinitions[input.key].title}: ${input.enabled ? "açıldı" : "kapatıldı"}`,
      { before: before[input.key], after: input.enabled },
    );
  });
}
