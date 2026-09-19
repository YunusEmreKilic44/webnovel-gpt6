# Satır — Webnovel platformu

Anime/manga görsel kimliğine sahip, Türkçe ve metin tabanlı webnovel platformu. Next.js App Router, React, TypeScript, Prisma 7 ve PostgreSQL kullanır. Ürün kararları, çalışan kapsam ve hedef mimari: [WEBNOVEL_MIMARI.md](./WEBNOVEL_MIMARI.md).

Son güncelleme: **19 Eylül 2026**. Uygulama Neon PostgreSQL kullanır. Yerel kitaplar, kullanıcılar ve ilişkili kayıtlar yedeklenerek Neon’a taşındı.

## Hızlı başlangıç

Node.js 22.17+ ve npm gerekir. Bu çalışma alanında bağımlılıklar, Neon bağlantısını içeren `.env` ve veritabanı hazırlanmıştır:

```sh
npm run dev
```

Uygulama: **http://localhost:3000**

Temiz bir kurulumda:

```sh
npm ci
```

`.env.example` dosyasını `.env` olarak kopyalayın. Neon konsolundaki havuzlu bağlantıyı `DATABASE_URL`, doğrudan bağlantıyı `DATABASE_URL_UNPOOLED` olarak ekleyin. `BETTER_AUTH_SECRET` alanına aşağıdaki komutun ürettiği değeri yazın:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npm run db:migrate
npm run db:seed
npm run dev
```

`.env` ve `.data` sürüm kontrolüne alınmaz. Hazırlanan yerel secret yalnız bu çalışma alanındadır.

### Neon veritabanı

Uygulama yalnız `DATABASE_URL` üzerinden PostgreSQL’e bağlanır; yerel PGlite’a otomatik dönüş yoktur. Neon’un havuzlu bağlantısı uygulama sorgularında, `DATABASE_URL_UNPOOLED` ise Prisma CLI ve migration işlemlerinde kullanılır. Doğrudan URL verilmezse CLI `DATABASE_URL` kullanır. Bağlantıların TLS parametrelerini koruyun.

Eski `.data/postgres` verileri ve `.data/neon-import-backup-*` yedekleri korunur. `npm run db:import-local` yedek alıp kayıt sayılarını gösterir; `node --import tsx scripts/import-local.ts --apply` boş ve migration uygulanmış hedefe tüm kayıtları tek transaction içinde aktarır. Önce eski PGlite sunucusunu durdurun. Hedefte kayıt varsa işlem durur; üzerine yazılmaz. Parola hash’leri ve tarih hassasiyeti korunur.

Geliştirmede (`npm run dev`), localhost adresinde `DEV_SKIP_EMAIL_VERIFICATION=true` kullanılabilir. Üretimde e-posta doğrulaması zorunludur; `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY` ve `EMAIL_FROM` tanımlanmalıdır. Şifre yenileme de e-posta servisini kullanır.

## Prisma geliştirme akışı

`npm ci` ve `npm run build`, Prisma Client'ı otomatik üretir. Şema `prisma/schema.prisma` içinde, PostgreSQL bağlantısı `prisma.config.ts` ve `src/db/index.ts` içindedir. Üretilen istemci `src/generated/prisma/` altında tutulur ve Git'e eklenmez. `src/db/schema.ts` yalnız ortak TypeScript tiplerini içerir; ORM şeması değildir.

Neon bağlantısı `@prisma/adapter-pg` kullanır. PGlite ve adaptörü yalnız geliştirme bağımlılığıdır; izole testler ve eski verilerin tek seferlik aktarımı için tutulur. Better Auth, oturum sorguları, katalog, yayın ve topluluk işlemleri, seed ve yönetici CLI'si Prisma üzerinden çalışır. Drizzle bağımlılıkları kaldırılmıştır.

```sh
npm run db:generate
npm run db:migrate
```

Şema değişikliğinden sonra PostgreSQL geliştirme veritabanında `npm run db:dev -- --name degisiklik_adi` kullanılır. Oluşan SQL incelenip sürüm kontrolüne alınır. `db:generate` yalnız istemci üretir, migration oluşturmaz.

`db:migrate`, doğrudan `prisma migrate deploy` çalıştırır. Eski Drizzle geçiş kodu kaldırıldı. SQL içindeki kısmi unique index, check constraint ve değişmezlik tetikleyicileri korunur; `prisma db push` bu kuralların yerine geçmez.

## Arayüz

Koyu zeminli anime/webnovel tasarımı; yatay gezinme, mobil menü, seri vitrini, türler, son güncellemeler ve gerçek değerlendirme puanlarından sıralama içerir. Kitaplar, stüdyo ve hesap ekranları aynı tasarımı kullanır. Okuyucu varsayılan olarak koyu açılır; açık ve sepya tercihleri saklanır.

Menü ve sayfa iskeleti oturum sorgusunu beklemeden gönderilir. Ana sayfadaki vitrinler, keşfet sonuçları, kitap bölümleri/yorumları ve kütüphane alanları ayrı Suspense sınırlarıyla yüklenir. Ortak kitap ve bölüm sorguları yalnız aynı istek içinde paylaşılır; kullanıcı verileri istekler arasında önbelleğe alınmaz. Okuyucu, kitap ve yönetim sayfaları için yükleme iskeletleri bulunur.

Yerel illüstrasyonlar: `public/art/`. Vitrin için bir geniş görsel ve yazarın seçebileceği altı kapak bulunur; Next.js Image görselleri cihaz boyutuna göre sunar. Görsel üretim bilgileri ve promptlar: [ARTWORK.md](./public/art/ARTWORK.md).

Bu sürüm metin tabanlı webnovel okuyucusudur; manga sayfası yükleme veya panel okuyucusu içermez. Görsel kimlik `src/app/globals.css`, gezinme `src/components/shell.tsx`, kapak sunumu `src/components/book-cover.tsx` üzerinden yönetilir.

## Neler çalışıyor?

- Türkçe, mobil uyumlu keşif, arama/tür filtresi, puana göre sıralama ve tamamlanan kitaplar.
- Kitap sayfası, cilt/bölüm listeleri ve kalıcı bölüm URL'leri.
- Açık/koyu/sepya okuma, yazı boyutu tercihleri ve bölüm bazlı okuma işareti.
- Better Auth ile kayıt, giriş, çıkış; e-posta doğrulama ve şifre yenileme sağlayıcı bağlantısı.
- Kullanıcıya özel kütüphane, 1–5 puan, kitap yorumları ve spoiler gizleme.
- Kitap, cilt ve bölüm oluşturma; Tiptap editörü ve gecikmeli otomatik taslak kaydı.
- Sürüm çakışması kontrolü: eski sekme yeni metni sessizce ezemez.
- Taslak/canlı metin ayrımı ve kayıtlarda bölüm sürüm geçmişi.
- Yayın ve premium başvuruları; değişmeyen başvuru anlık görüntüleri.
- Yönetici incelemesi, gerekçeli onay/red ve işlem kayıtları.
- Premium sonrası bölüm fiyatlandırması; premium öncesi yayınları ücretlendirmeyi engelleyen sunucu kuralları.
- Ücretli/taslak metnin okuyucuya gönderilmemesi; bölüm gövdelerinde ortak önbellek kullanılmaması.
- SQL migration'ları, ilk yayın/onay tarihini koruyan DB tetikleyicileri ve ilişkisel kısıtlar.

Başlangıç seed'i 6 kitap, 42 bölüm ve örnek yazar/değerlendirme içerir. Bunlar gerçek platform kullanım verileri değildir. Örnek kullanıcıların parolası yoktur; giriş için **Kayıt ol** ekranından kendi hesabınızı oluşturun. Seed, veritabanında kitap varsa tekrar veri eklemez. Üretim veritabanında örnek seed kullanmayın.

## Yayın akışını deneme

1. Bir yazar hesabı oluşturun; **Yazar stüdyosu → Yeni kitap** yolunu açın.
2. Kitabı oluşturup otomatik eklenen ilk bölüme en az 30 kelime yazın. Kaydedildi bildirimini bekleyin.
3. Kitabın stüdyo ekranında hak sahipliği kutusunu işaretleyip incelemeye gönderin.
4. Ayrı bir hesap oluşturun. Sunucuyu durdurup bu hesaba aşağıdaki CLI ile yönetici yetkisi verin:

```sh
npm run db:admin -- admin@ornek.com
```

5. Sunucuyu yeniden başlatın; yönetici hesabıyla `/admin` ekranında başvuruyu inceleyip gerekçeyle **Onayla ve yayımla** düğmesine basın.
6. Kitap ve başvuruda incelenen en fazla üç örnek bölüm aynı işlemde yayımlanır; kitap Keşfet ve ana sayfanın Son güncellemeler listesine girer. Başvurudan sonra düzenlenen taslaklar ve incelemeye alınmayan bölümler otomatik yayımlanmaz. Sonraki bölümler ve taslak güncellemeleri bölüm editöründen ayrıca yayımlanır. Önceki akıştan kalan `APPROVED` kitaplar için editörden ilk yayın desteği korunur.
7. Kitap yayımlandıktan sonra premium başvurusu gönderilebilir. E-postası doğrulanmış yönetici, kendi kitabının yayın ve premium başvurularını da onaylayabilir veya reddedebilir. Karar gerekçesi, değerlendiren yönetici ve işlem kaydı saklanır.
8. Premium onayından **sonra ilk kez yayımlanan** bölümün fiyatı değiştirilebilir. Önceki bölüm düzenlense bile ücretsiz kalır.

`db:admin` hesabı oluşturmaz, var olan ve e-postası doğrulanmış hesaba yetki verir. Ön tanımlı/yayımlanmış yönetici parolası yoktur.

## Bu sürümün sınırları

Bu teslim, temel yayın akışının çalışan ilk geliştirme dilimidir; mimari dokümandaki bütün aşamaların tamamlandığı anlamına gelmez.

- **Gerçek ödeme, checkout, satın alma hakkı, iyzico webhook'u, iade ve yazara para aktarımı henüz yok.** Ücretli bölüm ekranı bunu açıkça belirtir ve ödeme almaz.
- Premium incelemesi bu sürümde editoryal uygunluk/fiyatlandırma akışını gösterir. Sağlayıcı onboarding'i, sözleşmeler ve finans kontrolleri ücretli lansmandan önce tamamlanmalıdır.
- pg-boss worker, zamanlanmış yayın, transactional outbox ve takip bildirimi henüz eklenmedi.
- R2 dosya yükleme henüz yok; altı anime kapak illüstrasyonu yerel dosyalardan seçilir.
- Kitap metadata düzenleme, cilt/bölüm taşıma/sıralama, geçmiş sürüme dönme arayüzü, bölüm yorumları, şikâyet/itiraz, gelişmiş moderasyon ve yönetici MFA sonraki dilimdedir.
- Katalog ilk 60 sonucu, kitap yorumları son 30 yorumu gösterir; büyük katalog için cursor sayfalama gerekir.
- Okuma ilerlemesi bölüm seviyesindedir; paragraf/scroll konumu eşitlemesi henüz yok.
- E-posta çağrısı şu an doğrudan Resend'e yapılır; kalıcı teslim kuyruğu eklenmeden üretim bildirim garantisi verilmez.
- İş kuralı testleri izole PGlite üzerinde çalışır. Neon bağlantısı ve veri aktarımı ayrıca doğrulanır; üretim e-posta sağlayıcısı, yedekten dönüş ve ölçek testleri ayrı işlerdir.

## Kod yapısı

```text
src/app/                      Next.js sayfaları ve auth route handler
src/components/               Paylaşılan arayüz, editör, okuyucu
src/db/                       Prisma Client, Neon bağlantısı ve ortak tipler
src/generated/prisma/         Otomatik üretilen istemci; Git dışında
src/lib/                      Oturum, auth, ortak yardımcılar
src/modules/catalog/          Güvenli katalog sorguları
src/modules/publishing/       Yetki/premium politikaları ve transaction servisleri
src/modules/community/        Kütüphane, puan, yorum, okuma işareti
prisma/                       Prisma şeması, SQL migration ve DB değişmezlik kısıtları
prisma.config.ts              Prisma CLI bağlantı ve migration yapılandırması
public/art/                   Anime illüstrasyonları ve üretim notları
scripts/                      Yerel veri aktarımı, örnek veri ve yönetici CLI
tests/                        İş kuralları ve Playwright tarayıcı testleri
```

İstemcide gizlenen düğmeler yetki kontrolü sayılmaz. Server Actions oturumu, sahipliği ve girdiyi yeniden kontrol eder. Yayın/premium/fiyat işlemleri kitap satırını transaction içinde kilitler. İstemciden kullanıcı rolü veya ilk yayın/onay tarihi kabul edilmez.

## Kontroller

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

`npm run test:e2e` önce üretim derlemesi alır. Playwright, **localhost:3100** üzerinde ayrı PostgreSQL veritabanıyla çalışır. `docker compose up -d postgres-test` sonrasında `.env` içine `TEST_DATABASE_URL=postgresql://satir:satir@localhost:5433/satir_e2e` ekleyin. Veritabanı adı `_e2e` ile bitmeli ve uygulama veritabanından farklı olmalıdır. Testler Neon bağlantısına otomatik yönlenmez. CI kendi geçici PostgreSQL servisini başlatır. Migration, seed ve test yöneticisi bu ayrı veritabanında hazırlanır. Aynı derleme klasörü kullanıldığı için testten önce normal sunucuyu durdurun. Ekran görüntüleri ve izler `test-results/` altındadır.

`npm test`, Prisma Client ile ayrı, geçici PGlite veritabanlarında çalışır. 21 yayın/içerik testi ilk yayın, ilk premium tarihi, yetkisiz yazma, yinelenen başvuru, taslak çakışması, güvenli metin şeması ve mikrosaniyeli tarih korumasını denetler. Yönetici kendi kitabının yayın/premium başvurusunu onaylayabilir veya reddedebilir; bu dört senaryoda yetki kontrolü, karar kaydı ve yeniden değerlendirme engeli de test edilir. Otomatik yayın testleri gerçek katalog sorgularını, incelenen sürümün korunmasını, yalnız örnek bölümlerin yayımlanmasını ve gizli/eksik bölüm varsa tüm işlemin geri alınmasını kapsar. 3 migration testi kayıtların korunmasını, tekrar çalıştırmayı, tamamlanmamış geçmişi ve checksum uyuşmazlığını kapsar. 5 bağlantı/kimlik doğrulama testi eksik URL’de yerel veritabanına dönülmediğini ve geliştirme önizlemesinin üretimde açılmadığını denetler.

Üretim derlemesi sonrası `npm start` ile çalıştırılabilir. Bu, eksik ödeme/moderasyon/işletim işlerinin tamamlandığı veya ürünün ticari lansmana hazır olduğu anlamına gelmez.

### Bu teslimde doğrulananlar

Suspense düzenlemesi: TypeScript, ESLint, üretim derlemesi ve 29 Vitest testi başarılı. Neon’da ayrı test veritabanıyla 5 Playwright testi geçti. İki yeni test, sorguları veritabanı kilidiyle bekleterek menünün oturum/katalogdan önce, kitap ve bölüm listesinin de yorumlardan önce görünmesini doğrular.

19 Eylül 2026: Neon migration’ları uygulandı; 15 kullanıcı, 8 kitap, 44 bölüm ve ilişkili kayıtlar yerel yedekten aktarılarak alan değerleri doğrulandı. TypeScript, ESLint, 29 Vitest testi ve üretim derlemesi başarılı. Neon üzerinde ayrı geçici veritabanıyla 3 Playwright testi geçti; test veritabanı ardından kaldırıldı. Aktarılan kitap, ana sayfa, keşif, okuyucu ve giriş/kayıt sayfaları gerçek uygulama bağlantısıyla kontrol edildi. Taslak kaydından hemen sonraki yayında eski sürüm gönderilmesi düzeltildi.

17 Eylül 2026: Anime/webnovel arayüzü ve Prisma geçişi tamamlandı. TypeScript, ESLint ve üretim derlemesi geçti. İlk kontrolde 17 iş kuralı/migration testi ile 3 Playwright üretim tarayıcı testi başarılı. Kayıt, kütüphane, puan/yorum, otomatik kayıt, yönetici onayı, premium onayı, eski/yeni bölüm fiyatlandırması ve HTML/RSC içerik sınırı uçtan uca kontrol edildi. Masaüstü ve mobil ekran görüntüleri incelendi; kapakların yüklendiği, yatay taşma olmadığı ve mobil menünün klavye davranışı doğrulandı. Mevcut yerel veritabanı veri silinmeden Prisma migration geçmişine geçirildi. `npm audit` sonucu: 0 bilinen açık. GitHub Actions akışı eklendi; uzak CI çalıştırması bu yerel doğrulamanın parçası değildir.

Aynı gün yönetici öz değerlendirme kuralı güncellendi: kendi kitabının yayın ve premium başvurularında karar formu açıldı. Bu değişiklik sonrasında 21 test, TypeScript ve ESLint yeniden başarılı; üretim derlemesi ve tam Playwright paketi bu ek değişiklik için yeniden çalıştırılmadı.

Yayın onayı daha sonra otomatik yayınla birleştirildi. Bu değişiklikte 24 test, TypeScript ve ESLint başarılı. Playwright senaryosu ayrı ilk yayın adımı gerektirmeyecek şekilde güncellendi; tam üretim E2E paketi yeniden çalıştırılmadı. Yerel geliştirme sunucusunda önceden onaylanmış `deneme` kitabı mevcut yayın işlemiyle açıldı; kitap sayfası, Keşfet ve ana sayfa görünürlüğü Playwright ile doğrulandı. Masaüstü/mobil ekran görüntüleri alındı; mobil yatay taşma ve tarayıcı çalışma zamanı hatası görülmedi.
