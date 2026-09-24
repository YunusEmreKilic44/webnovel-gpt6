import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { DomainError } from "@/modules/publishing/policies";

// iyzico Checkout Form (hosted payment page). Card data never reaches this
// server: we create a form, send the buyer to iyzico's page, and iyzico posts
// a token back to our callback. The result is then fetched server-to-server
// with our credentials, so the browser's callback is never trusted by itself.
// Docs: https://docs.iyzico.com/odeme-metotlari/odeme-formu

function config() {
  const apiKey = process.env.IYZICO_API_KEY;
  const secretKey = process.env.IYZICO_SECRET_KEY;
  const baseUrl = (
    process.env.IYZICO_BASE_URL || "https://sandbox-api.iyzipay.com"
  ).replace(/\/+$/, "");
  if (!apiKey || !secretKey)
    throw new DomainError(
      "PAYMENT_NOT_CONFIGURED",
      "Ödeme sistemi şu an kullanılamıyor. Lütfen daha sonra tekrar dene.",
    );
  return { apiKey, secretKey, baseUrl };
}

export function isIyzicoConfigured() {
  return Boolean(process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY);
}

/** IYZWSv2: HMAC-SHA256(secret, randomKey + uriPath + body), base64-wrapped. */
export function iyzicoAuthorization(
  apiKey: string,
  secretKey: string,
  uriPath: string,
  body: string,
  randomKey: string,
) {
  const signature = createHmac("sha256", secretKey)
    .update(randomKey + uriPath + body)
    .digest("hex");
  const token = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return `IYZWSv2 ${Buffer.from(token).toString("base64")}`;
}

async function call<T>(uriPath: string, payload: object): Promise<T> {
  const { apiKey, secretKey, baseUrl } = config();
  const body = JSON.stringify(payload);
  const randomKey = `${Date.now()}${randomBytes(8).toString("hex")}`;
  const response = await fetch(baseUrl + uriPath, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: iyzicoAuthorization(
        apiKey,
        secretKey,
        uriPath,
        body,
        randomKey,
      ),
      "x-iyzi-rnd": randomKey,
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`iyzico HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** 2499 → "24.99" (iyzico expects decimal strings). */
export const iyzicoPrice = (minor: number) => (minor / 100).toFixed(2);

type IyzicoResult = {
  status: "success" | "failure";
  errorCode?: string;
  errorMessage?: string;
};

export async function initializeCheckout(input: {
  orderId: string;
  priceMinor: number;
  itemId: string;
  itemName: string;
  callbackUrl: string;
  buyer: { id: string; name: string; email: string; ip: string };
}) {
  const price = iyzicoPrice(input.priceMinor);
  const [name, ...rest] = input.buyer.name.trim().split(/\s+/);
  // Digital goods: iyzico still requires identity/address fields, so neutral
  // placeholders are sent. Nothing here is shown to or stored for the buyer.
  const address = "Dijital içerik - adres gerekmez";
  const result = await call<
    IyzicoResult & { token?: string; paymentPageUrl?: string }
  >("/payment/iyzipos/checkoutform/initialize/auth/ecom", {
    locale: "tr",
    conversationId: input.orderId,
    price,
    paidPrice: price,
    currency: "TRY",
    basketId: input.orderId,
    paymentGroup: "PRODUCT",
    callbackUrl: input.callbackUrl,
    enabledInstallments: [1],
    buyer: {
      id: input.buyer.id,
      name: name || "Satır",
      surname: rest.join(" ") || "Okuru",
      email: input.buyer.email,
      identityNumber: "11111111111",
      registrationAddress: address,
      ip: input.buyer.ip,
      city: "Istanbul",
      country: "Turkey",
    },
    billingAddress: {
      contactName: input.buyer.name.trim() || "Satır Okuru",
      city: "Istanbul",
      country: "Turkey",
      address,
    },
    basketItems: [
      {
        id: input.itemId,
        name: input.itemName,
        category1: "Dijital içerik",
        itemType: "VIRTUAL",
        price,
      },
    ],
  });
  if (result.status !== "success" || !result.token || !result.paymentPageUrl)
    throw new Error(
      `iyzico initialize failed: ${result.errorCode ?? ""} ${result.errorMessage ?? ""}`,
    );
  return { token: result.token, paymentPageUrl: result.paymentPageUrl };
}

export type CheckoutResult = IyzicoResult & {
  paymentStatus?: string;
  paymentId?: string;
  basketId?: string;
  conversationId?: string;
  currency?: string;
  price?: number;
  paidPrice?: number;
  fraudStatus?: number;
  token?: string;
};

export async function retrieveCheckout(token: string, conversationId: string) {
  return call<CheckoutResult>(
    "/payment/iyzipos/checkoutform/auth/ecom/detail",
    {
      locale: "tr",
      conversationId,
      token,
    },
  );
}
