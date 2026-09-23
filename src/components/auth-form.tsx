"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ArrowRight, BookOpen, LoaderCircle } from "./icons";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";

export function AuthForm({
  mode,
  token,
  localPreview,
}: {
  mode: "login" | "register" | "forgot" | "reset";
  token?: string;
  localPreview?: boolean;
}) {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const titles = {
    login: "Hikâyene kaldığın yerden.",
    register: "Yeni bir sayfa aç.",
    forgot: "Yeniden başlayalım.",
    reset: "Yeni bir şifre belirle.",
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setSuccess(false);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    try {
      const result =
        mode === "register"
          ? await authClient.signUp.email({
              email,
              password,
              name: String(form.get("name")),
              callbackURL: "/",
            })
          : mode === "login"
            ? await authClient.signIn.email({
                email,
                password,
                callbackURL: "/",
              })
            : mode === "forgot"
              ? await authClient.requestPasswordReset({
                  email,
                  redirectTo: "/sifre-yenile",
                })
              : await authClient.resetPassword({
                  token: token || "",
                  newPassword: password,
                });
      if (result.error) {
        const messages: Record<string, string> = {
          BANNED_USER:
            "Hesabın banlandı. Ban kaldırılana kadar giriş yapamazsın.",
          INVALID_EMAIL_OR_PASSWORD: "E-posta veya şifre hatalı.",
          USER_ALREADY_EXISTS: "Bu e-posta adresiyle bir hesap zaten var.",
          USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
            "Bu e-posta adresiyle bir hesap zaten var.",
          EMAIL_NOT_VERIFIED:
            "Giriş yapmadan önce e-postandaki doğrulama bağlantısını aç.",
          TOO_MANY_REQUESTS:
            "Çok fazla deneme yaptın. Bir dakika sonra tekrar dene.",
          PASSWORD_TOO_SHORT: "Şifren en az 10 karakter olmalı.",
          INVALID_TOKEN:
            "Bu bağlantı geçersiz veya süresi dolmuş. Yeni bir bağlantı iste.",
        };
        setMessage(
          messages[result.error.code || ""] ||
            "İşlem tamamlanamadı. Bilgilerini kontrol edip tekrar dene.",
        );
      } else if (mode === "forgot") {
        setSuccess(true);
        setMessage(
          "Bu adresle bir hesap varsa şifre yenileme bağlantısı gönderildi.",
        );
      } else if (mode === "reset") {
        setSuccess(true);
        setMessage("Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.");
      } else if (mode === "register" && !localPreview) {
        setSuccess(true);
        setMessage(
          "Hesabın oluşturuldu. E-postana gönderilen bağlantıyla adresini doğrula.",
        );
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setMessage("Bağlantı kurulamadı. Biraz sonra tekrar dene.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-wrap">
      <div className="auth-heading">
        <span className="brand-mark">
          <BookOpen size={30} />
        </span>
        <h1>{titles[mode]}</h1>
        <p>
          {mode === "register"
            ? "Oku, keşfet, yaz. Kendi dünyanı bul."
            : mode === "login"
              ? "Kütüphanen, sevdiğin hikâyeler ve yeni dünyalar seni bekliyor."
              : "Hikâyelerinden uzak kalma."}
        </p>
      </div>
      <div className="panel auth-panel">
        <form onSubmit={submit} className="form-stack">
          {mode === "register" && (
            <label className="field">
              Görünen adın
              <input
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={60}
                required
                placeholder="Seni nasıl tanıyalım?"
              />
            </label>
          )}
          {mode !== "reset" && (
            <label className="field">
              E-posta adresin
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="sen@ornek.com"
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label className="field">
              Şifren
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={10}
                maxLength={128}
                required
                placeholder={
                  mode === "login" ? "Şifreni gir" : "En az 10 karakter"
                }
              />
            </label>
          )}
          {mode === "login" && (
            <Link href="/sifremi-unuttum" className="text-link">
              Şifremi unuttum
            </Link>
          )}
          <button
            className="button button-dark"
            disabled={!hydrated || pending || (mode === "reset" && !token)}
          >
            {pending ? <LoaderCircle size={16} className="spin" /> : null}
            {pending
              ? "Biraz bekle…"
              : {
                  login: "Giriş yap",
                  register: "Hesap oluştur",
                  forgot: "Yenileme bağlantısı gönder",
                  reset: "Şifreyi güncelle",
                }[mode]}
            {!pending && <ArrowRight size={16} />}
          </button>
          {message && (
            <p
              role="status"
              className={cn("form-message", success ? "success" : "error")}
            >
              {message}
            </p>
          )}
        </form>
        <p className="auth-switch">
          {mode === "login" ? (
            <>
              Henüz hesabın yok mu? <Link href="/kayit">Aramıza katıl</Link>
            </>
          ) : (
            <>
              Zaten bir hesabın var mı? <Link href="/giris">Giriş yap</Link>
            </>
          )}
        </p>
      </div>
      {localPreview && (
        <p className="auth-note">
          Yerel geliştirme ortamında e-posta doğrulaması atlanır.
          <br />
          Gerçek ödeme alınmaz.
        </p>
      )}
    </div>
  );
}
