// Preset cover artwork in /public/art, used when a book has no uploaded cover.
export const coverPresets = [
  "ember",
  "ocean",
  "forest",
  "violet",
  "sand",
  "rose",
] as const;
export type CoverPreset = (typeof coverPresets)[number];

export const coverPresetOptions: { value: CoverPreset; label: string }[] = [
  { value: "ember", label: "Kızıl kılıç" },
  { value: "ocean", label: "Gökyüzü yolcusu" },
  { value: "forest", label: "Orman muhafızı" },
  { value: "violet", label: "Neon şehir" },
  { value: "sand", label: "Çöl gezgini" },
  { value: "rose", label: "Bahar hikâyesi" },
];
