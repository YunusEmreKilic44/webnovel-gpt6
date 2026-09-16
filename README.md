# Satır — Webnovel platformu

Next.js App Router, React, TypeScript, Drizzle ve PostgreSQL tabanlı ilk çalışan sürüm. Ürün ve hedef mimari: [WEBNOVEL_MIMARI.md](./WEBNOVEL_MIMARI.md).

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

5. Sunucuyu yeniden başlatın; yönetici hesabıyla `/admin` ekranında başvuruyu inceleyip gerekçeyle onaylayın.
6. Yazar hesabıyla bölüm editörüne dönün. İlk yayın, onaylanan başvuru metnini yayımlar; daha sonraki taslak ayrı kalır.
7. Kitap yayımlandıktan sonra premium başvurusu gönderilebilir. Yönetici kendi kitabının başvurusunu onaylayamaz.
8. Premium onayından **sonra ilk kez yayımlanan** bölümün fiyatı değiştirilebilir. Önceki bölüm düzenlense bile ücretsiz kalır.

`db:admin` hesabı oluşturmaz, var olan ve e-postası doğrulanmış hesaba yetki verir. Ön tanımlı/yayımlanmış yönetici parolası yoktur.

## Bu sürümün sınırları

Bu teslim, temel yayın akışının çalışan ilk geliştirme dilimidir; mimari dokümandaki bütün aşamaların tamamlandığı anlamına gelmez.

- **Gerçek ödeme, checkout, satın alma hakkı, iyzico webhook'u, iade ve yazara para aktarımı henüz yok.** Ücretli bölüm ekranı bunu açıkça belirtir ve ödeme almaz.
- Premium incelemesi bu sürümde editoryal uygunluk/fiyatlandırma akışını gösterir. Sağlayıcı onboarding'i, sözleşmeler ve finans kontrolleri ücretli lansmandan önce tamamlanmalıdır.
- pg-boss worker, zamanlanmış yayın, transactional outbox ve takip bildirimi henüz eklenmedi.
- R2 dosya yükleme henüz yok; kapaklar seçilebilir renklerde yerel SVG/CSS tasarımlarıdır.
- Kitap metadata düzenleme, cilt/bölüm taşıma/sıralama, geçmiş sürüme dönme arayüzü, bölüm yorumları, şikâyet/itiraz, gelişmiş moderasyon ve yönetici MFA sonraki dilimdedir.
- Katalog ilk 60 sonucu, kitap yorumları son 30 yorumu gösterir; büyük katalog için cursor sayfalama gerekir.
- Okuma ilerlemesi bölüm seviyesindedir; paragraf/scroll konumu eşitlemesi henüz yok.
- E-posta çağrısı şu an doğrudan Resend'e yapılır; kalıcı teslim kuyruğu eklenmeden üretim bildirim garantisi verilmez.
- Yerel doğrulama PGlite üzerinde yapılmıştır. Gerçek PostgreSQL, üretim e-posta sağlayıcısı, yedekten dönüş ve ölçek testleri ayrıca yürütülmelidir.

## Kod yapısı

```text
src/app/                      Next.js sayfaları ve auth route handler
src/components/               Paylaşılan arayüz, editör, okuyucu
src/db/                       PostgreSQL şeması ve iki bağlantı adaptörü
src/lib/                      Oturum, auth, ortak yardımcılar
src/modules/catalog/          Güvenli katalog sorguları
src/modules/publishing/       Yetki/premium politikaları ve transaction servisleri
src/modules/community/        Kütüphane, puan, yorum, okuma işareti
drizzle/                      Üretilen migration ve özel DB değişmezlik kısıtları
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

`npm test` gerçek PostgreSQL motorunu kullanan ayrı, geçici bir PGlite veritabanında çalışır. İlk yayın, ilk premium tarihi, yetkisiz yazma, yinelenen başvuru, taslak çakışması ve güvenli metin şeması denetlenir.

Üretim derlemesi sonrası `npm start` ile çalıştırılabilir. Bu, eksik ödeme/moderasyon/işletim işlerinin tamamlandığı veya ürünün ticari lansmana hazır olduğu anlamına gelmez.

### Bu teslimde doğrulananlar

16 Eylül 2026: TypeScript, ESLint ve üretim derlemesi geçti. 13 iş kuralı/DB testi ile 3 Playwright üretim tarayıcı testi başarılı. Kayıt, kütüphane, puan/yorum, otomatik kayıt, yönetici onayı, premium onayı, eski/yeni bölüm fiyatlandırması ve HTML/RSC içerik sınırı uçtan uca kontrol edildi. Masaüstü ve mobil ekran görüntüleri incelendi. `npm audit` sonucu: 0 bilinen açık. GitHub Actions akışı eklendi; uzak CI çalıştırması bu yerel doğrulamanın parçası değildir.
