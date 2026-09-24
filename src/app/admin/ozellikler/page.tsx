import { Suspense } from "react";
import { getDb } from "@/db";
import { requireAdmin } from "@/modules/admin/access";
import {
  featureDefinitions,
  featureKeys,
  readFeatureFlags,
} from "@/modules/features/flags";
import { setFeatureFlagAction } from "@/modules/features/actions";
import { isIyzicoConfigured } from "@/lib/iyzico";
import { AdminHeading } from "@/components/admin-ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { BlockSkeleton } from "@/components/loading-skeletons";

export const metadata = { title: "Özellikler" };

export default function FeaturesPage() {
  return (
    <Suspense fallback={<BlockSkeleton label="Özellikler yükleniyor" />}>
      <Features />
    </Suspense>
  );
}

async function Features() {
  await requireAdmin();
  // Read fresh from the database, never from a cached request value.
  const flags = await readFeatureFlags(getDb());
  return (
    <>
      <AdminHeading
        title="Özellikler"
        description="Henüz açılmamış özellikleri buradan aç veya kapat. Değişiklik hemen tüm siteye yansır ve işlem geçmişine kaydedilir."
      />
      <div className="stack">
        {featureKeys.map((key) => {
          const feature = featureDefinitions[key];
          const enabled = flags[key];
          return (
            <section className="panel feature-card" key={key}>
              <div className="feature-card-heading">
                <h2>{feature.title}</h2>
                <span className={`label-pill ${enabled ? "" : "gray"}`}>
                  {enabled ? "Açık" : "Kapalı"}
                </span>
              </div>
              <p>{feature.description}</p>
              {key === "coinStore" && !isIyzicoConfigured() && (
                <p className="notice">
                  iyzico anahtarları tanımlı değil. Mağazayı açsan da okurlar
                  ödeme başlatamaz; önce IYZICO_API_KEY ve IYZICO_SECRET_KEY
                  değerlerini gir.
                </p>
              )}
              <ActionForm
                action={setFeatureFlagAction}
                className="feature-form"
              >
                <input type="hidden" name="key" value={key} />
                <input type="hidden" name="enabled" value={String(!enabled)} />
                <SubmitButton
                  className={enabled ? "button-outline" : undefined}
                >
                  {enabled ? `${feature.title} kapat` : `${feature.title} aç`}
                </SubmitButton>
              </ActionForm>
            </section>
          );
        })}
      </div>
    </>
  );
}
