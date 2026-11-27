/* ---------- 5. Formel als LaTeX ---------- */
function pickArea(hint) {
  return new Promise(resolve => {
    const ov = document.createElement('div'); ov.className = 'areapick';
    ov.innerHTML = `<div class="aphint">${esc(hint)} <button class="btn sm" data-ap="no">Abbrechen</button></div>`;
    document.body.appendChild(ov);
    let st = null, box = null;
    const done = v => { ov.remove(); if (box) box.remove(); document.removeEventListener('keydown', key, true); resolve(v); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); } };
    document.addEventListener('keydown', key, true);
    ov.addEventListener('click', e => { if (e.target.closest('[data-ap]')) done(null); });
    ov.addEventListener('pointerdown', e => {
      if (e.target.closest('.aphint')) return;
      ov.style.pointerEvents = 'none'; const under = document.elementFromPoint(e.clientX, e.clientY); ov.style.pointerEvents = '';
      const pg = under && under.closest('.page'); if (!pg) return;
      const p = pageById(pg.dataset.id), el = els.get(p.id); if (!el) return;
      const r = el.svg.getBoundingClientRect();
      st = { p, r, x: e.clientX, y: e.clientY };
      box = document.createElement('div'); box.className = 'apbox'; document.body.appendChild(box);
      ov.setPointerCapture(e.pointerId); e.preventDefault();
    });
    ov.addEventListener('pointermove', e => {
      if (!st) return;
      const x0 = clamp(Math.min(st.x, e.clientX), st.r.left, st.r.right), x1 = clamp(Math.max(st.x, e.clientX), st.r.left, st.r.right);
      const y0 = clamp(Math.min(st.y, e.clientY), st.r.top, st.r.bottom), y1 = clamp(Math.max(st.y, e.clientY), st.r.top, st.r.bottom);
      Object.assign(box.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
      st.cur = { x0, y0, x1, y1 };
    });
    ov.addEventListener('pointerup', () => {
      if (!st || !st.cur) return;
      const { x0, y0, x1, y1 } = st.cur, z = S.zoom;
      if (x1 - x0 < 8 || y1 - y0 < 8) { st = null; if (box) { box.remove(); box = null; } return; }
      done({ p: st.p, x: (x0 - st.r.left) / z, y: (y0 - st.r.top) / z, w: (x1 - x0) / z, h: (y1 - y0) / z });
    });
  });
}
async function regionImage(p, a, maxSide = 1600) {
  const proxy = proxyOf(p), k = clamp(maxSide / Math.max(a.w, a.h), 1, 6);
  const vp = proxy.getViewport({ scale: k, rotation: rotOf(p), offsetX: -a.x * k, offsetY: -a.y * k });
  const c = document.createElement('canvas'); c.width = Math.ceil(a.w * k); c.height = Math.ceil(a.h * k);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await proxy.render({ canvasContext: ctx, viewport: vp }).promise;
  const own = p.annots.filter(x => { const b = bbox(x); return b.x < a.x + a.w && b.x + b.w > a.x && b.y < a.y + a.h && b.y + b.h > a.y; });
  if (own.length) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="${a.x} ${a.y} ${a.w} ${a.h}">${own.map(annotSVG).join('')}</svg>`);
    try { await img.decode(); ctx.drawImage(img, 0, 0); } catch (e) { /* ohne eigene Elemente */ }
  }
  return c;
}
let katexP = null;
function loadKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  if (!katexP) katexP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = (window.WB_CONFIG && WB_CONFIG.katexScript) || 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js'; s.onload = () => res(window.katex); s.onerror = () => { katexP = null; rej(new Error('Formel-Vorschau nicht verfügbar (offline?)')); }; document.head.appendChild(s); });
  return katexP;
}
async function formulaTool() {
  commitEdit();
  if (!aiReady()) { toast('Formeln erkennt die KI. Bitte zuerst den KI-Assistenten einrichten (Funken-Symbol oben).'); return; }
  const area = await pickArea('Zieh einen Rahmen um die Formel (gedruckt oder handschriftlich).');
  if (!area) return;
  busy(true, 'Formel wird gelesen …');
  let tex = '';
  try {
    const c = await regionImage(area.p, area);
    tex = await AIX.ask({ instructions: 'Du wandelst Formeln aus Bildern in LaTeX um. Antworte NUR mit dem LaTeX-Code ohne $-Zeichen, ohne Codeblock, ohne Erklärung. Mehrere Zeilen als aligned-Umgebung. Text in Formeln mit \\text{}.', messages: [{ role: 'user', text: 'Formel als LaTeX:', images: [c.toDataURL('image/png')] }], maxTokens: 800 });
    tex = String(tex).replace(/^```\w*\n?|```$/g, '').replace(/^\$+|\$+$/g, '').replace(/^\\\[|\\\]$/g, '').trim();
    busy(false);
  } catch (e) { busy(false); toast('Formel konnte nicht gelesen werden: ' + (e.message || e)); return; }
  let K = null; try { K = await loadKatex(); } catch (e) { K = null; }
  dialog('Formel als LaTeX', `<p class="note" style="margin:0">Bitte prüfen. Änderungen siehst du sofort in der Vorschau.</p>
    <textarea class="field area mono" id="fxTex" rows="4" spellcheck="false">${esc(tex)}</textarea>
    <div class="fxprev" id="fxPrev"></div>
    <div class="row2"><button type="button" class="btn" data-fx="tex">${icon('copy')}LaTeX kopieren</button><button type="button" class="btn" data-fx="word" ${K ? '' : 'disabled'}>Für Word kopieren</button><button type="button" class="btn" data-fx="md">Für Notion/Markdown ($$)</button></div>
    <p class="note" style="margin:4px 0 0">„Für Word“ kopiert MathML: in Word einfügen, es wird automatisch eine bearbeitbare Formel.</p>`, 'Als Text einfügen', b => {
    const t = $('#fxTex', b).value.trim(); if (!t) return false;
    const p = area.p; pushHist();
    const a = { id: uid(), t: 'text', x: area.x, y: area.y + area.h + 6, text: t, color: '#1b2130', size: 10, font: 'JetBrainsMono', bold: false };
    p.annots.push(a); drawAnnots(p); markDirty(); toast('LaTeX unter der Formel eingefügt');
  });
  $('#dlg .card').classList.add('wide');
  const b = $('#dlgBody');
  const prev = () => { const t = $('#fxTex', b).value; if (!K) { $('#fxPrev', b).innerHTML = '<span class="note">Vorschau nicht verfügbar</span>'; return; } try { $('#fxPrev', b).innerHTML = K.renderToString(t, { displayMode: true, output: 'mathml', throwOnError: true }); } catch (e) { $('#fxPrev', b).innerHTML = `<span class="note">LaTeX-Fehler: ${esc(e.message.replace(/^KaTeX parse error: /, ''))}</span>`; } };
  b.oninput = prev; prev();
  b.onclick = async e => {
    const x = e.target.closest('[data-fx]'); if (!x) return; const t = $('#fxTex', b).value.trim();
    if (x.dataset.fx === 'tex') toast(await writeSysClip(t) ? 'LaTeX kopiert' : 'Kopieren nicht möglich');
    else if (x.dataset.fx === 'md') toast(await writeSysClip(`$$\n${t}\n$$`) ? 'Kopiert' : 'Kopieren nicht möglich');
    else if (x.dataset.fx === 'word' && K) { try { const ml = K.renderToString(t, { output: 'mathml', displayMode: true }).replace(/^<span class="katex(-display)?">|<\/span>$/g, '').replace(/^<span class="katex">|<\/span>$/g, ''); const math = (ml.match(/<math[\s\S]*<\/math>/) || [ml])[0].replace(/<annotation[\s\S]*?<\/annotation>/, '').replace(/<semantics>|<\/semantics>/g, ''); toast(await writeSysClip(math) ? 'MathML kopiert – in Word einfügen' : 'Kopieren nicht möglich'); } catch (er) { toast('LaTeX-Fehler: ' + er.message); } }
  };
}

/* ---------- 6. E-Rechnung ansehen ---------- */
const EINV_NOTED = new Set();
async function einvoiceCheck() {
  if (!window.WBEInvoice || !S.pages.length) return;
  const src = S.sources.get(S.pages[0].src); if (!src || !src.pdf || EINV_NOTED.has(src.id)) return;
  EINV_NOTED.add(src.id);
  const f = await WBEInvoice.fromPdf(src.pdf).catch(() => null);
  if (!f) return;
  S.einv = f;
  pill(`${icon('xml')}<span>Diese PDF enthält eine E-Rechnung (${esc(f.name)})</span><button class="btn sm" data-x="show">Daten anzeigen</button><button class="ibtn" data-x="no" aria-label="Schließen">✕</button>`, k => { pill(null); if (k === 'show') einvoiceView(f.xml, f.name); });
}
function einvoiceView(xml, name) {
  let m; try { m = WBEInvoice.parse(xml); } catch (e) { toast(e.message || String(e)); return; }
  const epc = WBEInvoice.epc(m);
  let qr = '';
  if (epc && window.qrcode) { try { const q = window.qrcode(0, 'M'); q.addData(epc); q.make(); const n = q.getModuleCount(); let d = ''; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`; qr = `<div class="einv-qr"><svg viewBox="0 0 ${n + 4} ${n + 4}" width="132" height="132"><rect width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}"/></svg><small>GiroCode: mit der Banking-App scannen</small></div>`; } catch (e) { qr = ''; } }
  dialog('E-Rechnung', WBEInvoice.html(m).replace('</div>\n      <table', `</div>${qr}<table`) + `<div class="row2"><button type="button" class="btn" data-ev="pdf">${icon('save')}Lesbare PDF speichern</button><button type="button" class="btn" data-ev="open">Als Dokument öffnen</button><button type="button" class="btn" data-ev="xml">XML speichern</button><button type="button" class="btn" data-ev="csv">Für Buchhaltung (CSV)</button></div>`, 'Schließen', () => true);
  $('#dlgCancel').hidden = true; $('#dlg .card').classList.add('wide');
  $('#dlgBody').onclick = async e => {
    const x = e.target.closest('[data-ev]'); if (!x) return;
    const nm = cleanFile(`${WBEInvoice.TYPE[m.type] || 'Rechnung'} ${m.no} ${(m.seller && m.seller.name) || ''}`);
    if (x.dataset.ev === 'xml') dlTo(new TextEncoder().encode(xml), name && /\.xml$/i.test(name) && !/^factur-x/i.test(name) ? name : nm + '.xml', 'application/xml');
    else if (x.dataset.ev === 'pdf') saveBytes(await WBEInvoice.toPdf(m), nm + '.pdf');
    else if (x.dataset.ev === 'open') { closeDlg(); await openFiles([new File([await WBEInvoice.toPdf(m)], nm + '.pdf', { type: 'application/pdf' })], 'replace'); }
    else if (x.dataset.ev === 'csv') {
      const f2 = n => (+n || 0).toFixed(2).replace('.', ',');
      const rows = [['Belegdatum', 'Rechnungsnummer', 'Lieferant', 'USt-IdNr.', 'Netto', 'USt', 'Brutto', 'Fällig', 'IBAN', 'Verwendungszweck'], [m.date ? m.date.toLocaleDateString('de-DE') : '', m.no, (m.seller && m.seller.name) || '', (m.seller && m.seller.vatId) || '', f2(m.net), f2(m.tax), f2(m.gross), m.due ? m.due.toLocaleDateString('de-DE') : '', m.iban, m.payRef || m.no]];
      dlTo(new TextEncoder().encode('﻿' + rows.map(r => r.map(c => /[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(';')).join('\r\n')), nm + '.csv', 'text/csv');
    }
  };
}
function einvoiceOpen() {
  if (S.einv) { einvoiceView(S.einv.xml, S.einv.name); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xml,application/xml,text/xml,.pdf,application/pdf';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    if (/\.pdf$/i.test(f.name)) {
      const pdf = await PDFJS.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
      const x = await WBEInvoice.fromPdf(pdf); pdf.destroy();
      if (!x) { toast('In dieser PDF steckt keine E-Rechnung.'); return; }
      einvoiceView(x.xml, x.name);
    } else einvoiceView(await f.text(), f.name);
  };
  inp.click();
}
async function openEInvoiceXml(f) {
  const xml = await f.text();
  let m; try { m = WBEInvoice.parse(xml); } catch (e) { toast(e.message || String(e)); return; }
  const nm = cleanFile(`${WBEInvoice.TYPE[m.type] || 'Rechnung'} ${m.no} ${(m.seller && m.seller.name) || ''}`);
  await openFiles([new File([await WBEInvoice.toPdf(m)], nm + '.pdf', { type: 'application/pdf' })], 'replace');
  S.einv = { xml, name: f.name };
  setTimeout(() => einvoiceView(xml, f.name), 300);
}

/* ---------- 7. Serienbrief ---------- */
const PH = /\{\{?\s*([^{}\n]{1,40}?)\s*\}?\}/g;
function mmFill(text, row) { return String(text).replace(PH, (m, k) => { const key = Object.keys(row).find(c => c.toLowerCase() === k.toLowerCase()); return key != null ? row[key] : m; }); }
function mmPlaceholders() {
  const set = new Set();
  for (const p of S.pages) for (const a of p.annots) if ((a.t === 'text' || a.t === 'note') && a.text) for (const m of a.text.matchAll(PH)) set.add(m[1].trim());
  return [...set];
}
function mailMergeDialog() {
  commitEdit();
  let tab = null, idx = 0, prevOn = false;
  const orig = new Map();
  const restore = () => { for (const p of S.pages) { let ch = false; for (const a of p.annots) if (orig.has(a.id)) { a.text = orig.get(a.id); ch = true; } if (ch) drawAnnots(p); } orig.clear(); prevOn = false; };
  const preview = () => {
    if (!tab) return; restore(); prevOn = true;
    const row = tab.rows[idx];
    for (const p of S.pages) { let ch = false; for (const a of p.annots) if ((a.t === 'text' || a.t === 'note') && a.text && PH.test(a.text)) { PH.lastIndex = 0; orig.set(a.id, a.text); a.text = mmFill(a.text, row); ch = true; } PH.lastIndex = 0; if (ch) drawAnnots(p); }
  };
  const fieldNames = () => { const out = []; for (const f of S.forms.values()) for (const x of (f.fields || f || [])) if (x && x.name) out.push(x.name); return out; };
  const render = () => {
    const ph = mmPlaceholders(), fn = (() => { try { return fieldNames(); } catch (e) { return []; } })();
    const cols = tab ? tab.cols : [];
    const miss = ph.filter(p => !cols.some(c => c.toLowerCase() === p.toLowerCase()));
    const fMatch = fn.filter(n => cols.some(c => c.toLowerCase() === n.toLowerCase()));
    $('#dlgBody').innerHTML = `<p class="note" style="margin:0">Platzhalter wie <code>{Name}</code> in Textfeldern werden pro Zeile einer Tabelle (CSV oder Excel) ersetzt. Formularfelder mit gleichem Namen wie eine Spalte werden ebenfalls ausgefüllt.</p>
      <div class="row2"><button type="button" class="btn" data-mm="file">${icon('open')}${tab ? 'Andere Tabelle …' : 'Tabelle wählen (CSV, Excel) …'}</button>${tab ? `<span class="note">${esc(tab.name)}: ${tab.rows.length} Zeilen, ${cols.length} Spalten</span>` : ''}</div>
      ${tab ? `<div class="mmcols">${cols.map(c => `<button type="button" class="chip" data-ins="${esc(c)}" title="Als Platzhalter auf der aktuellen Seite einfügen">{${esc(c)}}</button>`).join('')}</div><p class="note" style="margin:2px 0 0">Spalte antippen fügt den Platzhalter auf der aktuellen Seite ein. Danach an die richtige Stelle ziehen.</p>` : ''}
      <p class="note">${ph.length ? `Im Dokument: ${ph.map(p => `<code${miss.includes(p) ? ' class="bad"' : ''}>{${esc(p)}}</code>`).join(' ')}${miss.length && tab ? ` – <b>${miss.length} ohne passende Spalte</b>` : ''}` : 'Noch keine Platzhalter im Dokument.'}${fMatch.length ? ` · Formularfelder: ${fMatch.map(esc).join(', ')}` : ''}</p>
      ${tab ? `<div class="mmnav"><label class="chkrow"><input type="checkbox" id="mmPrev" ${prevOn ? 'checked' : ''}> Vorschau im Dokument</label><button type="button" class="ibtn" data-mm="prev">‹</button><span>${idx + 1} / ${tab.rows.length}</span><button type="button" class="ibtn" data-mm="next">›</button><span class="note">${esc(Object.values(tab.rows[idx]).slice(0, 3).join(' · '))}</span></div>
      <div class="frow"><label class="fld"><span>Ergebnis</span><select class="field" id="mmOut"><option value="one">Eine PDF mit allen Briefen</option><option value="zip">Eine PDF je Zeile (ZIP)</option></select></label>
      <label class="fld"><span>Dateiname je Zeile</span><input class="field" id="mmName" value="${esc(lsGet('pdfwb.mmname') || `${baseName()} {${cols[0]}}`)}"></label></div>` : ''}`;
  };
  dialog('Serienbrief', '', 'Erstellen', () => {
    if (!tab) { toast('Bitte zuerst eine Tabelle wählen.'); return false; }
    const wasPrev = prevOn; restore();
    if (!mmPlaceholders().length && !(() => { try { return fieldNames().length; } catch (e) { return 0; } })()) { toast('Im Dokument gibt es noch keine Platzhalter.'); if (wasPrev) preview(); return false; }
    const out = $('#mmOut').value, pat = $('#mmName').value.trim() || baseName();
    lsSet('pdfwb.mmname', pat); restore(); closeDlg();
    mailMergeRun(tab, out, pat); return false;
  });
  $('#dlg .card').classList.add('wide');
  const cancel = $('#dlgCancel'), oldCancel = cancel.onclick; cancel.onclick = () => { restore(); oldCancel(); };
  render();
  $('#dlgBody').onchange = e => { if (e.target.id === 'mmPrev') { if (e.target.checked) preview(); else restore(); } };
  $('#dlgBody').onclick = async e => {
    const ins = e.target.closest('[data-ins]');
    if (ins) { const was = prevOn; restore(); insertTextAnnot(`{${ins.dataset.ins}}`); if (was) preview(); render(); return; }
    const x = e.target.closest('[data-mm]'); if (!x) return;
    if (x.dataset.mm === 'file') {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { const t = await WBConvert.readTable(f); tab = { ...t, name: f.name }; idx = 0; render(); } catch (er) { toast(er.message || String(er)); } };
      inp.click();
    } else if (x.dataset.mm === 'prev' || x.dataset.mm === 'next') { idx = (idx + (x.dataset.mm === 'next' ? 1 : -1) + tab.rows.length) % tab.rows.length; if (prevOn) preview(); render(); }
  };
}
async function mailMergeRun(tab, out, pat) {
  const rows = tab.rows.filter(r => Object.values(r).some(v => String(v).trim()));
  const list = [], fv0 = S.formVals;
  busy(true, 'Serienbrief wird erstellt …');
  try {
    for (let i = 0; i < rows.length; i++) {
      setMsg(`Brief ${i + 1} von ${rows.length} …`, true);
      const row = rows[i];
      const pages = S.pages.map(p => ({ ...p, annots: p.annots.map(a => ((a.t === 'text' || a.t === 'note') && a.text && /\{/.test(a.text) ? { ...a, text: mmFill(a.text, row) } : a)) }));
      const fv = {}; for (const [k, v] of Object.entries(fv0 || {})) fv[k] = typeof v === 'string' ? mmFill(v, row) : v;
      for (const c of tab.cols) for (const f of S.forms.values()) for (const x of (f.fields || f || [])) if (x && x.name && x.name.toLowerCase() === c.toLowerCase()) fv[x.name] = row[c];
      S.formVals = fv;
      let bytes; try { bytes = await buildPdf(pages); } finally { S.formVals = fv0; }
      list.push({ name: cleanFile(mmFill(pat, row)) || `Brief ${i + 1}`, bytes });
    }
    if (out === 'one') { const all = await WBTools.merge(list.map(l => l.bytes)); busy(false); await saveBytes(all, `${baseName()} – Serienbrief.pdf`); }
    else { const used = new Set(); const z = await WBFile.zip(list.map(l => { let n = l.name + '.pdf', k = 2; while (used.has(n)) n = `${l.name} (${k++}).pdf`; used.add(n); return { name: n, bytes: l.bytes }; })).arrayBuffer(); busy(false); dlTo(new Uint8Array(z), `${baseName()} – Serienbrief.zip`, 'application/zip'); }
    toast(`${list.length} Briefe erstellt`);
  } catch (e) { busy(false); S.formVals = fv0; console.error(e); toast('Serienbrief fehlgeschlagen: ' + (e.message || e)); }
}

/* ---------- 8. Belege scannen ---------- */
const RCATS = ['Büromaterial', 'Hardware', 'Software und Dienste', 'Telefon und Internet', 'Fahrtkosten', 'Reisekosten', 'Bewirtung', 'Porto', 'Fortbildung und Bücher', 'Werbung', 'Lebensmittel und Drogerie', 'Miete und Nebenkosten', 'Versicherung', 'Sonstiges'];
const eur2 = n => (n == null || n === '' || isNaN(n) ? '' : (+n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pEur = s => { if (s == null) return null; const v = window.WBScan ? WBScan.amt(String(s)) : parseFloat(String(s).replace(',', '.')); return v == null || isNaN(v) ? null : v; };
async function receiptRecognize(canvas, text) {
  if (aiReady()) {
    try {
      const out = await AIX.ask({ instructions: `Du liest Kassenbons und Rechnungen. Antworte NUR mit JSON: {"merchant":"Händler","date":"TT.MM.JJJJ","total":Bruttobetrag als Zahl,"vatRate":19 oder 7 oder 0,"vat":Steuerbetrag als Zahl,"no":"Beleg- oder Rechnungsnummer","pay":"bar" oder "Karte" oder "Überweisung" oder "","cat":eine von ${JSON.stringify(RCATS)}}. Unbekanntes leer lassen.`, messages: [{ role: 'user', text: text ? 'Belegtext:\n' + text.slice(0, 6000) : 'Beleg:', images: canvas ? [canvas.toDataURL('image/jpeg', 0.85)] : [] }], maxTokens: 400 });
      const j = aiJson(out, false);
      return { merchant: String(j.merchant || ''), date: String(j.date || ''), total: pEur(j.total), vatRate: j.vatRate === '' || j.vatRate == null ? null : +j.vatRate, vat: pEur(j.vat), no: String(j.no || ''), pay: String(j.pay || ''), cat: RCATS.includes(j.cat) ? j.cat : 'Sonstiges', via: 'KI' };
    } catch (e) { /* weiter ohne KI */ }
  }
  if (!text && canvas && window.WBTools) { try { text = (await Promise.race([WBTools.recognizeImage(canvas, 'deu'), new Promise((r, j) => setTimeout(() => j(new Error('Zeitüberschreitung')), 90000))])).text; } catch (e) { text = ''; } }
  return { ...WBScan.receipt(text || ''), via: 'Texterkennung' };
}
async function receiptsAdd(files, check) {
  const { PDFDocument } = PL;
  const recs = [], pdfParts = [];
  busy(true, 'Belege werden aufbereitet …');
  try {
    let k = 0;
    for (const f of files) {
      k++; setMsg(`Beleg ${k} von ${files.length} …`, true);
      if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const pdf = await PDFJS.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const pg = await pdf.getPage(i), tc = await pg.getTextContent();
          const text = tc.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('');
          let c = null;
          if (text.replace(/\s/g, '').length < 30 || aiReady()) { const vp = pg.getViewport({ scale: 1600 / Math.max(pg.view[2], pg.view[3]) }); c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: cx, viewport: vp }).promise; }
          recs.push(await receiptRecognize(c, text.replace(/\s/g, '').length >= 30 ? text : ''));
        }
        pdf.destroy(); pdfParts.push(bytes);
      } else {
        const src = await WBScan.load(f);
        let { corners } = WBScan.findCorners(src);
        if (check) { busy(false); const c2 = await WBScan.editCorners(src, corners); busy(true, 'Belege werden aufbereitet …'); if (c2) corners = c2; }
        const flat = WBScan.enhance(WBScan.warp(src, corners), 'gray');
        recs.push(await receiptRecognize(flat, ''));
        const d = await PDFDocument.create(), jpg = await d.embedJpg(await (await new Promise(r => flat.toBlob(r, 'image/jpeg', 0.82))).arrayBuffer());
        const W = Math.min(595.28, flat.width * 0.75), H = W * flat.height / flat.width;
        d.addPage([W, H]).drawImage(jpg, { x: 0, y: 0, width: W, height: H });
        pdfParts.push(await d.save());
      }
    }
    const merged = pdfParts.length === 1 ? pdfParts[0] : await WBTools.merge(pdfParts);
    busy(false);
    let newPages;
    if (S.sample || !S.pages.length) {
      const d = new Date(), nm = `Belege ${d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}.pdf`;
      await openFiles([new File([merged], nm, { type: 'application/pdf' })], 'replace', true);
      newPages = S.pages.slice();
    } else {
      const keep = S.cur; S.cur = S.pages.length - 1;
      const n = await insertPdfBytes(merged, 'Belege.pdf'); newPages = S.pages.slice(S.pages.length - n); S.cur = keep;
    }
    S.receipts = [...(S.receipts || []), ...recs.map((r, i) => ({ id: uid('r'), pid: newPages[i] ? newPages[i].id : null, ...r, total: r.total, at: Date.now() }))];
    markDirty();
    toast(`${recs.length} ${recs.length === 1 ? 'Beleg' : 'Belege'} erfasst${recs.some(r => r.via === 'Texterkennung') && !aiReady() ? ' (mit KI wird die Erkennung genauer)' : ''}`);
  } catch (e) { busy(false); console.error(e); toast('Belege konnten nicht verarbeitet werden: ' + (e.message || e)); }
}
function receiptsDialog() {
  if (!window.WBScan) return;
  commitEdit();
  const list = () => (S.receipts || []).filter(r => !r.pid || pageById(r.pid));
  const render = () => {
    const L = list(), sum = L.reduce((s, r) => s + (+r.total || 0), 0), vat = L.reduce((s, r) => s + (+r.vat || 0), 0);
    const byCat = {}; L.forEach(r => { byCat[r.cat || 'Sonstiges'] = (byCat[r.cat || 'Sonstiges'] || 0) + (+r.total || 0); });
    $('#dlgBody').innerHTML = `<p class="note" style="margin:0">Fotografiere Kassenbons und Rechnungen oder wähle Bilder und PDFs. Der Beleg wird zugeschnitten, entzerrt und als Seite abgelegt; Betrag, Datum und Händler werden erkannt.</p>
      <div class="row2"><button type="button" class="btn primary" data-rc="cam">${icon('image')}Kamera / Bilder …</button><button type="button" class="btn" data-rc="files">PDF-Belege …</button><label class="chkrow"><input type="checkbox" id="rcCheck" ${lsGet('pdfwb.rccheck') === '1' ? 'checked' : ''}> Ecken jedes Fotos prüfen</label></div>
      ${L.length ? `<div class="rctab"><table><thead><tr><th>S.</th><th>Datum</th><th>Händler</th><th>Kategorie</th><th class="r">Betrag €</th><th class="r">USt €</th><th>Zahlung</th><th></th></tr></thead><tbody>${L.map(r => `<tr data-r="${r.id}"><td><button type="button" class="lnk" data-pg="${r.pid || ''}">${r.pid ? pageNo(r.pid) : '–'}</button></td><td><input data-f="date" value="${esc(r.date || '')}" placeholder="TT.MM.JJJJ" size="10"></td><td><input data-f="merchant" value="${esc(r.merchant || '')}"></td><td><select data-f="cat">${RCATS.map(c => `<option ${c === r.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></td><td class="r"><input data-f="total" value="${eur2(r.total)}" size="8" inputmode="decimal" class="${r.total == null ? 'bad' : ''}"></td><td class="r"><input data-f="vat" value="${eur2(r.vat)}" size="6" inputmode="decimal"></td><td><select data-f="pay">${['', 'bar', 'Karte', 'Überweisung', 'PayPal'].map(c => `<option ${c === r.pay ? 'selected' : ''}>${c}</option>`).join('')}</select></td><td><button type="button" class="ibtn" data-del="${r.id}" title="Aus der Liste entfernen">✕</button></td></tr>`).join('')}</tbody>
        <tfoot><tr><td></td><td colspan="3"><b>${L.length} Belege</b></td><td class="r"><b>${eur2(sum)}</b></td><td class="r">${eur2(vat)}</td><td colspan="2"></td></tr></tfoot></table></div>
        <p class="note">${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)}: ${eur2(v)} €`).join(' · ')}</p>
        <div class="row2"><button type="button" class="btn" data-rc="csv">${icon('save')}Für Buchhaltung (CSV)</button><span class="note">Spalten wie in DATEV und Steuerprogrammen üblich, mit Seitenverweis auf den Beleg in dieser PDF.</span></div>` : '<p class="note">Noch keine Belege in diesem Dokument.</p>'}`;
  };
  dialog('Belege', '', 'Fertig', () => true);
  $('#dlgCancel').hidden = true; $('#dlg .card').classList.add('wide');
  render();
  const b = $('#dlgBody');
  b.onchange = e => {
    if (e.target.id === 'rcCheck') { lsSet('pdfwb.rccheck', e.target.checked ? '1' : '0'); return; }
    const tr = e.target.closest('[data-r]'), f = e.target.dataset.f; if (!tr || !f) return;
    const r = S.receipts.find(x => x.id === tr.dataset.r); if (!r) return;
    r[f] = f === 'total' || f === 'vat' ? pEur(e.target.value) : e.target.value; markDirty();
    if (f === 'total' || f === 'vat') render();
  };
  b.onclick = e => {
    const pg = e.target.closest('[data-pg]'); if (pg && pg.dataset.pg) { closeDlg(); scrollToPage(pageNo(pg.dataset.pg) - 1); return; }
    const del = e.target.closest('[data-del]'); if (del) { S.receipts = S.receipts.filter(r => r.id !== del.dataset.del); markDirty(); render(); return; }
    const x = e.target.closest('[data-rc]'); if (!x) return;
    if (x.dataset.rc === 'cam' || x.dataset.rc === 'files') {
      const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = x.dataset.rc === 'cam' ? 'image/*' : 'application/pdf,.pdf';
      if (x.dataset.rc === 'cam' && COARSE) inp.capture = 'environment';
      inp.onchange = async () => { const fs = [...inp.files]; if (!fs.length) return; closeDlg(); await receiptsAdd(fs, $('#rcCheck') ? lsGet('pdfwb.rccheck') === '1' : false); receiptsDialog(); };
      inp.click();
    } else if (x.dataset.rc === 'csv') {
      const L = list(), f2 = n => (n == null || isNaN(n) ? '' : (+n).toFixed(2).replace('.', ','));
      const rows = [['Belegdatum', 'Belegnummer', 'Händler', 'Kategorie', 'Brutto', 'USt-Satz', 'USt', 'Netto', 'Zahlungsart', 'Seite in PDF', 'Datei'], ...L.map(r => [r.date, r.no || '', r.merchant, r.cat, f2(r.total), r.vatRate != null ? r.vatRate + ' %' : '', f2(r.vat), r.total != null ? f2((+r.total) - (+r.vat || 0)) : '', r.pay || '', r.pid ? pageNo(r.pid) : '', S.docName])];
      dlTo(new TextEncoder().encode('﻿' + rows.map(r => r.map(c => /[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(';')).join('\r\n')), `${baseName()} – Belege.csv`, 'text/csv');
    }
  };
}

/* ---------- 9. Stapelverarbeitung ---------- */
function batchOpen() {
  if (!window.WBBatch) return;
  WBBatch.open({ pick: true, title: 'Stapelverarbeitung', saveLabel: 'In die Bibliothek', onSave: LIB ? async rs => { for (const r of rs) await LIB.importPdf(r.bytes, r.name.replace(/\.pdf$/i, ''), (S.lib && S.lib.folder) || null, {}); toast(`${rs.length} Dateien in der Bibliothek gespeichert`); } : null });
}

/* ---------- 10. PDF/A und Barrierefreiheit ---------- */
async function pdfaDialog() {
  if (!window.WBPdfA) return;
  commitEdit();
  busy(true, 'PDF wird geprüft …');
  let bytes, pf;
  try { bytes = await buildPdf(S.pages); pf = await WBPdfA.preflight(bytes); busy(false); }
  catch (e) { busy(false); toast('Prüfung fehlgeschlagen: ' + (e.message || e)); return; }
  const fix = pf.fonts.filter(f => f.fixable), bad = pf.fonts.filter(f => !f.embedded && !f.fixable);
  dialog('Als PDF/A speichern', `<p class="note" style="margin:0">PDF/A ist das Archivformat für Behörden, Gerichte, Hochschulen und die Steuer: alle Schriften eingebettet, festes Farbprofil, keine aktiven Inhalte.</p>
    <ul class="a11y">
      <li class="ok">Farbprofil (sRGB) und Metadaten werden ergänzt</li>
      ${fix.length ? `<li class="ok">${fix.length} Standardschrift${fix.length === 1 ? '' : 'en'} (${esc(fix.map(f => f.name).join(', '))}) werden durch maßgleiche freie Schriften ersetzt und eingebettet</li>` : '<li class="ok">Alle Schriften sind eingebettet</li>'}
      ${bad.length ? `<li class="bad">Nicht einbettbar: ${esc(bad.map(f => f.name).join(', '))}. Prüfprogramme werden das bemängeln. Abhilfe: die Seiten neu „drucken“ oder als Bild einfügen.</li>` : ''}
      ${pf.js ? '<li class="warn">JavaScript wird entfernt</li>' : ''}${pf.cmyk ? '<li class="warn">CMYK-Farben ohne Profil gefunden</li>' : ''}${pf.attachments ? '<li class="warn">Anhänge vorhanden: es wird PDF/A-3 statt PDF/A-2</li>' : ''}
    </ul>
    <div class="frow"><label class="fld"><span>Titel</span><input class="field" id="paTitle" value="${esc(S.meta.title || baseName())}"></label><label class="fld"><span>Autor</span><input class="field" id="paAuthor" value="${esc(S.meta.author || '')}"></label>
    <label class="fld"><span>Sprache</span><select class="field" id="paLang">${[['de-DE', 'Deutsch'], ['en-US', 'Englisch'], ['fr-FR', 'Französisch'], ['es-ES', 'Spanisch']].map(([k, l]) => `<option value="${k}" ${(S.meta.lang || 'de-DE') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>`, 'PDF/A speichern', b => {
    const o = { title: $('#paTitle', b).value.trim(), author: $('#paAuthor', b).value.trim(), lang: $('#paLang', b).value, subject: S.meta.subject || '', keywords: S.meta.keywords || '' };
    closeDlg();
    (async () => {
      busy(true, 'PDF/A wird erstellt …');
      try { const r = await WBPdfA.make(bytes, o); busy(false); await saveBytes(r.bytes, `${baseName()} (PDF-A).pdf`); toast(`Als PDF/A-${r.part}b gespeichert${r.issues.length ? ' – Hinweise: ' + r.issues.join(' ') : ''}`); }
      catch (e) { busy(false); console.error(e); toast('PDF/A fehlgeschlagen: ' + (e.message || e)); }
    })();
    return false;
  });
}
const lum = hex => { const h = String(hex || '#000').replace('#', ''), c = [0, 2, 4].map(i => parseInt(h.length === 3 ? h[i / 2] + h[i / 2] : h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b = '#ffffff') => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
async function a11yDialog() {
  commitEdit();
  busy(true, 'Barrierefreiheit wird geprüft …');
  const items = [];
  try {
    const bytes = await buildPdf(S.pages);
    const pdf = await PDFJS.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    let noText = [];
    for (let i = 1; i <= pdf.numPages; i++) { const tc = await (await pdf.getPage(i)).getTextContent(); if (tc.items.reduce((s, it) => s + it.str.replace(/\s/g, '').length, 0) < 20) noText.push(i); }
    let tagged = false; try { const mi = await pdf.getMarkInfo(); tagged = !!(mi && mi.Marked); } catch (e) { tagged = false; }
    let tree = false; try { tree = !!(await (await pdf.getPage(1)).getStructTree()); } catch (e) { tree = false; }
    const doc = await PL.PDFDocument.load(bytes, { updateMetadata: false }), N = PL.PDFName.of;
    let fieldsNoTip = 0, fields = 0; try { for (const f of doc.getForm().getFields()) { fields++; if (!f.acroField.dict.get(N('TU'))) fieldsNoTip++; } } catch (e) { /* kein Formular */ }
    let noUni = new Set(); for (const [, o] of doc.context.enumerateIndirectObjects()) { if (o instanceof PL.PDFDict && o.get(N('Type')) === N('Font') && o.get(N('Subtype')) === N('Type0') && !o.get(N('ToUnicode'))) noUni.add(String(o.get(N('BaseFont'))).replace(/^\/([A-Z]{6}\+)?/, '')); }
    pdf.destroy();
    const lowC = []; S.pages.forEach(p => p.annots.forEach(a => { if (a.t === 'text' && a.text && contrast(a.color || '#000') < 4.5) lowC.push(a); }));
    items.push({ ok: !!S.meta.title, t: 'Dokumenttitel', d: S.meta.title ? `„${S.meta.title}“ (wird statt des Dateinamens angezeigt)` : 'Screenreader lesen sonst nur den Dateinamen vor.', fix: 'meta' });
    items.push({ ok: !!S.meta.lang, t: 'Sprache', d: S.meta.lang ? S.meta.lang : 'Ohne Sprachangabe liest der Screenreader eventuell mit falscher Aussprache vor.', fix: 'meta' });
    items.push({ ok: !noText.length, t: 'Text lesbar', d: noText.length ? `Seite${noText.length > 1 ? 'n' : ''} ${noText.slice(0, 12).join(', ')}${noText.length > 12 ? ' …' : ''} ohne Text (Scan oder Bild).` : 'Alle Seiten enthalten echten Text.', fix: noText.length && window.WBTools ? 'ocr' : '' });
    items.push({ ok: S.pages.length < 8 || S.bookmarks.length > 0, t: 'Lesezeichen', d: S.bookmarks.length ? `${S.bookmarks.length} Einträge auf oberster Ebene` : S.pages.length < 8 ? 'bei kurzen Dokumenten nicht nötig' : 'Längere Dokumente brauchen eine Gliederung zum Springen.', fix: S.bookmarks.length || S.pages.length < 8 ? '' : 'toc' });
    items.push({ ok: tagged && tree, warn: !(tagged && tree), t: 'Struktur (Tags)', d: tagged && tree ? 'Das Dokument ist getaggt.' : 'Nicht getaggt: Überschriften, Listen und Tabellen sind für Screenreader nicht ausgezeichnet. Für volle Barrierefreiheit (PDF/UA) das Original in Word oder LibreOffice als „barrierefreies PDF“ exportieren.' });
    if (fields) items.push({ ok: !fieldsNoTip, warn: true, t: 'Formularfelder', d: fieldsNoTip ? `${fieldsNoTip} von ${fields} Feldern ohne Beschreibung (Tooltip).` : 'Alle Felder haben eine Beschreibung.' });
    items.push({ ok: !noUni.size, t: 'Text kopier- und vorlesbar', d: noUni.size ? `Schriften ohne Unicode-Zuordnung: ${[...noUni].slice(0, 4).join(', ')} – Text kann falsch vorgelesen werden. Abhilfe: Texterkennung.` : 'Alle Schriften haben eine Unicode-Zuordnung.' });
    items.push({ ok: !lowC.length, t: 'Kontrast eigener Texte', d: lowC.length ? `${lowC.length} Textfeld${lowC.length > 1 ? 'er' : ''} mit zu wenig Kontrast (unter 4,5 : 1).` : 'Ausreichend (mindestens 4,5 : 1).', fix: lowC.length ? 'contrast' : '' });
    busy(false);
  } catch (e) { busy(false); console.error(e); toast('Prüfung fehlgeschlagen: ' + (e.message || e)); return; }
  const okN = items.filter(i => i.ok).length;
  dialog('Barrierefreiheit prüfen', `<p class="note" style="margin:0"><b>${okN} von ${items.length}</b> Prüfpunkten erfüllt. Geprüft wird die PDF so, wie sie gespeichert wird.</p>
    <ul class="a11y">${items.map(i => `<li class="${i.ok ? 'ok' : i.warn ? 'warn' : 'bad'}"><b>${i.t}</b><span>${esc(i.d)}</span>${i.fix ? `<button type="button" class="btn sm" data-af="${i.fix}">${{ meta: 'Festlegen', ocr: 'Texterkennung', toc: 'Lesezeichen erzeugen', contrast: 'Farben abdunkeln' }[i.fix]}</button>` : ''}</li>`).join('')}</ul>
    <div class="frow" id="afMeta" hidden><label class="fld"><span>Titel</span><input class="field" id="afTitle" value="${esc(S.meta.title || baseName())}"></label><label class="fld"><span>Sprache</span><select class="field" id="afLang">${[['de-DE', 'Deutsch'], ['en-US', 'Englisch'], ['fr-FR', 'Französisch'], ['es-ES', 'Spanisch']].map(([k, l]) => `<option value="${k}" ${(S.meta.lang || 'de-DE') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>`, 'Fertig', b => {
    if (!$('#afMeta', b).hidden) { const t = $('#afTitle', b).value.trim(), l = $('#afLang', b).value; if (t !== S.meta.title || l !== S.meta.lang) { S.meta = { ...S.meta, title: t, lang: l }; markDirty(); toast('Titel und Sprache gespeichert'); } }
  });
  $('#dlgCancel').hidden = true; $('#dlg .card').classList.add('wide');
  $('#dlgBody').onclick = e => {
    const x = e.target.closest('[data-af]'); if (!x) return; const k = x.dataset.af;
    if (k === 'meta') { $('#afMeta').hidden = false; $('#afTitle').focus(); }
    else if (k === 'ocr') { closeDlg(); ACTS_REF.ocr && ACTS_REF.ocr(); }
    else if (k === 'toc') { closeDlg(); autoTocDialog(); }
    else if (k === 'contrast') {
      pushHist(); let n = 0;
      for (const p of S.pages) { let ch = false; for (const a of p.annots) if (a.t === 'text' && a.text && contrast(a.color || '#000') < 4.5) { let c = a.color || '#000000'; for (let s = 0; s < 20 && contrast(c) < 4.5; s++) c = '#' + [1, 3, 5].map(i => Math.round(parseInt(c.slice(i, i + 2), 16) * 0.85).toString(16).padStart(2, '0')).join(''); a.color = c; ch = true; n++; } if (ch) drawAnnots(p); }
      markDirty(); x.closest('li').className = 'ok'; x.remove(); toast(`${n} Textfarben abgedunkelt`);
    }
  };
}

