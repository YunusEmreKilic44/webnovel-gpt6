// Shared by the report dialog (client) and the report service (server).

export const reportTargetTypes = [
  "BOOK",
  "CHAPTER",
  "COMMENT",
  "USER",
] as const;
export type ReportTargetType = (typeof reportTargetTypes)[number];

export const reportReasons = {
  SPAM: "Spam veya reklam",
  HARASSMENT: "Taciz, zorbalık veya tehdit",
  HATE: "Nefret söylemi veya ayrımcılık",
  SEXUAL: "Uygunsuz cinsel içerik",
  VIOLENCE: "Şiddet veya kendine zarar vermeyi özendirme",
  COPYRIGHT: "Telif ihlali veya intihal",
  MISLEADING: "Yanıltıcı tür, etiket veya açıklama",
  SPOILER: "İşaretlenmemiş spoiler",
  IMPERSONATION: "Başka birini taklit ediyor",
  INAPPROPRIATE_PROFILE: "Uygunsuz ad veya profil resmi",
  OTHER: "Diğer",
} as const;
export type ReportReason = keyof typeof reportReasons;

const common: ReportReason[] = [
  "SPAM",
  "HARASSMENT",
  "HATE",
  "SEXUAL",
  "VIOLENCE",
];
/** Reasons offered for each target, in display order; OTHER is always last. */
export const reasonsByTarget: Record<ReportTargetType, ReportReason[]> = {
  BOOK: [...common, "COPYRIGHT", "MISLEADING", "OTHER"],
  CHAPTER: [...common, "COPYRIGHT", "OTHER"],
  COMMENT: [...common, "SPOILER", "OTHER"],
  USER: ["IMPERSONATION", "INAPPROPRIATE_PROFILE", ...common, "OTHER"],
};

export const reportTargetLabels: Record<ReportTargetType, string> = {
  BOOK: "Kitap",
  CHAPTER: "Bölüm",
  COMMENT: "Yorum",
  USER: "Kullanıcı",
};

export const REPORT_DETAILS_MAX = 1000;
/** "Other" needs an explanation; for the rest the text is optional. */
export const REPORT_OTHER_MIN = 10;

export const reportStatusLabels: Record<string, string> = {
  OPEN: "Açık",
  RESOLVED: "Çözüldü",
  DISMISSED: "Reddedildi",
};
export const reportActionLabels: Record<string, string> = {
  NONE: "İçeriğe dokunulmadı",
  HIDE: "İçerik gizlendi",
  BAN: "Kullanıcı banlandı",
};
