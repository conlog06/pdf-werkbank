/* ---------- Seitenübersicht: alle Seiten im Raster sortieren, drehen, löschen ---------- */
const org = { el: null, sel: new Set(), last: null };
function organizer(on = true) {
  if (!on) { if (org.el) { org.el.remove(); org.el = null; document.removeEventListener('keydown', orgKey, true); buildViewer(); scrollToPage(S.cur); } return; }
  commitEdit(); closeMenu();
  org.sel = new Set(S.selPages.size > 1 ? S.selPages : S.pages[S.cur] ? [S.pages[S.cur].id] : []);
  const el = document.createElement('div'); el.className = 'orgv';
  el.innerHTML = `<header><b>Seitenübersicht</b><span class="note" id="orgInfo"></span><span class="grow"></span>
    <button class="btn" data-o="all">Alle</button><button class="ibtn" data-o="rotl" title="Links drehen">${icon('rotl')}</button><button class="ibtn" data-o="rotr" title="Rechts drehen">${icon('rotr')}</button>
    <button class="ibtn" data-o="left" title="Nach vorn">${icon('up').replace('M6 15l6-6 6 6', 'M15 6l-6 6 6 6')}</button><button class="ibtn" data-o="right" title="Nach hinten">${icon('up').replace('M6 15l6-6 6 6', 'M9 6l6 6-6 6')}</button>
    <button class="ibtn" data-o="dup" title="Duplizieren">${icon('dup')}</button><button class="ibtn" data-o="blank" title="Leere Seite dahinter">${icon('blank')}</button><button class="ibtn" data-o="extract" title="Als eigene PDF speichern">${icon('extract')}</button><button class="ibtn" data-o="del" title="Löschen">${icon('trash')}</button>
    <button class="btn primary" data-o="close">Fertig</button></header><div class="orggrid"></div>`;
  document.body.appendChild(el); org.el = el;
  document.addEventListener('keydown', orgKey, true);
  orgRender();
  el.addEventListener('click', orgClick);
  // Ziehen zum Umsortieren (Maus und Finger)
  let dragId = null, ghost = null, over = null;
  el.addEventListener('pointerdown', e => {
    const t = e.target.closest('.orgt'); if (!t || e.button > 0) return;
    const start = { x: e.clientX, y: e.clientY, id: t.dataset.id, timer: 0, moved: false };
    const begin = () => { dragId = start.id; t.classList.add('drag'); ghost = t.cloneNode(true); ghost.className = 'orgt ghost'; ghost.style.width = t.offsetWidth + 'px'; document.body.appendChild(ghost); };
    if (e.pointerType !== 'mouse') start.timer = setTimeout(begin, 350);
    const move = ev => {
      const d = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
      if (!dragId && e.pointerType === 'mouse' && d > 6) begin();
      if (!dragId) { if (d > 10) clearTimeout(start.timer); return; }
      ev.preventDefault(); start.moved = true;
      ghost.style.left = ev.clientX - ghost.offsetWidth / 2 + 'px'; ghost.style.top = ev.clientY - 40 + 'px';
      const h = document.elementFromPoint(ev.clientX, ev.clientY), ot = h && h.closest('.orgt:not(.ghost)');
      $$('.orgt.before,.orgt.after', el).forEach(x => x.classList.remove('before', 'after'));
      over = null;
      if (ot && ot.dataset.id !== dragId) { const r = ot.getBoundingClientRect(), after = ev.clientX > r.left + r.width / 2; ot.classList.add(after ? 'after' : 'before'); over = { id: ot.dataset.id, after }; }
    };
    const up = () => {
      clearTimeout(start.timer); removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
      if (!dragId) return;
      if (ghost) ghost.remove(); ghost = null;
      const ids = org.sel.has(dragId) ? S.pages.filter(p => org.sel.has(p.id)).map(p => p.id) : [dragId];
      if (over && !ids.includes(over.id)) orgMove(ids, over.id, over.after);
      dragId = null; over = null; orgRender();
      el.dataset.noclick = '1'; setTimeout(() => { delete el.dataset.noclick; }, 50);
    };
    addEventListener('pointermove', move, { capture: true, passive: false }); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  });
}
function orgKey(e) {
  if (!org.el) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); organizer(false); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input')) { e.preventDefault(); e.stopPropagation(); orgAct('del'); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); e.stopPropagation(); orgAct('all'); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopPropagation(); (e.shiftKey ? redo() : undo()).then(() => orgRender()); }
}
function orgMove(ids, targetId, after) {
  pushHist();
  const moving = S.pages.filter(p => ids.includes(p.id)), rest = S.pages.filter(p => !ids.includes(p.id));
  let at = rest.findIndex(p => p.id === targetId); if (at < 0) return; if (after) at++;
  rest.splice(at, 0, ...moving); S.pages = rest; S.cur = S.pages.indexOf(moving[0]); markDirty();
}
const orgThumbs = new Map();
function orgRender() {
  const g = $('.orggrid', org.el); if (!g) return;
  const sz = innerWidth < 600 ? 110 : 150;
  g.innerHTML = S.pages.map((p, i) => { const [W, H] = dims(p); return `<div class="orgt${org.sel.has(p.id) ? ' on' : ''}" data-id="${p.id}"><div class="orgc" style="aspect-ratio:${W}/${H};width:${sz}px"><canvas></canvas><svg viewBox="0 0 ${W} ${H}">${p.annots.map(annotSVG).join('')}</svg></div><span>${i + 1}</span></div>`; }).join('');
  $('#orgInfo', org.el).textContent = `${S.pages.length} Seiten${org.sel.size ? ' · ' + org.sel.size + ' ausgewählt' : ''} · Ziehen zum Sortieren`;
  const io = new IntersectionObserver(ents => ents.forEach(en => { if (!en.isIntersecting) return; io.unobserve(en.target); orgPaint(en.target); }), { root: g, rootMargin: '300px' });
  $$('.orgt', g).forEach(t => io.observe(t));
}
async function orgPaint(t) {
  const p = pageById(t.dataset.id); if (!p) return;
  const cv = $('canvas', t), w = $('.orgc', t).clientWidth, key = pkey(p) + '|' + rotOf(p) + '|' + w;
  const hit = orgThumbs.get(p.id);
  if (hit && hit.key === key) { cv.width = hit.c.width; cv.height = hit.c.height; cv.getContext('2d').drawImage(hit.c, 0, 0); return; }
  try {
    await ensureDerived(p);
    const pr = proxyOf(p), base = pr.getViewport({ scale: 1, rotation: rotOf(p) }), vp = pr.getViewport({ scale: w * Math.min(2, devicePixelRatio || 1) / base.width, rotation: rotOf(p) });
    cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
    await pr.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0);
    orgThumbs.set(p.id, { key, c }); if (orgThumbs.size > 120) orgThumbs.delete(orgThumbs.keys().next().value);
  } catch (e) { /* Vorschau egal */ }
}
function orgClick(e) {
  if (org.el.dataset.noclick) return;
  const b = e.target.closest('[data-o]'); if (b) { orgAct(b.dataset.o); return; }
  const t = e.target.closest('.orgt'); if (!t) return;
  const id = t.dataset.id;
  if (e.shiftKey && org.last) { const a = S.pages.findIndex(p => p.id === org.last), z = S.pages.findIndex(p => p.id === id); S.pages.slice(Math.min(a, z), Math.max(a, z) + 1).forEach(p => org.sel.add(p.id)); }
  else if (e.ctrlKey || e.metaKey || COARSE || org.sel.size > 1 && !e.detail) { if (org.sel.has(id)) org.sel.delete(id); else org.sel.add(id); }
  else if (e.detail >= 2) { S.cur = S.pages.findIndex(p => p.id === id); organizer(false); return; }
  else org.sel = new Set([id]);
  org.last = id;
  $$('.orgt', org.el).forEach(x => x.classList.toggle('on', org.sel.has(x.dataset.id)));
  $('#orgInfo', org.el).textContent = `${S.pages.length} Seiten${org.sel.size ? ' · ' + org.sel.size + ' ausgewählt' : ''}${COARSE ? ' · lange drücken und ziehen zum Sortieren' : ' · Doppelklick öffnet die Seite'}`;
}
async function orgAct(k) {
  const sel = S.pages.filter(p => org.sel.has(p.id));
  if (k === 'close') { if (sel.length) S.cur = S.pages.indexOf(sel[0]); organizer(false); return; }
  if (k === 'all') { org.sel = org.sel.size === S.pages.length ? new Set() : new Set(S.pages.map(p => p.id)); orgRender(); return; }
  if (!sel.length) { toast('Erst Seiten antippen'); return; }
  if (k === 'rotl' || k === 'rotr') { const d = k === 'rotl' ? -90 : 90; pushHist(); for (const p of sel) { const [W, H] = dims(p); p.annots = p.annots.map(a => rotAnnot(a, W, H, d)); p.rot = (p.rot + d + 360) % 360; } markDirty(); }
  else if (k === 'del') { if (sel.length >= S.pages.length) { toast('Mindestens eine Seite muss bleiben.'); return; } pushHist(); S.pages = S.pages.filter(p => !org.sel.has(p.id)); org.sel.clear(); S.cur = clamp(S.cur, 0, S.pages.length - 1); markDirty(); toast(sel.length === 1 ? 'Seite gelöscht' : `${sel.length} Seiten gelöscht`); }
  else if (k === 'dup') { pushHist(); const last = S.pages.indexOf(sel[sel.length - 1]); const copies = sel.map(p => { const c = clone(p); c.id = uid('p'); c.annots = c.annots.map(a => ({ ...a, id: uid() })); return c; }); S.pages.splice(last + 1, 0, ...copies); org.sel = new Set(copies.map(c => c.id)); markDirty(); }
  else if (k === 'left' || k === 'right') {
    const idx = S.pages.indexOf(sel[0]), end = S.pages.indexOf(sel[sel.length - 1]);
    if (k === 'left' && idx > 0) orgMove(sel.map(p => p.id), S.pages[idx - 1].id, false);
    else if (k === 'right' && end < S.pages.length - 1) orgMove(sel.map(p => p.id), S.pages[end + 1].id, true);
  }
  else if (k === 'blank') {
    const p0 = sel[sel.length - 1], [W, H] = dims(p0);
    S.cur = S.pages.indexOf(p0);
    await insertPaper('blank', [W, H], 1);
    org.sel = new Set([S.pages[S.cur + 1] ? S.pages[S.cur + 1].id : p0.id]);
  }
  else if (k === 'extract') { S.selPages = new Set(sel.map(p => p.id)); if (sel.length === 1) S.cur = S.pages.indexOf(sel[0]); await extractPages(); S.selPages.clear(); return; }
  orgRender();
}

/* ---------- Vergleichen ---------- */
async function compareDialog() {
  if (!window.WBCompare) { toast('Vergleichen ist hier nicht verfügbar.'); return; }
  commitEdit();
  const first = S.sources.get(S.pages[0] && S.pages[0].src);
  const opts = [['orig', 'Mit dem Original (vor meinen Änderungen)'], ['file', 'Mit einer PDF vom Gerät …']];
  if (window.WBCloud && WBCloud.anyEnabled()) opts.push(['cloud', 'Mit einer PDF aus der Cloud …']);
  if (LIB && window.WBDrive && window.WBDrive.pdfOf) opts.push(['lib', 'Mit einem Dokument aus der Bibliothek …']);
  dialog('Vergleichen', `<p class="note" style="margin:0">Zeigt beide Fassungen nebeneinander. Entfernter Text ist rot, neuer grün markiert, mit Liste aller Änderungen.</p>
    <div class="radios">${opts.map(([k, l], i) => `<label class="chkrow"><input type="radio" name="cmpw" value="${k}" ${i === (S.dirty || hasAnyCE() ? 0 : 1) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    <label class="fld" id="cmpLibW" hidden><span>Dokument</span><select class="field" id="cmpLib"></select></label>`, 'Vergleichen', b => {
    const w = $('[name=cmpw]:checked', b).value;
    if (w === 'file') { closeDlg(); const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,.pdf'; inp.onchange = async () => { const f = inp.files[0]; if (f) runCompare({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }, true); }; inp.click(); return false; }
    closeDlg();
    (async () => {
      if (w === 'orig') { if (!first) return; runCompare({ name: 'Original', bytes: first.bytes }, true, S.pages.filter(p => p.src === first.id)); }
      else if (w === 'cloud') { const f = await WBCloud.pick({ mode: 'open', accept: ['pdf'] }); if (f && f[0]) runCompare({ name: f[0].name, bytes: f[0].bytes }, true); }
      else if (w === 'lib') { const id = $('#cmpLib', b).value, it = await LIB.get(id); busy(true, 'Dokument wird geladen …'); try { const bytes = await window.WBDrive.pdfOf(it); busy(false); runCompare({ name: it.name, bytes }, true); } catch (e) { busy(false); toast('Laden fehlgeschlagen: ' + (e.message || e)); } }
    })();
    return false;
  });
  const b = $('#dlgBody');
  if (LIB && opts.some(o => o[0] === 'lib')) {
    const items = (await LIB.all()).filter(i => i.kind === 'doc' && !i.trashed && !i.deleted && (!S.lib || i.id !== S.lib.id)).sort((x, y) => (y.updated || 0) - (x.updated || 0));
    $('#cmpLib', b).innerHTML = items.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('');
  }
  b.onchange = () => { $('#cmpLibW', b).hidden = $('[name=cmpw]:checked', b).value !== 'lib'; };
}
const hasAnyCE = () => S.pages.some(p => hasCE(p) || p.annots.length);
/* other = ältere/andere Fassung (links), aktuelles Dokument rechts */
async function runCompare(other, mineRight, pages = S.pages) {
  busy(true, 'Vergleich wird vorbereitet …');
  try {
    const mine = await buildPdf(pages);
    busy(false);
    await WBCompare.open(mineRight ? { a: other, b: { name: S.docName.replace(/\.pdf$/i, '') + ' (aktuell)', bytes: mine } } : { a: { name: S.docName, bytes: mine }, b: other });
  } catch (e) { console.error(e); busy(false); toast('Vergleichen fehlgeschlagen: ' + (e.message || e)); }
}

/* ---------- Cloud: öffnen und speichern ---------- */
async function cloudOpen() {
  if (!window.WBCloud) return;
  const f = await WBCloud.pick({ mode: 'open', accept: ['pdf', 'werkbank'] });
  if (!f || !f[0]) return;
  await openFiles([new File([f[0].bytes], f[0].name, { type: /\.pdf$/i.test(f[0].name) ? 'application/pdf' : 'application/octet-stream' })], 'replace');
}
async function cloudSaveDoc() {
  if (!window.WBCloud) return;
  if (!WBCloud.anyEnabled()) { if (LIB) { if (await ask('Noch kein Cloud-Dienst verbunden', 'Dropbox, iCloud Drive oder Nextcloud verbindest du in der Bibliothek unten links unter „Cloud-Dienste“.', 'Zur Bibliothek', 'Abbrechen', false)) goLibrary(); } else toast('Noch kein Cloud-Dienst verbunden.'); return; }
  commitEdit();
  const r = await WBCloud.pick({ mode: 'save', name: baseName() + '.pdf', ext: '.pdf', make: () => buildPdf(S.pages) });
  if (r) toast(`In ${r.label} gespeichert: ${r.path.join(' › ')}`);
}

/* ---------- Alle Werkzeuge (Übersicht wie in Acrobat) ---------- */
const HUB = [
  ['Bearbeiten', [['objects', 'Inhalte bearbeiten', 'Texte, Bilder und Flächen der PDF verschieben, löschen, ändern', 'objects', 'tool'], ['edittext', 'Text ändern', 'Vorhandenen Text direkt umschreiben', 'edittext', 'tool'], ['redact', 'Schwärzen', 'Bereich schwärzen, Text wird gelöscht', 'redact', 'tool'], ['redactsearch', 'Suchen und schwärzen', 'Namen, E-Mails, IBANs im ganzen Dokument', 'redact'], ['wm', 'Wasserzeichen', 'Text quer über die Seiten', 'stamp'], ['pn', 'Seitenzahlen', 'Nummerieren in vielen Formaten', 'list']]],
  ['Einfügen', [['field', 'Formularfeld', 'Textfeld, Kästchen, Auswahl, Unterschrift', 'field'], ['detectfields', 'Formular erkennen', 'Linien und Kästchen werden zu Feldern', 'field'], ['table', 'Tabelle', 'Aus Excel einfügen oder eintippen', 'grid'], ['calc', 'Rechner und Live-Graphen', 'Formeln, Funktionen, Statistik', 'calc'], ['qr', 'QR-Code', 'Link oder Text als QR-Code', 'qr'], ['photos', 'Fotos oder Scans', 'Bilder als neue Seiten', 'image']]],
  ['Seiten', [['organize', 'Seitenübersicht', 'Alle Seiten sortieren, drehen, löschen', 'grid'], ['blank', 'Neue Seite / Notizpapier', 'Leer, liniert, kariert, punktiert', 'blank'], ['merge', 'PDF anhängen', 'Weitere PDF ans Ende', 'add'], ['extract', 'Seiten extrahieren', 'Auswahl als eigene PDF', 'extract']]],
  ['Lernen und Uni', [['record', 'Vorlesung aufnehmen', 'Ton mit deinen Notizen verknüpft', 'mic'], ['learn', 'Lernkarten und Quiz', 'Aus Markierungen oder mit KI', 'cards'], ['tasks', 'Aufgaben', 'Aus Kommentaren, mit Fristen', 'tasks'], ['searchlib', 'In allen Dokumenten suchen', 'Ein Begriff, alle Skripte', 'search'], ['split', 'Zweites Dokument daneben', 'Skript neben Übungsblatt', 'split'], ['hw2text', 'Handschrift in Text', 'Geschriebenes wird tippbar', 'text'], ['cite', 'Zitieren', 'Quelle mit Seitenzahl, BibTeX', 'quote'], ['exam', 'Probeklausur', 'KI stellt und korrigiert', 'exam'], ['mindmap', 'Mindmap', 'Kapitel und Markierungen', 'mindmap'], ['studystats', 'Lernstatistik', 'Zeit, Serie, Pomodoro', 'chart'], ['formula', 'Formel als LaTeX', 'Für Word, Notion, LaTeX', 'sigma'], ['transcript', 'Transkript', 'Vorlesung als Text, durchsuchbar', 'mic'], ['asklib', 'Bibliothek fragen', 'KI-Antworten aus allen Skripten', 'spark'], ['cardsx', 'Anki und Lerngruppe', 'Karten austauschen', 'cards']]],
  ['Büro', [['template', 'Neu aus Vorlage', 'Rechnung, Angebot, Planer', 'template'], ['sign', 'Digital signieren', 'Mit Zertifikat, prüfbar', 'sig'], ['verifysig', 'Signaturen prüfen', 'Wer, wann, unverändert?', 'check'], ['convert', 'Umwandeln', 'Word, Excel, Bilder, Text', 'convert'], ['autotoc', 'Inhaltsverzeichnis', 'Aus Überschriften, als Lesezeichen', 'toc'], ['headfoot', 'Kopf- und Fußzeilen', 'Titel, Datum, Seitenzahlen', 'hf'], ['einvoice', 'E-Rechnung ansehen', 'ZUGFeRD und XRechnung lesen', 'xml'], ['receipts', 'Belege scannen', 'Kassenbons erfassen, CSV', 'receipt'], ['mailmerge', 'Serienbrief', 'Platzhalter plus Tabelle', 'mail'], ['batch', 'Stapelverarbeitung', 'Viele PDFs auf einmal', 'layers'], ['pdfa', 'PDF/A speichern', 'Archivformat für Behörden', 'archive'], ['a11y', 'Barrierefreiheit', 'Prüfen und verbessern', 'access'], ['contract', 'Vertrag auswerten', 'Fristen, Kosten, Klauseln', 'sig'], ['ledger', 'Rechnungen und Mahnungen', 'Offene Posten, EÜR', 'receipt']]],
  ['Werkzeuge', [['ocr', 'Texterkennung (OCR)', 'Scans durchsuchbar machen', 'scan'], ['compress', 'PDF verkleinern', 'Fotos und Scans komprimieren', 'compress'], ['compare', 'Vergleichen', 'Zwei Fassungen Wort für Wort', 'compare'], ['stats', 'Dokument-Statistik', 'Wörter, Lesezeit, Elemente', 'list'], ['dictate', 'Diktieren', 'Sprache in ein Textfeld', 'comment'], ['speak', 'Vorlesen', 'Ab dieser Seite vorlesen', 'book']]],
  ['Speichern und teilen', [['cloudsave', 'In der Cloud speichern', 'Dropbox, iCloud, Nextcloud, Ordner', 'cloud'], ['cloudopen', 'Aus der Cloud öffnen', 'PDF aus deinem Cloud-Speicher', 'cloud'], ['collab', 'Gemeinsam bearbeiten', 'Link für Live-Zusammenarbeit', 'users'], ['werkbank', 'Werkbank-Datei', 'Bearbeitbar weitergeben (.werkbank)', 'save'], ['secure', 'Mit Passwort', 'AES-256 verschlüsselt speichern', 'lock'], ['marks', 'Kommentare als Text', 'Alle Markierungen mit Seitenzahl', 'note']]],
];
function toolsHub() {
  commitEdit(); closeMenu();
  const can = k => { const m = $(`#menu [data-act="${k}"]`); if (!m) return true; const h = m.closest('[hidden]'); return !(m.hidden || (h && h.id !== 'menu')); };
  dialog('Alle Werkzeuge', `<input class="field" id="hubQ" type="search" placeholder="Werkzeug suchen …" autocomplete="off" style="height:36px">
    <div class="hub">${HUB.map(([g, list]) => `<section><h4>${g}</h4><div class="hubg">${list.filter(([k, , , , kind]) => kind === 'tool' ? !!$(`[data-tool="${k}"]`) || TOOL_NAMES[k] : (ACTS_REF[k] || k === 'organize') && can(k)).map(([k, l, d, ic, kind]) => `<button type="button" class="hubt" data-h="${k}" data-kind="${kind || ''}" data-s="${esc((l + ' ' + d + ' ' + g).toLowerCase())}"><span class="hi">${icon(ic)}</span><span><b>${l}</b><small>${d}</small></span></button>`).join('')}</div></section>`).join('')}</div>`, 'Schließen', () => true);
  $('#dlgCancel').hidden = true;
  const b = $('#dlgBody'); $('#dlg .card').classList.add('wide');
  const q = $('#hubQ', b); if (!COARSE) setTimeout(() => q.focus(), 40);
  q.oninput = () => { const s = q.value.trim().toLowerCase(); $$('.hubt', b).forEach(t => { t.hidden = !!s && !t.dataset.s.includes(s); }); $$('.hub section', b).forEach(sec => { sec.hidden = !$$('.hubt', sec).some(t => !t.hidden); }); };
  q.onkeydown = e => { if (e.key === 'Enter') { const t = $$('.hubt', b).find(x => !x.hidden); if (t) t.click(); } };
  b.onclick = e => {
    const t = e.target.closest('[data-h]'); if (!t) return;
    closeDlg(); $('#dlg .card').classList.remove('wide');
    if (t.dataset.kind === 'tool') setTool(t.dataset.h); else ACTS_REF[t.dataset.h]();
  };
  $('#dlgOk').addEventListener('click', () => $('#dlg .card').classList.remove('wide'), { once: true });
}
let ACTS_REF = {};

/* ===================== Version 1.8 ===================== */
const DAYMS = 864e5;
const fmtDur = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
const allAnnots = () => S.pages.flatMap((p, i) => p.annots.map(a => ({ p, i, a })));
const findAnnot = aid => { for (const p of S.pages) { const a = p.annots.find(x => x.id === aid); if (a) return { p, a }; } return null; };
function gotoAnnot(aid) { const f = findAnnot(aid); if (!f) return; scrollToPage(S.pages.indexOf(f.p)); setTimeout(() => select(f.p.id, f.a.id), 120); }

/* ---------- 1. Vorlesung aufnehmen: Ton mit Notizen verknüpft (wie Notability) ---------- */
const REC = { mr: null, stream: null, id: null, t0: 0, paused: 0, pauseAt: 0, chunks: [], known: null, mime: '', bar: null, timer: 0 };
const recOk = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
const recNow = () => (REC.mr ? (REC.pauseAt || performance.now()) - REC.t0 - REC.paused : 0);
const savedAud = new Set();
async function recStart() {
  if (REC.mr) return;
  if (!recOk()) { toast('Aufnehmen wird von diesem Browser nicht unterstützt.'); return; }
  if (S.sample) { toast('Bitte zuerst ein eigenes Dokument öffnen oder anlegen.'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { toast(e && e.name === 'NotAllowedError' ? 'Kein Zugriff aufs Mikrofon. Bitte in den Einstellungen des Browsers bzw. des Systems erlauben.' : 'Kein Mikrofon gefunden.'); return; }
  const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 40000 } : {});
  Object.assign(REC, { mr, stream, id: uid('r'), t0: performance.now(), paused: 0, pauseAt: 0, chunks: [], mime: mr.mimeType || mime || 'audio/webm', known: new Set(allAnnots().map(x => x.a.id)) });
  mr.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
  mr.onstop = recFinish;
  mr.start(1000);
  if (S.player) closePlayer();
  recBar(); txLiveStart();
  $('#btnRec') && $('#btnRec').setAttribute('aria-pressed', 'true');
  toast('Aufnahme läuft · alles, was du jetzt schreibst, wird mit der Stelle in der Aufnahme verknüpft');
}
function recBar() {
  if (REC.bar) REC.bar.remove();
  const b = document.createElement('div'); b.className = 'recbar';
  b.innerHTML = `<span class="dot rec"></span><b class="rt">0:00</b><span class="rtx" aria-live="off"></span><button class="btn" data-r="pause">Pause</button><button class="btn primary" data-r="stop">Beenden</button>`;
  document.body.appendChild(b); REC.bar = b;
  b.addEventListener('click', e => { const k = e.target.closest('[data-r]'); if (!k) return; if (k.dataset.r === 'stop') recStop(); else recPause(); });
  clearInterval(REC.timer); REC.timer = setInterval(() => { const t = $('.rt', b); if (t) t.textContent = fmtDur(recNow()); }, 500);
}
function recPause() {
  if (!REC.mr) return;
  const btn = $('[data-r=pause]', REC.bar);
  if (REC.mr.state === 'recording') { REC.mr.pause(); REC.pauseAt = performance.now(); btn.textContent = 'Weiter'; REC.bar.classList.add('paused'); if (TX.sr) try { TX.sr.stop(); } catch (e) { /* egal */ } }
  else { REC.paused += performance.now() - REC.pauseAt; REC.pauseAt = 0; REC.mr.resume(); btn.textContent = 'Pause'; REC.bar.classList.remove('paused'); if (TX.sr && TX.on) try { TX.sr.start(); } catch (e) { /* läuft */ } }
}
function recStop() { if (!REC.mr) return; recStamp(); REC.dur = recNow(); REC.mr.stop(); REC.stream.getTracks().forEach(t => t.stop()); }
function recFinish() {
  clearInterval(REC.timer);
  const blob = new Blob(REC.chunks, { type: REC.mime }), id = REC.id, n = (S.recs || []).length + 1;
  S.recs = S.recs || [];
  S.recs.push({ id, name: `Aufnahme ${n} · ${new Date().toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, mime: REC.mime, dur: Math.round(REC.dur || 0), at: Date.now() });
  S.audio.set(id, blob); txLiveStop(id);
  if (REC.bar) REC.bar.remove();
  Object.assign(REC, { mr: null, stream: null, bar: null, chunks: [], known: null });
  $('#btnRec') && $('#btnRec').setAttribute('aria-pressed', 'false');
  markDirty(); persistAudio();
  const linked = allAnnots().filter(x => x.a.rec === id).length;
  toast(`Aufnahme gespeichert (${fmtDur(S.recs[S.recs.length - 1].dur)}) · ${linked} ${linked === 1 ? 'Notiz' : 'Notizen'} verknüpft`);
}
/* neue Elemente bekommen die Stelle in der Aufnahme (wird bei jeder Änderung aufgerufen) */
function recStamp() {
  if (!REC.mr || !REC.known) return;
  const t = Math.round(recNow());
  for (const p of S.pages) for (const a of p.annots) if (!REC.known.has(a.id)) { REC.known.add(a.id); if (!a.rec && !a.pn && !a.hf) { a.rec = REC.id; a.rt = t; } }
}
async function audioOf(id) {
  if (S.audio.has(id)) return S.audio.get(id);
  let r = null;
  try { if (S.lib && LIB) r = await LIB.getBlob(`aud:${S.lib.id}:${id}`); } catch (e) { /* weiter */ }
  if (!r) try { r = await idbGet('aud:' + id); } catch (e) { /* weiter */ }
  if (!r && S.lib && window.WBSync && WBSync.fetchDoc) { /* Aufnahme kommt mit dem nächsten Abgleich */ }
  if (r && r.blob) { S.audio.set(id, r.blob); return r.blob; }
  return null;
}
async function persistAudio() {
  for (const r of S.recs || []) {
    const blob = S.audio.get(r.id); if (!blob || savedAud.has(r.id)) continue;
    try {
      if (S.lib && LIB) await LIB.putBlob(`aud:${S.lib.id}:${r.id}`, { blob, mime: r.mime });
      else await idbSet('aud:' + r.id, { blob, mime: r.mime });
      savedAud.add(r.id);
    } catch (e) { console.warn('Aufnahme sichern', e); }
  }
}
/* Abspielen: Notizen erscheinen in der Reihenfolge, in der sie geschrieben wurden */
async function openPlayer(rid, at) {
  const r = (S.recs || []).find(x => x.id === rid) || (S.recs || [])[0];
  if (!r) { toast('Noch keine Aufnahme. Über ⋯ › Werkzeuge › Vorlesung aufnehmen starten.'); return; }
  const blob = await audioOf(r.id);
  if (!blob) { toast('Die Aufnahme ist auf diesem Gerät noch nicht vorhanden (wird mit dem Sync geladen).'); return; }
  if (S.player && S.player.rid === r.id) { if (at != null) { S.player.au.currentTime = at / 1000; S.player.au.play(); } return; }
  closePlayer();
  const au = new Audio(URL.createObjectURL(blob)); au.preload = 'auto';
  const bar = document.createElement('div'); bar.className = 'playbar';
  bar.innerHTML = `<button class="ibtn" data-p="back" title="15 s zurück">−15</button><button class="ibtn pbig" data-p="play" title="Abspielen (Leertaste)">${icon('play')}</button><button class="ibtn" data-p="fwd" title="15 s vor">+15</button>
    <span class="pt">0:00</span><input type="range" min="0" max="${Math.max(1, Math.round(r.dur / 1000))}" value="0" step="0.1" aria-label="Position"><span class="pt pd">${fmtDur(r.dur)}</span>
    <button class="btn" data-p="speed" title="Geschwindigkeit">1×</button>${S.recs.length > 1 ? `<select class="field" data-p="pick">${S.recs.map(x => `<option value="${x.id}" ${x.id === r.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : `<span class="pn" title="${esc(r.name)}">${esc(r.name)}</span>`}
    <button class="btn" data-p="tx" title="Transkript anzeigen">Text</button><button class="ibtn" data-p="dl" title="Aufnahme speichern">${icon('save')}</button><button class="ibtn" data-p="del" title="Aufnahme löschen">${icon('trash')}</button><button class="ibtn" data-p="close" title="Schließen">✕</button>`;
  document.body.appendChild(bar);
  S.player = { rid: r.id, au, bar, t: 0, raf: 0 };
  const range = $('input[type=range]', bar);
  const tick = () => {
    const t = au.currentTime * 1000, prev = S.player.t;
    $('.pt', bar).textContent = fmtDur(t); if (!range.matches(':active')) range.value = au.currentTime;
    if (Math.abs(t - prev) > 1) {
      const lo = Math.min(t, prev), hi = Math.max(t, prev);
      S.player.t = t;
      for (const p of S.pages) if (p.annots.some(a => a.rec === r.id && a.rt > lo && a.rt <= hi)) drawAnnots(p);
    }
    if (!au.paused) S.player.raf = requestAnimationFrame(tick);
  };
  au.onplay = () => { $('[data-p=play]', bar).innerHTML = icon('pause'); tick(); };
  au.onpause = () => { $('[data-p=play]', bar).innerHTML = icon('play'); cancelAnimationFrame(S.player.raf); };
  au.onended = au.onpause;
  au.onseeked = tick; au.ontimeupdate = () => { if (au.paused) tick(); };
  au.onloadedmetadata = () => { if (isFinite(au.duration)) { range.max = au.duration; $('.pd', bar).textContent = fmtDur(au.duration * 1000); } };
  range.oninput = () => { au.currentTime = +range.value; };
  // Zu Beginn alles „zukünftig“: nur Notizen bis zur aktuellen Stelle sind voll sichtbar
  S.player.t = at != null ? at : 0; S.pages.forEach(p => { if (p.annots.some(a => a.rec === r.id)) drawAnnots(p); });
  bar.addEventListener('click', async e => {
    const b = e.target.closest('[data-p]'); if (!b || b.tagName === 'SELECT') return;
    const k = b.dataset.p;
    if (k === 'play') au.paused ? au.play() : au.pause();
    else if (k === 'back') au.currentTime = Math.max(0, au.currentTime - 15);
    else if (k === 'fwd') au.currentTime = Math.min(au.duration || 1e9, au.currentTime + 15);
    else if (k === 'speed') { const sp = [1, 1.25, 1.5, 2, 0.75], i = (sp.indexOf(au.playbackRate) + 1) % sp.length; au.playbackRate = sp[i]; b.textContent = String(sp[i]).replace('.', ',') + '×'; }
    else if (k === 'dl') { const ext = /mp4/.test(r.mime) ? 'm4a' : /ogg/.test(r.mime) ? 'ogg' : 'webm'; await saveBytes(blob, `${baseName()} – ${r.name.replace(/[\\/:*?"<>|·]/g, '-')}.${ext}`); }
    else if (k === 'del') {
      if (!await ask('Aufnahme löschen?', `„${r.name}“ wird entfernt. Die Notizen bleiben, nur die Verknüpfung zur Aufnahme geht verloren.`, 'Löschen')) return;
      closePlayer(); S.recs = S.recs.filter(x => x.id !== r.id); S.audio.delete(r.id);
      for (const { a } of allAnnots()) if (a.rec === r.id) { delete a.rec; delete a.rt; }
      try { if (S.lib && LIB) await LIB.delBlob(`aud:${S.lib.id}:${r.id}`); else await idbDel('aud:' + r.id); } catch (er) { /* egal */ }
      markDirty(); S.pages.forEach(drawAnnots); toast('Aufnahme gelöscht');
    }
    else if (k === 'close') closePlayer();
    else if (k === 'tx') transcriptDialog(r.id);
  });
  $('[data-p=pick]', bar) && ($('[data-p=pick]', bar).onchange = e => openPlayer(e.target.value));
  if (at != null) { au.currentTime = at / 1000; }
  au.play().catch(() => {});
}
function closePlayer() {
  if (!S.player) return;
  const { au, bar, rid } = S.player;
  au.pause(); URL.revokeObjectURL(au.src); bar.remove(); cancelAnimationFrame(S.player.raf);
  S.player = null;
  S.pages.forEach(p => { if (p.annots.some(a => a.rec === rid)) drawAnnots(p); });
}
const playFuture = a => !!(S.player && a.rec === S.player.rid && a.rt > S.player.t);
function recordingsDialog() {
  const list = S.recs || [];
  if (!list.length) { dialog('Aufnahmen', `<p class="note" style="margin:0">Noch keine Aufnahme in diesem Dokument. Starte eine mit dem Mikrofon oben oder über ⋯ › Werkzeuge › <b>Vorlesung aufnehmen</b>. Alles, was du währenddessen schreibst, markierst oder zeichnest, wird mit der Stelle in der Aufnahme verknüpft: später auf eine Notiz tippen, und die Aufnahme springt genau dorthin.</p>`, 'Aufnahme starten', () => { recStart(); }); return; }
  dialog('Aufnahmen', `<div class="verlist">${list.map(r => `<div class="ver"><span><b>${esc(r.name)}</b><br><small class="note">${fmtDur(r.dur)} · ${allAnnots().filter(x => x.a.rec === r.id).length} verknüpfte Notizen</small></span><button class="btn" data-play="${r.id}">${icon('play')}Abspielen</button></div>`).join('')}</div>`, 'Neue Aufnahme', () => { recStart(); });
  $('#dlgBody').onclick = e => { const b = e.target.closest('[data-play]'); if (b) { closeDlg(); openPlayer(b.dataset.play); } };
}

/* ---------- 2. Lernkarten und Quiz ---------- */
const startDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };
const cardsDue = () => (S.cards || []).filter(c => (c.due || 0) <= Date.now());
function srs(c, q) {
  // vereinfachtes SM-2: 1 Nochmal, 2 Schwer, 3 Gut, 4 Leicht
  const n = { ...c, ef: c.ef || 2.5, ivl: c.ivl || 0, reps: c.reps || 0, lapses: c.lapses || 0 };
  if (q === 1) { n.reps = 0; n.ivl = 0; n.lapses++; n.ef = Math.max(1.3, n.ef - 0.2); n.due = Date.now() + 10 * 60000; return n; }
  n.reps++;
  n.ivl = n.reps === 1 ? (q === 4 ? 3 : 1) : n.reps === 2 ? (q === 2 ? 2 : q === 3 ? 3 : 6) : Math.round(n.ivl * n.ef * (q === 2 ? 0.75 : q === 4 ? 1.3 : 1));
  n.ef = Math.max(1.3, n.ef + (q === 2 ? -0.15 : q === 4 ? 0.15 : 0));
  n.due = startDay() + n.ivl * DAYMS + 4 * 3600e3;
  return n;
}
const ivlLabel = (c, q) => { const n = srs(c, q); return q === 1 ? '10 min' : n.ivl === 1 ? '1 Tag' : n.ivl + ' Tage'; };
async function cardsFromMarks() {
  commitEdit();
  const have = new Set((S.cards || []).map(c => c.src));
  const add = [];
  for (const p of S.pages) {
    const marks = p.annots.filter(a => a.t === 'mark' && a.text && a.text.trim().length > 1 && !have.has(a.id));
    if (!marks.length) continue;
    let ps = null; try { await analysisOf(p); ps = pageString(p); } catch (e) { /* ohne Zusammenhang */ }
    // Zeilen ohne Satzzeichen am Ende (Überschriften, Kopfzeilen) beenden einen Satz
    const flat = ps ? ps.s.split('\n').map(l => l.trim()).map((l, k, arr) => (l && k < arr.length - 1 && !/[.,;:!?\-–]$/.test(l) && l.length < 60 ? l + '.' : l)).join(' ').replace(/\s+/g, ' ') : '';
    for (const a of marks) {
      let t = a.text.replace(/\s+/g, ' ').trim();
      // angeschnittene Wörter vervollständigen
      { const i0 = flat.indexOf(t); if (i0 >= 0) { let s1 = i0, e1 = i0 + t.length; while (s1 > 0 && /[\p{L}\p{N}]/u.test(flat[s1 - 1])) s1--; while (e1 < flat.length && /[\p{L}\p{N}]/u.test(flat[e1])) e1++; t = flat.slice(s1, e1); } }
      let front = '', back = t;
      if (a.comment && a.comment.trim()) { front = a.comment.trim(); }
      else {
        const i = flat.indexOf(t);
        if (i >= 0) {
          let s0 = Math.max(flat.lastIndexOf('. ', i), flat.lastIndexOf('? ', i), flat.lastIndexOf('! ', i), flat.lastIndexOf(': ', i));
          s0 = s0 < 0 || i - s0 > 260 ? Math.max(0, i - 120) : s0 + 2;
          let e0 = flat.slice(i + t.length).search(/[.!?](\s|$)/); e0 = e0 < 0 || e0 > 220 ? Math.min(flat.length, i + t.length + 100) : i + t.length + e0 + 1;
          const sent = flat.slice(s0, e0).trim();
          if (sent.length > t.length + 12) front = sent.replace(t, '_____');
        }
        if (!front) front = `Erkläre: ${t.length > 90 ? t.slice(0, 88) + ' …' : t}`;
        if (/^Erkläre/.test(front)) back = t;
      }
      add.push({ id: uid('c'), front, back, pid: p.id, src: a.id, due: Date.now(), created: Date.now() });
    }
  }
  if (!add.length) { toast((S.cards || []).length ? 'Alle Markierungen sind schon Lernkarten.' : 'Keine Textmarkierungen gefunden. Markiere zuerst Text mit dem Textmarker.'); return 0; }
  pushHist(); S.cards = [...(S.cards || []), ...add]; markDirty(); renderLearn();
  toast(`${add.length} Lernkarten aus Markierungen erstellt`);
  return add.length;
}
async function cardsWithAI() {
  if (!AIX || !AIX.info().ready) { toast('Dafür zuerst den KI-Assistenten einrichten (Funken-Symbol oben).'); return; }
  dialog('Lernkarten mit KI', `<p class="note" style="margin:0">Die KI liest den Text und schreibt Fragen mit Antworten. Prüfe die Karten danach kurz.</p>
    <label class="fld"><span>Aus</span><select class="field" id="aiScope"><option value="doc">dem ganzen Dokument</option><option value="page">dieser Seite</option><option value="marks">meinen Markierungen</option></select></label>
    <label class="fld"><span>Anzahl</span><select class="field" id="aiN"><option>8</option><option selected>12</option><option>20</option></select></label>`, 'Erstellen', b => {
    const scope = $('#aiScope', b).value, n = +$('#aiN', b).value; closeDlg();
    (async () => {
      busy(true, 'KI schreibt Lernkarten …');
      try {
        let text = '';
        const pages = scope === 'page' ? [S.pages[S.cur]] : S.pages;
        for (const p of pages) {
          const i = S.pages.indexOf(p);
          if (scope === 'marks') { const m = p.annots.filter(a => a.t === 'mark' && a.text).map(a => a.text.trim()); if (m.length) text += `\n[Seite ${i + 1}]\n` + m.join('\n'); continue; }
          try { await analysisOf(p); const ps = pageString(p); if (ps && ps.s.trim()) text += `\n[Seite ${i + 1}]\n` + ps.s; } catch (e) { /* weiter */ }
          if (text.length > 24000) break;
        }
        if (!text.trim()) throw new Error(scope === 'marks' ? 'Keine Markierungen gefunden.' : 'Kein Text gefunden (bei Scans zuerst die Texterkennung ausführen).');
        const out = await AIX.ask({ instructions: `Du erstellst Lernkarten für Studierende auf Deutsch. Antworte NUR mit einem JSON-Array, ohne Erklärung, ohne Codeblock: [{"q":"Frage","a":"kurze, präzise Antwort","s":Seitenzahl}]. Genau ${n} Karten, je Antwort höchstens 2 Sätze. Nur Inhalte aus dem Text, prüfungsrelevante Begriffe, Definitionen, Zusammenhänge.`, messages: [{ role: 'user', text: text.slice(0, 26000) }], maxTokens: 3000 });
        const json = JSON.parse((out.match(/\[[\s\S]*\]/) || ['[]'])[0]);
        const add = json.filter(x => x && x.q && x.a).map(x => { const pg = S.pages[(+x.s || 1) - 1]; return { id: uid('c'), front: String(x.q).trim(), back: String(x.a).trim(), pid: pg ? pg.id : null, ai: true, due: Date.now(), created: Date.now() }; });
        busy(false);
        if (!add.length) throw new Error('Die KI hat keine Karten geliefert.');
        pushHist(); S.cards = [...(S.cards || []), ...add]; markDirty(); openSide('learn'); toast(`${add.length} Lernkarten von der KI erstellt`);
      } catch (e) { busy(false); toast(e.setup ? 'Bitte zuerst den KI-Assistenten einrichten.' : 'Lernkarten fehlgeschlagen: ' + (e.message || e)); }
    })();
    return false;
  });
}
function cardDialog(c) {
  const isNew = !c;
  dialog(isNew ? 'Lernkarte hinzufügen' : 'Lernkarte', `<label class="fld"><span>Vorderseite (Frage)</span><textarea class="field area" id="cFront" rows="3">${esc(c ? c.front : '')}</textarea></label>
    <label class="fld"><span>Rückseite (Antwort)</span><textarea class="field area" id="cBack" rows="3">${esc(c ? c.back : '')}</textarea></label>
    ${isNew ? '' : `<p class="note" style="margin:0">${c.reps ? `${c.reps}× gewusst · nächste Wiederholung ${new Date(c.due).toLocaleDateString('de-DE')}` : 'Noch nicht gelernt'}</p>`}`, isNew ? 'Hinzufügen' : 'Speichern', b => {
    const front = $('#cFront', b).value.trim(), back = $('#cBack', b).value.trim();
    if (!front || !back) { toast('Bitte beide Seiten ausfüllen.'); return false; }
    pushHist();
    if (isNew) { S.cards = [...(S.cards || []), { id: uid('c'), front, back, pid: S.pages[S.cur] && S.pages[S.cur].id, due: Date.now(), created: Date.now() }]; }
    else Object.assign(c, { front, back });
    markDirty(); renderLearn();
  });
  if (!isNew) { $('#dlgCancel').textContent = 'Löschen'; $('#dlgCancel').onclick = () => { pushHist(); S.cards = S.cards.filter(x => x.id !== c.id); markDirty(); renderLearn(); closeDlg(); }; }
}
function renderLearn() {
  const el = $('#learnPanel'); if (!el) return;
  const cards = S.cards || [], due = cardsDue();
  const pg = c => { const n = c.pid ? pageNo(c.pid) : null; return n ? `<span class="pg">${n}</span>` : ''; };
  el.innerHTML = `<div class="sphead"><span>Lernkarten</span><span>${cards.length ? `${due.length} fällig · ${cards.length}` : ''}</span></div>
    <div class="lacts"><button class="btn primary" data-l="study" ${due.length ? '' : 'disabled'}>${icon('cards')}Lernen${due.length ? ` (${due.length})` : ''}</button><button class="btn" data-l="quiz" ${cards.length >= 4 ? '' : 'disabled'} title="${cards.length >= 4 ? 'Quiz mit Auswahlantworten' : 'Ab 4 Karten'}">Quiz</button></div>
    <div class="lacts"><button class="btn" data-l="marks">${icon('hl')}Aus Markierungen</button>${AIX ? `<button class="btn" data-l="ai">${icon('spark')}Mit KI</button>` : ''}<button class="ibtn" data-l="add" title="Karte hinzufügen">${icon('add')}</button>${window.WBAnki ? `<button class="ibtn" data-l="x" title="Anki und Lerngruppe">${icon('send')}</button>` : ''}</div>` +
    (cards.length ? cards.map(c => `<button class="sitem" data-card="${c.id}"><span class="dot" style="background:${(c.due || 0) <= Date.now() ? 'var(--accent)' : c.reps >= 3 ? '#1f9d55' : '#c9ced8'}"></span><span class="tx">${esc(c.front.length > 110 ? c.front.slice(0, 108) + '…' : c.front)}<small>${(c.due || 0) <= Date.now() ? 'fällig' : 'in ' + Math.max(1, Math.round((c.due - Date.now()) / DAYMS)) + ' Tagen'}${c.ai ? ' · KI' : ''}</small></span>${pg(c)}</button>`).join('')
      : `<p class="sempty">Markiere wichtige Stellen mit dem Textmarker und tippe auf <b>Aus Markierungen</b>: Daraus werden Lückentexte. Ein Kommentar an der Markierung wird zur Frage. Gelernt wird mit Wiederholung im passenden Abstand.</p>`);
}
function studyOverlay(mode = 'learn') {
  const all = S.cards || [];
  let queue = mode === 'quiz' ? [...all].sort(() => Math.random() - 0.5).slice(0, 10) : cardsDue().sort((a, b) => (a.due || 0) - (b.due || 0));
  if (!queue.length) { toast(mode === 'quiz' ? 'Für ein Quiz braucht es mindestens 4 Lernkarten.' : 'Heute ist nichts mehr fällig. 🎉'); return; }
  if (mode === 'quiz' && all.length < 4) { toast('Für ein Quiz braucht es mindestens 4 Lernkarten.'); return; }
  const el = document.createElement('div'); el.className = 'study';
  document.body.appendChild(el);
  let i = 0, shown = false, right = 0, again = 0, pick = null;
  const total = queue.length;
  const close = () => { el.remove(); document.removeEventListener('keydown', key, true); renderLearn(); };
  const opts = c => { const others = all.filter(x => x.id !== c.id && x.back !== c.back).sort(() => Math.random() - 0.5).slice(0, 3).map(x => x.back); return [...others, c.back].sort(() => Math.random() - 0.5); };
  let curOpts = null;
  const render = () => {
    if (i >= queue.length) {
      el.innerHTML = `<div class="sbox"><header><b>${mode === 'quiz' ? 'Quiz' : 'Lernen'}</b><span class="grow"></span><button class="ibtn" data-s="close">✕</button></header><div class="sdone"><h2>${mode === 'quiz' ? `${right} von ${total} richtig` : 'Geschafft!'}</h2><p class="note">${mode === 'quiz' ? (right === total ? 'Alles richtig. Stark!' : 'Falsche Antworten kommen gleich wieder in die Wiederholung.') : `${total} Karten wiederholt${again ? `, ${again}× „Nochmal“` : ''}. Die nächsten kommen, wenn sie fällig sind.`}</p><button class="btn primary" data-s="close">Fertig</button></div></div>`;
      return;
    }
    const c = queue[i], n = c.pid ? pageNo(c.pid) : null;
    if (mode === 'quiz' && !curOpts) curOpts = opts(c);
    el.innerHTML = `<div class="sbox"><header><b>${mode === 'quiz' ? 'Quiz' : 'Lernen'}</b><span class="note">${i + 1} / ${queue.length}</span><span class="grow"></span>${n ? `<button class="btn" data-s="page">Seite ${n}</button>` : ''}<button class="ibtn" data-s="edit" title="Karte bearbeiten">${icon('edittext')}</button><button class="ibtn" data-s="close" title="Beenden (Esc)">✕</button></header>
      <div class="sprog"><i style="width:${i / queue.length * 100}%"></i></div>
      <div class="scard"><div class="sq">${esc(c.front)}</div>${mode === 'quiz'
        ? `<div class="sopts">${curOpts.map((o, k) => `<button class="sopt${pick != null ? (o === c.back ? ' ok' : k === pick ? ' bad' : '') : ''}" data-o="${k}" ${pick != null ? 'disabled' : ''}><kbd>${k + 1}</kbd>${esc(o)}</button>`).join('')}</div>${pick != null ? '<button class="btn primary snext" data-s="next">Weiter (Leertaste)</button>' : ''}`
        : shown ? `<div class="sa">${esc(c.back)}</div>` : ''}</div>
      ${mode === 'learn' ? (shown ? `<div class="srate">${[[1, 'Nochmal'], [2, 'Schwer'], [3, 'Gut'], [4, 'Leicht']].map(([q, l]) => `<button class="btn${q === 3 ? ' primary' : ''}" data-q="${q}"><b>${l}</b><small>${ivlLabel(c, q)}</small></button>`).join('')}</div>` : `<div class="srate"><button class="btn primary sshow" data-s="show">Antwort zeigen <kbd>Leertaste</kbd></button></div>`) : ''}</div>`;
  };
  const rate = q => {
    const c = queue[i], idx = S.cards.findIndex(x => x.id === c.id);
    if (idx >= 0) { S.cards[idx] = srs(S.cards[idx], q); markDirty(); }
    if (window.WBStats) WBStats.card(q > 1);
    if (q === 1) { again++; queue.push(c); }
    i++; shown = false; render();
  };
  const choose = k => {
    if (pick != null) return;
    const c = queue[i]; pick = k;
    const ok = curOpts[k] === c.back; if (ok) right++;
    const idx = S.cards.findIndex(x => x.id === c.id);
    if (idx >= 0) { S.cards[idx] = ok ? { ...S.cards[idx], quizOk: (S.cards[idx].quizOk || 0) + 1 } : srs(S.cards[idx], 1); markDirty(); }
    if (window.WBStats) WBStats.card(ok);
    render();
  };
  const next = () => { i++; pick = null; curOpts = null; render(); };
  const key = e => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (i >= queue.length) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); } return; }
    if (mode === 'learn') {
      if (!shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); shown = true; render(); }
      else if (shown && /^[1-4]$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); rate(+e.key); }
      else if (shown && e.key === ' ') { e.preventDefault(); e.stopPropagation(); rate(3); }
    } else {
      if (pick == null && /^[1-4]$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); choose(+e.key - 1); }
      else if (pick != null && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); next(); }
    }
  };
  document.addEventListener('keydown', key, true);
  el.addEventListener('click', e => {
    if (e.target === el) return;
    const s = e.target.closest('[data-s]'), q = e.target.closest('[data-q]'), o = e.target.closest('[data-o]');
    if (q) { rate(+q.dataset.q); return; }
    if (o) { choose(+o.dataset.o); return; }
    if (!s) { if (mode === 'learn' && !shown && e.target.closest('.scard')) { shown = true; render(); } return; }
    if (s.dataset.s === 'close') close();
    else if (s.dataset.s === 'show') { shown = true; render(); }
    else if (s.dataset.s === 'next') next();
    else if (s.dataset.s === 'page') { const c = queue[i]; close(); scrollToPage(pageNo(c.pid) - 1); if (c.src) setTimeout(() => gotoAnnot(c.src), 150); }
    else if (s.dataset.s === 'edit') { const c = S.cards.find(x => x.id === queue[i].id); if (c) { close(); cardDialog(c); } }
  });
  render();
}

