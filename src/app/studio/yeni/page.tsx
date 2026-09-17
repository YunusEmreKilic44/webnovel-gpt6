import Link from "next/link";
import { requireUser } from "@/lib/session";
import { createBookAction } from "@/modules/publishing/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ArrowLeft, ArrowRight } from "@/components/icons";
import { genres } from "@/lib/utils";
export default async function NewBook() {
  await requireUser();
  return (
    <div style={{ maxWidth: 770 }}>
      <Link href="/studio" className="breadcrumbs">
        <ArrowLeft size={13} />
        Yazar stüdyosuna dön
      </Link>
      <div className="studio-heading">
        <div>
          <h1>Bir dünya kur.</h1>
          <p>İlk adım, hikâyene bir isim vermek.</p>
        </div>
      </div>
      <div className="panel">
        <ActionForm action={createBookAction} className="form-stack">
          <label className="field">
            Kitabın adı
            <input
              name="title"
              placeholder="Yeni dünyanı nasıl çağıralım?"
              minLength={3}
              maxLength={100}
              required
            />
          </label>
          <label className="field">
            Arka kapak yazısı
            <textarea
              name="description"
              placeholder="Okuyucuyu hikâyene davet et. Karakterlerini, dünyanı ve onları bekleyen macerayı anlat…"
              minLength={30}
              maxLength={3000}
              required
              rows={5}
            />
            <small>En az 30 karakter. Spoiler vermeden merak uyandır.</small>
          </label>
          <label className="field">
            Tür
            <select name="genre" defaultValue="Fantastik">
              {genres.slice(1).map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <fieldset style={{ border: 0, padding: 0 }}>
            <legend className="field" style={{ marginBottom: 14 }}>
              Kapak illüstrasyonu
            </legend>
            <div className="cover-picker">
              {["ember", "ocean", "forest", "violet", "sand", "rose"].map(
                (color, i) => (
                  <label className={`cover-choice cover-${color}`} key={color}>
                    <input
                      type="radio"
                      name="cover"
                      value={color}
                      defaultChecked={i === 0}
                      aria-label={
                        [
                          "Kızıl kılıç",
                          "Gökyüzü yolcusu",
                          "Orman muhafızı",
                          "Neon şehir",
                          "Çöl gezgini",
                          "Bahar hikâyesi",
                        ][i]
                      }
                    />
                    <span />
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <div className="notice" style={{ marginTop: 10 }}>
            Kitabın taslak olarak oluşturulur. Okuyuculara açılması için ilk
            bölümünü hazırlayıp yayın başvurusu göndermelisin.
          </div>
          <div>
            <SubmitButton>
              Kitabımı oluştur <ArrowRight size={15} />
            </SubmitButton>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
