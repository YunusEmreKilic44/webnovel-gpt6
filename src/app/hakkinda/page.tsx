export const metadata = { title: "Satır hakkında" };
export default function About() {
  return (
    <div style={{ maxWidth: 750 }} className="stack">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> BİR SATIR, BİN DÜNYA
          </div>
          <h1>Her hikâyeye bir ev.</h1>
          <p>
            Satır; okurların yeni dünyalarla, yazarların kendi sesleriyle
            buluştuğu yer.
          </p>
        </div>
      </div>
      <div className="panel stack">
        <h2>Oku. Hayal et. Yaz.</h2>
        <p>
          Hikâyeleri cilt ve bölümler halinde takip edebilir, kitaplığında
          biriktirebilir ve düşüncelerini diğer okurlarla paylaşabilirsin. Kendi
          hikâyeni yazmak istersen yazar stüdyosu seni bekliyor.
        </p>
        <h3>Yayın ve premium</h3>
        <p>
          Kitaplar yayın başvurusu onaylandıktan sonra okuyucularla buluşur.
          Premium kitaplarda yalnızca premium onayından sonra ilk kez yayımlanan
          bölümler ücretli yapılabilir. Önceden yayımlanan ücretsiz bölümler
          ücretsiz kalır.
        </p>
        <h3>Şu an erken erişimdeyiz</h3>
        <p>
          Bu ilk sürümde okuma, yazarlık ve başvuru akışları kullanılabilir.
          Gerçek tahsilat henüz açık değildir. İlk kurulumda gösterilen
          hikâyeler, yazarlar ve değerlendirmeler örnek içeriklerdir.
        </p>
      </div>
    </div>
  );
}
