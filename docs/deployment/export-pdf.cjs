// Run from the repository root after installing frontend dependencies.
const { chromium } = require('../../frontend/node_modules/playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

async function main() {
  const sourceName = process.argv[2] || 'opsi-hosting-domain.html';
  const outputName = process.argv[3] || 'iRent-Opsi-Hosting-dan-Domain.pdf';
  if (path.basename(sourceName) !== sourceName || path.basename(outputName) !== outputName) {
    throw new Error('Use filenames within docs/deployment');
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(__dirname, sourceName)).href);
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.locator('.page').evaluateAll((pages) =>
      pages.map((page, index) => {
        const footer = page.querySelector('footer');
        return {
          page: index + 1,
          overflow: page.scrollHeight > page.clientHeight,
          overlapsFooter: footer.previousElementSibling.getBoundingClientRect().bottom > footer.getBoundingClientRect().top - 8,
        };
      }),
    );
    console.log(layout);
    if (layout.some((page) => page.overflow || page.overlapsFooter)) {
      throw new Error('PDF content does not fit the page');
    }
    await page.pdf({
      path: path.join(__dirname, outputName),
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
