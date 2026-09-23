import { ActionForm, SubmitButton } from "./action-form";
import { SlideImageField } from "./slide-image-field";
import {
  saveAnnouncementAction,
  saveSlideAction,
  deleteContentAction,
} from "@/modules/site-content/actions";
import { imagePresets } from "@/modules/site-content/service";

const presetLabels: Record<(typeof imagePresets)[number], string> = {
  hero: "Ana görsel",
  ember: "Köz",
  forest: "Orman",
  ocean: "Okyanus",
  rose: "Gül",
  sand: "Kum",
  violet: "Mor",
};

type Common = {
  id: string;
  title: string;
  linkPath: string;
  linkLabel: string;
  published: boolean;
  position: number;
};
function CommonFields({ item }: { item?: Common }) {
  return (
    <>
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <label className="field">
        Başlık
        <input
          name="title"
          required
          minLength={2}
          maxLength={120}
          defaultValue={item?.title}
        />
      </label>
      <div className="content-form-grid">
        <label className="field">
          Bağlantı (isteğe bağlı)
          <input
            name="linkPath"
            maxLength={500}
            placeholder="/kitap/kitabin-adi"
            defaultValue={item?.linkPath}
          />
        </label>
        <label className="field">
          Bağlantı düğmesinin yazısı
          <input
            name="linkLabel"
            maxLength={50}
            placeholder="İncele"
            defaultValue={item?.linkLabel}
          />
        </label>
      </div>
      <div className="content-form-grid">
        <label className="field">
          Sıra (küçük numara önce gösterilir)
          <input
            name="position"
            type="number"
            required
            min={0}
            max={9999}
            defaultValue={item?.position ?? 0}
          />
        </label>
        <label className="check-field">
          <input
            name="published"
            type="checkbox"
            defaultChecked={item?.published ?? false}
          />
          Ana sayfada yayımla
        </label>
      </div>
    </>
  );
}
export function AnnouncementForm({
  item,
}: {
  item?: Common & { body: string };
}) {
  return (
    <ActionForm action={saveAnnouncementAction} className="form-stack">
      <CommonFields item={item} />
      <label className="field">
        Duyuru metni
        <textarea
          name="body"
          required
          minLength={3}
          maxLength={2000}
          defaultValue={item?.body}
        />
      </label>
      <SubmitButton>{item ? "Duyuruyu kaydet" : "Duyuru ekle"}</SubmitButton>
    </ActionForm>
  );
}
export function SlideForm({
  item,
}: {
  item?: Common & {
    description: string;
    imageAlt: string;
    imagePreset: string;
    hasImage: boolean;
    currentImageUrl: string;
  };
}) {
  return (
    <ActionForm action={saveSlideAction} className="form-stack">
      <CommonFields item={item} />
      <label className="field">
        Açıklama
        <textarea
          name="description"
          maxLength={500}
          defaultValue={item?.description}
        />
      </label>
      <SlideImageField
        fieldId={`slide-image-${item?.id ?? "new"}`}
        currentImageUrl={item?.hasImage ? item.currentImageUrl : undefined}
        initialPreset={item?.imagePreset ?? "hero"}
        presets={imagePresets.map((value) => ({
          value,
          label: presetLabels[value],
        }))}
        imageAlt={item?.imageAlt}
      />
      <label className="field">
        Görsel açıklaması (erişilebilirlik)
        <input
          name="imageAlt"
          maxLength={200}
          defaultValue={item?.imageAlt}
          placeholder="Görseli kısaca tanımla"
        />
      </label>
      <SubmitButton>{item ? "Slaytı kaydet" : "Slayt ekle"}</SubmitButton>
    </ActionForm>
  );
}
export function DeleteContentForm({
  id,
  kind,
}: {
  id: string;
  kind: "announcement" | "slide";
}) {
  return (
    <details className="content-delete">
      <summary className="text-link">Kaydı sil</summary>
      <p>
        Bu kayıt kalıcı olarak silinecek. Yalnızca gizlemek için “Ana sayfada
        yayımla” işaretini kaldırıp kaydet.
      </p>
      <ActionForm action={deleteContentAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="kind" value={kind} />
        <SubmitButton className="button-outline">
          Kalıcı olarak sil
        </SubmitButton>
      </ActionForm>
    </details>
  );
}
