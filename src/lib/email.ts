import "server-only";

// Transactional email through Resend (https://resend.com/docs/api-reference).
// Without a verified sending domain Resend only delivers from
// onboarding@resend.dev to the Resend account's own address.

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export async function sendEmail(to: string, subject: string, url: string) {
  if (!isEmailConfigured()) {
    // Better Auth swallows this error, so make it visible in the server log.
    console.error("email.not_configured", {
      missing: [
        !process.env.RESEND_API_KEY && "RESEND_API_KEY",
        !process.env.EMAIL_FROM && "EMAIL_FROM",
      ].filter(Boolean),
    });
    throw new Error("E-posta servisi henüz yapılandırılmadı.");
  }
  const footer = "Bu işlemi sen başlatmadıysan bu e-postayı yok sayabilirsin.";
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text: `${subject}\n\n${url}\n\n${footer}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222">
<p><strong>${escape(subject)}</strong></p>
<p><a href="${escape(url)}" style="display:inline-block;padding:12px 20px;background:#ea4056;color:#fff;text-decoration:none;border-radius:6px">Devam et</a></p>
<p style="font-size:13px;color:#555">Düğme çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br>${escape(url)}</p>
<p style="font-size:12px;color:#888">${footer}</p></div>`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!result.ok) {
    // Resend explains the refusal (unverified domain, sandbox recipient, …).
    const detail = await result.text().catch(() => "");
    console.error("email.send_failed", {
      status: result.status,
      detail: detail.slice(0, 500),
    });
    throw new Error("E-posta gönderilemedi.");
  }
}
