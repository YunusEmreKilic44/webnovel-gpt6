import { ActionForm, SubmitButton } from "./action-form";
import { SlideImageField } from "./slide-image-field";
import { AnnouncementEditorForm } from "./announcement-editor";
import { readAnnouncementBlocks } from "@/modules/site-content/announcement-content";
import {
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
function CommonFields({
  item,
  defaultPosition = 0,
  publishLabel = "Ana sayfada yayımla",
}: {
  item?: Common;
  defaultPosition?: number;
  publishLabel?: string;
}) {
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
            defaultValue={item?.position ?? defaultPosition}
          />
        </label>
        <label className="check-field">
          <input
            name="published"
            type="checkbox"
            defaultChecked={item?.published ?? false}
          />
          {publishLabel}
        </label>
      </div>
    </>
  );
}
export function AnnouncementForm({
  item,
}: {
  item?: Common & { body: string; content: unknown };
}) {
  return (
    <AnnouncementEditorForm
      blocks={readAnnouncementBlocks(item?.content, item?.body ?? "")}
      editing={Boolean(item)}
    >
      <CommonFields item={item} publishLabel="Duyuruyu yayımla" />
    </AnnouncementEditorForm>
  );
}
export function SlideForm({
  item,
  defaultPosition,
}: {
  defaultPosition?: number;
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
      <CommonFields item={item} defaultPosition={defaultPosition} />
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
      <summary className="text-link">
        {kind === "slide" ? "Sayfayı sil" : "Kaydı sil"}
      </summary>
      <p>
        Bu kayıt kalıcı olarak silinecek. Yalnızca gizlemek için yayımlama
        işaretini kaldırıp kaydet.
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
