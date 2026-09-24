import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/session";
import { GenreField } from "@/components/genre-field";
import { TagField } from "@/components/tag-field";
import { bookTagSelection, tagNames } from "@/modules/catalog/tags";
import { coverPresetOptions } from "@/lib/covers";
import { updateBookDetailsAction } from "@/modules/publishing/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CoverField } from "@/components/cover-field";
import { PageSkeleton } from "@/components/loading-skeletons";
import { ArrowLeft } from "@/components/icons";

export const metadata = { title: "Kitabı düzenle" };

type Props = { params: Promise<{ bookId: string }> };

export default function Page(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditBook {...props} />
    </Suspense>
  );
}

async function EditBook({ params }: Props) {
  const { bookId } = await params;
  const actor = await requireUser();
  const book = await getDb().book.findFirst({
    where: { id: bookId, authorId: actor.id },
    select: {
      id: true,
      title: true,
      subtitle: true,
      description: true,
      genres: true,
      tags: bookTagSelection,
      storyStatus: true,
      status: true,
      cover: true,
      coverUrl: true,
    },
  });
  if (!book) notFound();
  return (
    <div className="book-edit-page">
      <Link href={`/studio/books/${book.id}`} className="breadcrumbs">
        <ArrowLeft size={13} />
        {book.title}
      </Link>
      <div className="studio-heading">
        <div>
          <h1>Kitabı düzenle</h1>
          <p>
            Adı, açıklaması, kategorileri, etiketleri ve kapağı
            değiştirebilirsin. Kitabın bağlantı adresi aynı kalır.
          </p>
        </div>
      </div>
      <div className="panel">
        <ActionForm action={updateBookDetailsAction} className="form-stack">
          <input type="hidden" name="bookId" value={book.id} />
          <label className="field">
            Kitabın adı
            <input
              name="title"
              defaultValue={book.title}
              minLength={3}
              maxLength={100}
              required
            />
          </label>
          <label className="field">
            Alt başlık (isteğe bağlı)
            <input
              name="subtitle"
              defaultValue={book.subtitle}
              maxLength={120}
              placeholder="Serinin ya da cildin adı"
            />
          </label>
          <label className="field">
            Arka kapak yazısı
            <textarea
              name="description"
              defaultValue={book.description}
              minLength={30}
              maxLength={3000}
              required
              rows={6}
            />
            <small>En az 30 karakter.</small>
          </label>
          <GenreField key={book.genres.join("|")} defaultValue={book.genres} />
          <TagField
            key={tagNames(book.tags).join("|")}
            defaultValue={tagNames(book.tags)}
          />
          <div className="form-grid">
            <label className="field">
              Hikâye durumu
              <select name="storyStatus" defaultValue={book.storyStatus}>
                <option value="ONGOING">Devam ediyor</option>
                <option value="COMPLETED">Tamamlandı</option>
                <option value="HIATUS">Arada</option>
              </select>
            </label>
          </div>
          <div className="field">
            Kapak
            <CoverField
              fieldId={`cover-${book.id}`}
              presets={coverPresetOptions}
              initialPreset={book.cover}
              currentImageUrl={book.coverUrl}
              title={book.title}
              author={actor.name}
            />
          </div>
          {book.status === "PUBLISHED" && (
            <p className="notice">
              Kitabın yayında; kaydettiğin değişiklikler okurlara hemen yansır.
            </p>
          )}
          <div className="button-row">
            <SubmitButton>Değişiklikleri kaydet</SubmitButton>
            <Link
              href={`/studio/books/${book.id}`}
              className="button button-outline"
            >
              Vazgeç
            </Link>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
