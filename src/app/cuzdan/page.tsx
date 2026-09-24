import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { requireUser } from "@/lib/session";
import { date, money } from "@/lib/utils";
import { isIyzicoConfigured } from "@/lib/iyzico";
import { getFeatureFlags } from "@/modules/features/flags";
import { buyCoinsAction } from "@/modules/coins/actions";
import {
  getActivePackages,
  getChapterPrice,
  getWallet,
} from "@/modules/coins/service";
import { AccountNavigation } from "@/components/account-navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { BlockSkeleton } from "@/components/loading-skeletons";
import { ArrowLeft, Coins, LockKeyhole } from "@/components/icons";

export const metadata = {
  title: "Coin mağazası ve cüzdanım",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ odeme?: string; geri?: string }>;
};

const paymentMessages: Record<string, { ok: boolean; text: string }> = {
  basarili: { ok: true, text: "Ödemen alındı, coinlerin hesabına yüklendi." },
  basarisiz: {
    ok: false,
    text: "Ödeme tamamlanamadı. Kartından para çekilmediyse tekrar deneyebilirsin.",
  },
  beklemede: {
    ok: false,
    text: "Ödemen doğrulanıyor. Onaylandığında coinlerin otomatik yüklenecek.",
  },
  hata: {
    ok: false,
    text: "Ödeme sonucu alınamadı. Kartından para çekildiyse bize ulaş.",
  },
};

export default function WalletPage(props: Props) {
  return (
    <div className="account-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span />
            COIN CÜZDANI
          </div>
          <h1>
            Coin mağazası<span className="accent-text">.</span>
          </h1>
          <p>Coin yükle, premium bölümleri kalıcı olarak aç.</p>
        </div>
      </div>
      <AccountNavigation active="wallet" />
      <Suspense fallback={<BlockSkeleton label="Cüzdan yükleniyor" rows={6} />}>
        <Wallet {...props} />
      </Suspense>
    </div>
  );
}

async function Wallet({ searchParams }: Props) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const db = getDb();
  const [wallet, packages, chapterPrice] = await Promise.all([
    getWallet(db, user.id),
    getActivePackages(db),
    getChapterPrice(db),
  ]);
  const notice = query.odeme ? paymentMessages[query.odeme] : undefined;
  // Only same-site paths are offered as the way back.
  const back =
    query.geri && /^\/oku\/[\w-]+$/.test(query.geri) ? query.geri : null;
  const { coinStore } = await getFeatureFlags();
  const paymentsOpen = isIyzicoConfigured();
  return (
    <>
      {notice && (
        <p
          role="status"
          className={`form-message ${notice.ok ? "success" : "error"}`}
        >
          {notice.text}
        </p>
      )}
      <section className="wallet-balance">
        <Coins size={30} />
        <div>
          <span>Bakiyen</span>
          <strong>{wallet.balance.toLocaleString("tr-TR")} coin</strong>
          <p>
            Her premium bölüm <strong>{chapterPrice} coin</strong>. Açtığın
            bölümler hesabında kalıcı olarak kalır.
          </p>
        </div>
        {back && (
          <Link href={back} className="button button-outline">
            <ArrowLeft size={15} /> Bölüme dön
          </Link>
        )}
      </section>

      {!coinStore ? (
        <section className="wallet-section" aria-labelledby="packages-title">
          <h2 id="packages-title">Coin yükle</h2>
          <p className="notice">
            Coin mağazası henüz açılmadı; yakında buradan coin
            yükleyebileceksin. Mevcut bakiyen ve açtığın bölümler korunur.
          </p>
        </section>
      ) : (
        <section className="wallet-section" aria-labelledby="packages-title">
          <h2 id="packages-title">Coin yükle</h2>
          {!paymentsOpen && (
            <p className="notice">
              Coin satın alma şu an kullanılamıyor. Paketleri inceleyebilir,
              mevcut bakiyenle okumaya devam edebilirsin.
            </p>
          )}
          {packages.length === 0 ? (
            <p className="notice">Şu an satışta coin paketi yok.</p>
          ) : (
            <div className="coin-packages">
              {packages.map((pack) => (
                <ActionForm
                  action={buyCoinsAction}
                  className="coin-package"
                  key={pack.id}
                >
                  <input type="hidden" name="packageId" value={pack.id} />
                  <Coins size={24} />
                  <strong>{pack.coins.toLocaleString("tr-TR")} coin</strong>
                  <span className="coin-package-chapters">
                    {Math.floor(pack.coins / chapterPrice)} premium bölüm
                  </span>
                  <span className="coin-package-price">
                    {money(pack.priceMinor)}
                  </span>
                  <SubmitButton disabled={!paymentsOpen}>Satın al</SubmitButton>
                </ActionForm>
              ))}
            </div>
          )}
          <p className="wallet-note">
            <LockKeyhole size={13} /> Ödemeler iyzico güvenli ödeme sayfasında
            alınır; kart bilgilerin Satır’a iletilmez. Coinler iade edilemez ve
            başka hesaba aktarılamaz.
          </p>
        </section>
      )}

      {wallet.orders.length > 0 && (
        <section className="wallet-section" aria-labelledby="orders-title">
          <h2 id="orders-title">Tamamlanmamış ödemeler</h2>
          <ul className="wallet-history">
            {wallet.orders.map((order) => (
              <li key={order.id}>
                <div>
                  <strong>{order.coins} coin</strong>
                  <span>
                    {money(order.priceMinor)} ·{" "}
                    {order.status === "PENDING" ? "Bekliyor" : "Başarısız"}
                  </span>
                </div>
                <time dateTime={order.createdAt.toISOString()}>
                  {date(order.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="wallet-section" aria-labelledby="history-title">
        <h2 id="history-title">Hareketler</h2>
        {wallet.transactions.length === 0 ? (
          <p className="notice">Henüz coin hareketin yok.</p>
        ) : (
          <ul className="wallet-history">
            {wallet.transactions.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>
                    {entry.kind === "TOP_UP"
                      ? "Coin yükleme"
                      : entry.kind === "UNLOCK"
                        ? "Bölüm açıldı"
                        : "Bakiye düzeltmesi"}
                  </strong>
                  <span>
                    {entry.kind === "UNLOCK" && entry.chapter ? (
                      <Link
                        href={`/oku/${entry.chapter.id}`}
                        className="text-link"
                      >
                        {entry.chapter.book.title} · {entry.note}
                      </Link>
                    ) : (
                      entry.note
                    )}
                  </span>
                </div>
                <div className="wallet-amount">
                  <strong className={entry.amount > 0 ? "plus" : "minus"}>
                    {entry.amount > 0 ? "+" : ""}
                    {entry.amount} coin
                  </strong>
                  <time dateTime={entry.createdAt.toISOString()}>
                    {date(entry.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
