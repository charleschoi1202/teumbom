// Renders docs/architecture.html to docs/architecture.pdf (+ png preview) with local Chrome.
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.resolve(here, "../../../docs");
const name = process.argv[2] || "architecture";
const html = "file:///" + path.join(docs, `${name}.html`).replace(/\\/g, "/");

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1180, height: 700, deviceScaleFactor: 2 });
await page.goto(html, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
const fontOk = await page.evaluate(() => document.fonts.check('16px "Pretendard Variable"') || document.fonts.check("16px Pretendard"));
console.log("Pretendard available:", fontOk);
await page.pdf({ path: path.join(docs, `${name}.pdf`), width: "1180px", height: "700px", printBackground: true, pageRanges: "1" });
await page.screenshot({ path: path.join(docs, `${name}.png`) });
await browser.close();
console.log("written", path.join(docs, `${name}.pdf`));
