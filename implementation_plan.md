# Lighthouse Performansı ve Sayfa Geçiş Hızı Optimizasyon Planı

## Durum Özeti ve Sorun Tespiti

Projenin incelenmesi ve yapılan canlı kıyaslama (benchmarking) testleri sonucunda performansın 72 seviyesinde kalmasının, backend veri çekiminin ve sayfa geçişlerinin yavaş olmasının 4 ana kök nedeni tespit edilmiştir:

1. **`layout.tsx` Üzerindeki `force-dynamic` Kilidi**:
   - `src/app/layout.tsx` dosyasında `export const dynamic = "force-dynamic";` tanımlanmış.
   - Bu direktif, Next.js'in statik üretim (SSG), ISR (Incremental Static Regeneration) ve istemci tarafı `<Link>` önceden yükleme (prefetch) yeteneklerini **tüm projede (22 rotanın tamamında)** devre dışı bırakıyor.
   - Tamamen statik olan sayfalar dahi (`/hakkinda`, vb.) her istekte sıfırdan SSR edilmek zorunda kalıyor.
   
2. **Backend ve Veritabanı Gecikmesi (Neon Frankfurt / Sıfır Önbellek)**:
   - Veritabanı Neon Serverless PostgreSQL (`eu-central-1.aws.neon.tech` / Frankfurt) üzerinde.
   - Yapılan ölçümlerde soğuk bağlantı süresi **~470 ms**, sıcak sorgu süresi **~44 ms** ölçüldü.
   - Ana sayfada (`/`), keşfet sayfasında (`/kesfet`) ve kitap detayında (`/kitap/[slug]`) her istekte ardışık 4-5 veritabanı sorgusu ve her satır için 4 ilişkili alt sorgu (`chapterCount`, `volumeCount`, `averageRating`, `ratingCount`) sıfırdan çalışıyor.
   - Hiçbir katalog verisinde `unstable_cache` veya ISR kullanılmadığı için her sayfa geçişinde Frankfurt'a ağ turu (roundtrip) atılıyor ve 400-800 ms bekleniyor.

3. **Sayfalar Arası Geçişte Donma Hissi (Eksik `loading.tsx` ve Geçiş Göstergesi)**:
   - `/kesfet` ve `/kitap/[slug]` gibi ana rotalarda `loading.tsx` dosyaları bulunmuyor.
   - Kullanıcı bir kitaba veya Keşfet menüsüne tıkladığında, sunucudan tüm veriler gelene kadar (1-2 saniye) ekranda hiçbir görsel tepki oluşmuyor ve sayfa donmuş gibi görünüyor.
   - Rota seviyesinde `loading.tsx` eklendiğinde Next.js 50ms içinde anında skeleton arayüzüne geçiş yapar; önbellek devrede olduğunda ise sayfa 0-50ms içinde tamamen hazır gelir.
   - Ayrıca sayfalar arası geçişlerde anında görsel tepki veren hafif bir üst ilerleme çubuğu (top navigation progress bar) bulunmuyor.

4. **Lighthouse LCP (Largest Contentful Paint) ve Görsel Yükü**:
   - `public/art/` altındaki görseller (`hero.png`, `ember.png`, `forest.png`, vb.) **2.5 MB - 3.3 MB** boyutunda devasa ham PNG dosyalarıdır (toplam klasör ~20 MB).
   - Lighthouse mobil simülasyonunda (1.6 Mbps bant genişliği) bu görsellerin indirilmesi saniyeler sürerek LCP puanını doğrudan düşürmektedir.
   - `next.config.ts` içinde modern formatlar (`avif`, `webp`) etkinleştirilmemiştir.
   - Ana sayfadaki `HomeHero` bileşeni `<Suspense fallback={<HeroSkeleton />}>` arkasında asenkron bir server component olduğu için tarayıcının ilk HTML preload tarayıcısı (scanner) hero görselini görememekte, LCP görseli büyük bir gecikmeyle yüklenmeye başlamaktadır.
   - `HeroSkeleton` bileşeninin sağ tarafındaki `.hero-edition` rozeti eksiktir; içerik yüklendiğinde düzen kayması (CLS) oluşmaktadır.

---

## Önerilen Çözümler ve Değişiklikler

### 1. Mimari ve Next.js Önbellekleme Katmanı

#### [MODIFY] [layout.tsx](file:///c:/Users/grove/Desktop/webnovel-gpt6/src/app/layout.tsx)
- `export const dynamic = "force-dynamic";` satırını kaldırarak Next.js'in statik analiz ve önbellekleme motorunu serbest bırakacağız.
- `RootLayout` içindeki `ShellAccount` ve admin linkleri zaten `<Suspense>` içinde olduğundan, layout ve statik sayfalar Next.js tarafından anında ve kesintisiz sunulabilecektir.

#### [MODIFY] [next.config.ts](file:///c:/Users/grove/Desktop/webnovel-gpt6/src/next.config.ts)
- `images` yapılandırmasına `formats: ["image/avif", "image/webp"]` ekleyerek Next.js Image Optimization'ın modern ve hafif formatları servis etmesini sağlayacağız.
- Görsel kalitelerini optimize ederek LCP süresini en aza indireceğiz.

---

### 2. Backend Veri Çekme Optimizasyonu (Neon Latency & Cache)

#### [MODIFY] [queries.ts](file:///c:/Users/grove/Desktop/webnovel-gpt6/src/modules/catalog/queries.ts)
- `getCatalog`, `getPublicBook` ve `getPublicChapters` fonksiyonlarını Next.js `unstable_cache` ile sarmalayacağız (`tags: ["catalog"]`, `revalidate: 60`).
- İlk istekten sonra tüm katalog sorguları Frankfurt'a gitmek yerine Next.js sunucu önbelleğinden **< 1 ms** sürede dönecektir (500 ms -> 1 ms, 500 kat hızlanma).
- Zaten mevcut olan sunucu eylemlerindeki (`publishing`, `community`) `revalidatePath` ve `revalidateTag` çağrıları sayesinde, yeni kitap eklendiğinde, bölüm yayımlandığında veya puan verildiğinde önbellek anında otomatik tazelenecektir.
- Correlated subquery'lerin çalıştığı SQL sorgusunu optimize ederek gereksiz hesaplamaları önleyeceğiz.

#### [MODIFY] [page.tsx](file:///c:/Users/grove/Desktop/webnovel-gpt6/src/app/page.tsx)
- Ana sayfaya `export const revalidate = 60;` (ISR) ekleyeceğiz. Böylece ana sayfa her ziyaretçide veritabanına gitmek yerine hazır HTML/RSC olarak anında (10-30 ms TTFB) servis edilecek.
- `HomeHero` içindeki `FeaturedReadLink` için yapılan ayrı ardışık veritabanı çağrısını (waterfall) kaldırıp ilk bölüm kimliğini doğrudan veya paralel elde ederek hero butonunun gecikmeli parlamasını önleyeceğiz.
- Hero görseline `priority={true}` vererek tarayıcının `<head>` içine `<link rel="preload" as="image">` eklemesini sağlayacağız (LCP optimizasyonu).

---

### 3. Sayfa Geçişleri ve Anında Tepki (Instant Navigation)

#### [NEW] [loading.tsx (kesfet)](file:///c:/Users/grove/Desktop/webnovel-gpt6/src/app/kesfet/loading.tsx)
- `/kesfet` rotasına özel `loading.tsx` ekleyeceğiz. Kullanıcı "Webnoveller" linkine tıkladığı anda donma hissi olmadan anında filtre toolbar'ı ve `BookGridSkeleton` görüntülenecek.

#### [NEW] [loading.tsx (kitap)](file:///c:/Users/grove/Desktop/webnovel-gpt6/src/app/kitap/[slug]/loading.tsx)
- `/kitap/[slug]` rotasına özel `loading.tsx` ekleyerek herhangi bir kitap kartına tıklandığında anında kitap detay iskeletinin açılmasını sağlayacağız.

#### [NEW] [nav-progress.tsx](file:///c:/Users/grove/Desktop/webnovel-gpt6/src/components/nav-progress.tsx) & [MODIFY] [shell.tsx](file:///c:/Users/grove/Desktop/webnovel-gpt6/src/components/shell.tsx)
- Sayfalar arası geçişlerde tarayıcı adres çubuğunun hemen altına zarif, ultra hafif, kırmızı vurgulu (`--accent`) bir geçiş ilerleme çubuğu (navigation progress bar) ekleyeceğiz.
- Kullanıcı herhangi bir linke tıkladığında (<10ms) sayfanın yüklendiğine dair anında görsel geri bildirim alacak.

---

### 4. Görsellerin Optimizasyonu (Lighthouse LCP & Transfer Boyutu)

#### [MODIFY] `public/art/*.png` Görsellerinin Optimize Edilmesi
- `sharp` kütüphanesini kullanarak `public/art/` altındaki 2.5 - 3.3 MB boyutundaki 7 devasa PNG görseli, görsel kalitesinden hiçbir ödün vermeden optimize edeceğiz:
  - `hero.png` (2.47 MB -> ~150-250 KB)
  - `ember.png`, `forest.png`, `ocean.png`, `rose.png`, `sand.png`, `violet.png` (her biri 2.8-3.3 MB -> ~150-250 KB)
  - Toplam 20 MB'lık görsel yükünü ~1.5 MB'a (%90+ tasarruf) düşüreceğiz.
  - Bu sayede mobil Lighthouse LCP süresi 4+ saniyeden 1.2-1.8 saniyeye gerileyecektir.

#### [MODIFY] [loading-skeletons.tsx](file:///c:/Users/grove/Desktop/webnovel-gpt6/src/components/loading-skeletons.tsx)
- `HeroSkeleton` bileşenine sağ taraftaki `.hero-edition` alanını ekleyerek gerçek içerik yüklendiğinde oluşabilecek düzen kaymasını (CLS) tamamen ortadan kaldıracağız (CLS: 0).

---

## Doğrulama Planı

### Otomatik Testler
- `npm run typecheck`: TypeScript tip denetimi.
- `npm run test`: Mevcut 33 Vitest testinin eksiksiz geçmesi (özellikle `publishing`, `database`, `migrations`).
- `npm run build`: Next.js üretim derlemesinin alınması, rotaların statik/ISR/dinamik dağılımının doğrulanması.

### Canlı Kıyaslama ve Performans Ölçümü
- Önbellekli ve önbelleksiz sorgu sürelerinin karşılaştırılması (`bench.ts` ile yanıt süresi teyidi: 500ms -> <2ms).
- Sayfalar arası geçişin akıcılığının ve geçiş çubuğunun test edilmesi.
- Görsel boyutlarının ve transfer sürelerinin doğrulanması.
