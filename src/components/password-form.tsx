"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useHydrated } from "@/lib/use-hydrated";

export function PasswordForm() {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const newPassword = String(form.get("newPassword"));
    setSuccess(false);
    if (newPassword !== form.get("confirmPassword")) {
      setMessage("Yeni şifreler eşleşmiyor.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const result = await authClient.changePassword({
        currentPassword: String(form.get("currentPassword")),
        newPassword,
        revokeOtherSessions: form.get("revokeOtherSessions") === "on",
      });
      if (result.error) {
        setMessage(
          result.error.code === "INVALID_PASSWORD"
            ? "Mevcut şifren hatalı."
            : result.error.status === 401
              ? "Oturumunu yenilemek için tekrar giriş yap."
              : "Şifre değiştirilemedi. Bilgilerini kontrol edip tekrar dene.",
        );
      } else {
        element.reset();
        setSuccess(true);
        setMessage("Şifren güncellendi.");
      }
    } catch {
      setMessage("Bağlantı kurulamadı. Tekrar dene.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <label className="field">
        Mevcut şifren
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </label>
      <div className="settings-fields">
        <label className="field">
          <span id="new-password-label">Yeni şifren</span>
          <input
            name="newPassword"
            aria-labelledby="new-password-label"
            aria-describedby="new-password-help"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
          />
          <small id="new-password-help">En az 10 karakter kullan.</small>
        </label>
        <label className="field">
          Yeni şifreni tekrar yaz
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
          />
        </label>
      </div>
      <label className="check-field">
        <input name="revokeOtherSessions" type="checkbox" defaultChecked />
        Diğer cihazlardaki oturumlarımı kapat
      </label>
      <div>
        <button
          type="submit"
          className="button button-outline"
          disabled={!hydrated || pending}
        >
          {pending ? "Güncelleniyor…" : "Şifreyi güncelle"}
        </button>
      </div>
      {message && (
        <p
          role="status"
          className={`form-message ${success ? "success" : "error"}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
