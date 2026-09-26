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
  emailUnavailable = false,
}: {
  mode: "login" | "register" | "forgot" | "reset";
  token?: string;
  localPreview?: boolean;
  /** No email service configured: verification and reset mails cannot go out. */
  emailUnavailable?: boolean;
}) {
  const hydrated = useHydrated();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  // Set when sign-in fails because the address is not verified yet.
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "failed">(
    "idle",
  );
  const blocked =
    emailUnavailable && (mode === "register" || mode === "forgot");
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
    setUnverifiedEmail("");
    setResend("idle");
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
          NAME_TAKEN: "Bu kullanıcı adı zaten kullanılıyor.",
          INVALID_NAME: "Görünen adın 2–60 karakter olmalı.",
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
          EMAIL_SERVICE_UNAVAILABLE:
            "Kayıt şu an kapalı: doğrulama e-postası gönderilemiyor.",
          INVALID_TOKEN:
            "Bu bağlantı geçersiz veya süresi dolmuş. Yeni bir bağlantı iste.",
        };
        setMessage(
          messages[result.error.code || ""] ||
            "İşlem tamamlanamadı. Bilgilerini kontrol edip tekrar dene.",
        );
        if (result.error.code === "EMAIL_NOT_VERIFIED")
          setUnverifiedEmail(email);
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
  async function resendVerification() {
    setResend("sending");
    try {
      const result = await authClient.sendVerificationEmail({
        email: unverifiedEmail,
        callbackURL: "/",
      });
      setResend(result.error ? "failed" : "sent");
    } catch {
      setResend("failed");
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
        {blocked && (
          <p className="notice auth-unavailable" role="status">
            {mode === "register"
              ? "Kayıt şu an kapalı: doğrulama e-postası gönderilemiyor. Lütfen daha sonra tekrar dene."
              : "Şifre yenileme e-postası şu an gönderilemiyor. Lütfen daha sonra tekrar dene."}
          </p>
        )}
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
            disabled={
              !hydrated || pending || blocked || (mode === "reset" && !token)
            }
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
          {unverifiedEmail && !emailUnavailable && (
            <div className="auth-resend">
              {resend === "sent" ? (
                <p className="form-message success" role="status">
                  Doğrulama bağlantısı yeniden gönderildi. Gelen kutunu ve
                  istenmeyen klasörünü kontrol et.
                </p>
              ) : (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={resendVerification}
                  disabled={resend === "sending"}
                >
                  {resend === "sending" && (
                    <LoaderCircle size={15} className="spin" />
                  )}
                  Doğrulama e-postasını yeniden gönder
                </button>
              )}
              {resend === "failed" && (
                <p className="form-message error" role="alert">
                  E-posta gönderilemedi. Birkaç dakika sonra tekrar dene.
                </p>
              )}
            </div>
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
