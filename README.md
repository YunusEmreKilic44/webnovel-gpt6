# Satır — Webnovel platformu

Anime/manga görsel kimliğine sahip, Türkçe ve metin tabanlı webnovel platformu. Next.js App Router, React, TypeScript, Prisma 7 ve PostgreSQL kullanır. Ürün kararları, çalışan kapsam ve hedef mimari: [WEBNOVEL_MIMARI.md](./WEBNOVEL_MIMARI.md).

Son güncelleme: **20 Eylül 2026**. Uygulama Neon PostgreSQL kullanır. Yerel kitaplar, kullanıcılar ve ilişkili kayıtlar yedeklenerek Neon’a taşındı.

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

### Cloudinary (görsel yükleme)

Kitap kapakları ve ana sayfa slayt görselleri Cloudinary’de saklanır; veritabanında yalnız teslim adresi (`cover_url`, `image_url`) ve silme için `public_id` tutulur. `.env` içinde şunları tanımlayın (Cloudinary Dashboard → Settings → API Keys):

```bash
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=   # yalnız sunucuda; NEXT_PUBLIC_ öneki vermeyin
CLOUDINARY_FOLDER=satir  # yüklemeler satir/covers ve satir/slides altına gider
```

- Yüklenen dosya önce sunucuda `sharp` ile doğrulanır (JPG/PNG/WebP, en fazla 3 MB), EXIF temizlenerek WebP’ye çevrilir, sonra imzalı API ile yüklenir. Değiştirilen veya kaldırılan eski görsel Cloudinary’den silinir; kayıt başarısız olursa yeni yüklenen dosya da geri silinir.
- Sayfalar görselleri `next/image` + Cloudinary loader ile boyutlandırır (`f_auto,q_auto,w_…`).
- Ayarlar eksikse görsel yükleme hata mesajı verir; hazır illüstrasyonlar çalışmaya devam eder.
- Migration’dan sonra eski, veritabanında saklanan slayt görsellerini taşımak için: `npm run media:migrate-slides -- --dry-run`, ardından `npm run media:migrate-slides`.
- Yöneticiler kitap ayrıntı sayfasında yazarın yüklediği kapağı gerekçeyle kaldırabilir.

### Coin ve ödemeler (iyzico)

Okurlar cüzdan sayfasından (`/cuzdan`) coin paketi alır; premium bölümler **sabit bir coin fiyatıyla** açılır. Yazarlar fiyat belirlemez, yalnız premium onayından sonra yayımlanan bölümleri premium işaretler. Bölüm fiyatı ve paketler `/admin/coin` sayfasından yönetilir (varsayılan: bölüm 5 coin; 50 coin 24,99 ₺, 150 coin 64,99 ₺, 400 coin 159,99 ₺).

```bash
IYZICO_API_KEY=
IYZICO_SECRET_KEY=
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com   # canlıda https://api.iyzipay.com
```

- Ödeme iyzico’nun barındırılan ödeme formunda alınır; kart bilgisi uygulamaya gelmez. iyzico sonucu `${BETTER_AUTH_URL}/api/payments/iyzico/callback` adresine gönderir, bu yüzden canlıda `BETTER_AUTH_URL` herkese açık https adresi olmalıdır.
- Callback’e güvenilmez: sunucu token ile iyzico’dan sonucu sorgular; sipariş numarası, tutar, para birimi ve dolandırıcılık durumu eşleşmeden coin yüklenmez. Aynı ödeme iki kez yüklenemez.
- Bakiye veritabanında eksiye düşemez; her hareket `coin_transactions` defterine yazılır. Bir bölüm aynı okur için yalnız bir kez ücretlendirilir.
- Tahsil edilip siparişle uyuşmayan ödemeler `coins.order.paid_mismatch` olarak loglanır ve iyzico panelinden elle iade edilmelidir.

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

Ayarlar, profil, stüdyo kitapları, cilt/bölüm yönetimi ve başvurular da bağımsız sunucu bileşenlerinden yüklenir. Okuyucunun metni ve bölüm bağlantıları oturum sorgusunu beklemez; metin sunucuda render edilir ve ücretli/taslak içerik sorgu koşullarıyla korunur. Bölüm gezinmesi tüm bölüm listesini taşımak yerine yalnız önceki/sonraki kimlikleri getirir. Ana sayfa sorguları gerekli 6/6/5 kitapla sınırlıdır; Better Auth’ın getirdiği kullanıcı için ikinci sorgu yapılmaz. Kitap-yazar, yorum ve puan sorgularına indeksler eklendi. Arama formları `next/form` ile tam sayfa yenilemeden geçiş yapar.

Yerel illüstrasyonlar: `public/art/`. Vitrin için bir geniş görsel ve yazarın seçebileceği altı kapak bulunur; Next.js Image görselleri cihaz boyutuna göre sunar. Görsel üretim bilgileri ve promptlar: [ARTWORK.md](./public/art/ARTWORK.md).

Bu sürüm metin tabanlı webnovel okuyucusudur; manga sayfası yükleme veya panel okuyucusu içermez. Görsel kimlik `src/app/globals.css`, gezinme `src/components/shell.tsx`, kapak sunumu `src/components/book-cover.tsx` üzerinden yönetilir.

## Neler çalışıyor?

- `/duyurular`: yayımlanan tüm duyuruların 12 kayıtlık sayfalarla arşivi; `/duyurular/[id]`: duyurunun tam metni ve görselleri. Ana sayfada ilk üç duyurunun özeti bulunur; masaüstü ve mobil menüden arşive erişilir. Taslaklar herkese açık sorgulara dahil edilmez.
- `/admin/duyurular`: metin/görsel bloklarıyla duyuru hazırlama, imleç konumuna isteğe bağlı görsel ekleme, blok sıralama/kaldırma, bağlantı, taslak/yayın ve silme. En fazla 8 JPG/PNG/WebP görsel; dosya başına 3 MB, tek kayıtta toplam 12 MB, metin için 20.000 karakter sınırı vardır. Görseller kaydetme sırasında Cloudinary `announcements` klasörüne yüklenir; kaydedilmemiş seçimler yerel önizlemedir. Kaldırılan/değiştirilen görseller ve başarısız kayıtların yüklemeleri temizlenir. `20261003000000_announcement_content` migration'ı eski metinleri koruyarak JSON bloklarına taşır (`npm run db:migrate`).
- `/admin/slider`: ana sayfa slaytlarının başlık, açıklama, site içi bağlantı, görsel ve sıra yönetimi. JPG/PNG/WebP dosyaları (en fazla 3 MB) doğrulanıp küçültülerek WebP biçiminde PostgreSQL'de saklanır; yeniden dağıtımda kaybolmaz. Hazır görsel seçimi ve yönetici önizlemesi bulunur. Yayında slayt yoksa mevcut haftanın hikâyesi alanı gösterilir. Duyuru/slider değişiklikleri yetki kontrolü ve işlem kaydıyla saklanır; `20260923000002_site_content` migration'ı gerekir.
- Kitap sayfasında toplam okunma; profil menüsü ve stüdyodan erişilen `/studio/istatistikler` yazar panelinde kitap/bölüm okunmaları, son 7 gün okunması, kütüphaneye eklenme, görünür yorum ve değerlendirme istatistikleri. Panel yalnız oturum sahibinin kitaplarını gösterir.
- Okunma, yayımlanmış ücretsiz bölüm metni görünür sekmede açıldığında kaydedilir. Hesap veya misafir tarayıcı başına aynı bölüm UTC gününde bir kez sayılır; eşzamanlı istekler veritabanında tekilleştirilir. Yazarın kendi hesabıyla okumaları, ön yüklemeler, taslak/gizli/kilitli içerik sayılmaz. Kitap toplamı bölüm okumalarının toplamıdır; geçmiş okumalar geriye dönük üretilemez. Misafir kimliği HttpOnly çerezde, istatistik kimliği hash olarak saklanır. Yeni kurulum/güncellemede `npm run db:migrate` çalıştırılmalıdır.
- Türkçe, mobil uyumlu keşif, arama/tür filtresi, puana göre sıralama ve tamamlanan kitaplar.
- Kitap sayfası, cilt/bölüm listeleri ve kalıcı bölüm URL'leri.
- Açık/koyu/sepya okuma, yazı boyutu tercihleri ve bölüm bazlı okuma işareti.
- Better Auth ile kayıt, giriş, çıkış; e-posta doğrulama ve şifre yenileme sağlayıcı bağlantısı.
- Navbar profil menüsü: profil, ayarlar, kütüphane, stüdyo ve çıkış; yöneticide yönetim bağlantısı. `/profil` hesap özeti ve hikâyeleri, `/ayarlar` ad güncelleme, şifre değişikliği ve tarayıcıya özel okuma tercihleri sunar. Eski `/hesap` adresi `/profil` sayfasına yönlenir.
- Kullanıcıya özel kütüphane, 1–5 puan, kitap yorumları ve spoiler gizleme.
- Kitap yorumlarında beğenme/geri alma ve toplam beğeni sayısı. Doğrulanmış, banlı olmayan hesap başına bir beğeni saklanır; gizli yorumlara ve yayında olmayan kitaplara beğeni eklenemez.
- Yönetici kullanıcı listesinde doğrudan **Düzenle**, **Banla** ve **Banı kaldır** işlemleri; banlı/aktif filtreleri, gerekçe ve işlem geçmişi. Ban süresizdir ve yönetici tarafından kaldırılır. Ban açık oturumları kapatır, yeni girişi ve uygulama işlemlerini engeller; ban kaldırılınca yeniden giriş gerekir. Kullanıcı ve içerikleri silinmez. Güncelleme için `npm run db:migrate` gerekir.
- Kitap, cilt ve bölüm oluşturma; Tiptap editörü ve gecikmeli otomatik taslak kaydı. Editördeki **Resim ekle** butonu imleç konumuna isteğe bağlı resim ekler ve anında önizler; resme tıklayarak erişilebilirlik açıklaması yazılabilir veya resim kaldırılabilir. Geri al/yinele desteklenir. Bölüm başına en fazla 1 resim, dosya başına 3 MB (JPG/PNG/WebP) yükleme sınırı vardır. Resimler kelime sayısına dahil edilmez.
- Bölüm görselleri, taslak/premium erişimini korumak için WebP olarak `chapter_images` tablosunda saklanır ve `/api/chapter-images/[id]` üzerinden yetki kontrolüyle sunulur; ortak önbelleğe alınmaz. Bölüm, görsel ve sürüm kaydı aynı transaction içindedir. Önceki sürümler ve inceleme anlık görüntüleri için kaydedilmiş görseller korunur; bölümü tamamen silmek ilişkili görselleri de siler. `20261004000000_chapter_images` migration'ı gerekir (`npm run db:migrate`).
- Sürüm çakışması kontrolü: eski sekme yeni metni sessizce ezemez.
- Taslak/canlı metin ayrımı ve kayıtlarda bölüm sürüm geçmişi.
- Yayın ve premium başvuruları; değişmeyen başvuru anlık görüntüleri.
- Yönetici incelemesi, gerekçeli onay/red ve işlem kayıtları.
- `/admin` sol menülü yönetim alanı: genel bakış, kullanıcılar, kitaplar, başvurular, yorumlar ve işlem geçmişi. Listeler arama, filtre ve 20 kayıtlık sayfalama içerir. Kullanıcı ayrıntılarında ad/rol düzenleme ve tüm oturumları kapatma; kitap ayrıntılarında bilgi, hikâye durumu, vitrin ve görünürlük yönetimi; bölüm ve yorumlarda gerekçeli gizleme/geri açma bulunur. Yönetici rolü için doğrulanmış e-posta gerekir, kendi yetkisini kaldırma engellenir ve rol değişiklikleri hedefin oturumlarını kapatır. Yeni yönetim değişikliği ile işlem kaydı aynı transaction içinde saklanır. Yayın/premium onayları `/admin/basvurular` sayfasındadır.
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

5. Sunucuyu yeniden başlatın; yönetici hesabıyla `/admin/basvurular` ekranında başvuruyu inceleyip gerekçeyle **Onayla ve yayımla** düğmesine basın.
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
- Yazar stüdyosunda kitap metadata düzenleme, cilt/bölüm taşıma/sıralama, geçmiş sürüme dönme arayüzü, bölüm yorumları, şikâyet/itiraz, gelişmiş moderasyon ve yönetici MFA sonraki dilimdedir. Yöneticiler kitap bilgilerini ve bölüm/yorum görünürlüğünü yönetim panelinden düzenleyebilir.
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

Kullanıcı kimliği: `User.name`, PostgreSQL'in metin eşitliğiyle benzersizdir (büyük/küçük harf farklı ad sayılır). Kayıt ve ad güncellemelerinde baş/son boşluklar temizlenir ve 2–60 karakter sınırı uygulanır. `User.slug`, ekleme trigger'ı tarafından addan üretilir; Türkçe karakterler dönüştürülür, çakışmalara sayısal ek verilir. Slug benzersiz ve değişmezdir; ad değişince profil adresi korunur. Herkese açık rota `/yazar/[slug]`, ilişkiler ve yetki kontrolleri kullanıcı ID'siyle çalışır. Eski ID adresleri kalıcı olarak slug adresine yönlenir.

Bu değişikliği dağıtırken `npm run build` ve uygulamayı başlatmadan önce `npm run db:migrate` çalıştırın; build, Prisma istemcisini de yeniden üretir. `20261006000000_user_identity`, mevcut hesapların sluglarını doldurur. Aynı ada sahip hesaplar varsa migration, adları kendiliğinden değiştirmeden durur. Ön kontrol: `SELECT name, array_agg(id) FROM "user" GROUP BY name HAVING count(*) > 1;`. Çakışmaları giderdikten sonra başarısız migration kaydını Prisma'nın `migrate resolve --rolled-back 20261006000000_user_identity` komutuyla çözerek migration'ı yeniden uygulayın. Yerel aktarım script'i eski kayıtların sluglarını hedef veritabanında oluşturur; mevcut slugları korur.

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
