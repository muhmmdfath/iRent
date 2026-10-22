// Build the operational handbook from its Markdown source; run from any directory.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('../../frontend/node_modules/playwright');
const directory = __dirname;
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function inline(s) {
  return escape(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
function blocks(markdown) {
  const lines = markdown.trim().split('\n');
  const result = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (line.startsWith('## ')) { result.push(`<h2>${inline(line.slice(3))}</h2>`); i++; continue; }
    if (line.startsWith('### ')) { result.push(`<h3>${inline(line.slice(4))}</h3>`); i++; continue; }
    if (line.startsWith('![')) {
      const match = line.match(/^!\[([^\]]+)\]\(([^)]+)\)$/);
      if (!match) throw new Error('Invalid image: ' + line);
      result.push(`<figure><div><img src="${escape(match[2])}" alt="${escape(match[1])}"></div><figcaption>${inline(match[1])}</figcaption></figure>`); i++; continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++].trim().split('|').slice(1, -1).map((cell) => cell.trim()));
      result.push('<table><thead><tr>' + rows[0].map((cell) => '<th>' + inline(cell) + '</th>').join('') + '</tr></thead><tbody>' + rows.slice(2).map((row) => '<tr>' + row.map((cell) => '<td>' + inline(cell) + '</td>').join('') + '</tr>').join('') + '</tbody></table>'); continue;
    }
    if (/^(\d+\. |\- )/.test(line)) {
      const ordered = /^\d/.test(line); const entries = [];
      const start = ordered ? Number(line.match(/^\d+/)[0]) : null;
      while (i < lines.length && (ordered ? /^\d+\. / : /^- /).test(lines[i].trim())) entries.push('<li>' + inline(lines[i++].trim().replace(/^(\d+\. |\- )/, '')) + '</li>');
      const tag = ordered ? 'ol' : 'ul'; result.push(`<${tag}${ordered ? ` start="${start}"` : ''}>${entries.join('')}</${tag}>`); continue;
    }
    if (line.startsWith('> ')) {
      const notes = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) notes.push(inline(lines[i++].trim().slice(2)));
      result.push('<aside>' + notes.join('<br>') + '</aside>'); continue;
    }
    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(## |### |\| |\d+\. |\- |> |!\[)/.test(lines[i].trim())) paragraph.push(lines[i++].trim());
    result.push('<p>' + inline(paragraph.join(' ')) + '</p>');
  }
  return result.join('\n');
}
async function main() {
  const source = fs.readFileSync(path.join(directory, 'panduan-admin.md'), 'utf8');
  const pages = source.split(/\n<!-- page -->\n/).map((section, index) => {
    const lines = section.trim().split('\n');
    const title = lines.shift().replace(/^# /, '');
    if (!title || !section.trim().startsWith('# ')) throw new Error('Missing page title: ' + (index + 1));
    return { title, body: lines.join('\n'), number: index + 1 };
  });
  const contents = pages.map((page) => {
    let body = blocks(page.body);
    if (page.body.includes('{{CONTENTS_A}}')) body = contentsBlock(pages.slice(4, 24));
    if (page.body.includes('{{CONTENTS_B}}')) body = contentsBlock(pages.slice(24));
    return `<section class="page ${page.number === 1 ? 'cover' : ''}" id="p${page.number}"><header><span>iRent Semarang</span><span>Panduan operasional admin · Versi 1.0</span></header><main><div class="eyebrow">${page.number === 1 ? 'BUKU PEGANGAN ADMIN' : 'PANDUAN ADMIN / ' + String(page.number).padStart(2, '0')}</div><h1>${inline(page.title)}</h1>${body}</main><footer><span>irentsmg.tech · Edisi 22 Oktober 2026 · Seluruh waktu WIB</span><span>${page.number} / ${pages.length}</span></footer></section>`;
  }).join('\n');
  function contentsBlock(items) {
    return '<p class="intro">Klik judul untuk menuju halaman yang diperlukan.</p><nav class="toc">' + items.map((item) => `<a href="#p${item.number}"><span>${inline(item.title)}</span><strong>${item.number}</strong></a>`).join('') + '</nav>';
  }
  const style = `
@font-face{font-family:Poppins;src:url('../../frontend/node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2')}@font-face{font-family:Poppins;src:url('../../frontend/node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2');font-weight:600}
@page{size:A4;margin:0}*{box-sizing:border-box}html{background:#e9e9eb}body{margin:0;color:#202027;font:12px/1.72 Poppins,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{position:relative;background:#fff;width:210mm;height:297mm;padding:15mm 18mm 19mm;break-after:page;overflow:hidden}.page:last-child{break-after:auto}header{display:flex;justify-content:space-between;border-bottom:1px solid #e6e6e9;padding-bottom:10px;margin-bottom:24px;font-size:8.5px;color:#71717c}header span:first-child{color:#24242d;font-weight:600}main{display:flow-root}.eyebrow{font-size:9px;letter-spacing:1.7px;color:#a12c5e;font-weight:600;margin-bottom:9px}h1{font-size:25px;line-height:1.35;letter-spacing:-.7px;margin:0 0 23px;font-weight:600;max-width:610px}h2{font-size:14px;line-height:1.5;margin:20px 0 8px;font-weight:600}h3{font-size:12px;line-height:1.5;margin:15px 0 7px}p{margin:0 0 12px}strong{font-weight:600}ol,ul{margin:8px 0 14px;padding-left:21px}li{padding-left:4px;margin:0 0 8px}li:last-child{margin-bottom:0}table{width:100%;border-collapse:collapse;margin:10px 0 17px;font-size:10.8px;line-height:1.62}th{text-align:left;background:#f5f3f5;font-weight:600}td,th{padding:9px 10px;border-bottom:1px solid #e7e5e8;vertical-align:top}td:first-child{width:31%;font-weight:600}aside{margin:17px 0;padding:13px 16px;background:#fff2f7;border-left:3px solid #d94c87;font-size:11px;line-height:1.7}code{font-family:Poppins,sans-serif;font-size:.93em;color:#6d3450;background:#f8f4f6;padding:1px 4px;overflow-wrap:anywhere}a{color:#98315d;text-decoration:none}footer{position:absolute;bottom:12mm;left:18mm;right:18mm;display:flex;justify-content:space-between;border-top:1px solid #e6e6e9;padding-top:9px;font-size:8px;color:#7a7780}.cover main{padding-top:39mm}.cover h1{font-size:42px;line-height:1.2;max-width:550px;margin-bottom:25px}.cover .eyebrow{margin-bottom:20px}.cover p{font-size:14px;max-width:530px;line-height:1.9}.cover h2{margin-top:42px;font-size:12px}.cover aside{margin-top:28px;max-width:550px}.toc{display:grid;margin-top:20px;gap:0}.toc a{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:10px 0;border-bottom:1px solid #e8e5e8;font-size:11.3px;color:#27232b}.toc strong{color:#9e315e;font-size:10px}.intro{color:#6e6771}figure{margin:15px 0 18px}figure div{max-height:225px;overflow:hidden;border:1px solid #e7e5e8;border-radius:6px}figure img{width:100%;display:block}figcaption{font-size:8.5px;color:#7a737d;margin-top:6px}nav{break-inside:avoid}
`;
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Panduan Lengkap Admin iRent Semarang</title><style>${style}\n.toc a{padding:7px 0;line-height:1.5}</style></head><body>${contents}</body></html>`;
  fs.writeFileSync(path.join(directory, 'panduan-admin.html'), html);
  const browser = await chromium.launch({ headless: true });
  try {
    const tab = await browser.newPage();
    await tab.goto(pathToFileURL(path.join(directory, 'panduan-admin.html')).href);
    await tab.evaluate(() => document.fonts.ready);
    const issues = await tab.locator('.page').evaluateAll((elements) => elements.map((element, index) => ({
      page: index + 1,
      title: element.querySelector('h1').textContent,
      remaining: Math.round(element.querySelector('footer').getBoundingClientRect().top - element.querySelector('main').getBoundingClientRect().bottom),
      overflow: element.scrollHeight > element.clientHeight,
    })).filter((item) => item.remaining < 16 || item.overflow));
    if (issues.length) throw new Error('Pages need more room: ' + JSON.stringify(issues));
    const broken = await tab.locator('img').evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src));
    if (broken.length) throw new Error('Missing images: ' + broken.join(', '));
    await tab.pdf({ path: path.join(directory, 'iRent-Panduan-Lengkap-Admin.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, outline: true });
    fs.writeFileSync(path.join(directory, 'manual-outline.json'), JSON.stringify(pages.map(({ title, number }) => ({ title, page: number })), null, 2) + '\n');
    console.log(`Created ${pages.length} pages; layout, fonts and images checked.`);
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
