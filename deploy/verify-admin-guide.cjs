// Visual/navigation checks with a simulated admin session; no production data is read.
const {
  chromium,
  expect,
} = require("../frontend/node_modules/@playwright/test");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const origin = process.argv[2] || "http://127.0.0.1:5180";
const before = process.argv.includes("--before");
const output = path.resolve(
  __dirname,
  "../backend/storage/deployment/guide-review",
);
mkdirSync(output, { recursive: true });
async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      return route.fulfill({
        json:
          url.pathname === "/api/auth/session"
            ? {
                user: {
                  id: "guide-preview",
                  name: "Admin iRent",
                  email: "preview@example.test",
                  phone: null,
                  role: "admin",
                  profile: null,
                },
                csrfToken: "preview",
              }
            : { data: [], total: 0, unread: 0, page: 1, limit: 10 },
      });
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + "/admin/guide", { waitUntil: "networkidle" });
      await expect(
        page.getByRole("heading", { name: "Panduan admin", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: path.join(output, `${before ? "before" : "after"}-${width}.png`),
        fullPage: true,
      });
      if (before) continue;
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width < 768) {
        await page.getByLabel("Pilih topik panduan").selectOption("refund");
      } else {
        await page
          .getByRole("navigation", { name: "Topik panduan" })
          .getByRole("link", { name: "Refund manual", exact: true })
          .click();
      }
      await expect(
        page
          .getByRole("article")
          .getByRole("heading", { name: "Refund manual", exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("article")
          .getByRole("link", { name: "Buka antrean refund" }),
      ).toHaveAttribute("href", "/admin/refunds");
      await page.reload();
      await expect(
        page
          .getByRole("article")
          .getByRole("heading", { name: "Refund manual", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: path.join(output, `refund-${width}.png`),
        fullPage: true,
      });
    }
    console.log(
      before
        ? "Baseline captured at desktop and mobile."
        : "PASS guide layout, navigation, actions and reload at desktop/mobile.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
