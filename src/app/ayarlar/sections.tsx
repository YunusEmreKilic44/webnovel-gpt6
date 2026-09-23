import { cookies } from "next/headers";
import { requireUser } from "@/lib/session";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PasswordForm } from "@/components/password-form";
import {
  updateAvatarAction,
  updateProfile,
  updateReadingPreferences,
} from "@/modules/account/actions";
import { AvatarField } from "@/components/avatar-field";
import { BookOpen, LockKeyhole, UserRound } from "@/components/icons";

export async function ProfileSettings() {
  const user = await requireUser();
  return (
    <section
      className="settings-section"
      aria-labelledby="profile-settings-title"
    >
      <div className="settings-section-heading">
        <UserRound size={21} />
        <h2 id="profile-settings-title">Profil bilgileri</h2>
        <p>Hikâyelerinde ve yorumlarında görünen adın ve profil resmin.</p>
      </div>
      <div className="stack">
        <ActionForm action={updateAvatarAction} className="form-stack">
          <AvatarField name={user.name} currentUrl={user.avatarUrl} />
        </ActionForm>
        <ProfileNameForm user={user} />
      </div>
    </section>
  );
}

function ProfileNameForm({
  user,
}: {
  user: Awaited<ReturnType<typeof requireUser>>;
}) {
  return (
    <>
      <ActionForm action={updateProfile} className="form-stack">
        <label className="field">
          Görünen adın
          <input
            name="name"
            defaultValue={user.name}
            required
            minLength={2}
            maxLength={60}
            autoComplete="name"
          />
        </label>
        <label className="field">
          E-posta adresin
          <input type="email" value={user.email} readOnly />
          <small>
            {user.emailVerified
              ? "E-posta adresin doğrulanmış."
              : "E-postandaki doğrulama bağlantısıyla adresini doğrula."}
          </small>
        </label>
        <div>
          <SubmitButton>Profili kaydet</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}

export async function ReadingSettings() {
  const [, store] = await Promise.all([requireUser(), cookies()]);
  const storedTheme = store.get("reader-theme")?.value;
  const theme =
    storedTheme === "paper" || storedTheme === "sepia" ? storedTheme : "dark";
  const storedFont = Number(store.get("reader-font")?.value || 20);
  const font = Number.isFinite(storedFont)
    ? Math.max(16, Math.min(28, Math.round(storedFont)))
    : 20;
  return (
    <section
      className="settings-section"
      aria-labelledby="reader-settings-title"
    >
      <div className="settings-section-heading">
        <BookOpen size={21} />
        <h2 id="reader-settings-title">Okuma tercihleri</h2>
        <p>Bu tarayıcıda bölüm okurken kullanılacak görünüm.</p>
      </div>
      <ActionForm action={updateReadingPreferences} className="form-stack">
        <fieldset className="theme-options">
          <legend>Sayfa görünümü</legend>
          {[
            { value: "dark", label: "Koyu" },
            { value: "paper", label: "Açık" },
            { value: "sepia", label: "Sepya" },
          ].map((option) => (
            <label className="theme-choice" key={option.value}>
              <input
                type="radio"
                name="theme"
                value={option.value}
                defaultChecked={theme === option.value}
              />
              <span
                className={`theme-swatch theme-swatch-${option.value}`}
                aria-hidden="true"
              >
                Aa
              </span>
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
        <label className="field">
          <span id="reader-font-label">Yazı boyutu</span>
          <select
            name="font"
            defaultValue={font}
            aria-labelledby="reader-font-label"
          >
            {Array.from({ length: 13 }, (_, i) => 16 + i).map((size) => (
              <option key={size} value={size}>
                {size} px
              </option>
            ))}
          </select>
        </label>
        <div>
          <SubmitButton>Tercihleri kaydet</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}

export async function SecuritySettings() {
  await requireUser();
  return (
    <section
      className="settings-section"
      aria-labelledby="security-settings-title"
    >
      <div className="settings-section-heading">
        <LockKeyhole size={21} />
        <h2 id="security-settings-title">Şifre ve güvenlik</h2>
        <p>Hesabına yalnız senin erişebilmen için güçlü bir şifre kullan.</p>
      </div>
      <PasswordForm />
    </section>
  );
}
