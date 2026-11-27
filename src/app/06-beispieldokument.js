/* ---------- Beispieldokument ---------- */
async function makeSample() {
  const { PDFDocument, StandardFonts, rgb } = PL;
  const d = await PDFDocument.create();
  d.setTitle('Beispiel-Dokument'); d.setProducer('PDF Werkbank');
  const f = await d.embedFont(StandardFonts.Helvetica), fb = await d.embedFont(StandardFonts.HelveticaBold), fm = await d.embedFont(StandardFonts.Courier);
  const ink = rgb(0.106, 0.129, 0.188), muted = rgb(0.38, 0.41, 0.48), blue = rgb(0.12, 0.31, 0.85), rule = rgb(0.82, 0.84, 0.87);
  const H = A4[1], M = 56, CW = A4[0] - 2 * M;
  const wrapT = (txt, font, size, maxW) => {
    const out = []; let ln = '';
    for (const w of txt.split(' ')) { const t = ln ? ln + ' ' + w : w; if (font.widthOfTextAtSize(t, size) > maxW && ln) { out.push(ln); ln = w; } else ln = t; }
    if (ln) out.push(ln); return out;
  };
  const p1 = d.addPage(A4);
  let y = H - 64;
  p1.drawText('BEISPIEL-DOKUMENT', { x: M, y, size: 8.5, font: fb, color: blue }); y -= 30;
  p1.drawText('Willkommen in der PDF Werkbank', { x: M, y, size: 24, font: fb, color: ink }); y -= 22;
  for (const l of wrapT('Dieses Dokument dient zum Ausprobieren. Öffne oben links dein eigenes PDF oder ziehe eine Datei einfach in das Fenster.', f, 11, CW)) { p1.drawText(l, { x: M, y, size: 11, font: f, color: muted }); y -= 15; }
  y -= 10; p1.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.8, color: rule }); y -= 30;
  p1.drawText('Was du hier tun kannst', { x: M, y, size: 14, font: fb, color: ink }); y -= 22;
  const bullets = [
    'Vorhandene Texte direkt in der PDF ändern, Inhalte verschieben, entfernen oder dauerhaft schwärzen.',
    'Mit Füller, Kugelschreiber oder Textmarker schreiben, auf dem iPad mit Apple Pencil und Druckstärke.',
    'Strich kurz halten: Linien, Rechtecke und Ellipsen werden automatisch begradigt.',
    'Formulare ausfüllen (Seite 2 hat echte Formularfelder), Bilder einfügen und unterschreiben.',
    'Strecken in mm messen, Stempel, Notizen, Lesezeichen und eine Kommentarliste nutzen.',
    'Seiten drehen, sortieren, Notizpapier einfügen, PDFs anhängen und alles als neue PDF speichern.',
  ];
  for (const b of bullets) {
    p1.drawText('•', { x: M + 2, y, size: 11, font: fb, color: blue });
    for (const l of wrapT(b, f, 11, CW - 18)) { p1.drawText(l, { x: M + 16, y, size: 11, font: f, color: ink }); y -= 16; }
    y -= 4;
  }
  y -= 18;
  const markY = y;
  p1.drawText('Tastenkürzel', { x: M, y, size: 14, font: fb, color: ink }); y -= 24;
  const keys = [['V', 'Auswählen'], ['M', 'PDF-Inhalte'], ['E', 'Text ändern'], ['T', 'Neuer Text'], ['B', 'Schwärzen'], ['P', 'Stift'], ['G', 'Radierer'], ['H', 'Markieren'], ['Q', 'Messen'],
    ['R', 'Rechteck'], ['A', 'Pfeil'], ['S', 'Stempel'], ['C', 'Notiz'], ['U', 'Unterschrift'], ['F', 'Lesemodus'], ['Entf', 'Löschen'], ['Strg+Z', 'Rückgängig'], ['Strg+S', 'Speichern']];
  const half = Math.ceil(keys.length / 2);
  keys.forEach(([k, v], i) => {
    const col = i < half ? 0 : 1, row = i % half, x = M + col * (CW / 2), yy = y - row * 17;
    p1.drawText(k, { x, y: yy, size: 10, font: fm, color: blue });
    p1.drawText(v, { x: x + 74, y: yy, size: 10.5, font: f, color: ink });
  });
  y -= half * 17 + 20;
  p1.drawText('Datenschutz', { x: M, y, size: 14, font: fb, color: ink }); y -= 20;
  for (const l of wrapT('Die Bearbeitung findet vollständig in deinem Browser statt. Deine Datei wird nicht hochgeladen, sondern nur beim Speichern als neue PDF erzeugt.', f, 11, CW)) { p1.drawText(l, { x: M, y, size: 11, font: f, color: ink }); y -= 16; }
  p1.drawText('PDF Werkbank · Beispielseite 1 von 2', { x: M, y: 36, size: 8, font: f, color: muted });

  const p2 = d.addPage(A4);
  y = H - 64;
  p2.drawText('FORMULAR', { x: M, y, size: 8.5, font: fb, color: blue }); y -= 30;
  p2.drawText('Teilnahmebestätigung', { x: M, y, size: 22, font: fb, color: ink }); y -= 20;
  p2.drawText('Beispielformular zum Ausfüllen und Unterschreiben.', { x: M, y, size: 11, font: f, color: muted }); y -= 46;
  // echte Formularfelder (AcroForm), damit das Ausfüllen direkt ausprobiert werden kann
  const form = d.getForm();
  const field = (label, x, yy, w, name) => {
    p2.drawText(label, { x, y: yy + 22, size: 8.5, font: fb, color: muted });
    p2.drawLine({ start: { x, y: yy }, end: { x: x + w, y: yy }, thickness: 0.8, color: rgb(0.55, 0.58, 0.64) });
    if (name) { const tf = form.createTextField(name); tf.addToPage(p2, { x, y: yy + 1, width: w, height: 17, borderWidth: 0 }); tf.setFontSize(11); }
  };
  const gap = 20, hw = (CW - gap) / 2;
  field('NAME', M, y, hw, 'Name'); field('VORNAME', M + hw + gap, y, hw, 'Vorname'); y -= 58;
  field('STRASSE UND HAUSNUMMER', M, y, CW, 'Strasse'); y -= 58;
  field('PLZ', M, y, 110, 'PLZ'); field('ORT', M + 130, y, CW - 130, 'Ort'); y -= 58;
  field('E-MAIL', M, y, CW, 'E-Mail'); y -= 52;
  [['Ich habe die Teilnahmebedingungen gelesen und akzeptiere sie.', 'Bedingungen'], ['Ich möchte über künftige Termine informiert werden.', 'Newsletter']].forEach(([t, name]) => {
    form.createCheckBox(name).addToPage(p2, { x: M, y: y - 2, width: 12, height: 12, borderWidth: 0.9, borderColor: rgb(0.45, 0.48, 0.54) });
    p2.drawText(t, { x: M + 22, y, size: 11, font: f, color: ink }); y -= 26;
  });
  y = 170;
  field('ORT, DATUM', M, y, hw, 'Ort_Datum'); field('UNTERSCHRIFT', M + hw + gap, y, hw);
  p2.drawText('PDF Werkbank · Beispielseite 2 von 2', { x: M, y: 36, size: 8, font: f, color: muted });

  const hw1 = fb.widthOfTextAtSize('Tastenkürzel', 14);
  return { bytes: await d.save(), mark: { x: M, y: H - markY, w: hw1 } };
}

/* ---------- Werkzeugleiste anpassen: Werkzeuge ein- und ausblenden, Reihenfolge ändern ---------- */
const TB_EXTRA = { btnImg: ['img', 'Bild einfügen', 'image'], btnSig: ['sig', 'Unterschreiben', 'sign'], btnCalc: ['calc', 'Rechner', 'calc'] };
const TB_PRESETS = {
  all: ['Alles anzeigen', []],
  write: ['Schreiben und Lernen', ['objects', 'edittext', 'white', 'redact', 'measure', 'check', 'cross', 'stamp', 'calc']],
  edit: ['PDF bearbeiten', ['laser', 'measure', 'calc', 'eraser']],
  forms: ['Formulare und Verträge', ['objects', 'edittext', 'eraser', 'hl', 'ul', 'so', 'rect', 'ellipse', 'line', 'arrow', 'measure', 'laser', 'calc', 'redact']],
};
let TB_DEFAULT = null;
/* Gruppen: ein Knopf je Gruppe, die übrigen Werkzeuge im Ausklapp-Menü */
const TB_GROUPS = { edit: ['objects', 'edittext', 'white', 'redact'], marks: ['hl', 'ul', 'so'], shapes: ['rect', 'ellipse', 'line', 'arrow', 'measure'], stamps: ['check', 'cross', 'stamp', 'note'], insert: ['img', 'sig'] };
const TB_GROUP_NAMES = { edit: 'PDF bearbeiten', marks: 'Markieren', shapes: 'Formen und Messen', stamps: 'Haken, Stempel, Notiz', insert: 'Bild und Unterschrift' };
const groupOf = k => Object.keys(TB_GROUPS).find(g => TB_GROUPS[g].includes(k));
let tbCompact = lsGet('pdfwb.tbcompact') !== '0';
const tbEl = k => (k === 'img' ? $('#btnImg') : k === 'sig' ? $('#btnSig') : $(`.toolbar [data-tool="${k}"]`));
const tbKey = el => el.dataset.tool || (TB_EXTRA[el.id] || [])[0] || (el.classList.contains('vsep') ? 'sep' : null);
function tbItems() {
  const out = [];
  for (const el of $('.toolbar').children) {
    if (el.id === 'btnThumbs' || el.id === 'btnTbCfg') continue;
    if (el.classList.contains('grow')) break;
    const k = tbKey(el); if (k === 'sep' && !out.length) continue; // Trennlinie hinter der Seitenleisten-Taste bleibt fest
    if (k) out.push({ key: k, el });
  }
  return out;
}
const tbLabel = k => (k === 'sep' ? 'Trennlinie' : TB_EXTRA['btn' + k[0].toUpperCase() + k.slice(1)] ? TB_EXTRA['btn' + k[0].toUpperCase() + k.slice(1)][1] : TOOL_NAMES[k] || k);
const tbIcon = k => (k === 'sep' ? '' : icon(k === 'img' ? 'image' : k === 'sig' ? 'sign' : k));
function tbLoad() { try { const c = JSON.parse(lsGet('pdfwb.toolbar') || 'null'); return c && Array.isArray(c.order) ? c : null; } catch (e) { return null; } }
/* gespeicherte Reihenfolge plus Werkzeuge, die in einer neueren Version dazugekommen sind */
function tbOrder(cfg) {
  if (!cfg) return TB_DEFAULT.slice();
  const order = cfg.order.filter(k => k === 'sep' || TB_DEFAULT.includes(k));
  TB_DEFAULT.forEach((k, i) => {
    if (k === 'sep' || order.includes(k)) return;
    const prev = TB_DEFAULT.slice(0, i).reverse().find(x => x !== 'sep' && order.includes(x));
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, k);
  });
  return order;
}
function applyToolbar(cfg = tbLoad()) {
  const nav = $('.toolbar'), items = tbItems();
  if (!TB_DEFAULT) TB_DEFAULT = items.map(i => i.key);
  const byKey = new Map(items.filter(i => i.key !== 'sep').map(i => [i.key, i.el]));
  const seps = items.filter(i => i.key === 'sep').map(i => i.el);
  const hidden = new Set((cfg && cfg.hidden) || []), anchor = $('#btnTbCfg');
  let si = 0;
  const placed = [];
  for (const k of tbOrder(cfg)) {
    let el;
    if (k === 'sep') { el = seps[si++]; if (!el) { el = document.createElement('span'); el.className = 'vsep'; } }
    else el = byKey.get(k);
    if (!el) continue;
    nav.insertBefore(el, anchor);
    el.hidden = k !== 'sep' && hidden.has(k);
    placed.push({ k, el });
  }
  seps.slice(si).forEach(el => el.remove());
  // Gruppen bilden: nur ein Vertreter je Gruppe bleibt sichtbar
  for (const [g, list] of Object.entries(TB_GROUPS)) {
    const vis = list.filter(k => byKey.get(k) && !byKey.get(k).hidden);
    let rep = vis.includes(S.tool) ? S.tool : vis.includes(lsGet('pdfwb.tbrep.' + g)) ? lsGet('pdfwb.tbrep.' + g) : vis[0];
    for (const k of list) {
      const el = byKey.get(k); if (!el) continue;
      const grouped = tbCompact && vis.length > 1;
      el.classList.toggle('gh', grouped && k !== rep);
      el.classList.toggle('grep', grouped && k === rep);
      if (grouped && k === rep) { el.dataset.group = g; if (!$('.gchev', el)) el.insertAdjacentHTML('beforeend', '<span class="gchev" aria-hidden="true"></span>'); }
      else { delete el.dataset.group; const c = $('.gchev', el); if (c) c.remove(); }
    }
  }
  const off = el => el.hidden || el.classList.contains('gh');
  // doppelte und überzählige Trennlinien ausblenden
  let lastVis = 'sep';
  placed.forEach(({ k, el }) => { if (k === 'sep') { el.hidden = lastVis === 'sep'; if (!el.hidden) lastVis = 'sep'; } else if (!off(el)) lastVis = k; });
  for (let i = placed.length - 1; i >= 0; i--) { const { k, el } = placed[i]; if (off(el)) continue; if (k === 'sep') el.hidden = true; break; }
}
/* Ausklapp-Menü einer Werkzeuggruppe */
function openGroupMenu(btn) {
  closeGroupMenu();
  const g = btn.dataset.group; if (!g) return;
  const hidden = new Set((tbLoad() || {}).hidden || []);
  const items = TB_GROUPS[g].filter(k => tbEl(k) && !hidden.has(k));
  const keyOf = t => Object.keys(KEYS).find(k => KEYS[k] === t) || (t === 'img' ? 'i' : t === 'sig' ? 'u' : '');
  const m = document.createElement('div'); m.className = 'tbfly'; m.setAttribute('role', 'menu');
  m.innerHTML = `<div class="mh">${esc(TB_GROUP_NAMES[g])}</div>` + items.map(k => `<button role="menuitem" data-k="${k}" aria-pressed="${S.tool === k}">${tbIcon(k)}<span>${esc(tbLabel(k))}</span>${keyOf(k) ? `<kbd>${keyOf(k).toUpperCase()}</kbd>` : ''}</button>`).join('');
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect(), mh = m.offsetHeight, below = innerHeight - r.bottom > mh + 12;
  m.style.left = clamp(r.left, 8, innerWidth - m.offsetWidth - 8) + 'px';
  m.style.top = (below ? r.bottom + 6 : r.top - mh - 6) + 'px';
  m.onclick = e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k; closeGroupMenu();
    lsSet('pdfwb.tbrep.' + g, k);
    if (k === 'img' || k === 'sig') { applyToolbar(); tbEl(k).click(); } else setTool(k);
  };
  setTimeout(() => document.addEventListener('pointerdown', groupMenuAway, true), 0);
}
function groupMenuAway(e) { if (!e.target.closest('.tbfly')) closeGroupMenu(); }
function closeGroupMenu() { const m = $('.tbfly'); if (m) m.remove(); document.removeEventListener('pointerdown', groupMenuAway, true); }
function bindGroups() {
  const nav = $('.toolbar');
  let lp = 0, lpFired = false;
  nav.addEventListener('pointerdown', e => {
    const b = e.target.closest('.grep'); lpFired = false; if (!b) return;
    clearTimeout(lp); lp = setTimeout(() => { lpFired = true; openGroupMenu(b); }, 450);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) nav.addEventListener(ev, () => clearTimeout(lp));
  // Ecke antippen, langes Drücken oder erneutes Tippen auf das aktive Werkzeug öffnet die Gruppe
  nav.addEventListener('click', e => {
    const b = e.target.closest('.grep'); if (!b) return;
    if (lpFired || e.target.closest('.gchev') || (b.dataset.tool && b.dataset.tool === S.tool)) { e.preventDefault(); e.stopImmediatePropagation(); if (!lpFired) openGroupMenu(b); lpFired = false; }
  }, true);
  nav.addEventListener('contextmenu', e => { const b = e.target.closest('.grep'); if (b) { e.preventDefault(); openGroupMenu(b); } });
}
function toolbarDialog() {
  let order = tbOrder(tbLoad()), hidden = new Set((tbLoad() || {}).hidden || []);
  const rows = () => order.map((k, i) => `<div class="tbrow${k === 'sep' ? ' sep' : ''}" data-i="${i}">
      ${k === 'sep' ? '<span style="width:18px"></span>' : `<input type="checkbox" data-vis ${hidden.has(k) ? '' : 'checked'} aria-label="${esc(tbLabel(k))} anzeigen">`}
      ${tbIcon(k)}<span class="nm">${esc(tbLabel(k))}${k !== 'sep' && Object.entries(KEYS).find(([, t]) => t === k) ? ` <small style="color:var(--muted)">(${Object.entries(KEYS).find(([, t]) => t === k)[0].toUpperCase()})</small>` : ''}</span>
      ${k === 'sep' ? '<button class="mv" data-del title="Trennlinie entfernen" aria-label="Trennlinie entfernen">✕</button>' : ''}
      <button class="mv" data-up title="Nach vorne" aria-label="Nach vorne">▲</button><button class="mv" data-down title="Nach hinten" aria-label="Nach hinten">▼</button></div>`).join('');
  dialog('Werkzeugleiste anpassen', `<p class="note" style="margin:0">Häkchen blendet ein oder aus, Pfeile ändern die Reihenfolge. Ausgeblendete Werkzeuge bleiben über Tastenkürzel und die Befehlssuche (Strg/⌘ K) erreichbar.</p>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px">${Object.entries(TB_PRESETS).map(([k, [l]]) => `<button class="btn" data-preset="${k}" type="button">${esc(l)}</button>`).join('')}<button class="btn" data-addsep type="button">+ Trennlinie</button></div>
    <label class="chk" style="margin-top:10px"><input type="checkbox" id="tbGroup" ${tbCompact ? 'checked' : ''}> Ähnliche Werkzeuge gruppieren (kompakt)</label>
    <div class="tblist" id="tbList">${rows()}</div>`, 'Übernehmen', () => {
    lsSet('pdfwb.toolbar', JSON.stringify({ order, hidden: [...hidden] }));
    lsSet('pdfwb.tbcompact', tbCompact ? '1' : '0');
    applyToolbar(); toast('Werkzeugleiste angepasst');
  });
  const b = $('#dlgBody'), list = $('#tbList', b);
  const redraw = () => { list.innerHTML = rows(); applyToolbar({ order, hidden: [...hidden] }); };
  b.onclick = e => {
    const pr = e.target.closest('[data-preset]');
    if (pr) { order = TB_DEFAULT.slice(); hidden = new Set(TB_PRESETS[pr.dataset.preset][1]); redraw(); return; }
    if (e.target.closest('[data-addsep]')) { order.push('sep'); redraw(); list.scrollTop = list.scrollHeight; return; }
    const row = e.target.closest('.tbrow'); if (!row) return;
    const i = +row.dataset.i;
    if (e.target.closest('[data-up]') && i > 0) { [order[i - 1], order[i]] = [order[i], order[i - 1]]; redraw(); }
    else if (e.target.closest('[data-down]') && i < order.length - 1) { [order[i + 1], order[i]] = [order[i], order[i + 1]]; redraw(); }
    else if (e.target.closest('[data-del]')) { order.splice(i, 1); redraw(); }
  };
  const g0 = tbCompact;
  $('#tbGroup', b).onchange = e => { tbCompact = e.target.checked; applyToolbar({ order, hidden: [...hidden] }); };
  $('#dlgCancel').addEventListener('click', () => { tbCompact = g0; }, { once: true });
  b.onchange = e => { if (e.target.id === 'tbGroup') return; const row = e.target.closest('.tbrow'); if (!row || !e.target.matches('[data-vis]')) return; const k = order[+row.dataset.i]; if (e.target.checked) hidden.delete(k); else hidden.add(k); applyToolbar({ order, hidden: [...hidden] }); };
  $('#dlgCancel').addEventListener('click', () => applyToolbar(), { once: true });
}

/* ---------- Stift-Favoriten: Stiftart, Farbe, Stärke und Deckkraft mit einem Tipp ---------- */
const PEN_FAV_DEFAULT = [{ kind: 'fount', color: '#1b2a6b', sw: 2, op: 100 }, { kind: 'ball', color: '#d0342c', sw: 1.25, op: 100 }, { kind: 'ball', color: '#1e8a4c', sw: 1.25, op: 100 }, { kind: 'marker', color: '#ffd400', sw: 12, op: 40 }];
let penFavs = (() => { try { const v = JSON.parse(lsGet('pdfwb.penfavs') || 'null'); return Array.isArray(v) ? v : PEN_FAV_DEFAULT.slice(); } catch (e) { return PEN_FAV_DEFAULT.slice(); } })();
const savePenFavs = () => lsSet('pdfwb.penfavs', JSON.stringify(penFavs));
const sameFav = (f, o) => f.kind === (o.kind || 'ball') && f.color.toLowerCase() === (o.color || '').toLowerCase() && Math.abs(f.sw - o.sw) < 0.01 && f.op === o.op;
const KIND_LABEL = { fount: 'Füller', ball: 'Kuli', marker: 'Marker' };
function renderPenFavs(o) {
  const el = $('#penFavs'); if (!el) return;
  el.innerHTML = penFavs.map((f, i) => {
    const d = clamp(f.sw * (f.kind === 'marker' ? 1 : 2.2), 4, 16);
    return `<button class="fav" data-fav="${i}" style="--c:${f.color}" aria-pressed="${!!o && sameFav(f, o)}" title="${KIND_LABEL[f.kind]} · ${f.sw} pt${f.op < 100 ? ' · ' + f.op + ' %' : ''} (gedrückt halten oder Rechtsklick: entfernen)"><i style="width:${d}px;height:${d}px;opacity:${Math.max(0.35, f.op / 100)}${f.kind === 'marker' ? ';border-radius:2px' : ''}"></i></button>`;
  }).join('') + (penFavs.length < 10 ? '<button class="fav add" data-favadd title="Aktuellen Stift als Favorit merken" aria-label="Favorit hinzufügen">+</button>' : '') + '<span class="vsep"></span>';
}
function applyPenFav(f) {
  const tg = propTarget();
  if (tg && tg.isAnnot && tg.type === 'pen') {
    pushHist(); Object.assign(tg.obj, { kind: f.kind, color: f.color, sw: f.sw, op: f.op });
    drawAnnots(pageById(S.sel.pid)); markDirty();
  }
  PEN_KINDS[TP.pen.kind] = { sw: TP.pen.sw, op: TP.pen.op, color: TP.pen.color };
  Object.assign(TP.pen, { kind: f.kind, color: f.color, sw: f.sw, op: f.op });
  PEN_KINDS[f.kind] = { sw: f.sw, op: f.op, color: f.color };
  if (S.tool !== 'pen' && !(tg && tg.isAnnot)) setTool('pen'); else renderProps();
}
function bindPenFavs() {
  const el = $('#penFavs'); if (!el) return;
  let lp = 0, lpDone = false;
  const remove = i => { const f = penFavs[i]; if (!f) return; penFavs.splice(i, 1); savePenFavs(); renderProps(); toast(`Favorit entfernt (${KIND_LABEL[f.kind]})`); };
  el.addEventListener('pointerdown', e => { const b = e.target.closest('[data-fav]'); lpDone = false; if (!b) return; clearTimeout(lp); lp = setTimeout(() => { lpDone = true; remove(+b.dataset.fav); }, 650); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => clearTimeout(lp));
  el.addEventListener('contextmenu', e => { const b = e.target.closest('[data-fav]'); if (!b) return; e.preventDefault(); clearTimeout(lp); if (!lpDone) remove(+b.dataset.fav); lpDone = true; });
  el.addEventListener('click', e => {
    if (lpDone) { lpDone = false; return; }
    if (e.target.closest('[data-favadd]')) {
      const tg = propTarget(), o = tg && tg.type === 'pen' ? tg.obj : TP.pen;
      const f = { kind: o.kind || 'ball', color: o.color, sw: o.sw, op: o.op };
      if (penFavs.some(x => sameFav(x, f))) { toast('Diesen Stift gibt es schon als Favorit'); return; }
      penFavs.push(f); savePenFavs(); renderProps(); toast('Stift als Favorit gemerkt');
      return;
    }
    const b = e.target.closest('[data-fav]'); if (b) applyPenFav(penFavs[+b.dataset.fav]);
  });
}

/* ---------- Tastenkürzel und Gesten ---------- */
function shortcutsDialog() {
  const mac = /Mac|iPad|iPhone/.test(navigator.platform), M = mac ? '⌘' : 'Strg', kb = s => s.split(' ').map(x => `<kbd>${esc(x)}</kbd>`).join(' ');
  const tools = Object.entries(KEYS).map(([k, t]) => [TOOL_NAMES[t] || t, k.toUpperCase()]);
  const groups = [
    ['Werkzeuge', tools.concat([['Bild einfügen', 'I'], ['Unterschreiben', 'U'], ['Rechner', 'Z']])],
    ['Dokument', [['Befehle und Suche', M + ' K'], ['In Bibliothek sichern / Speichern', M + ' S'], ['Als PDF exportieren', M + ' ⇧ S'], ['Öffnen', M + ' O'], ['Im Dokument suchen', M + ' F'], ['Rückgängig', M + ' Z'], ['Wiederholen', M + ' ⇧ Z']]],
    ['Bearbeiten', [['Kopieren / Ausschneiden', M + ' C'], ['Einfügen', M + ' V'], ['Duplizieren', M + ' D'], ['Alles auf der Seite auswählen', M + ' A'], ['Löschen', 'Entf'], ['Verschieben (1 pt / 10 pt)', '← → ↑ ↓'], ['Auswahl aufheben', 'Esc']]],
    ['Ansicht', [['Vergrößern / Verkleinern', M + ' + −'], ['Seitenbreite', M + ' 0'], ['Lesemodus', 'F'], ['Blättern im Lesemodus', '← →'], ['Diese Übersicht', '?']]],
    ['Tablet und Touch', [['Zoomen', 'zwei Finger spreizen'], ['Seitenbreite / Vergrößern', 'Doppeltipp'], ['Rückgängig', 'zwei Finger tippen'], ['Wiederholen', 'drei Finger tippen'], ['Radieren', 'Pencil-Taste'], ['Form gerade ziehen', 'Strich halten']]],
  ];
  dialog('Tastenkürzel und Gesten', `<div class="keys">${groups.map(([h, rows]) => `<h3>${esc(h)}</h3>` + rows.map(([l, k]) => `<div><span>${esc(l)}</span><span>${h === 'Tablet und Touch' ? `<span style="color:var(--muted)">${esc(k)}</span>` : kb(k)}</span></div>`).join('')).join('')}</div>`, 'Schließen', () => true);
  $('#dlgCancel').hidden = true;
}

/* ---------- Seiten einfügen: aus PDF-Bytes nach der aktuellen Seite ---------- */
async function insertPdfBytes(bytes, name, pick) {
  commitEdit();
  const pages = await addSource(bytes, name);
  const list = pick ? pages.filter((p, i) => pick.includes(i)) : pages;
  if (!list.length) return 0;
  pushHist();
  const at = Math.min(S.cur + 1, S.pages.length);
  S.pages.splice(at, 0, ...list);
  S.selPages.clear(); markDirty(); buildViewer(); scrollToPage(at);
  return list.length;
}
/* Fotos und Scans: Kamera oder Fotomediathek, je Bild eine Seite */
let photoMode = lsGet('pdfwb.photomode') || 'scan';
function photosDialog() {
  dialog('Fotos oder Scans einfügen', `<p class="note" style="margin:0 0 10px">Jedes Bild wird eine eigene Seite hinter der aktuellen. Auf Tablet und Handy kannst du direkt die Kamera nehmen.</p>
    <div class="seg" id="phMode" role="group">${[['scan', 'Scan (S/W)'], ['scancolor', 'Scan farbig'], ['photo', 'Foto']].map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${k === photoMode}">${l}</button>`).join('')}</div>
    <p class="note">Scan hellt das Papier auf und verstärkt die Schrift, ideal für Arbeitsblätter und Notizen.</p>${window.WBScan ? `<label class="chkrow"><input type="checkbox" id="phCrop" ${lsGet('pdfwb.photocrop') !== '0' ? 'checked' : ''}> Blatt automatisch erkennen, zuschneiden und gerade rücken</label>` : ''}`, 'Bilder wählen …', () => { $('#filePhotos').click(); });
  $('#dlgBody').onchange = e => { if (e.target.id === 'phCrop') lsSet('pdfwb.photocrop', e.target.checked ? '1' : '0'); };
  $('#phMode').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; photoMode = b.dataset.k; lsSet('pdfwb.photomode', photoMode); $$('#phMode button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
}
async function insertPhotos(files) {
  if (!files.length || !window.WBPhotos) return;
  busy(true, 'Bilder werden aufbereitet …');
  try {
    const bytes = await window.WBPhotos.toPdf(files, { mode: photoMode, crop: lsGet('pdfwb.photocrop') !== '0', onProgress: (n, t) => setMsg(`Bild ${n} von ${t} …`, true) });
    busy(false);
    const n = await insertPdfBytes(bytes, files.length === 1 ? files[0].name.replace(/\.\w+$/, '') + '.pdf' : 'Fotos.pdf');
    toast(n === 1 ? 'Foto als Seite eingefügt' : `${n} Fotos als Seiten eingefügt`);
  } catch (e) { busy(false); console.error(e); toast(e.message || 'Die Bilder konnten nicht eingefügt werden.'); }
}
/* Seitenangabe wie „1-3, 5“ → Indizes (0-basiert) */
function parseRange(str, n) {
  const out = new Set();
  for (const part of String(str || '').split(/[,;\s]+/).filter(Boolean)) {
    const m = /^(\d+)(?:\s*[-–]\s*(\d+)?)?$/.exec(part); if (!m) continue;
    const a = +m[1], b = m[2] ? +m[2] : (/[-–]$/.test(part) ? n : a);
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= n) out.add(i - 1);
  }
  return [...out].sort((x, y) => x - y);
}
/* Seiten aus einem anderen Dokument der Bibliothek einfügen */
async function libPagesDialog() {
  if (!S.lib || !LIB) return;
  const docs = (await LIB.all()).filter(i => i.kind === 'doc' && !i.trashed && !i.deleted && !i.missing && i.id !== S.lib.id).sort((a, b) => (b.openedAt || b.updatedAt || 0) - (a.openedAt || a.updatedAt || 0));
  if (!docs.length) { toast('In der Bibliothek gibt es noch kein anderes Dokument.'); return; }
  let pick = docs[0].id;
  dialog('Seiten aus der Bibliothek einfügen', `<input class="field" id="lpQ" placeholder="Dokument suchen …" style="width:100%">
    <div class="libpick" id="lpList">${docs.slice(0, 120).map((d, i) => `<button type="button" data-id="${d.id}" aria-pressed="${i === 0}" title="${esc(d.name)}"><div class="ph" data-th="${d.id}"></div><span class="nm">${esc(d.name)}</span><small style="color:var(--muted)">${d.pages || '?'} S.</small></button>`).join('')}</div>
    <label class="fld"><span>Seiten</span><input class="field" id="lpRange" placeholder="alle, oder z. B. 1-3, 5"></label>`, 'Einfügen', b => {
    const it = docs.find(d => d.id === pick); if (!it) return false;
    const range = $('#lpRange', b).value.trim();
    (async () => {
      busy(true, `„${it.name}“ wird vorbereitet …`);
      try {
        const bytes = window.WBDrive && window.WBDrive.pdfOf ? await window.WBDrive.pdfOf(it) : (await LIB.loadDoc(it.id)).sources[0].bytes;
        let src = bytes;
        if (window.WBDecrypt && window.WBDecrypt.isEncrypted(src)) src = (await window.WBDecrypt.plain(src)).bytes;
        const n0 = (await PDFJS.getDocument({ data: src.slice(), isEvalSupported: false }).promise).numPages;
        let sel = range && !/^alle$/i.test(range) ? parseRange(range, n0) : null;
        if (sel && !sel.length) { busy(false); toast('Keine gültigen Seiten angegeben.'); return; }
        // nur die gewählten Seiten übernehmen, damit das Dokument klein bleibt
        if (sel && sel.length < n0) {
          try {
            const from = await PL.PDFDocument.load(src, { updateMetadata: false }), to = await PL.PDFDocument.create();
            (await to.copyPages(from, sel)).forEach(pg => to.addPage(pg));
            src = new Uint8Array(await to.save()); sel = null;
          } catch (e) { console.warn('Seiten kopieren', e); }
        }
        busy(false);
        const n = await insertPdfBytes(src, it.name + '.pdf', sel);
        toast(`${n} ${n === 1 ? 'Seite' : 'Seiten'} aus „${it.name}“ eingefügt`);
      } catch (e) { busy(false); console.error(e); toast('Einfügen fehlgeschlagen: ' + (e.message || e)); }
    })();
  });
  const b = $('#dlgBody');
  $('#lpList', b).onclick = e => { const x = e.target.closest('[data-id]'); if (!x) return; pick = x.dataset.id; $$('#lpList [data-id]', b).forEach(y => y.setAttribute('aria-pressed', String(y === x))); };
  $('#lpList', b).ondblclick = e => { if (e.target.closest('[data-id]')) $('#dlgOk').click(); };
  $('#lpQ', b).oninput = e => { const q = e.target.value.toLowerCase(); $$('#lpList [data-id]', b).forEach(x => { x.hidden = q && !x.title.toLowerCase().includes(q); }); };
  for (const d of docs.slice(0, 120)) LIB.getBlob('thumb:' + d.id).then(t => { const ph = $(`[data-th="${d.id}"]`, b); if (t && ph) { const im = document.createElement('img'); im.className = 'ph'; im.src = URL.createObjectURL(t); ph.replaceWith(im); } }).catch(() => {});
}

/* ---------- Mit Passwort speichern ---------- */
function secureDialog() {
  if (!window.WBDecrypt || !window.WBDecrypt.encrypt) { toast('Verschlüsseln ist hier nicht verfügbar.'); return; }
  dialog('Mit Passwort speichern', `<p class="note" style="margin:0 0 10px">Die PDF lässt sich danach nur mit diesem Passwort öffnen (AES-256, in Acrobat, Vorschau und Browsern).</p>
    <label class="fld"><span>Passwort</span><input class="field" id="sPw" type="password" autocomplete="new-password" minlength="4"></label>
    <label class="fld"><span>Wiederholen</span><input class="field" id="sPw2" type="password" autocomplete="new-password"></label>
    <label class="chk"><input type="checkbox" id="sPrint" checked> Drucken erlauben</label>
    <label class="chk"><input type="checkbox" id="sCopy" checked> Text kopieren erlauben</label>
    <label class="chk"><input type="checkbox" id="sEdit"> Bearbeiten und Kommentieren erlauben</label>
    <p class="err" id="sErr" style="color:var(--danger)"></p>`, 'Speichern', b => {
    const pw = $('#sPw', b).value, err = $('#sErr', b);
    if (pw.length < 4) { err.textContent = 'Bitte mindestens 4 Zeichen.'; return false; }
    if (pw !== $('#sPw2', b).value) { err.textContent = 'Die Passwörter stimmen nicht überein.'; return false; }
    const perms = { print: $('#sPrint', b).checked, copy: $('#sCopy', b).checked, edit: $('#sEdit', b).checked };
    (async () => {
      busy(true, 'PDF wird verschlüsselt …');
      try {
        const enc = await window.WBDecrypt.encrypt(await buildPdf(S.pages), pw, perms);
        busy(false);
        await saveBytes(enc, baseName() + '-geschützt.pdf');
      } catch (e) { busy(false); console.error(e); toast('Verschlüsseln fehlgeschlagen: ' + (e.message || e)); }
    })();
  });
}

/* ---------- Weiterlesen: letzte Seite je Dokument merken ---------- */
let posT = 0;
function rememberPos() {
  if (!S.lib || S.renderMode) return;
  clearTimeout(posT);
  posT = setTimeout(() => lsSet('pdfwb.pos.' + S.lib.id, JSON.stringify({ p: S.cur, n: S.pages.length, t: Date.now() })), 400);
}
function resumePos() {
  try {
    const v = JSON.parse(lsGet('pdfwb.pos.' + S.lib.id) || 'null');
    if (v && v.p > 0 && v.p < S.pages.length) { setTimeout(() => { viewer.scrollTop = els.get(S.pages[v.p].id).wrap.offsetTop - 16; setCurrent(v.p); toast(`Weiter auf Seite ${v.p + 1} von ${S.pages.length}`); }, 120); }
  } catch (e) { /* egal */ }
}

/* ---------- Schriftauswahl ---------- */
function fontUI() {
  if (!$('#wbFontCss')) {
    const st = document.createElement('style'); st.id = 'wbFontCss';
    st.textContent = Object.values(FONTS).filter(f => f.file).map(f => `@font-face{font-family:"${f.family}";src:url("fonts/${f.file}-Regular.ttf") format("truetype");font-weight:400;font-display:swap}` +
      (f.noBold ? '' : `@font-face{font-family:"${f.family}";src:url("fonts/${f.file}-Bold.ttf") format("truetype");font-weight:700;font-display:swap}`)).join('\n');
    document.head.appendChild(st);
  }
  const groups = {};
  for (const [k, f] of Object.entries(FONTS)) (groups[f.g] = groups[f.g] || []).push([k, f]);
  $('#fontSel').innerHTML = Object.entries(groups).map(([g, list]) => `<optgroup label="${g}">${list.map(([k, f]) => `<option value="${k}" style="font-family:${esc(f.css)}">${esc(f.label || k)}</option>`).join('')}</optgroup>`).join('');
}

/* ---------- KI-Assistent: Fragen zum Dokument, Zusammenfassen, Lernkarten, Handschrift erkennen ---------- */
const AIX = window.WBAI || null;
const ai = { scope: 'doc', msgs: [], ctxKey: '', busy: null, sel: null, setup: false };
const AI_INSTR = 'Du bist der KI-Assistent in der PDF Werkbank, einem PDF-Editor. Antworte auf Deutsch (außer wenn ausdrücklich übersetzt werden soll), klar, freundlich und knapp. Nutze einfaches Markdown: #### für Zwischenüberschriften, „- “ für Stichpunkte, **fett** für Schlüsselbegriffe. Stütze dich auf den mitgelieferten Inhalt; steht etwas nicht darin, sag das offen. Verweise auf Seiten im Format [S. 3].';
const scopeName = s => (s === 'sel' ? 'die markierte Stelle' : s === 'page' ? 'diese Seite' : 'das Dokument');
const AI_ACTIONS = [
  { k: 'sum', l: 'Zusammenfassen', i: 'list', p: s => `Fasse ${scopeName(s)} zusammen: ein Satz zum Thema, danach die wichtigsten Punkte als Stichpunkte mit Seitenangabe.` },
  { k: 'explain', l: 'Einfach erklären', i: 'bulb', p: s => `Erkläre ${scopeName(s)} so, dass man es ohne Vorwissen versteht, mit einem kurzen Beispiel.` },
  { k: 'cards', l: 'Lernkarten', i: 'cards', p: s => `Erstelle 8 bis 12 Lernkarten zu ${scopeName(s)}. Je Karte: eine Zeile „**F:** Frage“ und darunter „**A:** knappe Antwort [S. n]“.` },
  { k: 'quiz', l: 'Quiz', i: 'quiz', p: s => `Stelle mir 5 Multiple-Choice-Fragen zu ${scopeName(s)} mit je vier Antworten a) bis d). Die Lösungen mit kurzer Begründung erst ganz am Ende unter „#### Lösungen“.` },
  { k: 'todo', l: 'Aufgaben & Termine', i: 'checks', p: s => `Liste alle Aufgaben, To-dos, Termine und Fristen aus ${scopeName(s)} auf, mit Datum falls vorhanden und Seitenangabe. Gibt es keine, sag das in einem Satz.` },
  { k: 'translate', l: 'Übersetzen', i: 'translate', p: s => `Übersetze ${scopeName(s)} ins Deutsche; ist der Text schon Deutsch, dann ins Englische. Gib nur die Übersetzung aus und behalte die Gliederung bei.` },
  { k: 'ocr', l: 'Handschrift → Text', i: 'hand', img: true, p: s => `Schreibe den gesamten Inhalt ${s === 'doc' ? 'dieser Seiten' : 'dieser Seite'} als sauberen, gegliederten Text ab, auch Handschrift. Formeln in einfacher Schreibweise (z. B. x^2). Nichts hinzuerfinden; Unleserliches als [?].` },
];
/* Text einer Seite in Lesereihenfolge, plus eigene Texte und Notizen */
async function pageText(p) {
  const tc = await textContent(p), lines = [];
  let line = '', lastY = null;
  for (const it of tc.items) {
    const y = it.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2 && line) { lines.push(line); line = ''; }
    line += it.str; lastY = y;
    if (it.hasEOL) { lines.push(line); line = ''; }
  }
  if (line) lines.push(line);
  const own = p.annots.filter(a => (a.t === 'text' || a.t === 'note') && a.text).map(a => (a.t === 'note' ? 'Notiz: ' : '') + a.text)
    .concat(p.annots.filter(a => a.comment).map(a => 'Kommentar: ' + a.comment));
  return { text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), own };
}
/* Seite mit allen eigenen Elementen als JPEG (für Handschrift und Bilder) */
async function pageImage(p, maxSide = 1600) {
  const proxy = proxyOf(p), v1 = proxy.getViewport({ scale: 1, rotation: rotOf(p) });
  const k = Math.min(2.5, maxSide / Math.max(v1.width, v1.height)), vp = proxy.getViewport({ scale: k, rotation: rotOf(p) });
  const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
  await proxy.render({ canvasContext: ctx, viewport: vp }).promise;
  if (p.annots.length) {
    const [W, H] = dims(p), img = new Image();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="0 0 ${W} ${H}">${p.annots.map(annotSVG).join('')}</svg>`;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    ctx.drawImage(img, 0, 0, c.width, c.height);
  }
  return c.toDataURL('image/jpeg', 0.82);
}
const MAX_CTX = 90000, MAX_IMGS = 6;
async function aiContext(scope, wantImg) {
  const head = `Dokument: „${S.docName.replace(/\.pdf$/i, '')}“, ${S.pages.length} ${S.pages.length === 1 ? 'Seite' : 'Seiten'}.`;
  if (scope === 'sel' && ai.sel) return { head: head + ` Markierte Stelle auf Seite ${ai.sel.page}:`, text: ai.sel.text, images: [] };
  const list = scope === 'page' ? [S.cur] : S.pages.map((p, i) => i);
  const parts = [], images = [];
  let total = 0, cut = false, thin = 0;
  for (const i of list) {
    const p = S.pages[i], t = await pageText(p);
    const block = `[Seite ${i + 1}]\n${t.text}${t.own.length ? '\n' + t.own.join('\n') : ''}`;
    if (t.text.length < 120) thin++;
    if (total + block.length > MAX_CTX) { cut = true; break; }
    parts.push(block); total += block.length;
  }
  // Seiten ohne Text (Handschrift, Scans): Bilder mitschicken
  const needImg = wantImg || thin > list.length / 2 || (scope === 'page' && S.pages[S.cur].annots.some(a => a.t === 'pen'));
  if (needImg) {
    const order = scope === 'page' ? [S.cur] : [S.cur, ...list.filter(i => i !== S.cur)];
    for (const i of order.slice(0, MAX_IMGS)) images.push(await pageImage(S.pages[i]));
  }
  return { head: head + (cut ? ` (Text nach ${parts.length} Seiten gekürzt)` : '') + (images.length ? ` Dazu ${images.length === 1 ? 'ein Bild der Seite' : images.length + ' Seitenbilder'} (S. ${(scope === 'page' ? [S.cur] : [S.cur, ...list.filter(i => i !== S.cur)]).slice(0, MAX_IMGS).map(i => i + 1).join(', ')}).` : ''), text: parts.join('\n\n'), images };
}
/* Markdown light → HTML, Seitenverweise als Knöpfe */
function aiMd(t) {
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[(?:S\.|Seite)\s*(\d+)(?:\s*[–-]\s*\d+)?\]/g, (m, n) => `<button class="pg" data-pg="${n}" title="Zu Seite ${n}">S. ${n}</button>`);
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of esc(t).split('\n')) {
    const line = raw.trimEnd(), m = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(line), h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) { close(); out.push(`<h4>${inline(h[1])}</h4>`); }
    else if (m) { const tag = m[1] ? 'ol' : 'ul'; if (list !== tag) { close(); out.push(`<${tag}>`); list = tag; } out.push(`<li>${inline(m[2])}</li>`); }
    else if (!line.trim()) close();
    else { close(); out.push(`<p>${inline(line)}</p>`); }
  }
  close();
  return out.join('');
}
const aiPlain = t => t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/^\s*[-*]\s+/gm, '• ').replace(/\[(?:S\.|Seite)\s*(\d+)\]/g, '(S. $1)').trim();
/* lange Zeilen für Textfelder umbrechen */
function wrapFor(text, a, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      const t = line ? line + ' ' + w : w;
      if (line && measure(t, a) > maxW) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out.join('\n');
}
function aiAddMsg(kind, html) {
  const log = $('#aiLog'), em = $('.empty', log); if (em) em.remove();
  const d = document.createElement('div'); d.className = 'am ' + kind; d.innerHTML = html;
  log.appendChild(d); log.scrollTop = log.scrollHeight;
  return d;
}
function aiRender(el, text, streaming) {
  el.innerHTML = `<div class="tx">${aiMd(text)}${streaming ? '<span class="cursor"></span>' : ''}</div>` + (streaming ? '' : `<div class="acts">
    <button data-aa="copy">${icon('copy')}Kopieren</button><button data-aa="note">${icon('note')}Als Notiz</button><button data-aa="text">${icon('text')}Als Text</button><button data-aa="page">${icon('blank')}Als Seite</button></div>`);
  el.dataset.raw = text;
  const log = $('#aiLog'); if (log.scrollHeight - log.scrollTop - log.clientHeight < 140) log.scrollTop = log.scrollHeight;
}
function aiEmpty() {
  const I = AIX ? AIX.info() : null;
  $('#aiLog').innerHTML = `<div class="empty">${I && I.ready ? 'Wähle oben eine Aktion oder stell eine Frage zum Dokument, zum Beispiel „Worum geht es auf Seite 3?“' : 'Richte zuerst einen KI-Dienst ein (Zahnrad oben).'}</div>`;
}
function aiUpdateHead() {
  const I = AIX && AIX.info();
  $('#aiWho').textContent = I && I.ready ? `${I.name}${I.model ? ' · ' + I.model : ''}` : 'nicht eingerichtet';
  $('#aiSend').disabled = false;
  $('#aiSend').innerHTML = ai.busy ? icon('close') : icon('send');
  $('#aiSend').title = ai.busy ? 'Stopp' : 'Senden (Enter)';
}
async function aiShowSetup(on) {
  ai.setup = on;
  $('#aiSetup').hidden = !on; $('#aiMain').hidden = on;
  $('#aiCfg').setAttribute('aria-pressed', String(on));
  if (on) await AIX.renderSetup($('#aiSetup'), { onChange: I => { aiUpdateHead(); if (I.ready && ai.setup && !ai.keepSetup) aiShowSetup(false); aiEmpty(); } });
}
function aiSetScope(s) {
  ai.scope = s;
  $$('#aiScope button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === s)));
}
function toggleAI(on = $('#aiPanel').hidden, opts = {}) {
  if (!AIX) { toast('Die KI ist in dieser Fassung nicht verfügbar.'); return; }
  $('#aiPanel').hidden = !on; $('#btnAI').setAttribute('aria-pressed', String(on));
  $('#app').classList.toggle('aiopen', on && innerWidth > 1100);
  if (!on) { if (ai.busy) ai.busy.abort(); return; }
  if (!$('#calc').hidden && window.toggleCalc) window.toggleCalc(false);
  if (innerWidth > 760) $('#aiPanel').style.top = (propbar.getBoundingClientRect().bottom + 8) + 'px';
  aiUpdateHead();
  if (!AIX.info().ready) aiShowSetup(true); else if (ai.setup) aiShowSetup(false);
  if (!$('#aiLog').children.length) aiEmpty();
  if (!COARSE && !ai.setup) setTimeout(() => $('#aiInput').focus(), 30);
}
async function aiRun(question, opts = {}) {
  if (!AIX) return;
  if (!AIX.info().ready) { toggleAI(true); aiShowSetup(true); return; }
  if (ai.busy) return;
  if ($('#aiPanel').hidden) toggleAI(true);
  if (opts.scope) aiSetScope(opts.scope);
  const scope = ai.scope;
  if (scope === 'sel' && !ai.sel) aiSetScope('page');
  const key = scope + ':' + (scope === 'page' ? S.pages[S.cur].id : scope === 'sel' ? ai.sel.id : S.pages.length) + (opts.img ? ':img' : '');
  const first = ai.ctxKey !== key || !ai.msgs.length;
  if (first && ai.msgs.length) aiAddMsg('u', `<small>Neuer Bezug: ${esc(scope === 'sel' ? 'Auswahl' : scope === 'page' ? 'Seite ' + (S.cur + 1) : 'ganzes Dokument')}</small>`);
  if (first) { ai.msgs = []; ai.ctxKey = key; }
  aiAddMsg('u', esc(opts.label || question));
  const el = aiAddMsg('a', '<div class="tx"><span class="cursor"></span></div>');
  const ctrl = new AbortController(); ai.busy = ctrl; aiUpdateHead();
  const m = { role: 'user', text: question };
  try {
    if (first) {
      const c = await aiContext(scope, opts.img);
      if (!c.text.trim() && !c.images.length) throw new Error('Auf ' + (scope === 'page' ? 'dieser Seite' : 'den Seiten') + ' ist kein Text zu finden. Versuch „Handschrift → Text“.');
      m.text = `${c.head}\n\n<inhalt>\n${c.text}\n</inhalt>\n\n${question}`; m.images = c.images;
    }
    ai.msgs.push(m);
    const out = await AIX.ask({ instructions: AI_INSTR, messages: ai.msgs, signal: ctrl.signal, onDelta: (d, all) => aiRender(el, all, true) });
    ai.msgs.push({ role: 'assistant', text: out });
    aiRender(el, out || '(keine Antwort)', false);
  } catch (e) {
    if (ai.msgs[ai.msgs.length - 1] === m) ai.msgs.pop();
    if (ctrl.signal.aborted || (e && e.name === 'AbortError')) { const raw = el.querySelector('.tx') ? el.dataset.raw || '' : ''; if (raw) aiRender(el, raw + '\n\n_(abgebrochen)_', false); else el.remove(); }
    else { el.classList.add('err'); el.innerHTML = `<div class="tx">${esc(e.message || String(e))}</div>${e.auth || e.setup ? '<div class="acts"><button data-aa="setup">' + icon('gear') + 'KI einrichten</button></div>' : ''}`; }
  } finally { ai.busy = null; aiUpdateHead(); }
}
/* Antwort weiterverwenden */
async function aiAnswerAction(k, raw) {
  const p = S.pages[S.cur]; if (!p) return;
  const txt = aiPlain(raw);
  if (k === 'copy') { toast(await writeSysClip(txt) ? 'Antwort kopiert' : 'Kopieren nicht möglich'); return; }
  if (k === 'note') {
    const [W] = dims(p), [, cy] = viewCenter(p);
    pushHist(); const a = { id: uid(), t: 'note', x: W - NOTE - 18, y: Math.max(18, cy - 40), color: '#ffd400', text: txt.slice(0, 20000) };
    p.annots.push(a); drawAnnots(p); markDirty(); toast('Als Notiz auf Seite ' + (S.cur + 1) + ' angeheftet'); return;
  }
  if (k === 'text') {
    const [W] = dims(p), tp = TP.text;
    insertTextAnnot(wrapFor(txt, { size: tp.size, font: tp.font, bold: tp.bold }, W * 0.8), p); toast('Als Text eingefügt'); return;
  }
  if (k === 'page') {
    busy(true, 'Seite wird erstellt …');
    try { await insertPdfBytes(await aiPagePdf(raw), 'KI-Notiz.pdf'); busy(false); toast('Als neue Seite eingefügt'); }
    catch (e) { busy(false); console.error(e); toast('Seite konnte nicht erstellt werden.'); }
  }
}
/* Antwort als eigene A4-Seite (Inter, mit Überschriften und Stichpunkten) */
async function aiPagePdf(raw) {
  const out = await PL.PDFDocument.create();
  out.registerFontkit(await loadFontkit());
  const reg = await out.embedFont(await fontFile('Inter', false), { subset: true }), bold = await out.embedFont(await fontFile('Inter', true), { subset: true });
  const [W, H] = A4, M = 56, ink = PL.rgb(0.106, 0.129, 0.188), mut = PL.rgb(0.35, 0.39, 0.45);
  let pg = out.addPage([W, H]), y = H - M;
  const newPage = () => { pg = out.addPage([W, H]); y = H - M; };
  const draw = (text, font, size, x, color = ink) => {
    const words = text.split(/\s+/); let line = '';
    const flush = () => { if (y < M + size) newPage(); pg.drawText(line, { x, y: y - size, size, font, color }); y -= size * 1.45; line = ''; };
    for (const w of words) { const t = line ? line + ' ' + w : w; if (line && font.widthOfTextAtSize(t, size) > W - M - x) flush(); line = line ? line + ' ' + w : w; }
    if (line) flush();
  };
  draw('KI-Notiz · ' + S.docName.replace(/\.pdf$/i, ''), reg, 9, M, mut); y -= 6;
  for (const rawLine of raw.split('\n')) {
    const l = rawLine.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[(?:S\.|Seite)\s*(\d+)\]/g, '(S. $1)');
    if (!l.trim()) { y -= 6; continue; }
    const h = /^#{1,6}\s+(.*)$/.exec(l), li = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(l);
    if (h) { y -= 6; draw(h[1], bold, 14, M); }
    else if (li) { if (y < M + 12) newPage(); pg.drawText(li[1] ? li[1] + '.' : '•', { x: M + 4, y: y - 11, size: 11, font: reg, color: ink }); draw(li[2], reg, 11, M + 20); }
    else draw(l, reg, 11, M);
  }
  return new Uint8Array(await out.save());
}
function bindAI() {
  if (!AIX) { $('#btnAI').hidden = true; return; }
  $('#aiQuick').innerHTML = AI_ACTIONS.map(a => `<button type="button" data-q="${a.k}">${icon(a.i)}${esc(a.l)}</button>`).join('');
  $('#btnAI').onclick = () => toggleAI();
  $('#aiClose').onclick = () => toggleAI(false);
  $('#aiCfg').onclick = () => { ai.keepSetup = !ai.setup; aiShowSetup(!ai.setup); };
  $('#aiNew').onclick = () => { if (ai.busy) ai.busy.abort(); ai.msgs = []; ai.ctxKey = ''; $('#aiLog').innerHTML = ''; aiEmpty(); };
  $('#aiScope').onclick = e => { const b = e.target.closest('[data-v]'); if (b) aiSetScope(b.dataset.v); };
  $('#aiQuick').onclick = e => { const b = e.target.closest('[data-q]'); if (!b) return; const a = AI_ACTIONS.find(x => x.k === b.dataset.q); aiRun(a.p(ai.scope), { label: a.l + ' · ' + (ai.scope === 'sel' ? 'Auswahl' : ai.scope === 'page' ? 'Seite ' + (S.cur + 1) : 'Dokument'), img: a.img }); };
  $('#aiForm').onsubmit = e => { e.preventDefault(); if (ai.busy) { ai.busy.abort(); return; } const q = $('#aiInput').value.trim(); if (!q) return; $('#aiInput').value = ''; aiRun(q); };
  $('#aiInput').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#aiForm').requestSubmit(); } if (e.key === 'Escape') toggleAI(false); });
  $('#aiLog').onclick = e => {
    const pgb = e.target.closest('[data-pg]'); if (pgb) { const n = +pgb.dataset.pg; if (n >= 1 && n <= S.pages.length) scrollToPage(n - 1); return; }
    const b = e.target.closest('[data-aa]'); if (!b) return;
    if (b.dataset.aa === 'setup') { aiShowSetup(true); return; }
    aiAnswerAction(b.dataset.aa, b.closest('.am').dataset.raw || '');
  };
  AIX.onChange(() => aiUpdateHead());
}
/* aus der Schnellleiste: KI zu einer Markierung oder einem eigenen Text */
function aiForAnnot(p, a, kind) {
  const text = a.t === 'mark' ? a.text : a.text;
  if (!text) { toast('Hier ist kein Text zum Auswerten.'); return; }
  ai.sel = { id: a.id, text, page: S.pages.indexOf(p) + 1 };
  $('#aiScope [data-v=sel]').hidden = false;
  const act = AI_ACTIONS.find(x => x.k === kind);
  aiRun(act.p('sel'), { scope: 'sel', label: act.l + ' · „' + (text.length > 40 ? text.slice(0, 39) + '…' : text) + '“' });
}
/* Rechtschreibung eines eigenen Textfelds direkt verbessern */
async function aiFixText(p, a) {
  if (!AIX || !AIX.info().ready) { toggleAI(true); return; }
  setMsg('KI korrigiert den Text …', true);
  try {
    const out = (await AIX.ask({ instructions: 'Korrigiere Rechtschreibung, Grammatik und Zeichensetzung des Textes. Behalte Sprache, Inhalt, Zeilenumbrüche und Ton bei. Antworte ausschließlich mit dem korrigierten Text.', messages: [{ role: 'user', text: a.text }], maxTokens: 2000 })).trim();
    setMsg('');
    if (!out || out === a.text) { toast('Keine Fehler gefunden'); return; }
    pushHist(); a.text = out; drawAnnots(p); markDirty(); toast('Text korrigiert · Strg+Z macht es rückgängig');
  } catch (e) { setMsg(''); toast(e.message || String(e)); }
}

