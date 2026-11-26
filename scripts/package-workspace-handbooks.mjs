/** Regenerate the two downloadable books from the same pages used by the reader. */
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "src/shared/ui/guide/documents");
const cacheDir = await mkdtemp(path.join(tmpdir(), "academy-handbooks-"));
const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const stylesheet = `
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #203442; font: 12pt/1.62 "Malgun Gothic", "Noto Sans CJK KR", sans-serif; word-break: keep-all; }
  section { width: 297mm; height: 209.8mm; padding: 13mm 16mm 10mm; display: flex; flex-direction: column; break-after: page; }
  section:last-child { break-after: auto; }
  header, footer { display: flex; justify-content: space-between; align-items: center; font-size: 10pt; color: #486272; }
  header { padding-bottom: 3mm; border-bottom: 1pt solid #426475; }
  h1 { font-size: 24pt; margin: 4mm 0 1mm; line-height: 1.35; }
  .route { font-size: 11pt; color: #265c72; margin: 0 0 5mm; }
  main { display: grid; grid-template-columns: 51fr 49fr; gap: 8mm; align-items: start; }
  figure { margin: 0; }
  img { width: 100%; max-height: 99mm; display: block; object-fit: contain; border: .5pt solid #ced9dc; }
  figcaption { color: #546877; font-size: 10pt; line-height: 1.5; margin-top: 2mm; }
  ol { padding-inline-start: 1.5em; margin: 0; }
  li { padding-left: 1mm; margin-bottom: 2mm; }
  li::marker, dt, h2 { font-weight: 700; color: #205b70; }
  aside { margin-top: 3mm; padding: 2mm 3mm; background: #eff5f6; border-left: 2pt solid #306c7c; }
  h2 { margin: 0; font-size: 11pt; } aside p, .help p { margin: 0; font-size: 11pt; }
  .help { margin: 3mm 0 0; }
  .example { padding: 7mm; background: #eff5f6; } .example h2 { font-size: 15pt; }
  dl { margin: 4mm 0 0; } dl div { padding: 3mm 0; border-top: .5pt solid #c6d5da; }
  dd { margin: 0; }
  footer { margin-top: auto; padding-top: 3mm; border-top: .5pt solid #c6d5da; }
`;

async function illustration(item) {
  if ("example" in item) {
    const rows = item.example.rows.map(([term, value]) => `<div><dt>${escape(term)}</dt><dd>${escape(value)}</dd></div>`).join("");
    return `<div class="example"><h2>${escape(item.example.title)}</h2><dl>${rows}</dl></div>`;
  }
  const asset = item.image.startsWith("/src/") ? path.join(root, item.image) : path.join(root, "public", item.image);
  const bytes = await readFile(asset);
  const mime = path.extname(asset) === ".png" ? "image/png" : "image/jpeg";
  return `<figure><img src="data:${mime};base64,${bytes.toString("base64")}" alt="${escape(item.alt)}"><figcaption>${escape(item.alt)}</figcaption></figure>`;
}

async function printBook(browser, book, name) {
  const sheets = await Promise.all(book.pages.map(async (item, index) => `<section>
    <header><b>학원플러스</b><span>${escape(book.title)}</span></header>
    <h1>${escape(item.title)}</h1><p class="route">${escape(item.start)}</p>
    <main>${await illustration(item)}<div><ol>${item.steps.map(step => `<li>${escape(step)}</li>`).join("")}</ol>
    <aside><h2>완료 확인</h2><p>${escape(item.done)}</p></aside>
    <div class="help"><h2>막혔을 때</h2><p>${escape(item.recovery)}</p></div></div></main>
    <footer><span>${escape(book.title)}</span><span>${index + 1} / ${book.pages.length}쪽</span></footer></section>`));
  const page = await browser.newPage();
  try {
    await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>학원플러스 · ${escape(book.title)}</title><style>${stylesheet}</style><body>${sheets.join("")}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const fits = await page.evaluate(() => [...document.querySelectorAll("section")].every(section =>
      section.querySelector("main").getBoundingClientRect().bottom <= section.querySelector("footer").getBoundingClientRect().top &&
      section.querySelector("footer").getBoundingClientRect().bottom <= section.getBoundingClientRect().bottom));
    if (!fits) throw new Error(`Page content overflow in ${name}`);
    await page.pdf({ path: path.join(output, name), preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
  } finally { await page.close(); }
}

let server, browser;
try {
  server = await createServer({ root, cacheDir, configFile: false, resolve: { alias: { "@": path.join(root, "src") } },
    server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom" });
  const { handbooks } = await server.ssrLoadModule("/src/shared/ui/guide/handbookData.ts");
  browser = await chromium.launch({ channel: process.env.HANDBOOK_BROWSER_CHANNEL || undefined });
  await mkdir(output, { recursive: true });
  await printBook(browser, handbooks.teacher, "teacher-pc.pdf");
  await printBook(browser, handbooks.student, "student-app.pdf");
} finally {
  await browser?.close();
  await server?.close();
  await rm(cacheDir, { recursive: true, force: true });
}
