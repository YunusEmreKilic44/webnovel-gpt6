export function isLocalPreview() {
  const hostname = new URL(
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
  ).hostname;
  const testDatabase = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).pathname.endsWith("_e2e")
    : false;
  return (
    ["localhost", "127.0.0.1"].includes(hostname) &&
    (process.env.NODE_ENV === "development" ||
      (process.env.E2E_TEST === "true" && testDatabase))
  );
}
