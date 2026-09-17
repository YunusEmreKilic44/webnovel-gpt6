import "dotenv/config";
import { openDatabase } from "../src/db";
import { wordCount } from "../src/modules/publishing/content";

const stories = [
  {
    id: "kul-ve-yildiz",
    title: "Kül ve Yıldız",
    subtitle: "KAYIP KRALLIĞIN MİRASI",
    author: "Elif Arden",
    genre: "Fantastik",
    cover: "ember" as const,
    description:
      "Gökyüzünden son yıldız düştüğünde, herkes bunun bir son olduğunu sandı. Genç bir haritacı olan Lâl, avucunda sönmeyen bir kıvılcımla uyanır. Unutulmuş bir krallık, kırılmış bir yemin ve yeniden yazılmayı bekleyen bir kader. Bazen yolu bulmak için önce kaybolmak gerekir.",
    titles: [
      "Gökyüzünün sustuğu gece",
      "Küllerin altındaki harita",
      "İsimsiz yolcu",
      "Camdan yapılmış bir söz",
      "Kuzey kapısı",
      "Eski dünyanın sesi",
      "Yıldız toplayıcısı",
      "Kırık pusula",
      "Son koruyucu",
      "Ateşin hatırladıkları",
      "Dönüş yolu",
      "Yeni bir gökyüzü",
    ],
    first:
      "Lâl, gökyüzünün sesini ilk kez o gece duydu. Şehrin bütün saatleri durmuştu; limandaki tekneler, görünmeyen bir el tarafından tutuluyormuş gibi kıpırtısızdı. Sadece onun odasındaki eski harita, masanın üzerinde usulca titriyordu.",
  },
  {
    id: "gece-ekspresi",
    title: "Gece Ekspresi",
    subtitle: "BAZI YOLLAR EVE ÇIKMAZ",
    author: "Deniz Yalın",
    genre: "Gizem",
    cover: "ocean" as const,
    description:
      "Her gece 00.17'de aynı istasyondan kalkan, hiçbir tarifede görünmeyen bir tren. Kayıp kardeşinin izini süren Ada, tek yön biletini aldığında geri dönüşün bir yer değil, bir seçim olduğunu öğrenecek.",
    titles: [
      "Son sefer",
      "Yedinci vagon",
      "Bilet kontrolü",
      "Unutulan durak",
      "Yol arkadaşları",
      "Sabaha karşı",
    ],
    first:
      "İstasyonun tabelası yıllar önce sökülmüştü. Yine de Ada doğru yerde olduğunu biliyordu. Cebindeki eski bilet, yağmurda ıslanmasına rağmen mürekkebini kaybetmemişti. Gece yarısını on yedi geçe, uzaklardan bir tren sesi duyuldu.",
  },
  {
    id: "yosun-kalbi",
    title: "Yosun Kalbi",
    subtitle: "ORMAN SENİ HATIRLIYOR",
    author: "Mira Aksu",
    genre: "Fantastik",
    cover: "forest" as const,
    description:
      "İnsanların unuttuğu her şey bir ormanda büyür. Annesinin son hatırasını arayan bir kız, ağaçların isimlerini bilen bir yabancıyla karşılaşır. Doğanın ve hafızanın sınırlarında, sessizce filizlenen bir macera.",
    titles: [
      "Kökler",
      "Yeşil bir fısıltı",
      "Hatıra bahçesi",
      "Yağmurun dili",
      "Ormanın ötesi",
      "Eve dönüş",
    ],
    first:
      "Ormanda hiçbir ağaç aynı yöne eğilmiyordu. Narin bunu ilk fark ettiğinde durdu, avucunu en yakın gövdeye yasladı. Kabuk sıcaktı. Sanki içeride, ahşabın derinliklerinde, küçük bir kalp atıyordu.",
  },
  {
    id: "son-yorunge",
    title: "Son Yörünge",
    subtitle: "SONSUZLUKTA BİR İHTİMAL",
    author: "Aras Tekin",
    genre: "Bilim Kurgu",
    cover: "violet" as const,
    description:
      "Dünya'dan gelen son sinyalin üzerinden kırk yıl geçti. Kepler istasyonunun yalnız arşivcisi, henüz doğmamış birinden bir mesaj alır. Zamanın iki ucunda başlayan bir insanlık hikâyesi.",
    titles: [
      "Sinyal",
      "Boşlukta yankı",
      "Kırk yıl sonra",
      "Mavi nokta",
      "Dönüş koordinatları",
      "Yörünge",
    ],
    first:
      "İstasyonun penceresinden Dünya, unutulmuş bir boncuk gibi görünüyordu. Eren her sabah aynı manzaraya bakıyor, her sabah biraz daha az hatırlıyordu. O gün arşiv terminalinde bir ışık yandı. Kırk yıldır ilk kez.",
  },
  {
    id: "eylulun-son-mektubu",
    title: "Eylülün Son Mektubu",
    subtitle: "SÖYLENMEMİŞ HER ŞEYE",
    author: "Selin Erdem",
    genre: "Romantik",
    cover: "rose" as const,
    description:
      "Küçük bir sahafın rafları arasında bulunan on iki mektup. Hiç tanışmamış iki insanın birbirine bıraktığı notlar, sonbahar İstanbul'unda yollarını kesiştirir. Bazı hikâyeler noktadan sonra başlar.",
    titles: [
      "Sahaf",
      "İlk mektup",
      "Yağmurlu perşembe",
      "Kenar notları",
      "Bir fincan daha",
      "Son sayfa",
    ],
    first:
      "Kitabın arasından düşen zarfın üzerinde yalnızca bir tarih vardı. Eylül, tozlu zemine eğilip zarfı aldığında sahafın kapı zili çaldı. İçeri giren adamı daha önce hiç görmemişti ama elindeki kitabı tanıyordu.",
  },
  {
    id: "kum-saati",
    title: "Kum Saati",
    subtitle: "HER SANİYE BİR SIR",
    author: "Bora Kuzey",
    genre: "Macera",
    cover: "sand" as const,
    description:
      "Çölün ortasında, haritalardan silinmiş bir şehir. Zamanın tersine aktığı söylentisini araştıran genç bir kâşif, kendi geçmişinin izleriyle karşılaşır. Keşfedilmeyi bekleyen yalnızca bir şehir değildir.",
    titles: [
      "Sarı ufuk",
      "Haritasız şehir",
      "Kumun hafızası",
      "Tersine",
      "Gölge pazarı",
      "Zamanın kıyısı",
    ],
    first:
      "Çölün sessizliğini tarif etmek kolay değildi. Ses yokluğu değildi bu; her şeyin nefesini tutması gibiydi. Sarp, pusulasının ibresine son kez baktı. İbre kuzeyi değil, kumun altını gösteriyordu.",
  },
];
const continuation = [
  "Bir süre hiçbir şey söylemeden bekledi. Dışarıdaki dünya kendi ritminde akmaya devam ediyordu ama burada, bu küçük anda, bir şeyler geri dönülmez biçimde değişmişti. Cevapların kolay olmayacağını biliyordu. Yine de ilk adımı atmak için bütün yolu görmek gerekmiyordu.",
  "Eski defterini açıp sayfanın kenarına tek bir cümle yazdı: Her hikâyenin, henüz anlatılmamış bir tarafı vardır. Kalemi bıraktı. Pencerenin ardından süzülen ışık, sözcüklerin üzerine düştü. İçinde uzun zamandır hissetmediği bir merak uyanmıştı.",
  "Kapının eşiğinde durduğunda arkasına baktı. Bildiği her şey oradaydı: masadaki fincan, yarım kalmış notlar, duvarda asılı küçük resim. Önündeyse henüz adı konmamış bir yol uzanıyordu. Derin bir nefes aldı ve dışarı çıktı.",
];
const { db, close } = openDatabase();
try {
  const exists = await db.book.findMany({ take: 1, select: { id: true } });
  if (exists.length) {
    console.log("Veritabanında kitap var; örnek veriler tekrar eklenmedi.");
  } else {
    await db.$transaction(async (tx) => {
      for (let n = 0; n < 8; n++)
        await tx.user.create({
          data: {
            id: `sample-reader-${n}`,
            name: [
              "Zeynep",
              "Kerem",
              "Duru",
              "Emir",
              "İpek",
              "Ege",
              "Yağmur",
              "Can",
            ][n],
            email: `reader${n}@example.test`,
            emailVerified: true,
          },
        });
      for (const [storyIndex, story] of stories.entries()) {
        const authorId = `sample-author-${storyIndex}`;
        await tx.user.create({
          data: {
            id: authorId,
            name: story.author,
            email: `author${storyIndex}@example.test`,
            emailVerified: true,
          },
        });
        await tx.book.create({
          data: {
            id: story.id,
            authorId,
            slug: story.id,
            title: story.title,
            subtitle: story.subtitle,
            description: story.description,
            genre: story.genre,
            cover: story.cover,
            status: "PUBLISHED",
            storyStatus: storyIndex === 4 ? "COMPLETED" : "ONGOING",
            featured: storyIndex === 0,
            updatedAt: new Date(Date.now() - storyIndex * 86400000),
          },
        });
        for (const [chapterIndex, title] of story.titles.entries()) {
          const volumePosition =
            storyIndex === 0 ? Math.floor(chapterIndex / 4) + 1 : 1;
          const volumeId = `${story.id}-v${volumePosition}`;
          await tx.volume.createMany({
            data: {
              id: volumeId,
              bookId: story.id,
              title:
                storyIndex === 0
                  ? [
                      "Küllerin Arasından",
                      "Kuzeyin Çağrısı",
                      "Yıldızın Mirası",
                    ][volumePosition - 1]
                  : "Birinci Cilt",
              position: volumePosition,
            },
            skipDuplicates: true,
          });
          const content = {
            type: "doc",
            content: [
              chapterIndex === 0
                ? story.first
                : `${title}. Yolculuk yeni bir güne açılıyordu. ${story.first}`,
              ...continuation,
            ].map((text) => ({
              type: "paragraph",
              content: [{ type: "text", text }],
            })),
          };
          await tx.chapter.create({
            data: {
              id: `${story.id}-${chapterIndex + 1}`,
              bookId: story.id,
              volumeId,
              title,
              publishedTitle: title,
              position:
                storyIndex === 0 ? (chapterIndex % 4) + 1 : chapterIndex + 1,
              content,
              publishedContent: content,
              wordCount: wordCount(content),
              publishedWordCount: wordCount(content),
              status: "PUBLISHED",
              firstPublishedAt: new Date("2026-09-01T12:00:00Z"),
            },
          });
        }
        for (let n = 0; n < 8; n++)
          await tx.rating.create({
            data: {
              id: `${story.id}-rating-${n}`,
              userId: `sample-reader-${n}`,
              bookId: story.id,
              score: n < 5 - (storyIndex % 3) ? 5 : 4,
            },
          });
      }
      await tx.comment.create({
        data: {
          id: "sample-comment-1",
          userId: "sample-reader-0",
          bookId: "kul-ve-yildiz",
          body: "İlk bölümün atmosferi çok güzel. Haritanın sırrını öğrenmek için sabırsızlanıyorum.",
        },
      });
    });
    console.log(
      "6 örnek kitap ve 42 bölüm oluşturuldu. Örnek kullanıcıların giriş parolası yoktur.",
    );
  }
} finally {
  await close();
}
