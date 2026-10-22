// Read-only live checks, plus login/logout and a rejected registration request.
// Credentials and screenshots remain in ignored private deployment storage.
const {
  chromium,
  expect,
} = require("../frontend/node_modules/@playwright/test");
const { readFileSync, mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const origin = process.argv[2];
const credentialFile = process.argv[3];
if (!origin?.startsWith("https://") || !credentialFile)
  throw new Error("HTTPS origin and private credential file required");
const credentials = Object.fromEntries(
  readFileSync(credentialFile, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const output = path.resolve("backend/storage/deployment/verification");
mkdirSync(output, { recursive: true });
const results = [];
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ baseURL: origin });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const home = await page.goto(origin, { waitUntil: "networkidle" });
    expect(home.status()).toBe(200);
    expect((await home.securityDetails()).issuer).toBeTruthy();
    await expect(page.locator("h1")).toBeVisible();
    await page.screenshot({
      path: path.join(output, "home-desktop.png"),
      fullPage: true,
    });
    results.push("HTTPS home and valid certificate");
    const ready = await context.request.get("/api/health/ready");
    expect(ready.status()).toBe(200);
    expect((await ready.json()).database).toBe("connected");
    results.push("Database readiness");
    for (const [url, scope] of [
      ["/manifest.webmanifest", "/"],
      ["/admin/manifest.webmanifest", "/admin/"],
    ]) {
      const response = await context.request.get(url);
      expect(response.status()).toBe(200);
      expect((await response.json()).scope).toBe(scope);
    }
    for (const url of ["/sw.js", "/admin/sw.js"]) {
      const response = await context.request.get(url);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toMatch(/javascript/);
      expect(response.headers()["cache-control"]).toContain("no-cache");
    }
    expect(
      (await context.request.get("/assets/irent-missing-test.js")).status(),
    ).toBe(404);
    results.push("Both PWA manifests/workers and missing asset 404");
    expect((await context.request.get("/api/admin/bookings")).status()).toBe(
      401,
    );
    expect((await context.request.get("/api/bookings")).status()).toBe(401);
    const invalidOrigin = await context.request.post("/api/auth/register", {
      headers: { origin: "https://invalid.example" },
      data: {
        name: "Rejected request",
        email: "rejected@example.invalid",
        password: "abcdefgh",
      },
    });
    expect(invalidOrigin.status()).toBe(403);
    const shortPassword = await context.request.post("/api/auth/register", {
      headers: { origin },
      data: {
        name: "Rejected request",
        email: "rejected@example.invalid",
        password: "abcdefg",
      },
    });
    expect(shortPassword.status()).toBe(400);
    results.push(
      "Private API authorization, origin rejection and password minimum",
    );
    await page.goto("/login");
    await page
      .getByLabel("Email atau nomor HP")
      .fill(credentials.IRENT_ADMIN_EMAIL);
    await page
      .getByLabel("Password", { exact: true })
      .fill(credentials.IRENT_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await page.waitForURL("**/admin/**");
    const response = await context.request.get("/api/auth/session");
    const session = await response.json();
    expect(session.user.role).toBe("admin");
    const cookie = (await context.cookies()).find((item) =>
      item.name.startsWith("__Host-"),
    );
    expect(cookie).toBeTruthy();
    expect(cookie.secure && cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    await page.reload({ waitUntil: "networkidle" });
    expect(page.url()).toContain("/admin/");
    await page.screenshot({
      path: path.join(output, "admin-desktop.png"),
      fullPage: true,
    });
    results.push("Admin UI login, secure session and deep-link reload");
    await page.goto("/admin/account", { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: "Ganti password", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Ganti password" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByLabel("Password baru", { exact: true }),
    ).toHaveAttribute("type", "password");
    await page.screenshot({
      path: path.join(output, "change-password-desktop.png"),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: path.join(output, "change-password-mobile.png"),
    });
    await dialog
      .getByLabel("Password lama", { exact: true })
      .fill("unsaved-test");
    await dialog
      .getByRole("button", { name: "Tampilkan password lama", exact: true })
      .click();
    await expect(
      dialog.getByLabel("Password lama", { exact: true }),
    ).toHaveAttribute("type", "text");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole("button", { name: "Ganti password", exact: true })
      .click();
    await expect(page.getByLabel("Password lama", { exact: true })).toHaveValue(
      "",
    );
    await page.getByRole("button", { name: "Batal", exact: true }).click();
    results.push(
      "Password dialog on desktop/mobile, reveal, Escape and clearing unsaved fields",
    );
    const logout = await context.request.post("/api/auth/logout", {
      headers: { origin, "x-csrf-token": session.csrfToken },
      data: {},
    });
    expect(logout.ok()).toBe(true);
    expect((await context.request.get("/api/admin/bookings")).status()).toBe(
      401,
    );
    results.push("Logout revokes private API access");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: path.join(output, "home-mobile.png"),
      fullPage: true,
    });
    await page.goto("/login", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("button", { name: "Masuk", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(pageErrors).toEqual([]);
    results.push("Mobile home/login and no uncaught browser errors");
    writeFileSync(
      path.join(output, "results.json"),
      JSON.stringify(
        { origin, checkedAt: new Date().toISOString(), results },
        null,
        2,
      ),
    );
    console.log(results.map((result) => `PASS ${result}`).join("\n"));
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  // Assertion errors contain expected/actual status only; never print credentials.
  console.error(error.message);
  process.exitCode = 1;
});
