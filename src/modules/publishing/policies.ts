import type { Actor, Book, Chapter } from "@/db/schema";

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
export function requireVerified(actor: Actor) {
  if (!actor.emailVerified)
    throw new DomainError(
      "EMAIL_UNVERIFIED",
      "Önce e-posta adresini doğrulamalısın.",
    );
}
export function requireOwner(actor: Actor, book: Pick<Book, "authorId">) {
  if (actor.id !== book.authorId)
    throw new DomainError("FORBIDDEN", "Bu kitabı düzenleme yetkin yok.");
}
export function requireReviewer(actor: Actor) {
  requireVerified(actor);
  if (actor.role !== "admin")
    throw new DomainError(
      "FORBIDDEN",
      "Bu başvuruyu değerlendirme yetkin yok.",
    );
}
export function requirePaidEligibility(
  book: Pick<
    Book,
    "status" | "hidden" | "premiumStatus" | "firstPremiumApprovedAt"
  >,
  chapter: Pick<Chapter, "status" | "hidden" | "firstPublishedAt">,
) {
  if (
    book.status !== "PUBLISHED" ||
    book.hidden ||
    chapter.status !== "PUBLISHED" ||
    chapter.hidden
  )
    throw new DomainError(
      "NOT_PUBLISHED",
      "Yalnızca yayındaki bölümler ücretli olabilir.",
    );
  if (book.premiumStatus !== "ACTIVE")
    throw new DomainError(
      "PREMIUM_NOT_ACTIVE",
      "Kitabın aktif premium onayı bulunmuyor.",
    );
  if (
    !book.firstPremiumApprovedAt ||
    !chapter.firstPublishedAt ||
    chapter.firstPublishedAt.getTime() <= book.firstPremiumApprovedAt.getTime()
  )
    throw new DomainError(
      "CHAPTER_PREDATES_PREMIUM",
      "Premium onayından önce yayımlanan bölümler daima ücretsiz kalır.",
    );
}
export function canReadPublic(
  book: Pick<Book, "status" | "hidden">,
  chapter: Pick<Chapter, "status" | "hidden" | "accessType">,
) {
  return (
    book.status === "PUBLISHED" &&
    !book.hidden &&
    chapter.status === "PUBLISHED" &&
    !chapter.hidden &&
    chapter.accessType === "FREE"
  );
}
