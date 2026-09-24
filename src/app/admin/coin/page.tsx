import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { requireAdmin } from "@/modules/admin/access";
import { getAdminCoinOverview } from "@/modules/coins/service";
import {
  saveCoinPackageAction,
  updateCoinSettingsAction,
  updatePremiumRulesAction,
} from "@/modules/coins/actions";
import { isIyzicoConfigured } from "@/lib/iyzico";
import { money } from "@/lib/utils";
import {
  AdminEmpty,
  AdminHeading,
  AdminTable,
  fullDate,
} from "@/components/admin-ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { BlockSkeleton } from "@/components/loading-skeletons";

export const metadata = { title: "Coin ve ödemeler" };

export default function Page() {
  return (
    <Suspense fallback={<BlockSkeleton label="Coin ayarları yükleniyor" />}>
      <CoinAdmin />
    </Suspense>
  );
}

const orderStatus: Record<string, string> = {
  PENDING: "Bekliyor",
  PAID: "Ödendi",
  FAILED: "Başarısız",
};

type Package = Awaited<
  ReturnType<typeof getAdminCoinOverview>
>["packages"][number];

async function CoinAdmin() {
  await requireAdmin();
  const { price, packages, orders, totals, unlocks, premiumRules } =
    await getAdminCoinOverview(getDb());
  return (
    <>
      <AdminHeading
        title="Coin ve ödemeler"
        description="Premium bölümlerin sabit coin fiyatını ve satıştaki coin paketlerini yönet. Yazarlar fiyat belirlemez; yalnız bölümün premium olup olmadığını seçer."
      />
      {!isIyzicoConfigured() && (
        <p className="notice">
          iyzico anahtarları tanımlı değil (IYZICO_API_KEY, IYZICO_SECRET_KEY).
          Okurlar şu an coin satın alamaz.
        </p>
      )}
      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <span>Tahsil edilen</span>
          <strong>{money(totals._sum.priceMinor ?? 0)}</strong>
        </div>
        <div className="admin-stat-card">
          <span>Satılan coin</span>
          <strong>{(totals._sum.coins ?? 0).toLocaleString("tr-TR")}</strong>
        </div>
        <div className="admin-stat-card">
          <span>Açılan bölüm</span>
          <strong>
            {unlocks._count.toLocaleString("tr-TR")} ·{" "}
            {(unlocks._sum.coinsSpent ?? 0).toLocaleString("tr-TR")} coin
          </strong>
        </div>
      </div>

      <section className="panel">
        <h2>Premium bölüm fiyatı</h2>
        <p>
          Her premium bölüm bu fiyatla açılır. Değişiklik yalnız bundan sonraki
          açılışları etkiler; daha önce açılan bölümler açık kalır.
        </p>
        <ActionForm action={updateCoinSettingsAction} className="inline-form">
          <label className="field">
            Bölüm başına coin
            <input
              name="chapterPriceCoins"
              type="number"
              min={1}
              max={1000}
              required
              defaultValue={price}
            />
          </label>
          <SubmitButton>Fiyatı kaydet</SubmitButton>
        </ActionForm>
      </section>

      <section className="panel">
        <h2>Premium başvuru şartları</h2>
        <p>
          Bir kitap premium başvurusu yapabilmek için yayında en az bu kadar
          bölüme ve okunmaya sahip olmalı. Okunma, bir okurun bir bölümü bir
          günde bir kez açması olarak sayılır. Mevcut premium kitaplar
          etkilenmez.
        </p>
        <ActionForm action={updatePremiumRulesAction} className="inline-form">
          <label className="field">
            En az yayında bölüm
            <input
              name="minChapters"
              type="number"
              min={0}
              max={1000}
              required
              defaultValue={premiumRules.minChapters}
            />
          </label>
          <label className="field">
            En az okunma
            <input
              name="minReads"
              type="number"
              min={0}
              max={10000000}
              required
              defaultValue={premiumRules.minReads}
            />
          </label>
          <SubmitButton>Şartları kaydet</SubmitButton>
        </ActionForm>
      </section>

      <section className="panel">
        <h2>Coin paketleri</h2>
        <p>
          Okurların cüzdan sayfasında gördüğü paketler. Satıştan kaldırmak için
          “Satışta” işaretini kaldır; geçmiş siparişler etkilenmez.
        </p>
        <div className="stack">
          {packages.map((pack) => (
            <PackageForm
              key={`${pack.id}:${pack.updatedAt.getTime()}`}
              pack={pack}
            />
          ))}
          <details className="content-editor">
            <summary>Yeni paket ekle</summary>
            <PackageForm />
          </details>
        </div>
      </section>

      <section className="panel">
        <h2>Son siparişler</h2>
        {orders.length === 0 ? (
          <AdminEmpty text="Henüz sipariş yok." />
        ) : (
          <AdminTable label="Son coin siparişleri">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Paket</th>
                <th>Tutar</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <th>
                    <Link
                      className="text-link"
                      href={`/admin/kullanicilar/${order.user.id}`}
                    >
                      {order.user.name}
                    </Link>
                    <small>{order.user.email}</small>
                  </th>
                  <td>{order.coins} coin</td>
                  <td>{money(order.priceMinor)}</td>
                  <td>
                    <span
                      className={`label-pill ${order.status === "PAID" ? "" : order.status === "PENDING" ? "amber" : "gray"}`}
                    >
                      {orderStatus[order.status] ?? order.status}
                    </span>
                    {order.failureReason && (
                      <small>{order.failureReason}</small>
                    )}
                    {order.providerPaymentId && (
                      <small>iyzico: {order.providerPaymentId}</small>
                    )}
                  </td>
                  <td>
                    <time dateTime={order.createdAt.toISOString()}>
                      {fullDate(order.createdAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </section>
    </>
  );
}

function PackageForm({ pack }: { pack?: Package }) {
  return (
    <ActionForm action={saveCoinPackageAction} className="coin-package-form">
      <input type="hidden" name="id" value={pack?.id ?? ""} />
      <label className="field">
        Coin
        <input
          name="coins"
          type="number"
          min={1}
          max={100000}
          required
          defaultValue={pack?.coins}
        />
      </label>
      <label className="field">
        Fiyat (₺)
        <input
          name="price"
          type="number"
          min={1}
          max={100000}
          step="0.01"
          required
          defaultValue={pack ? (pack.priceMinor / 100).toFixed(2) : undefined}
        />
      </label>
      <label className="field">
        Sıra
        <input
          name="position"
          type="number"
          min={0}
          max={9999}
          required
          defaultValue={pack?.position ?? 0}
        />
      </label>
      <label className="check-field">
        <input
          name="active"
          type="checkbox"
          defaultChecked={pack?.active ?? true}
        />
        Satışta
      </label>
      <SubmitButton className="button-outline">
        {pack ? "Kaydet" : "Paketi ekle"}
      </SubmitButton>
    </ActionForm>
  );
}
