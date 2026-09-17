# Satır — Webnovel platformu

Anime/manga görsel kimliğine sahip, Türkçe ve metin tabanlı webnovel platformu. Next.js App Router, React, TypeScript, Prisma 7 ve PostgreSQL kullanır. Ürün kararları, çalışan kapsam ve hedef mimari: [WEBNOVEL_MIMARI.md](./WEBNOVEL_MIMARI.md).

Son güncelleme: **17 Eylül 2026**. Arayüz yenilemesi ve Drizzle'dan Prisma'ya geçiş tamamlandı; mevcut yerel kitap ve kullanıcı verileri korundu.

## Hızlı başlangıç

Node.js 22.17+ ve npm gerekir. Bu çalışma alanında bağımlılıklar, yerel `.env` ve örnek veritabanı hazırlanmıştır:

```sh
npm run dev
```

Uygulama: **http://localhost:3000**

Temiz bir kurulumda:

```sh
npm ci
```

`.env.example` dosyasını `.env` olarak kopyalayın. `BETTER_AUTH_SECRET` alanına aşağıdaki komutun ürettiği değeri yazın:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npm run db:migrate
npm run db:seed
npm run dev
```

`.env` ve `.data` sürüm kontrolüne alınmaz. Hazırlanan yerel secret yalnız bu çalışma alanındadır.

### Yerel veritabanı

`DATABASE_URL` yokken `LOCAL_DATABASE=true`, PostgreSQL'in gömülü WASM sürümü **PGlite** kullanır. Veriler `.data/postgres` altında kalıcıdır; tarayıcı kapatıldığında kaybolmaz. Bu, sunucu PostgreSQL'i olmadan yerelde ürünü denemek için eklenen geliştirme adaptörüdür.

**Aynı PGlite veri klasörünü yalnız bir süreç açmalıdır.** Migration, seed veya yönetici CLI komutlarından önce çalışan web sunucusunu durdurun. Birden fazla instance, ayrı worker ve üretim için gerçek PostgreSQL kullanın. Entegrasyon testleri ayrı, bellekteki PGlite örneğinde çalışır; yerel verinizi değiştirmez.

### PostgreSQL ile çalıştırma

```sh
docker compose up -d postgres
```

`.env` içinde `DATABASE_URL=postgresql://satir:satir@localhost:5432/satir` ayarlayın, `LOCAL_DATABASE=false` yapın ve migration'ları uygulayın. Üretimde güçlü DB kimlik bilgileri, TLS ve yönetilen yedekler kullanın. Docker Compose ayarları yalnız yerel geliştirme içindir.

PostgreSQL/üretim modunda e-posta doğrulaması zorunludur. `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY` ve doğrulanmış gönderen adresi olan `EMAIL_FROM` tanımlanmalıdır. `DEV_SKIP_EMAIL_VERIFICATION` yalnız localhost URL'si + yerel PGlite koşullarında etkilidir. Resend anahtarı yoksa gerçek e-posta gönderilmez. Şifre yenileme de bu servise bağlıdır.

## Prisma geliştirme akışı

`npm ci` ve `npm run build`, Prisma Client'ı otomatik üretir. Şema `prisma/schema.prisma` içinde, PostgreSQL bağlantısı `prisma.config.ts` ve `src/db/index.ts` içindedir. Üretilen istemci `src/generated/prisma/` altında tutulur ve Git'e eklenmez. `src/db/schema.ts` yalnız ortak TypeScript tiplerini içerir; ORM şeması değildir.

PostgreSQL bağlantısı `@prisma/adapter-pg`, yerel bağlantı `pglite-prisma-adapter` kullanır. Better Auth, oturum sorguları, katalog, yayın ve topluluk işlemleri, seed ve yönetici CLI'si Prisma üzerinden çalışır. Drizzle bağımlılıkları kaldırılmıştır.

```sh
npm run db:generate
npm run db:migrate
```

Şema değişikliğinden sonra PostgreSQL geliştirme veritabanında `npm run db:dev -- --name degisiklik_adi` kullanılır. Oluşan SQL incelenip sürüm kontrolüne alınır. `db:generate` yalnız istemci üretir, migration oluşturmaz.

`db:migrate`, PostgreSQL'de Prisma Migrate kullanır. Yerel PGlite'da aynı SQL dosyaları transaction içinde uygulanıp `_prisma_migrations` tablosuna kaydedilir. Mevcut eski migration geçmişi bilinen dosya hash'leriyle doğrulanır ve uygulanmış migration'lar baseline edilir; kitaplar ve hesaplar silinmez. Tanınmayan veya değiştirilmiş geçmişte işlem durur. SQL içindeki kısmi unique index, check constraint ve değişmezlik tetikleyicileri korunur; `prisma db push` bu kuralların yerine geçmez.

## Arayüz

Koyu zeminli anime/webnovel tasarımı; yatay gezinme, mobil menü, seri vitrini, türler, son güncellemeler ve gerçek değerlendirme puanlarından sıralama içerir. Kitaplar, stüdyo ve hesap ekranları aynı tasarımı kullanır. Okuyucu varsayılan olarak koyu açılır; açık ve sepya tercihleri saklanır.

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
- Yerel doğrulama PGlite üzerinde yapılmıştır. Gerçek PostgreSQL, üretim e-posta sağlayıcısı, yedekten dönüş ve ölçek testleri ayrıca yürütülmelidir.

## Kod yapısı

```text
src/app/                      Next.js sayfaları ve auth route handler
src/components/               Paylaşılan arayüz, editör, okuyucu
src/db/                       Prisma Client, bağlantı adaptörleri ve yerel migration
src/generated/prisma/         Otomatik üretilen istemci; Git dışında
src/lib/                      Oturum, auth, ortak yardımcılar
src/modules/catalog/          Güvenli katalog sorguları
src/modules/publishing/       Yetki/premium politikaları ve transaction servisleri
src/modules/community/        Kütüphane, puan, yorum, okuma işareti
prisma/                       Prisma şeması, SQL migration ve DB değişmezlik kısıtları
prisma.config.ts              Prisma CLI bağlantı ve migration yapılandırması
public/art/                   Anime illüstrasyonları ve üretim notları
scripts/                      Migration, örnek veri ve yönetici CLI
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

`npm run test:e2e` önce üretim derlemesi alır. Playwright kendi üretim sunucusunu **localhost:3100** üzerinde ve `.data/e2e` veritabanıyla başlatır; migration, örnek veri ve test yöneticisini otomatik hazırlar. Normal geliştirme veritabanına dokunmaz. Aynı derleme klasörü kullanıldığı için testten önce normal sunucuyu durdurun. Sabit test yönetici parolası yalnız bu ayrı veritabanının fixture'ında kullanılır; normal seed'e veya üretime eklenmez. Test ekran görüntüleri ve hata izleri `test-results/` altındadır. Cache başlıkları, geliştirme sunucusunun farklı davranışı yerine üretim yanıtında doğrulanır.

`npm test`, Prisma Client ile ayrı, geçici PGlite veritabanlarında çalışır. 21 yayın/içerik testi ilk yayın, ilk premium tarihi, yetkisiz yazma, yinelenen başvuru, taslak çakışması, güvenli metin şeması ve mikrosaniyeli tarih korumasını denetler. Yönetici kendi kitabının yayın/premium başvurusunu onaylayabilir veya reddedebilir; bu dört senaryoda yetki kontrolü, karar kaydı ve yeniden değerlendirme engeli de test edilir. Otomatik yayın testleri gerçek katalog sorgularını, incelenen sürümün korunmasını, yalnız örnek bölümlerin yayımlanmasını ve gizli/eksik bölüm varsa tüm işlemin geri alınmasını kapsar. 3 migration testi eski verilerin korunmasını, tekrar çalıştırmayı, tanınmayan geçmişi ve checksum uyuşmazlığını kapsar. Bu kontroller ayrı PostgreSQL sunucusunda üretim doğrulamasının yerine geçmez.

Üretim derlemesi sonrası `npm start` ile çalıştırılabilir. Bu, eksik ödeme/moderasyon/işletim işlerinin tamamlandığı veya ürünün ticari lansmana hazır olduğu anlamına gelmez.

### Bu teslimde doğrulananlar

17 Eylül 2026: Anime/webnovel arayüzü ve Prisma geçişi tamamlandı. TypeScript, ESLint ve üretim derlemesi geçti. İlk kontrolde 17 iş kuralı/migration testi ile 3 Playwright üretim tarayıcı testi başarılı. Kayıt, kütüphane, puan/yorum, otomatik kayıt, yönetici onayı, premium onayı, eski/yeni bölüm fiyatlandırması ve HTML/RSC içerik sınırı uçtan uca kontrol edildi. Masaüstü ve mobil ekran görüntüleri incelendi; kapakların yüklendiği, yatay taşma olmadığı ve mobil menünün klavye davranışı doğrulandı. Mevcut yerel veritabanı veri silinmeden Prisma migration geçmişine geçirildi. `npm audit` sonucu: 0 bilinen açık. GitHub Actions akışı eklendi; uzak CI çalıştırması bu yerel doğrulamanın parçası değildir.

Aynı gün yönetici öz değerlendirme kuralı güncellendi: kendi kitabının yayın ve premium başvurularında karar formu açıldı. Bu değişiklik sonrasında 21 test, TypeScript ve ESLint yeniden başarılı; üretim derlemesi ve tam Playwright paketi bu ek değişiklik için yeniden çalıştırılmadı.

Yayın onayı daha sonra otomatik yayınla birleştirildi. Bu değişiklikte 24 test, TypeScript ve ESLint başarılı. Playwright senaryosu ayrı ilk yayın adımı gerektirmeyecek şekilde güncellendi; tam üretim E2E paketi yeniden çalıştırılmadı. Yerel geliştirme sunucusunda önceden onaylanmış `deneme` kitabı mevcut yayın işlemiyle açıldı; kitap sayfası, Keşfet ve ana sayfa görünürlüğü Playwright ile doğrulandı. Masaüstü/mobil ekran görüntüleri alındı; mobil yatay taşma ve tarayıcı çalışma zamanı hatası görülmedi.
