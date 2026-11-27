// PDF Werkbank – Rauchtests (laufen bei jedem Push in GitHub Actions)
// Start: python3 -m http.server 8080 im Repo-Ordner, dann: node tests/smoke.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8080/';
let failed = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };
const browser = await chromium.launch();
async function page(vp = { width: 1400, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  if (process.env.WB_TEST_HOOK) await (await import(process.env.WB_TEST_HOOK)).default(ctx);
  const p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|favicon/.test(m.text())) errors.push(m.text()); });
  p.setDefaultTimeout(30000);
  return { p, ctx, errors };
}
try {
  // 1 Editor startet mit Beispiel, alle Module geladen
  {
    const { p, ctx, errors } = await page();
    await p.goto(BASE + 'index.html'); await p.waitForSelector('.page canvas');
    const mods = await p.evaluate(() => ['WBTools', 'WBConvert', 'WBTemplates', 'WBSign', 'WBCite', 'WBPdfA', 'WBEInvoice', 'WBStats', 'WBScan', 'WBBatch', 'WBLibChat', 'WBAnki', 'WBLedger', 'WBTasks'].filter(k => !window[k]));
    ok(!mods.length, 'Module geladen ' + mods.join(','));
    // Suche mit Trefferliste
    await p.keyboard.press('Control+f'); await p.keyboard.type('werkbank'); await p.waitForTimeout(1200);
    ok(/\d+\/\d+/.test(await p.textContent('#findCount')) && await p.$$eval('.fl-r', e => e.length) > 0, 'Suche mit Trefferliste');
    // Speichern als PDF
    await p.keyboard.press('Escape');
    ok(!errors.length, 'Editor ohne Fehler ' + errors.join(' | '));
    await ctx.close();
  }
  // 2 schmale Fenster: keine horizontale Scrollleiste, Suche erreichbar
  for (const w of [1000, 820, 390]) {
    const { p, ctx } = await page({ width: w, height: 800 });
    await p.goto(BASE + 'index.html'); await p.waitForSelector('.page canvas');
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    await p.keyboard.press('Control+f'); await p.keyboard.type('werkbank'); await p.waitForTimeout(1000);
    const vis = await p.$eval('#findInput', e => { const r = e.getBoundingClientRect(); return r.width > 60 && r.right <= innerWidth; });
    ok(sw <= w && vis, `Kopfzeile bei ${w}px (Breite ${sw}, Suchfeld sichtbar ${vis})`);
    await ctx.close();
  }
  // 3 Bibliothek
  {
    const { p, ctx, errors } = await page();
    await p.goto(BASE + 'library.html'); await p.waitForSelector('#nav .nitem');
    ok(await p.$$eval('#nav .nitem', e => e.length) >= 5, 'Bibliothek mit Navigation');
    ok(!errors.length, 'Bibliothek ohne Fehler ' + errors.join(' | '));
    await ctx.close();
  }
  // 4 E-Rechnung: ZUGFeRD erzeugen und wieder lesen
  {
    const { p, ctx } = await page();
    await p.goto(BASE + 'index.html'); await p.waitForSelector('.page canvas');
    const r = await p.evaluate(async () => {
      const P = { name: 'Max Muster', company: 'Muster IT', street: 'Weg 1', city: '33602 Bielefeld', email: 'a@b.de', phone: '0521 1', taxId: '1/2/3', iban: 'DE89 3704 0044 0532 0130 00', kleinunternehmer: true, vat: 19 };
      const data = { profile: P, to: 'Kunde GmbH\nStr. 2\n49074 Osnabrück', toName: 'Kunde GmbH', no: 'RE-1', date: '20.11.2026', items: [{ desc: 'Leistung', qty: '2', unit: 'Std.', price: '50' }], terms: 14 };
      const inv = await WBTemplates.invoicePdf('invoice', data);
      const z = await WBEInvoice.zugferd(inv.bytes, WBEInvoice.cii(data), { title: 'Rechnung RE-1' });
      const pdf = await pdfjsLib.getDocument({ data: z.bytes.slice() }).promise;
      const m = WBEInvoice.parse((await WBEInvoice.fromPdf(pdf)).xml);
      return { gross: m.gross, part: z.part };
    });
    ok(r.gross === 100 && r.part === 3, 'ZUGFeRD erzeugt und gelesen');
    await ctx.close();
  }
} catch (e) { console.error(e); failed++; }
await browser.close();
console.log(failed ? `${failed} Fehler` : 'Alles in Ordnung');
process.exit(failed ? 1 : 0);
