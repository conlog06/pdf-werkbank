/* ---------- Schnellleiste an markiertem Text und eigenen Textfeldern ---------- */
const QCOLORS = ['#ffd400', '#7ee081', '#ff8fb1', '#8ecbff'];
function qbarFor(p) {
  if (S.tool !== 'select' && !(S.qbar && S.qbar.pid === p.id)) return null;
  const a = S.qbar && S.qbar.pid === p.id ? p.annots.find(x => x.id === S.qbar.aid) : (S.sel && S.sel.pid === p.id && !S.editing ? selAnnot() : null);
  if (!a || !(a.t === 'mark' || (a.t === 'text' && a.text))) return null;
  return a;
}
function drawQbar(p, e) {
  const old = $('.qbar', e.wrap); if (old) old.remove();
  const a = qbarFor(p); if (!a || drag) return;
  const b = bbox(a), z = S.zoom, q = document.createElement('div'); q.className = 'qbar'; q.dataset.aid = a.id;
  q.style.left = clamp((b.x + b.w / 2) * z, 120, e.wrap.clientWidth - 120) + 'px';
  q.style.top = Math.max(44, b.y * z) + 'px';
  const kiBtns = AIX ? `<span class="qs"></span><button data-qa="explain" title="Mit KI erklären">${icon('spark')}Erklären</button><button data-qa="translate" title="Mit KI übersetzen">${icon('translate')}</button>` : '';
  q.innerHTML = a.t === 'mark'
    ? QCOLORS.map(c => `<button class="qc" data-qc="${c}" style="background:${c}" title="Farbe" aria-label="Farbe ${c}"></button>`).join('') + `<span class="qs"></span><button data-qa="comment" title="Kommentar">${icon('comment')}</button><button data-qa="copy" title="Text kopieren">${icon('copy')}</button>${window.WBCite ? `<button data-qa="cite" title="Zitieren (mit Quelle und Seite)">${icon('quote')}</button>` : ''}${kiBtns}<span class="qs"></span><button data-qa="del" title="Entfernen">${icon('trash')}</button>`
    : `<button data-qa="copy" title="Text kopieren">${icon('copy')}</button>${AIX ? `<button data-qa="fix" title="Rechtschreibung mit KI korrigieren">${icon('spark')}Korrigieren</button><button data-qa="translate" title="Mit KI übersetzen">${icon('translate')}</button>` : ''}<span class="qs"></span><button data-qa="del" title="Löschen">${icon('trash')}</button>`;
  e.wrap.appendChild(q);
}
function bindQbar() {
  pagesEl.addEventListener('pointerdown', e => {
    if (e.target.closest('.qbar')) { e.stopPropagation(); return; }
    if (S.qbar) { const p = pageById(S.qbar.pid); S.qbar = null; if (p) setTimeout(() => drawAnnots(p), 0); }
  }, true);
  pagesEl.addEventListener('click', e => {
    const q = e.target.closest('.qbar'); if (!q) return;
    const wrap = q.closest('.page'), p = pageById(wrap.dataset.id), a = p && p.annots.find(x => x.id === q.dataset.aid); if (!a) return;
    const c = e.target.closest('[data-qc]');
    if (c) { pushHist(); a.color = c.dataset.qc; if (a.kind === 'hl' && !a.op) a.op = 40; drawAnnots(p); markDirty(); return; }
    const b = e.target.closest('[data-qa]'); if (!b) return;
    const k = b.dataset.qa;
    if (k === 'copy') writeSysClip(a.text).then(ok => toast(ok ? 'Text kopiert' : 'Kopieren nicht möglich'));
    else if (k === 'comment') editComment(p, a);
    else if (k === 'del') { pushHist(); p.annots = p.annots.filter(x => x.id !== a.id); if (S.sel && S.sel.aid === a.id) S.sel = null; S.qbar = null; drawAnnots(p); markDirty(); renderProps(); }
    else if (k === 'fix') aiFixText(p, a);
    else if (k === 'cite') citeQuote(p, a);
    else aiForAnnot(p, a, k);
  });
}

/* ---------- Desktop: PDF direkt aus dem System bearbeiten (Standard-PDF-Programm) ----------
   Doppelklick auf eine PDF öffnet ein eigenes Fenster; Strg/⌘+S schreibt zurück in dieselbe Datei. */
const DESKF = window.wbDesktop || null;
const FILE_MODE = !!(DESKF && DESKF.onOpenPath && /[?&]file=1/.test(location.search));
const sessKey = () => (S.file ? 'session:file:' + S.file.path : 'session');
function fileUI() {
  document.body.classList.toggle('filemode', !!S.file);
  const sv = $('#btnSave'); if (!sv || !S.file) return;
  sv.title = 'In „' + S.file.name + '“ speichern (Strg/⌘+S)';
  const l = sv.querySelector('.lbl'); if (l) l.textContent = 'Speichern';
  const m = $('#mToLib'); if (m) m.hidden = !LIB;
}
function fileState() {
  if (!S.file || !DESKF.docState) return;
  DESKF.docState({ dirty: !!S.dirty, title: S.file.name + (S.dirty ? ' ●' : '') + ' – PDF Werkbank' });
}
let fileSaving = null;
async function saveToFile(as) {
  if (!S.file) return savePdf();
  commitEdit(); if (S.busy || !S.pages.length) return false;
  if (fileSaving) return fileSaving;
  fileSaving = (async () => {
    busy(true, as ? 'PDF wird erstellt …' : 'Wird gespeichert …');
    try {
      const isWb = /\.werkbank$/i.test(S.file.name);
      const bytes = isWb ? new Uint8Array(await (await werkbankBlob()).arrayBuffer()) : await buildPdf(S.pages);
      const r = as ? await DESKF.fileSaveAs(bytes, S.file.name) : await DESKF.fileWrite(bytes);
      busy(false);
      if (!r || !r.path) { toast('Speichern abgebrochen'); return false; }
      if (as) { S.file = { path: r.path, name: r.path.split(/[\\/]/).pop() }; S.docName = S.file.name; fileUI(); }
      S.dirty = false; updateTitle(); fileState();
      try { await idbDel(sessKey()); } catch (e) { /* egal */ }
      toast(as ? 'Gespeichert unter ' + r.path : 'Gespeichert' + (r.backup ? ' · Sicherheitskopie des Originals angelegt' : ''));
      return true;
    } catch (e) {
      busy(false); console.error(e);
      const msg = e && e.message || String(e);
      if (/schreibgeschützt|geöffnet|EPERM|EACCES|EBUSY/i.test(msg) && await ask('Datei lässt sich nicht überschreiben', msg + ' Stattdessen unter neuem Namen speichern?', 'Speichern unter …', 'Abbrechen')) return saveToFile(true);
      toast('Speichern fehlgeschlagen: ' + msg);
      return false;
    } finally { fileSaving = null; }
  })();
  return fileSaving;
}
async function openPathFile(f) {
  busy(false);
  const bytes = new Uint8Array(f.bytes);
  S.file = { path: f.path, name: f.name };
  // ungesicherte Änderungen nach einem Absturz?
  let sess = null;
  try { sess = await idbGet('session:file:' + f.path); } catch (e) { sess = null; }
  if (sess && sess.dirty && sess.pages && sess.pages.length && (!f.mtime || sess.savedAt > f.mtime)) {
    const when = new Date(sess.savedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
    if (await ask('Ungesicherte Änderungen wiederherstellen?', `„${f.name}“ wurde am ${when} nicht gespeichert (z. B. nach einem Absturz). Änderungen zurückholen?`, 'Wiederherstellen', 'Verwerfen', false)) {
      busy(true, 'Wird wiederhergestellt …');
      try {
        await applyState(sess, async id => { const s = await idbGet('src:' + id); if (s) savedSrc.add(id); return s; });
        S.docName = f.name; busy(false); updateTitle(); fileUI(); fileState(); setMsg('Änderungen wiederhergestellt · Strg/⌘+S speichert in die Datei');
        return;
      } catch (e) { busy(false); console.error(e); for (const id of [...S.sources.keys()]) dropSource(id); S.pages = []; }
    }
    try { await idbDel('session:file:' + f.path); } catch (e) { /* egal */ }
  }
  await openFiles([new File([bytes], f.name, { type: /\.werkbank$/i.test(f.name) ? 'application/x-pdf-werkbank' : 'application/pdf' })], 'replace', true);
  S.docName = f.name; S.dirty = false; S.sample = false; updateTitle(); fileUI(); fileState();
  setMsg('„' + f.name + '“ geöffnet · Strg/⌘+S speichert direkt in die Datei');
}
function bindFileMode() {
  if (!FILE_MODE) return false;
  DESKF.onOpenPath(f => { openPathFile(f).catch(e => { console.error(e); toast('Öffnen fehlgeschlagen: ' + (e.message || e)); }); });
  DESKF.onMenu && DESKF.onMenu(async k => {
    if (k === 'save-close') { if (await saveToFile()) DESKF.closeWindow(); }
    else if (k === 'save') saveToFile();
    else if (k === 'save-as') saveToFile(true);
  });
  $('#btnLib').hidden = false; $('#btnLib').title = 'Bibliothek öffnen';
  $('#btnLib').onclick = e => { e.preventDefault(); e.stopImmediatePropagation(); DESKF.openLibrary(); };
  const ob = $('#btnOpen'); if (ob) ob.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); DESKF.openDialog(); }, true);
  busy(true, 'PDF wird geöffnet …');
  setTimeout(() => DESKF.ready(), 0);
  return true;
}

/* ---------- Live-Graphen: Funktionsgraph als bearbeitbares Objekt auf der Seite ----------
   { t: 'graph', x, y, w, h, src: 'a = 1\nf(x) = a·x²', view: { x0, x1, y0, y1 }, deg } – Formeln, Regler und Ausschnitt
   bleiben bearbeitbar (Doppelklick), beim Export wird der Graph scharf als Bild eingebettet. */
const GCOL = ['#1f5fd6', '#d0342c', '#1e8a4c', '#8a3ffc', '#e07b00', '#0f8b8d'];
function graphEval(a) {
  if (!window.WBCalc) return { plots: [], vars: [], err: 'Rechner fehlt' };
  const st = { deg: !!a.deg, vars: new Map(), funcs: new Map() };
  const res = window.WBCalc.runAll(a.src || '', st, true);
  const plots = res.filter(r => r.plot).map(r => r.plot);
  const vars = res.filter(r => r.kind === 'assign' && /^\s*[A-Za-z]\w*\s*=\s*-?[\d.,]+\s*$/.test(r.src)).map(r => ({ name: r.src.split('=')[0].trim(), value: r.value }));
  const err = res.find(r => r.kind === 'error');
  return { plots, vars, err: err ? err.src + ': ' + err.text : '' };
}
function gStep(range, n) { const raw = range / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; }
const gTick = (v, st) => { const d = Math.max(0, -Math.floor(Math.log10(st))); return (Math.abs(v) < st / 1e6 ? 0 : v).toFixed(Math.min(d, 6)).replace('.', ',').replace('-', '−'); };
function graphSVG(a, forExport) {
  const { x, y, w, h } = a, v = a.view, ev = graphEval(a);
  const X = t => x + (t - v.x0) / (v.x1 - v.x0) * w, Y = t => y + h - (t - v.y0) / (v.y1 - v.y0) * h;
  const fs = Math.max(5.5, Math.min(9, Math.min(w, h) / 26)), cid = 'gc' + a.id;
  let out = `<g class="graph"><defs><clipPath id="${cid}"><rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}"/></clipPath></defs>`;
  out += `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="#ffffff" stroke="#c9ced8" stroke-width="0.8" rx="2"/>`;
  out += `<g clip-path="url(#${cid})">`;
  const sx = gStep(v.x1 - v.x0, Math.max(3, w / 55)), sy = gStep(v.y1 - v.y0, Math.max(3, h / 45));
  let grid = '', labels = '';
  const ax = v.y0 <= 0 && v.y1 >= 0 ? Y(0) : y + h - 1, ay = v.x0 <= 0 && v.x1 >= 0 ? X(0) : x + 1;
  for (let t = Math.ceil(v.x0 / sx) * sx; t <= v.x1 + 1e-9; t += sx) {
    const px = X(t); grid += `M${r2(px)} ${r2(y)}V${r2(y + h)}`;
    if (Math.abs(t) > sx / 1e6) labels += `<text x="${r2(px)}" y="${r2(Math.min(y + h - 2, ax + fs + 1))}" text-anchor="middle">${gTick(t, sx)}</text>`;
  }
  for (let t = Math.ceil(v.y0 / sy) * sy; t <= v.y1 + 1e-9; t += sy) {
    const py = Y(t); grid += `M${r2(x)} ${r2(py)}H${r2(x + w)}`;
    if (Math.abs(t) > sy / 1e6) labels += `<text x="${r2(Math.max(x + 2, ay - 2))}" y="${r2(py + fs * 0.35)}" text-anchor="${ay - 2 < x + 2 + fs ? 'start' : 'end'}">${gTick(t, sy)}</text>`;
  }
  out += `<path d="${grid}" stroke="#e6e9ef" stroke-width="0.5" fill="none"/>`;
  out += `<path d="M${r2(x)} ${r2(ax)}H${r2(x + w)}M${r2(ay)} ${r2(y)}V${r2(y + h)}" stroke="#5a6374" stroke-width="0.8" fill="none"/>`;
  out += `<g font-family='${FONTS.Helvetica.css}' font-size="${r2(fs)}" fill="#5a6374">${labels}</g>`;
  const n = Math.round(clamp(w * (forExport ? 3 : 1.4), 80, 1400));
  ev.plots.forEach((pl, i) => {
    let d = '', pen = false, prevY = null;
    for (let k = 0; k <= n; k++) {
      const t = v.x0 + (v.x1 - v.x0) * k / n;
      let yv; try { yv = pl.f(t); } catch (e) { yv = NaN; }
      if (!isFinite(yv) || (prevY !== null && Math.abs(yv - prevY) > (v.y1 - v.y0) * 4)) { pen = false; prevY = isFinite(yv) ? yv : null; continue; }
      const py = clamp(Y(yv), y - h * 2, y + h * 3);
      d += (pen ? 'L' : 'M') + r2(X(t)) + ' ' + r2(py); pen = true; prevY = yv;
    }
    if (d) out += `<path d="${d}" stroke="${GCOL[i % GCOL.length]}" stroke-width="${r2(Math.max(1, Math.min(w, h) / 160))}" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  out += '</g>';
  // Legende
  const leg = ev.plots.map((pl, i) => `<tspan fill="${GCOL[i % GCOL.length]}" x="${r2(x + 5)}" dy="${i ? r2(fs * 1.25) : 0}">${esc((pl.src || pl.name || '').replace(/\*/g, '·').slice(0, 40))}</tspan>`).join('');
  if (leg) out += `<text x="${r2(x + 5)}" y="${r2(y + fs + 3)}" font-family='${FONTS.Helvetica.css}' font-size="${r2(fs)}" font-weight="600">${leg}</text>`;
  if (ev.vars.length) out += `<text x="${r2(x + w - 5)}" y="${r2(y + fs + 3)}" text-anchor="end" font-family='${FONTS.Helvetica.css}' font-size="${r2(fs)}" fill="#5a6374">${esc(ev.vars.map(q => q.name + ' = ' + window.WBCalc.fmt(q.value, 4)).join('   '))}</text>`;
  if (ev.err && !forExport) out += `<text x="${r2(x + 5)}" y="${r2(y + h - 5)}" font-family='${FONTS.Helvetica.css}' font-size="${r2(fs)}" fill="#d0342c">${esc(ev.err.slice(0, 80))}</text>`;
  return out + '</g>';
}
/* Graph als PNG (für den PDF-Export) */
async function graphPNG(a, scale = 4) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(a.w * scale)}" height="${Math.round(a.h * scale)}" viewBox="${a.x} ${a.y} ${a.w} ${a.h}">${graphSVG(a, true)}</svg>`;
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  const c = document.createElement('canvas'); c.width = Math.round(a.w * scale); c.height = Math.round(a.h * scale);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
/* vor dem Export: Live-Graphen in Bilder umwandeln (auf Kopien der Seiten) */
async function pagesForExport(list) {
  const special = a => a.t === 'graph' || a.t === 'table';
  if (!list.some(p => p.annots.some(special))) return { pages: list, temp: [] };
  const temp = [];
  const pages = await Promise.all(list.map(async p => {
    if (!p.annots.some(special)) return p;
    const annots = await Promise.all(p.annots.map(async a => {
      if (a.t === 'table') return tableParts(a);
      if (a.t !== 'graph') return a;
      const id = registerImage(await graphPNG(a), 'png', a.w * 4, a.h * 4); temp.push(id);
      return { id: a.id, t: 'img', img: id, x: a.x, y: a.y, w: a.w, h: a.h };
    }));
    return { ...p, annots: annots.flat() };
  }));
  return { pages, temp };
}
function insertGraph(src, view, deg) {
  const p = S.pages[S.cur]; if (!p) return;
  const [W] = dims(p), [cx, cy] = viewCenter(p), w = Math.min(320, W * 0.6), h = w * 0.68;
  const v = view && isFinite(view.x0) ? { x0: view.x0, x1: view.x1, y0: view.y0, y1: view.y1 } : { x0: -5, x1: 5, y0: -4, y1: 4 };
  pushHist();
  const a = { id: uid(), t: 'graph', x: clamp(cx - w / 2, 0, W - w), y: Math.max(10, cy - h / 2), w, h, src, view: v, deg: !!deg };
  p.annots.push(a); drawAnnots(p); markDirty();
  setTool('select'); S.sel = { pid: p.id, aid: a.id }; drawAnnots(p); renderProps();
  toast('Live-Graph eingefügt · Doppelklick zum Bearbeiten');
  setTimeout(() => editGraph(p, a), 80);
}
/* Bearbeiten: Formeln, Regler für Variablen (a = 1 …) und Ausschnitt, Änderungen erscheinen sofort */
function editGraph(p, a) {
  closeGraphEditor();
  pushHist();
  const box = document.createElement('section'); box.className = 'gedit'; box.setAttribute('aria-label', 'Live-Graph bearbeiten');
  const num = v => window.WBCalc.fmt(v, 6);
  const render = () => {
    const ev = graphEval(a);
    $('.gsl', box).innerHTML = ev.vars.map(q => {
      const span = Math.max(1, Math.abs(q.value) * 2, 5);
      const min = q.lo != null ? q.lo : -span, max = q.hi != null ? q.hi : span;
      return `<label class="gsrow"><b>${esc(q.name)}</b><input type="range" min="${Math.min(min, q.value)}" max="${Math.max(max, q.value)}" step="${gStep(max - min, 100) / 2}" value="${q.value}" data-var="${esc(q.name)}"><output>${esc(num(q.value))}</output></label>`;
    }).join('') || '<p class="note" style="margin:0">Tipp: „a = 1“ als Zeile anlegen und in der Formel verwenden – dann erscheint hier ein Regler.</p>';
    $('.gerr', box).textContent = ev.err || '';
  };
  const redraw = () => { drawAnnots(p); markDirty(); };
  box.innerHTML = `<header><i data-i="calc"></i><b>Live-Graph</b><span class="grow"></span><button class="ibtn" data-g="close" aria-label="Fertig">${icon('close')}</button></header>
    <textarea class="field gsrc" rows="4" spellcheck="false" aria-label="Formeln, eine je Zeile">${esc(a.src)}</textarea>
    <p class="gerr"></p><div class="gsl"></div>
    <div class="grange"><label>x von <input class="field" data-r="x0" value="${num(a.view.x0)}"></label><label>bis <input class="field" data-r="x1" value="${num(a.view.x1)}"></label>
      <label>y von <input class="field" data-r="y0" value="${num(a.view.y0)}"></label><label>bis <input class="field" data-r="y1" value="${num(a.view.y1)}"></label></div>
    <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" data-g="auto">y automatisch</button><button class="btn" data-g="std">Standard-Ausschnitt</button><button class="btn" data-g="deg" aria-pressed="${!!a.deg}">${a.deg ? 'Grad' : 'Bogenmaß'}</button><span class="grow"></span><button class="btn primary" data-g="close">Fertig</button></div>`;
  document.body.appendChild(box);
  box.querySelector('[data-i]').outerHTML = icon('calc');
  const r = els.get(p.id).wrap.getBoundingClientRect(), z = S.zoom;
  if (innerWidth > 760) { box.style.left = clamp(r.left + (a.x + a.w) * z + 12, 8, innerWidth - 340) + 'px'; box.style.top = clamp(r.top + a.y * z, 70, innerHeight - 420) + 'px'; }
  render();
  let t = 0;
  $('.gsrc', box).addEventListener('input', e => { a.src = e.target.value; clearTimeout(t); t = setTimeout(() => { render(); redraw(); }, 120); });
  $('.gsrc', box).addEventListener('keydown', e => e.stopPropagation());
  box.addEventListener('input', e => {
    const s = e.target.closest('[data-var]');
    if (s) {
      const name = s.dataset.var, val = +s.value;
      a.src = a.src.split('\n').map(l => (new RegExp('^\\s*' + name + '\\s*=\\s*-?[\\d.,]+\\s*$').test(l) ? `${name} = ${num(val)}` : l)).join('\n');
      $('.gsrc', box).value = a.src; s.nextElementSibling.textContent = num(val);
      redraw(); return;
    }
    const rr = e.target.closest('[data-r]');
    if (rr) { const v = parseFloat(rr.value.replace(',', '.').replace('−', '-')); if (isFinite(v)) { a.view[rr.dataset.r] = v; if (a.view.x1 > a.view.x0 && a.view.y1 > a.view.y0) redraw(); } }
  });
  box.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') closeGraphEditor(); });
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const k = b.dataset.g;
    if (k === 'close') { closeGraphEditor(); return; }
    if (k === 'std') Object.assign(a.view, { x0: -5, x1: 5, y0: -4, y1: 4 });
    if (k === 'deg') { a.deg = !a.deg; b.textContent = a.deg ? 'Grad' : 'Bogenmaß'; b.setAttribute('aria-pressed', String(a.deg)); }
    if (k === 'auto') {
      const ev = graphEval(a); let lo = Infinity, hi = -Infinity;
      for (const pl of ev.plots) for (let i = 0; i <= 300; i++) { const xv = a.view.x0 + (a.view.x1 - a.view.x0) * i / 300; let yv; try { yv = pl.f(xv); } catch (er) { yv = NaN; } if (isFinite(yv) && Math.abs(yv) < 1e6) { lo = Math.min(lo, yv); hi = Math.max(hi, yv); } }
      if (isFinite(lo)) { const pad = (hi - lo || 2) * 0.12; a.view.y0 = lo - pad; a.view.y1 = hi + pad; }
    }
    $$('[data-r]', box).forEach(i => { i.value = num(a.view[i.dataset.r]); });
    redraw();
  });
  S.gedit = { box, p, a };
  if (!COARSE) setTimeout(() => $('.gsrc', box).focus(), 30);
}
function closeGraphEditor() {
  if (!S.gedit) return;
  S.gedit.box.remove(); S.gedit = null; updateUndo();
}

/* ---------- Eigenes Format „.werkbank“: alles bleibt bearbeitbar, auch nach dem Verschicken ---------- */
async function werkbankBlob() {
  const imgIds = new Set(); for (const p of S.pages) for (const a of p.annots) if (a.img) imgIds.add(a.img);
  const state = docState(imgIds); state.dirty = false;
  const audio = [];
  for (const r of S.recs || []) { const b = await audioOf(r.id); if (b) audio.push({ id: r.id, mime: r.mime, bytes: new Uint8Array(await b.arrayBuffer()) }); }
  return window.WBFile.pack({ name: baseName(), state, sources: [...S.sources.values()].map(x => ({ id: x.id, name: x.name, bytes: x.bytes })), audio });
}
async function saveWerkbank() {
  commitEdit(); if (!S.pages.length || !window.WBFile) return;
  busy(true, 'Werkbank-Datei wird erstellt …');
  try { const blob = await werkbankBlob(); busy(false); await saveBytes(blob, baseName() + '.werkbank'); }
  catch (e) { busy(false); console.error(e); toast('Speichern fehlgeschlagen: ' + (e.message || e)); }
}
async function openWerkbank(file, mode, noAsk) {
  if (S.busy) return;
  commitEdit();
  const bytes = file.bytes ? new Uint8Array(file.bytes) : new Uint8Array(await file.arrayBuffer());
  if (mode === 'replace' && S.lib && LIB && LIB.importWerkbank) {
    busy(true, 'Wird in die Bibliothek übernommen …');
    try { const doc = await LIB.importWerkbank(bytes, null); busy(false); location.href = 'index.html?doc=' + encodeURIComponent(doc.id); }
    catch (e) { busy(false); toast(e.message || String(e)); }
    return;
  }
  if (mode !== 'replace') { toast('Werkbank-Dateien lassen sich nur öffnen, nicht anhängen.'); return; }
  if (S.dirty && !S.sample && !noAsk && !await ask('Ungespeicherte Änderungen verwerfen?', `Wenn du „${file.name}“ öffnest, gehen die Änderungen an „${S.docName}“ verloren.`)) return;
  busy(true, 'Werkbank-Datei wird geöffnet …');
  try {
    const wb = await window.WBFile.unpack(bytes);
    const oldIds = [...S.sources.keys()];
    if (!wb.state) {
      const first = [...wb.sources.values()][0]; if (!first) throw new Error('Die Datei enthält keine Seiten.');
      busy(false); await openFiles([new File([first.bytes], first.name, { type: 'application/pdf' })], 'replace', true); return;
    }
    oldIds.forEach(dropSource);
    await applyState(wb.state, async id => wb.sources.get(id) || null);
    S.docName = (wb.manifest.name || file.name.replace(/\.werkbank$/i, '')) + '.pdf';
    S.dirty = false; busy(false); updateTitle(); viewer.scrollTop = 0;
    scheduleAutosave();
    setMsg(`„${file.name}“ geöffnet · alle Markierungen, Stifte und Live-Graphen sind bearbeitbar`);
  } catch (e) { busy(false); console.error(e); toast('Öffnen fehlgeschlagen: ' + (e.message || e)); }
}

/* ---------- Gemeinsam bearbeiten: Link-Sitzung im Editor ---------- */
const SHARE_TOKEN = new URLSearchParams(location.search).get('share');
function shareHooks() {
  return {
    getState: () => { const st = docState(); st.dirty = false; return JSON.parse(JSON.stringify(st)); },
    getSource: id => { const x = S.sources.get(id); return x && { id, name: x.name, bytes: x.bytes }; },
    hasSource: id => S.sources.has(id),
    addSource: async (id, src) => { if (!S.sources.has(id)) await addSource(src.bytes, src.name, id); },
    apply: (st, structural) => applyRemote(st, structural),
    busy: () => !!(S.editing || drag),
    onStatus: shareStatus, onPeers: sharePeers, onCursor: showCursor, onMention,
  };
}
/* Stand der anderen übernehmen, ohne Zoom und Position zu verlieren */
async function applyRemote(st, structural) {
  st = JSON.parse(JSON.stringify(st)); // nie Objekte mit der Sitzung teilen (sonst ändert jeder Strich auch deren Basisstand)
  const top = viewer.scrollTop;
  S.images = new Map(st.images || []); S.bookmarks = st.bookmarks || []; S.formVals = st.formVals || {}; S.paperSrc = new Map(st.paperSrc || []);
  if (st.meta) S.meta = st.meta;
  uidN = Math.max(uidN, st.uidN || 0) + 1;
  const sel = S.sel;
  if (structural || st.pages.length !== S.pages.length || st.pages.some((p, i) => p.id !== S.pages[i].id)) {
    S.pages = st.pages; await Promise.all(S.pages.filter(hasCE).map(ensureDerived));
    buildViewer(); viewer.scrollTop = top;
  } else {
    for (let i = 0; i < S.pages.length; i++) {
      const p = S.pages[i], q = st.pages[i];
      if (JSON.stringify(p) === JSON.stringify(q)) continue;
      const ce = ceKey(p);
      Object.assign(p, q);
      if (ceKey(p) !== ce) { await ensureDerived(p); const e = els.get(p.id); if (e) e.key = null; renderPage(p); }
      drawAnnots(p);
    }
    updateSideLater();
  }
  if (sel && !(pageById(sel.pid) || { annots: [] }).annots.some(a => a.id === sel.aid)) S.sel = null;
  renderProps();
  if (S.lib) { libState('pending'); clearTimeout(autoT); autoT = setTimeout(libSave, 1200); }
}
function shareStatus(i) {
  const el = $('#shareBar'); if (!el) return;
  el.hidden = false;
  el.dataset.s = i.status;
  const t = $('.st', el);
  if (t) t.textContent = { saving: 'Speichert …', saved: 'Live', synced: 'Live', error: 'Offline', ended: 'Beendet' }[i.status] || 'Live';
  if (i.status === 'ended') toast('Der Besitzer hat die Freigabe beendet.');
  if (S.lib && (i.status === 'saved' || i.status === 'synced')) lsSet('pdfwb.sharerev.' + S.lib.id, String(i.rev));
}
function sharePeers(list) {
  const el = $('#sharePeers'); if (!el) return;
  el.innerHTML = list.slice(0, 5).map(p => `<span class="peer" style="--c:${esc(p.color || '#888')}" title="${esc(p.name || 'Gast')}${p.page != null ? ' · Seite ' + (p.page + 1) : ''}">${esc((p.name || 'G').trim().slice(0, 1).toUpperCase())}</span>`).join('') + (list.length > 5 ? `<span class="peer more">+${list.length - 5}</span>` : '');
  const t = $('#shareBar .st'); if (t && list.length) t.textContent = 'Live · ' + (list.length === 1 ? list[0].name || 'Gast' : list.length + ' weitere');
}
async function askName() {
  if (!window.WBShare || window.WBShare.me.name) return;
  return new Promise(res => {
    dialog('Wie heißt du?', `<p class="note" style="margin:0 0 10px">Damit die anderen sehen, wer mitarbeitet. Nur für dieses Dokument, kein Konto nötig.</p><input class="field" id="shName" maxlength="40" placeholder="Vorname" style="width:100%">`, 'Weiter', b => { window.WBShare.setName($('#shName', b).value.trim() || 'Gast'); res(); return true; });
    $('#dlgCancel').addEventListener('click', () => { window.WBShare.setName('Gast'); res(); }, { once: true });
    setTimeout(() => $('#shName').focus(), 30);
  });
}
async function openShared(tok) {
  if (!window.WBShare) { toast('Gemeinsames Bearbeiten ist hier nicht verfügbar.'); return false; }
  busy(true, 'Geteiltes Dokument wird geladen …');
  try {
    const sess = await window.WBShare.connect(tok, shareHooks());
    const row = sess.row;
    if (!row.state || !row.state.pages) {
      // Besitzer hat ein unbearbeitetes PDF geteilt: Quelle als Dokument öffnen
      const sid = (row.src_ids || [])[0]; if (!sid) throw new Error('Das geteilte Dokument ist noch leer. Bitte in einem Moment neu laden.');
      const src = await sess.sourceOf(sid);
      await addSource(src.bytes, row.name + '.pdf', sid);
      S.pages = [...S.proxies.keys()].filter(k => k.startsWith(sid + ':')).map((k, i) => { const pg = S.proxies.get(k), vp = pg.getViewport({ scale: 1 }); return { id: 'p' + sid + i, src: sid, idx: i, baseRot: pg.rotate || 0, rot: 0, w0: vp.width, h0: vp.height, annots: [] }; });
      S.docName = row.name + '.pdf'; S.sample = false; S.zoom = initialZoom(); buildViewer();
    } else {
      await applyState(JSON.parse(JSON.stringify(row.state)), sid => sess.sourceOf(sid));
      S.docName = row.name + '.pdf';
    }
    S.dirty = false; S.share = { token: tok }; S.shareSess = sess;
    busy(false); updateTitle(); libUI();
    const base = shareHooks().getState();
    sess.start(row.rev, row.state && row.state.pages ? row.state : base);
    if (!(row.state && row.state.pages)) sess.flush();
    const inf = sess.info();
    if (!sess.canEdit()) { S.viewonly = true; document.body.classList.add('viewonly'); setTool('select'); setMsg('Nur ansehen · Änderungen des Besitzers erscheinen live'); }
    else setMsg('Gemeinsam bearbeiten · Änderungen erscheinen bei allen in Sekunden');
    shareStatus({ status: 'synced', rev: inf.rev });
    askName().then(() => sess.setPage(S.cur || 0));
    return true;
  } catch (e) {
    busy(false); console.error(e);
    $('#pages').innerHTML = `<div class="share-err"><h2>Link lässt sich nicht öffnen</h2><p>${esc(e.message || String(e))}</p></div>`;
    return true;
  }
}
/* Besitzer öffnet ein geteiltes Dokument aus der Bibliothek: Änderungen der Gäste holen und live bleiben */
async function attachShareForLib() {
  if (!window.WBShare || !S.lib || S.renderMode) return;
  const libId = S.lib.id, tok = await window.WBShare.tokenForDoc(libId);
  if (S.shareSess) { S.shareSess.close(); S.shareSess = null; S.share = null; }
  if (!tok || !S.lib || S.lib.id !== libId) { const sb = $('#shareBar'); if (sb && !tok) sb.hidden = true; return; }
  try {
    const sess = await window.WBShare.connect(tok, shareHooks()), row = sess.row;
    const seen = +lsGet('pdfwb.sharerev.' + S.lib.id) || 0;
    S.share = { token: tok }; S.shareSess = sess;
    if (row.state && row.state.pages && row.rev > seen) {
      // Gäste haben inzwischen gearbeitet: deren Stand mit dem lokalen zusammenführen
      const merged = row.state; // offline beim Besitzer nichts geändert: Stand der Gäste gilt
      for (const sid of merged.srcIds || []) if (!S.sources.has(sid)) { const src = await sess.sourceOf(sid); await addSource(src.bytes, src.name, sid); }
      await applyRemote(merged, true);
      sess.start(row.rev, row.state);
      toast('Änderungen aus dem geteilten Link übernommen');
    } else { sess.start(row.rev, row.state && row.state.pages ? row.state : null); if (S.dirty || row.rev <= seen) sess.flush(); }
    shareStatus({ status: 'synced', rev: row.rev });
  } catch (e) { console.warn('Freigabe verbinden', e); }
}
function collabDialog() {
  if (!window.WBShare) { toast('Gemeinsames Bearbeiten ist hier nicht verfügbar.'); return; }
  if (S.share && !S.lib) {
    const url = window.WBShare.linkOf(S.share.token);
    dialog('Gemeinsam bearbeiten', `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="border:1px solid var(--line);border-radius:12px;overflow:hidden;line-height:0">${window.WBShare.qrSVG(url, 150)}</div><div style="flex:1;min-width:220px"><p class="note" style="margin-top:0">Diesen Link an weitere Personen schicken:</p><input class="field" readonly value="${esc(url)}" style="width:100%" id="shUrl"></div></div>`, 'Link kopieren', () => { navigator.clipboard.writeText(url).then(() => toast('Link kopiert'), () => {}); return true; });
    return;
  }
  if (!S.lib) { toast('Zum Teilen das Dokument zuerst in die Bibliothek übernehmen (⋯ › In die Bibliothek übernehmen).'); return; }
  libSave().finally(() => window.WBShare.ownerDialog({ id: S.lib.id, name: S.lib.name }, { toast, busy: (m) => (m ? busy(true, m) : busy(false)) }).then(() => attachShareForLib()));
}

/* ==================== Version 1.6: weitere Werkzeuge ==================== */
const pill = (() => {
  let el = null;
  return (html, onClick) => {
    if (el) { el.remove(); el = null; }
    if (!html) return;
    el = document.createElement('div'); el.className = 'xpill'; el.innerHTML = html; document.body.appendChild(el);
    el.addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (b) onClick(b.dataset.x, b); });
    return el;
  };
})();

/* ---------- Präsentation: eine Seite pro Bildschirm, Pfeiltasten, Laser, B = schwarz ---------- */
const pres = { on: false, black: '', prevZoom: 1, prevFit: false, hint: null };
function presFit() {
  const p = S.pages[S.cur]; if (!p) return;
  const [W, H] = dims(p), vw = viewer.clientWidth - 24, vh = viewer.clientHeight - 24;
  setZoom(Math.min(vw / W, vh / H), null, false);
  requestAnimationFrame(() => presGo(S.cur, true));
}
function presGo(i, instant) {
  i = clamp(i, 0, S.pages.length - 1);
  const e = els.get(S.pages[i].id); if (!e) return;
  viewer.scrollTo({ top: e.wrap.offsetTop - Math.max(0, (viewer.clientHeight - e.wrap.offsetHeight) / 2), behavior: 'auto' });
  setCurrent(i);
  const c = $('#presNum'); if (c) { c.textContent = `${i + 1} / ${S.pages.length}`; c.classList.add('show'); clearTimeout(pres.hint); pres.hint = setTimeout(() => c.classList.remove('show'), 1400); }
}
function presBlack(k) { pres.black = pres.black === k ? '' : k; const o = $('#presBlack'); o.hidden = !pres.black; o.style.background = pres.black === 'w' ? '#fff' : '#000'; }
function setPresent(on) {
  if (on === pres.on) return;
  commitEdit();
  pres.on = on;
  if (on) {
    pres.prevZoom = S.zoom; pres.prevFit = S.fitMode;
    if (!S.reading) setReading(true);
    document.body.classList.add('present');
    if (!$('#presBlack')) {
      document.body.insertAdjacentHTML('beforeend', '<div id="presBlack" hidden></div><div id="presNum"></div>');
      $('#presBlack').addEventListener('click', () => presBlack(pres.black));
    }
    setTool('select');
    setTimeout(presFit, 120);
    toast('Präsentation · ← → blättern · L Laser · B schwarz · W weiß · Esc beenden');
  } else {
    document.body.classList.remove('present'); presBlack(''); if ($('#presBlack')) $('#presBlack').hidden = true;
    if (S.tool === 'laser') setTool('select');
    if (S.reading) setReading(false);
    setTimeout(() => (pres.prevFit ? fitWidth() : setZoom(pres.prevZoom)), 80);
  }
}
window.addEventListener('keydown', e => {
  if (!pres.on || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key, n = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ' ': 1, Enter: 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1, Backspace: -1 }[k];
  let used = true;
  if (n) presGo(S.cur + (e.shiftKey && k === ' ' ? -1 : n));
  else if (k === 'Home') presGo(0); else if (k === 'End') presGo(S.pages.length - 1);
  else if (k === 'b' || k === 'B' || k === '.') presBlack('b');
  else if (k === 'w' || k === 'W' || k === ',') presBlack('w');
  else if (k === 'l' || k === 'L' || k === 'j') setTool(S.tool === 'laser' ? 'select' : 'laser');
  else if (k === 'Escape') setPresent(false);
  else used = false;
  if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
viewer.addEventListener('click', e => { if (pres.on && S.tool !== 'laser' && !e.target.closest('a,.forml')) presGo(S.cur + (e.clientX < innerWidth * 0.25 ? -1 : 1)); });
addEventListener('resize', () => { if (pres.on) { clearTimeout(pres.rt); pres.rt = setTimeout(presFit, 150); } });
document.addEventListener('fullscreenchange', () => { if (pres.on && !document.fullscreenElement) setPresent(false); });

/* ---------- Vorlesen (Sprachausgabe des Systems) ---------- */
const tts = { on: false, rate: +(lsGet('pdfwb.ttsrate') || 1), gen: 0 };
function ttsStop() { tts.on = false; tts.gen++; try { speechSynthesis.cancel(); } catch (e) { /* egal */ } pill(null); }
function ttsVoice(lang) {
  const vs = speechSynthesis.getVoices(), l = lang.slice(0, 2);
  return vs.find(v => v.lang === lang && /natural|neural|premium|enhanced/i.test(v.name)) || vs.find(v => v.lang === lang) || vs.find(v => v.lang && v.lang.slice(0, 2) === l) || null;
}
async function speakDoc(from = S.cur) {
  if (!('speechSynthesis' in window)) { toast('Vorlesen wird von diesem Browser nicht unterstützt.'); return; }
  if (tts.on) { ttsStop(); return; }
  tts.on = true; const gen = ++tts.gen;
  const bar = () => pill(`<span class="dot"></span><span>Vorlesen · Seite <b id="ttsPg">${S.cur + 1}</b></span><button data-x="rate" title="Tempo">${tts.rate}×</button><button data-x="next" title="Nächste Seite">⏭</button><button data-x="stop" title="Stopp">■</button>`, (k, b) => {
    if (k === 'stop') ttsStop();
    else if (k === 'next') { const nx = S.cur + 1; ttsStop(); if (nx < S.pages.length) speakDoc(nx); }
    else if (k === 'rate') { tts.rate = { 1: 1.25, 1.25: 1.5, 1.5: 0.85, 0.85: 1 }[tts.rate] || 1; lsSet('pdfwb.ttsrate', String(tts.rate)); b.textContent = tts.rate + '×'; const c = S.cur; ttsStop(); speakDoc(c); }
  });
  bar();
  for (let i = from; i < S.pages.length && tts.on && gen === tts.gen; i++) {
    const { text, own } = await pageText(S.pages[i]);
    const all = [text, ...own].join('\n').replace(/-\n(?=[a-zäöü])/g, '').replace(/\s*\n\s*/g, ' ').trim();
    if (!all) continue;
    if (i !== S.cur) scrollToPage(i);
    const pg = $('#ttsPg'); if (pg) pg.textContent = i + 1;
    const lang = /\b(the|and|of|to|is)\b/i.test(all.slice(0, 400)) && !/\b(der|die|und|das|ist)\b/i.test(all.slice(0, 400)) ? 'en-US' : 'de-DE', voice = ttsVoice(lang);
    const chunks = all.match(/[^.!?…]{1,220}(?:[.!?…]+|$)|\S{221,}/g) || [all];
    for (const ch of chunks) {
      if (!tts.on || gen !== tts.gen) return;
      await new Promise(res => {
        const u = new SpeechSynthesisUtterance(ch.trim()); u.lang = lang; u.rate = tts.rate; if (voice) u.voice = voice;
        u.onend = u.onerror = () => res(); speechSynthesis.speak(u);
        // Sicherheitsnetz: manche Systeme melden das Ende nicht
        setTimeout(res, 2500 + ch.length * 160 / tts.rate);
      });
    }
  }
  if (gen === tts.gen) { tts.on = false; pill(null); }
}

/* ---------- Diktieren in ein Textfeld ---------- */
const dict = { rec: null, a: null, p: null, base: '' };
function dictateStop() {
  const r = dict.rec; dict.rec = null;
  if (r) { try { r.stop(); } catch (e) { /* egal */ } }
  pill(null);
  if (dict.a && dict.p) {
    if (!dict.a.text.trim()) { dict.p.annots = dict.p.annots.filter(x => x !== dict.a); drawAnnots(dict.p); }
    else { markDirty(); S.sel = { pid: dict.p.id, aid: dict.a.id }; drawAnnots(dict.p); renderProps(); }
  }
  dict.a = dict.p = null;
}
function dictate() {
  if (dict.rec) { dictateStop(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || DESKF) { toast(DESKF ? 'In der Desktop-App diktierst du mit der Diktierfunktion des Systems: am Mac zweimal Fn, unter Windows Win + H – dann in ein Textfeld sprechen.' : 'Diktieren geht in diesem Browser nicht. Chrome, Edge oder Safari verwenden – oder die Diktierfunktion der Tastatur.'); return; }
  commitEdit();
  const p = S.pages[S.cur]; if (!p) return;
  let a = S.sel && S.sel.pid === p.id && p.annots.find(x => x.id === S.sel.aid && x.t === 'text');
  if (!a) {
    const [cx, cy] = viewCenter(p), [W] = dims(p), tp = TP.text;
    a = { id: uid(), t: 'text', x: clamp(cx - 120, 10, W - 60), y: cy, text: '', color: tp.color, size: tp.size, font: tp.font, bold: tp.bold, bg: tp.bg || '' };
    pushHist(); p.annots.push(a);
  } else pushHist();
  dict.a = a; dict.p = p; dict.base = a.text ? a.text.replace(/\s*$/, ' ') : '';
  const rec = new SR(); dict.rec = rec;
  rec.lang = navigator.language && /^en/.test(navigator.language) ? navigator.language : 'de-DE'; rec.continuous = true; rec.interimResults = true;
  rec.onresult = ev => {
    let fin = '', tmp = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) (ev.results[i].isFinal ? (fin += ev.results[i][0].transcript) : (tmp += ev.results[i][0].transcript));
    if (fin) dict.base += fin.trim().replace(/\s*(neue Zeile|new line)\s*/gi, '\n').replace(/\s*(Punkt)$/i, '.').replace(/\s*(Komma)$/i, ',') + ' ';
    a.text = (dict.base + tmp).replace(/^\s+/, ''); drawAnnots(p);
  };
  rec.onerror = ev => { if (ev.error === 'not-allowed') toast('Bitte den Zugriff aufs Mikrofon erlauben.'); else if (ev.error === 'network') toast('Diktieren braucht hier eine Internetverbindung. Alternativ: Diktierfunktion des Systems (Mac: 2× Fn, Windows: Win + H).'); else if (ev.error !== 'no-speech' && ev.error !== 'aborted') toast('Diktieren: ' + ev.error); };
  rec.onend = () => { if (dict.rec === rec) dictateStop(); };
  try { rec.start(); } catch (e) { toast('Diktieren ließ sich nicht starten.'); dict.rec = null; return; }
  pill('<span class="dot rec"></span><span>Diktat läuft · „neue Zeile“ für Umbruch</span><button data-x="stop">Fertig</button>', k => { if (k === 'stop') dictateStop(); });
}

