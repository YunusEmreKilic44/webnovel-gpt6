import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { isEmailConfigured, sendEmail } from "@/lib/email";

const env = { ...process.env };
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("E-posta gönderimi", () => {
  it("ayar yoksa göndermez ve eksik değişkenleri loglar", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM = "Satır <no-reply@example.test>";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(isEmailConfigured()).toBe(false);
    await expect(
      sendEmail("a@example.test", "Konu", "https://satir.test/x"),
    ).rejects.toThrow("yapılandırılmadı");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("email.not_configured", {
      missing: ["RESEND_API_KEY"],
    });
  });

  it("Resend'e metin ve HTML gövdeyle gönderir; bağlantıyı kaçışlar", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Satır <no-reply@example.test>";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail("a@example.test", "Konu", "https://satir.test/v?a=1&b=2");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: "Satır <no-reply@example.test>",
      to: "a@example.test",
      subject: "Konu",
    });
    expect(body.text).toContain("https://satir.test/v?a=1&b=2");
    expect(body.html).toContain("https://satir.test/v?a=1&amp;b=2");
  });

  it("Resend reddederse sebebini loglar ve hata verir", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Satır <no-reply@example.test>";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"message":"The example.test domain is not verified."}', {
          status: 403,
        }),
      ),
    );
    await expect(
      sendEmail("a@example.test", "Konu", "https://satir.test/x"),
    ).rejects.toThrow("gönderilemedi");
    expect(console.error).toHaveBeenCalledWith("email.send_failed", {
      status: 403,
      detail: '{"message":"The example.test domain is not verified."}',
    });
  });
});
