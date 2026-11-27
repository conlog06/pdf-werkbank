/* ---------- Textbearbeitung ---------- */
function editText(p, a, isNew, before, extra) {
  if (S.editing) commitEdit();
  const el = els.get(p.id); if (!el) return;
  const ta = document.createElement('textarea');
  ta.className = 'ted'; ta.value = a.text; ta.spellcheck = false; ta.setAttribute('aria-label', 'Text bearbeiten');
  S.editing = { p, a, ta, isNew, before: before || snap(), orig: a.text, extra: !!extra, styled: false };
  styleTA();
  el.wrap.append(ta);
  drawAnnots(p); renderProps();
  requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
  ta.addEventListener('input', () => { a.text = ta.value; styleTA(); });
  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' || (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey))) { ev.preventDefault(); commitEdit(); }
    ev.stopPropagation();
  });
  ta.addEventListener('blur', ev => {
    if (ev.relatedTarget && propbar.contains(ev.relatedTarget)) return;
    setTimeout(() => { if (S.editing && S.editing.ta === ta && document.activeElement !== ta && !propbar.contains(document.activeElement)) commitEdit(); }, 0);
  });
}
function styleTA() {
  const ed = S.editing; if (!ed) return;
  const { a, ta } = ed, z = S.zoom, f = FONT(a.font);
  const lines = (ta.value || ' ').split('\n');
  ta.style.left = a.x * z + 'px'; ta.style.top = a.y * z + 'px';
  ta.style.font = `${fw(a)} ${a.size * z}px/${LH} ${f.css}`;
  ta.style.color = a.color; ta.style.textAlign = a.align || 'left';
  ta.style.width = (Math.max(...lines.map(l => measure(l || ' ', a))) + a.size) * z + 'px';
  ta.style.height = lines.length * LH * a.size * z + 'px';
}
function commitEdit() {
  commitCEdit();
  const ed = S.editing; if (!ed) return;
  S.editing = null;
  const { p, a, ta, isNew, before } = ed;
  const txt = ta.value.replace(/\s+$/, '');
  ta.remove();
  a.text = txt;
  const has = !!txt.trim();
  let changed = false;
  if (isNew) {
    if (has) { p.annots.push(a); changed = true; }
    else if (ed.extra) changed = true;
  } else if (!has) { p.annots = p.annots.filter(x => x !== a); changed = true; }
  else if (txt !== ed.orig || ed.styled) changed = true;
  if (changed) { S.hist.push(before); S.fut.length = 0; markDirty(); }
  else if (ed.extra) { /* nichts */ }
  drawAnnots(p); updateUndo(); renderProps();
}

/* ---------- Text in der PDF finden ---------- */
async function textContent(p) {
  const key = pkey(p);
  let tc = S.textCache.get(key);
  if (!tc) { tc = await proxyOf(p).getTextContent(); S.textCache.set(key, tc); }
  return tc;
}
function itemGeom(vp, it, s0 = 0, s1 = 1) {
  const tx = PDFJS.Util.transform(vp.transform, it.transform);
  const fh = Math.hypot(tx[2], tx[3]) || 1, ux = tx[2] / fh, uy = tx[3] / fh;
  const dl = Math.hypot(tx[0], tx[1]) || 1, dx = tx[0] / dl, dy = tx[1] / dl;
  const w = it.width || 0;
  const bx = tx[4] + dx * w * s0, by = tx[5] + dy * w * s0, L = w * (s1 - s0);
  const pts = [];
  for (const k of [-0.24, 0.92]) for (const m of [0, L]) pts.push([bx + dx * m + ux * k * fh, by + dy * m + uy * k * fh]);
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, fh };
}
async function replaceTextAt(p, pt) {
  let tc;
  try { tc = await textContent(p); } catch (e) { toast('Der Text dieser Seite konnte nicht gelesen werden.'); return; }
  const vp = proxyOf(p).getViewport({ scale: 1, rotation: rotOf(p) });
  let best = null;
  for (const it of tc.items) {
    if (!it.str || !it.str.trim() || !it.width) continue;
    const g = itemGeom(vp, it), pad = 1.5;
    if (pt[0] >= g.x - pad && pt[0] <= g.x + g.w + pad && pt[1] >= g.y - pad && pt[1] <= g.y + g.h + pad) {
      if (!best || g.w * g.h < best.g.w * best.g.h) best = { it, g };
    }
  }
  if (!best) { toast('An dieser Stelle wurde kein Text gefunden.'); return; }
  const before = snap(), g = best.g;
  const famRaw = ((tc.styles[best.it.fontName] || {}).fontFamily || '').toLowerCase();
  const font = famRaw.includes('mono') ? 'Courier' : famRaw.includes('serif') && !famRaw.includes('sans') ? 'Times' : 'Helvetica';
  const size = Math.max(4, Math.round(g.fh * 2) / 2);
  p.annots.push({ id: uid(), t: 'white', x: g.x - 1, y: g.y - 1, w: g.w + 2, h: g.h + 2 });
  const a = { id: uid(), t: 'text', x: g.x, y: g.y + 0.92 * g.fh - FONT(font).bl * size, text: best.it.str, color: '#000000', size, font, bold: /bold|black|heavy/i.test(best.it.fontName + famRaw) };
  editText(p, a, true, before, true);
  if (S.editing) S.editing.ta.select();
}

/* ---------- Suche ---------- */
let findTok = 0, findT;
/* Suche 2.0: findet Treffer über Zeilen- und Textgrenzen, trennt Silbentrennung, durchsucht eigene Notizen und Textfelder */
const FIND_OPT = (() => { try { return JSON.parse(lsGet('pdfwb.findopt') || '{}'); } catch (e) { return {}; } })();
const foldAcc = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
function pageFlat(tc) {
  // Text der Seite als ein String mit Zuordnung Zeichen → Textstück
  let s = ''; const map = [];
  const items = tc.items.filter(it => typeof it.str === 'string');
  items.forEach((it, k) => {
    const str = it.str;
    if (s && !/\s$/.test(s) && str && !/^\s/.test(str)) {
      const prev = items[k - 1], hyph = /[A-Za-zÄÖÜäöüß]-$/.test(s) && prev && (prev.hasEOL || Math.abs(prev.transform[5] - it.transform[5]) > 2);
      if (hyph) { s = s.slice(0, -1); map.pop(); }
      else if (prev && (prev.hasEOL || Math.abs(prev.transform[5] - it.transform[5]) > 2 || it.transform[4] - (prev.transform[4] + (prev.width || 0)) > 1.5)) { s += ' '; map.push(null); }
    }
    for (let j = 0; j < str.length; j++) { s += str[j]; map.push([it, j, str.length]); }
    if (it.hasEOL && !/\s$/.test(s) && !/[A-Za-zÄÖÜäöüß]-$/.test(s)) { s += ' '; map.push(null); }
  });
  return { s, map };
}
function findRx(q) {
  let src = foldAcc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  if (FIND_OPT.word) src = '(?<![\\p{L}\\p{N}])' + src + '(?![\\p{L}\\p{N}])';
  return new RegExp(src, 'gu' + (FIND_OPT.case ? '' : 'i'));
}
async function runFind(q) {
  const tok = ++findTok;
  q = q.trim();
  const qk = q.toLowerCase() + (FIND_OPT.case ? '|c' : '') + (FIND_OPT.word ? '|w' : '');
  if (q.length < 2) { S.find = null; S.pages.forEach(drawHits); $('#findCount').textContent = ''; findList(false); return; }
  $('#findCount').textContent = '…';
  const rx = findRx(q), hits = [];
  for (const p of S.pages) {
    let tc; try { tc = await textContent(p); } catch (e) { continue; }
    if (tok !== findTok) return;
    const { s, map } = pageFlat(tc), fs = foldAcc(s);
    // foldAcc kann die Länge ändern (ß → ss); dann Zuordnung über Zeichenweise Faltung
    let idx = null;
    if (fs.length !== s.length) { idx = []; for (let i = 0; i < s.length; i++) { const f = foldAcc(s[i]); for (let k = 0; k < f.length; k++) idx.push(i); } }
    rx.lastIndex = 0; let m;
    while ((m = rx.exec(fs))) {
      if (!m[0].length) { rx.lastIndex++; continue; }
      const a = idx ? idx[m.index] : m.index, b = idx ? idx[m.index + m[0].length - 1] + 1 : m.index + m[0].length;
      const parts = []; let cur = null;
      for (let i = a; i < b; i++) {
        const c = map[i]; if (!c) continue;
        if (cur && cur.it === c[0] && cur.e === c[1]) cur.e++;
        else { cur = { it: c[0], b: c[1], e: c[1] + 1, n: c[2] }; parts.push(cur); }
      }
      if (!parts.length) continue;
      hits.push({ pid: p.id, parts: parts.map(x => ({ it: x.it, s0: x.b / x.n, s1: x.e / x.n })), it: parts[0].it, s0: parts[0].b / parts[0].n, s1: parts[0].e / parts[0].n, ctx: [s.slice(Math.max(0, a - 40), a), s.slice(a, b), s.slice(b, b + 50)] });
      if (hits.length > 5000) break;
    }
    // eigene Notizen, Textfelder, Kommentare
    for (const an of p.annots) {
      const t = [an.text, an.comment].filter(Boolean).join(' '); if (!t) continue;
      const ft = foldAcc(t); rx.lastIndex = 0; const mm = rx.exec(ft); if (!mm) continue;
      hits.push({ pid: p.id, aid: an.id, ctx: [t.slice(Math.max(0, mm.index - 30), mm.index), t.slice(mm.index, mm.index + mm[0].length), t.slice(mm.index + mm[0].length, mm.index + mm[0].length + 50)], own: an.t });
    }
  }
  for (const r of S.recs || []) for (const sg of r.tx || []) {
    const ft = foldAcc(sg.text); rx.lastIndex = 0; const mm = rx.exec(ft); if (!mm) continue;
    hits.push({ rid: r.id, t: sg.t, ctx: [sg.text.slice(Math.max(0, mm.index - 30), mm.index), sg.text.slice(mm.index, mm.index + mm[0].length), sg.text.slice(mm.index + mm[0].length, mm.index + mm[0].length + 50)] });
  }
  S.find = { q: q.toLowerCase(), key: qk, hits, i: hits.length ? 0 : -1 };
  S.pages.forEach(drawHits);
  findList(document.activeElement === $('#findInput') || !$('#findList').hidden ? true : undefined);
  if (hits.length) goHit(0); else $('#findCount').textContent = 'Keine';
}
function hitsSVG(p) {
  if (!S.find || !S.find.hits.length) return '';
  const vp = proxyOf(p) ? proxyOf(p).getViewport({ scale: 1, rotation: rotOf(p) }) : null;
  if (!vp) return '';
  return S.find.hits.map((h, i) => {
    if (h.pid !== p.id || !h.parts) return '';
    return h.parts.map(pt => { const g = itemGeom(vp, pt.it, pt.s0, pt.s1); return `<rect class="hit${i === S.find.i ? ' on' : ''}" x="${r2(g.x)}" y="${r2(g.y)}" width="${r2(g.w)}" height="${r2(g.h)}" rx="1.5"/>`; }).join('');
  }).join('');
}
function drawHits(p) { const e = els.get(p.id); if (e) { const g = $('.hits', e.svg); if (g) g.innerHTML = hitsSVG(p); } }
function goHit(i) {
  const f = S.find; if (!f || !f.hits.length) return;
  const prev = f.hits[f.i];
  f.i = (i + f.hits.length) % f.hits.length;
  const h = f.hits[f.i];
  if (h.rid) { $('#findCount').textContent = `${f.i + 1}/${f.hits.length}`; openPlayer(h.rid, h.t); return; }
  const p = pageById(h.pid);
  if (prev && prev.pid && prev.pid !== h.pid) drawHits(pageById(prev.pid));
  drawHits(p);
  $('#findCount').textContent = `${f.i + 1}/${f.hits.length}`;
  const lst = $('#findList'); if (lst && !lst.hidden) { $$('.fl-on', lst).forEach(x => x.classList.remove('fl-on')); const r = $(`[data-h="${f.i}"]`, lst); if (r) { r.classList.add('fl-on'); r.scrollIntoView({ block: 'nearest' }); } }
  if (h.aid) { setCurrent(S.pages.indexOf(p)); gotoAnnot(h.aid); return; }
  const e = els.get(p.id), g = itemGeom(proxyOf(p).getViewport({ scale: 1, rotation: rotOf(p) }), h.it, h.s0, h.s1);
  viewer.scrollTo({ top: e.wrap.offsetTop + g.y * S.zoom - viewer.clientHeight * 0.35, left: Math.max(0, e.wrap.offsetLeft + g.x * S.zoom - viewer.clientWidth / 2), behavior: reduceMotion ? 'auto' : 'smooth' });
  setCurrent(S.pages.indexOf(p));
}
function openFind() { const f = $('.find'), fi = $('#findInput'); f.classList.add('open'); fi.focus(); fi.select(); if (S.find) findList(true); }
/* Liste zu; im schmalen Fenster das Feld nur einklappen, wenn nichts gesucht wird */
function closeFind(soft) {
  findList(false);
  const fi = $('#findInput');
  if (!soft || !fi.value.trim()) $('.find').classList.remove('open');
  if (!soft) fi.blur();
}
/* Trefferliste unter dem Suchfeld */
function findList(show) {
  const box = $('#findList'); if (!box) return;
  const f = S.find;
  if (show === false || !f) { box.hidden = true; if (!f) box.innerHTML = ''; return; }
  const per = new Map(); f.hits.forEach(h => { if (h.pid) per.set(h.pid, (per.get(h.pid) || 0) + 1); });
  box.innerHTML = `<div class="fl-h"><span>${f.hits.length ? `${f.hits.length} ${f.hits.length === 1 ? 'Treffer' : 'Treffer'} auf ${per.size} ${per.size === 1 ? 'Seite' : 'Seiten'}` : 'Keine Treffer'}</span>
    <label title="Groß- und Kleinschreibung beachten"><input type="checkbox" data-fo="case" ${FIND_OPT.case ? 'checked' : ''}>Aa</label><label title="Nur ganze Wörter"><input type="checkbox" data-fo="word" ${FIND_OPT.word ? 'checked' : ''}>Wort</label></div>
    <div class="fl-l">${f.hits.slice(0, 300).map((h, i) => `<button type="button" class="fl-r${i === f.i ? ' fl-on' : ''}" data-h="${i}"><span class="fl-p">${h.rid ? `${icon('mic')} ${fmtDur(h.t)}` : `S. ${pageNo(h.pid)}`}${h.aid ? ' · ' + ({ note: 'Notiz', text: 'Text', mark: 'Markierung' }[h.own] || 'Element') : ''}</span><span class="fl-c">${h.ctx[0] ? '…' + esc(h.ctx[0].replace(/\s+/g, ' ')) : ''}<mark>${esc(h.ctx[1])}</mark>${esc(h.ctx[2].replace(/\s+/g, ' '))}…</span></button>`).join('')}${f.hits.length > 300 ? `<p class="note" style="padding:6px 10px">… und ${f.hits.length - 300} weitere</p>` : ''}</div>
    ${LIB && window.WBSearch ? `<button type="button" class="fl-lib" data-fl="lib">${icon('search')}„${esc(f.q)}“ in der ganzen Bibliothek suchen</button>` : ''}`;
  if (show === true) box.hidden = false;
}

/* ---------- Seiten verwalten ---------- */
function targetPages() {
  if (S.selPages.size > 1) return S.pages.filter(p => S.selPages.has(p.id));
  return S.pages[S.cur] ? [S.pages[S.cur]] : [];
}
function rotatePages(d) {
  commitEdit();
  const ps = targetPages(); if (!ps.length) return;
  pushHist();
  for (const p of ps) { const [W, H] = dims(p); p.annots = p.annots.map(a => rotAnnot(a, W, H, d)); p.rot = (p.rot + d + 360) % 360; }
  if (S.sel) S.sel = null;
  ps.forEach(refreshPage); markDirty(); updateStatus(); renderProps();
}
function deletePages() {
  commitEdit();
  const ps = targetPages(); if (!ps.length) return;
  if (ps.length >= S.pages.length) { toast('Mindestens eine Seite muss im Dokument bleiben.'); return; }
  pushHist();
  const ids = new Set(ps.map(p => p.id));
  const first = S.pages.findIndex(p => ids.has(p.id));
  S.pages = S.pages.filter(p => !ids.has(p.id));
  S.selPages.clear(); S.sel = null; S.cur = clamp(first, 0, S.pages.length - 1);
  markDirty(); buildViewer(); scrollToPage(S.cur);
  toast(ps.length === 1 ? 'Seite gelöscht' : `${ps.length} Seiten gelöscht`);
}
/* ---------- Notizpapier ---------- */
const PAPERS = { blank: 'Leer', lined: 'Liniert', grid: 'Kariert', dots: 'Punktiert' };
const FORMATS = { a4p: ['A4 hoch', [595.28, 841.89]], a4l: ['A4 quer', [841.89, 595.28]], a5p: ['A5 hoch', [419.53, 595.28]], letter: ['US Letter', [612, 792]] };
async function makePaper(kind, size, count = 1) {
  const d = await PL.PDFDocument.create(), [W, H] = size, mm = 72 / 25.4, c = PL.rgb(0.68, 0.76, 0.89);
  for (let n = 0; n < count; n++) {
    const pg = d.addPage(size);
    if (kind === 'lined') {
      for (let y = H - 28 * mm; y > 14 * mm; y -= 8 * mm) pg.drawLine({ start: { x: 12 * mm, y }, end: { x: W - 12 * mm, y }, thickness: 0.5, color: c });
      pg.drawLine({ start: { x: 25 * mm, y: H - 10 * mm }, end: { x: 25 * mm, y: 10 * mm }, thickness: 0.6, color: PL.rgb(0.92, 0.6, 0.6) });
    } else if (kind === 'grid' || kind === 'dots') {
      const st = 5 * mm, nx = Math.floor((W - 20 * mm) / st), ny = Math.floor((H - 20 * mm) / st);
      const x0 = (W - nx * st) / 2, y0 = (H - ny * st) / 2;
      if (kind === 'grid') {
        for (let i = 0; i <= nx; i++) pg.drawLine({ start: { x: x0 + i * st, y: y0 }, end: { x: x0 + i * st, y: y0 + ny * st }, thickness: 0.35, color: c });
        for (let j = 0; j <= ny; j++) pg.drawLine({ start: { x: x0, y: y0 + j * st }, end: { x: x0 + nx * st, y: y0 + j * st }, thickness: 0.35, color: c });
      } else {
        for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) pg.drawCircle({ x: x0 + i * st, y: y0 + j * st, size: 0.55, color: c });
      }
    }
  }
  return new Uint8Array(await d.save());
}
function paperDialog(mode) {
  const cur = S.pages[S.cur], curDims = cur ? dims(cur) : A4;
  const fmtOpts = (mode === 'insert' && cur ? `<option value="cur">Wie aktuelle Seite</option>` : '') + Object.entries(FORMATS).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('');
  dialog(mode === 'new' ? 'Neues Dokument' : 'Neue Seite einfügen', `
    <div class="frow">
      <label class="fld"><span>Papier</span><select class="field" id="ppKind">${Object.entries(PAPERS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label class="fld"><span>Format</span><select class="field" id="ppFmt">${fmtOpts}</select></label>
      <label class="fld"><span>Anzahl</span><input class="field num" type="number" id="ppCount" value="1" min="1" max="50"></label>
    </div>
    <p class="note">Liniert 8 mm, kariert und punktiert 5 mm. Ideal für Notizen mit dem Pencil.</p>`, mode === 'new' ? 'Erstellen' : 'Einfügen', b => {
    const kind = $('#ppKind', b).value, f = $('#ppFmt', b).value, count = clamp(Math.round(+$('#ppCount', b).value || 1), 1, 50);
    const size = f === 'cur' ? curDims : FORMATS[f][1];
    (mode === 'new' ? newDocument(kind, size, count) : insertPaper(kind, size, count)).catch(e => { console.error(e); toast('Die Seite konnte nicht erstellt werden.'); });
  });
}
async function insertPaper(kind, size, count) {
  commitEdit();
  const key = kind + ':' + size.map(Math.round).join('x');
  let src = S.paperSrc.get(key);
  if (!src || !S.sources.has(src)) {
    const before = new Set(S.sources.keys());
    await addSource(await makePaper(kind, size), PAPERS[kind] + ' ' + key);
    src = [...S.sources.keys()].find(k => !before.has(k));
    S.paperSrc.set(key, src);
  }
  const vp = S.proxies.get(src + ':0').getViewport({ scale: 1 });
  pushHist();
  const at = Math.min(S.cur + 1, S.pages.length);
  for (let n = 0; n < count; n++) S.pages.splice(at + n, 0, { id: uid('p'), src, idx: 0, baseRot: 0, rot: 0, w0: vp.width, h0: vp.height, annots: [] });
  S.selPages.clear(); markDirty(); buildViewer(); scrollToPage(at);
  toast(count === 1 ? `${PAPERS[kind]}e Seite eingefügt` : `${count} Seiten eingefügt`);
}
const insertBlank = () => paperDialog('insert');
function movePage(id, toIdx) {
  const from = S.pages.findIndex(p => p.id === id);
  if (from < 0 || toIdx === from || toIdx === from + 1) return;
  pushHist();
  const [p] = S.pages.splice(from, 1);
  S.pages.splice(toIdx > from ? toIdx - 1 : toIdx, 0, p);
  S.cur = S.pages.indexOf(p); S.selPages.clear();
  markDirty(); buildViewer(); scrollToPage(S.cur);
}

/* ---------- Bilder und Unterschrift ---------- */
function registerImage(url, fmt, w, h) { const id = uid('i'); S.images.set(id, { url, fmt, w, h }); return id; }
function placeImage(imgId, targetW, p, at) {
  p = p || S.pages[S.cur]; if (!p) return;
  const im = S.images.get(imgId), [W, H] = dims(p);
  let w = Math.min(targetW, W * 0.6), h = w * im.h / im.w;
  if (h > H * 0.6) { h = H * 0.6; w = h * im.w / im.h; }
  let cx = W / 2, cy = H / 2;
  if (at) { cx = at[0]; cy = at[1]; }
  else {
    const e = els.get(p.id), r = e.wrap.getBoundingClientRect(), v = viewer.getBoundingClientRect();
    const top = Math.max(r.top, v.top), bot = Math.min(r.bottom, v.bottom);
    if (bot > top) cy = ((top + bot) / 2 - r.top) / S.zoom;
  }
  const a = { id: uid(), t: 'img', img: imgId, x: clamp(cx - w / 2, 0, Math.max(0, W - w)), y: clamp(cy - h / 2, 0, Math.max(0, H - h)), w, h };
  pushHist(); p.annots.push(a); markDirty();
  setTool('select'); select(p.id, a.id); drawAnnots(p);
}
function loadImageFile(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('lesen'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error('bild'));
      img.onload = () => {
        const jpg = /jpe?g/i.test(file.type);
        let w = img.naturalWidth, h = img.naturalHeight;
        if (jpg) { res(registerImage(fr.result, 'jpg', w, h)); return; }
        const s = Math.min(1, 2400 / Math.max(w, h));
        const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(registerImage(c.toDataURL('image/png'), 'png', c.width, c.height));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function insertImages(files, p, at) {
  for (const f of files) {
    try { const id = await loadImageFile(f); placeImage(id, 220, p, at); } catch (e) { toast(`„${f.name}“ konnte nicht als Bild gelesen werden.`); }
  }
}

const sig = { mode: 'draw', ctx: null, down: false, last: null, w: 2.6, color: '#1b2a6b', has: false };
const sigCanvas = $('#sigCanvas');
function openSig() {
  commitEdit();
  $('#sigModal').hidden = false;
  $('#sigSaved').hidden = !lsGet('pdfwb.signature');
  requestAnimationFrame(() => { sizeSig(); setSigMode('draw'); });
}
function closeSig() { $('#sigModal').hidden = true; }
function sizeSig() {
  const r = sigCanvas.getBoundingClientRect();
  sigCanvas.width = Math.max(300, Math.round(r.width * 2)); sigCanvas.height = Math.max(100, Math.round(r.height * 2));
  sig.ctx = sigCanvas.getContext('2d'); sig.ctx.setTransform(2, 0, 0, 2, 0, 0);
  sig.ctx.lineCap = 'round'; sig.ctx.lineJoin = 'round'; sig.has = false;
}
function clearSig() { sig.ctx.save(); sig.ctx.setTransform(1, 0, 0, 1, 0, 0); sig.ctx.clearRect(0, 0, sigCanvas.width, sigCanvas.height); sig.ctx.restore(); sig.has = false; }
function setSigMode(m) {
  sig.mode = m;
  $('#sigTabDraw').setAttribute('aria-pressed', String(m === 'draw'));
  $('#sigTabType').setAttribute('aria-pressed', String(m === 'type'));
  $('#sigText').hidden = m !== 'type';
  sigCanvas.style.pointerEvents = m === 'draw' ? '' : 'none';
  clearSig();
  if (m === 'type') { $('#sigText').focus(); drawTypedSig(); }
}
async function drawTypedSig() {
  clearSig();
  const txt = $('#sigText').value.trim(); if (!txt) return;
  try { await document.fonts.load('64px Caveat'); } catch (e) { /* Fallback */ }
  if (sig.mode !== 'type') return;
  clearSig();
  const W = sigCanvas.width / 2, H = sigCanvas.height / 2, ctx = sig.ctx;
  let size = H * 0.55;
  ctx.font = `500 ${size}px Caveat, "Segoe Script", cursive`;
  const mw = ctx.measureText(txt).width;
  if (mw > W * 0.86) size *= (W * 0.86) / mw;
  ctx.font = `500 ${size}px Caveat, "Segoe Script", cursive`;
  ctx.fillStyle = sig.color; ctx.textBaseline = 'alphabetic';
  ctx.fillText(txt, W * 0.09, H * 0.7);
  sig.has = true;
}
sigCanvas.addEventListener('pointerdown', e => {
  if (sig.mode !== 'draw') return;
  sigCanvas.setPointerCapture(e.pointerId);
  const r = sigCanvas.getBoundingClientRect();
  sig.down = true; sig.last = [e.clientX - r.left, e.clientY - r.top, performance.now()]; sig.w = 2.6;
  sig.ctx.fillStyle = sig.color; sig.ctx.beginPath(); sig.ctx.arc(sig.last[0], sig.last[1], 1.2, 0, Math.PI * 2); sig.ctx.fill();
  sig.has = true;
});
sigCanvas.addEventListener('pointermove', e => {
  if (!sig.down) return;
  const r = sigCanvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, t = performance.now();
  const [lx, ly, lt] = sig.last, v = Math.hypot(x - lx, y - ly) / Math.max(1, t - lt);
  sig.w = sig.w * 0.7 + clamp(3.4 - v * 1.4, 1.2, 3.4) * 0.3;
  const ctx = sig.ctx; ctx.strokeStyle = sig.color; ctx.lineWidth = sig.w;
  ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke();
  sig.last = [x, y, t];
});
const sigUp = () => { sig.down = false; };
sigCanvas.addEventListener('pointerup', sigUp); sigCanvas.addEventListener('pointercancel', sigUp);
function trimSig() {
  const c = sigCanvas, d = sig.ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const pad = 6; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return { url: o.toDataURL('image/png'), w: o.width, h: o.height };
}
function useSignature(t) {
  const id = registerImage(t.url, 'png', t.w, t.h);
  closeSig(); placeImage(id, 150);
}
function sigOk() {
  const t = sig.has ? trimSig() : null;
  if (!t) { toast(sig.mode === 'type' ? 'Bitte zuerst deinen Namen eingeben.' : 'Bitte zuerst im Feld unterschreiben.'); return; }
  if ($('#sigRemember').checked) lsSet('pdfwb.signature', JSON.stringify(t));
  useSignature(t);
}

/* ---------- Bestätigungsdialog ---------- */
function ask(title, text, yes = 'Verwerfen', no = 'Abbrechen', danger = true) {
  return new Promise(res => {
    $('#askTitle').textContent = title; $('#askText').textContent = text;
    $('#askYes').textContent = yes; $('#askNo').textContent = no; $('#askYes').className = 'btn ' + (danger ? 'danger' : 'primary');
    const m = $('#askModal'); m.hidden = false; $('#askNo').focus();
    const done = v => { m.hidden = true; $('#askYes').onclick = $('#askNo').onclick = null; res(v); };
    $('#askYes').onclick = () => done(true); $('#askNo').onclick = () => done(false);
  });
}

/* ---------- Dialoge und Menü ---------- */
function dialog(title, html, okLabel, onOk) {
  commitEdit(); closeMenu();
  $('#dlgTitle').textContent = title; $('#dlgBody').innerHTML = html; $('#dlgOk').textContent = okLabel; $('#dlgCancel').hidden = false; $('#dlgOk').disabled = false; $('#dlgCancel').textContent = 'Abbrechen'; $('#dlg .card').classList.remove('wide');
  $('#dlgBody').onclick = $('#dlgBody').onchange = $('#dlgBody').oninput = null;
  const m = $('#dlg'); m.hidden = false;
  const first = $('input:not([type=checkbox]):not([type=color]),select', $('#dlgBody'));
  if (first && !COARSE) setTimeout(() => first.focus(), 30);
  const close = () => { m.hidden = true; $('#dlgOk').onclick = $('#dlgCancel').onclick = null; };
  $('#dlgCancel').onclick = close;
  $('#dlgOk').onclick = () => { if (onOk($('#dlgBody')) !== false) close(); };
}
function openMenu() { const m = $('#menu'); m.hidden = false; $('#btnMore').setAttribute('aria-expanded', 'true'); const f = $('button', m); if (f && !COARSE) f.focus(); }
function closeMenu() { const m = $('#menu'); if (m.hidden) return; m.hidden = true; $('#btnMore').setAttribute('aria-expanded', 'false'); }

function watermarkDialog() {
  dialog('Wasserzeichen', `
    <label class="fld"><span>Text</span><input class="field" id="wmText" value="ENTWURF" maxlength="60"></label>
    <div class="frow">
      <label class="fld"><span>Farbe</span><input type="color" id="wmColor" value="#d0342c"></label>
      <label class="fld"><span>Deckkraft</span><input type="range" id="wmOp" min="5" max="60" value="18"></label>
      <label class="fld"><span>Ausrichtung</span><select class="field" id="wmAng"><option value="45">Diagonal</option><option value="0">Waagerecht</option><option value="90">Senkrecht</option></select></label>
    </div>
    <label class="fld"><span>Seiten</span><select class="field" id="wmPages"><option value="all">Alle Seiten</option><option value="cur">Nur aktuelle Seite</option></select></label>`, 'Einfügen', b => {
    const text = $('#wmText', b).value.trim();
    if (!text) { toast('Bitte einen Text eingeben.'); return false; }
    const ang = +$('#wmAng', b).value, ps = $('#wmPages', b).value === 'all' ? S.pages : [S.pages[S.cur]];
    pushHist();
    for (const p of ps) {
      const [W, H] = dims(p), w72 = measure(text, { bold: true, size: 72, font: 'Helvetica' });
      const span = ang === 45 ? Math.hypot(W, H) * 0.62 : (ang === 0 ? W : H) * 0.78;
      const size = Math.round(clamp(72 * span / w72, 16, 160));
      p.annots.push({ id: uid(), t: 'wm', x: W / 2, y: H / 2, text, size, color: $('#wmColor', b).value, op: +$('#wmOp', b).value, ang });
      drawAnnots(p);
    }
    markDirty(); toast(ps.length === 1 ? 'Wasserzeichen eingefügt' : `Wasserzeichen auf ${ps.length} Seiten eingefügt`);
  });
}
function pageNumberDialog() {
  dialog('Seitenzahlen', `
    <label class="fld"><span>Format</span><select class="field" id="pnFmt"><option value="Seite {n} von {N}">Seite 1 von 5</option><option value="{n} / {N}">1 / 5</option><option value="{n}">1</option><option value="– {n} –">– 1 –</option></select></label>
    <div class="frow">
      <label class="fld"><span>Position</span><select class="field" id="pnPos"><option value="bc">Unten mittig</option><option value="br">Unten rechts</option><option value="bl">Unten links</option><option value="tc">Oben mittig</option><option value="tr">Oben rechts</option></select></label>
      <label class="fld"><span>Größe (pt)</span><input class="field num" type="number" id="pnSize" value="9" min="6" max="24"></label>
      <label class="fld"><span>Beginnt bei</span><input class="field num" type="number" id="pnStart" value="1" min="0" max="9999"></label>
    </div>
    <label class="chk"><input type="checkbox" id="pnSkip"> Erste Seite ohne Nummer (Deckblatt)</label>
    <p class="note">Bereits eingefügte Seitenzahlen werden ersetzt.</p>`, 'Einfügen', b => {
    const fmt = $('#pnFmt', b).value, pos = $('#pnPos', b).value, size = clamp(+$('#pnSize', b).value || 9, 6, 24);
    const start = Math.max(0, Math.round(+$('#pnStart', b).value || 1)), skip = $('#pnSkip', b).checked;
    const last = S.pages.length - (skip ? 1 : 0) + start - 1;
    pushHist();
    S.pages.forEach((p, i) => {
      p.annots = p.annots.filter(a => !a.pn);
      if (!(skip && i === 0)) {
        const n = i + start - (skip ? 1 : 0), text = fmt.replace('{n}', n).replace('{N}', last);
        const a = { id: uid(), t: 'text', text, size, font: 'Helvetica', bold: false, color: '#1b2130', pn: true };
        const w = measure(text, a), [W, H] = dims(p), m = 30;
        a.x = pos[1] === 'c' ? (W - w) / 2 : pos[1] === 'r' ? W - m - w : m;
        a.y = pos[0] === 'b' ? H - m * 0.75 - LH * size : m * 0.75;
        p.annots.push(a);
      }
      drawAnnots(p);
    });
    markDirty(); toast('Seitenzahlen eingefügt');
  });
}
/* ---------- Dokumenteinstellungen (Reiter: Dokument, Kommentare, Messen, Ansicht) ---------- */
function settingsDialog(tab = 'doc') {
  const m = S.meta, P = S.prefs;
  const f = (id, label, v, ph = '') => `<label class="fld"><span>${label}</span><input class="field" id="${id}" value="${esc(v || '')}" placeholder="${esc(ph)}"></label>`;
  const chk = (id, label, on, note = '') => `<label class="chk big"><input type="checkbox" id="${id}"${on ? ' checked' : ''}><span>${label}${note ? `<small>${note}</small>` : ''}</span></label>`;
  const opt = (v, l, cur) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${l}</option>`;
  const tabs = [['doc', 'Dokument'], ['cmt', 'Kommentare'], ['meas', 'Messen'], ['view', 'Ansicht'], ...(AIX ? [['ai', 'KI']] : [])];
  const nMarks = S.pages.reduce((s, p) => s + p.annots.filter(a => !a.pn).length, 0);
  dialog('Einstellungen', `
    <div class="seg stab" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-st="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div>
    <div class="spage" data-sp="doc">
      ${f('mTitle', 'Titel', m.title)}${f('mAuthor', 'Autor des Dokuments', m.author)}
      <div class="frow">${f('mSubject', 'Betreff', m.subject)}${f('mKeys', 'Stichwörter (mit Komma getrennt)', m.keywords)}</div>
      <label class="fld"><span>Beim Öffnen in anderen Programmen anzeigen</span><select class="field" id="mMode">${opt('', 'Nur die Seiten', m.pageMode || '')}${opt('UseOutlines', 'Seiten und Lesezeichen', m.pageMode || '')}${opt('UseThumbs', 'Seiten und Miniaturen', m.pageMode || '')}</select></label>
      <p class="note">${S.pages.length} Seiten · ${nMarks} Kommentare und Markierungen · ${S.bookmarks.length} Lesezeichen</p>
    </div>
    <div class="spage" data-sp="cmt" hidden>
      ${f('pAuthor', 'Dein Name für Kommentare', P.author, 'z. B. ' + (m.author || 'Max Mustermann'))}
      <div class="fld"><span>Markierungen und Kommentare beim Speichern</span>
        <label class="chk big"><input type="radio" name="pExp" value="annots"${P.exportMarks === 'annots' ? ' checked' : ''}><span>Als bearbeitbare PDF-Kommentare<small>Markieren, Unterstreichen, Durchstreichen, Stift, Formen, Textfelder und Stempel bleiben in Acrobat, Vorschau und im Browser als Kommentare mit Autor und Text erhalten.</small></span></label>
        <label class="chk big"><input type="radio" name="pExp" value="flatten"${P.exportMarks === 'flatten' ? ' checked' : ''}><span>Fest in die Seite einbetten<small>Sieht überall gleich aus, lässt sich aber nicht mehr als Kommentar bearbeiten.</small></span></label>
      </div>
      ${chk('pAsk', 'Nach dem Markieren nach einem Kommentar fragen', P.askComment)}
      ${chk('pShow', 'Markierungen und Kommentare anzeigen', P.showMarks, 'Ausschalten zeigt die Seiten ohne eigene Elemente. Gespeichert wird trotzdem alles.')}
      <div class="frow">
        <label class="fld"><span>Farbe Markieren</span><input type="color" id="pHl" value="${P.hlColor}"></label>
        <label class="fld"><span>Farbe Unterstreichen</span><input type="color" id="pUl" value="${P.ulColor}"></label>
        <label class="fld"><span>Farbe Durchstreichen</span><input type="color" id="pSo" value="${P.soColor}"></label>
      </div>
    </div>
    <div class="spage" data-sp="meas" hidden>
      <div class="frow">
        <label class="fld"><span>Einheit</span><select class="field" id="pUnit">${Object.entries(UNITS).map(([k, u]) => opt(k, `${u[2]} (${u[1]})`, P.unit)).join('')}</select></label>
        <label class="fld"><span>Nachkommastellen</span><select class="field" id="pDec">${[0, 1, 2, 3, 4].map(d => opt(d, d, P.decimals)).join('')}</select></label>
        <label class="fld"><span>Maßstab</span><select class="field" id="pScale">${SCALES.map(s => opt(s, '1 : ' + s, P.scale)).join('')}</select></label>
      </div>
      ${chk('pAll', 'Vorhandene Messungen ebenfalls umstellen', true)}
      <p class="note">Beispiel: 100 pt entsprechen <b id="pEx">${fmtLen(100, P.unit, P.scale, P.decimals)}</b>.</p>
    </div>
    <div class="spage" data-sp="view" hidden>
      <label class="fld"><span>Darstellung</span><select class="field" id="pTheme">${opt('', 'Wie das System', lsGet('pdfwb.theme') || '')}${opt('light', 'Hell', lsGet('pdfwb.theme') || '')}${opt('dark', 'Dunkel', lsGet('pdfwb.theme') || '')}</select></label>
      ${chk('pGroup', 'Werkzeuge gruppieren', tbCompact, 'Ähnliche Werkzeuge (Formen, Markieren, Stempel …) teilen sich einen Knopf mit Ausklapp-Menü.')}
      <p class="note" style="margin:-4px 0 10px"><button type="button" class="btn" id="pTb">${icon('sliders')}Werkzeugleiste anpassen …</button></p>
      ${chk('pSnap', 'Hilfslinien beim Verschieben', P.snap, 'Elemente rasten an Seitenrand, Mitte und anderen Elementen ein.')}
      ${chk('pShape', 'Formen beim Zeichnen erkennen', TP.pen.shapes, 'Strich am Ende kurz halten: Linie, Rechteck oder Ellipse.')}
      ${chk('pNight', 'Nachtmodus für Seiten', S.night)}
      ${COARSE ? chk('pPencil', 'Nur Apple Pencil zeichnet', S.pencil.only, 'Finger scrollen und zoomen, der Handballen malt nicht mit.') : ''}
    </div>
    ${AIX ? '<div class="spage" data-sp="ai" hidden><div id="stAI"></div></div>' : ''}`, 'Übernehmen', b => {
    S.meta = { title: $('#mTitle', b).value.trim(), author: $('#mAuthor', b).value.trim(), subject: $('#mSubject', b).value.trim(), keywords: $('#mKeys', b).value.trim(), pageMode: $('#mMode', b).value };
    const unit = $('#pUnit', b).value, dec = +$('#pDec', b).value, scale = +$('#pScale', b).value;
    Object.assign(S.prefs, {
      author: $('#pAuthor', b).value.trim(), exportMarks: $('input[name=pExp]:checked', b).value, askComment: $('#pAsk', b).checked,
      showMarks: $('#pShow', b).checked, hlColor: $('#pHl', b).value, ulColor: $('#pUl', b).value, soColor: $('#pSo', b).value,
      unit, decimals: dec, scale, snap: $('#pSnap', b).checked,
    });
    savePrefs();
    TP.hl.color = S.prefs.hlColor; TP.ul.color = S.prefs.ulColor; TP.so.color = S.prefs.soColor;
    TP.measure.unit = unit; TP.measure.scale = scale; TP.pen.shapes = $('#pShape', b).checked;
    if ($('#pAll', b).checked) for (const p of S.pages) for (const a of p.annots) if (a.t === 'measure') { a.unit = unit; a.scale = scale; delete a.dec; }
    setNight($('#pNight', b).checked);
    setTheme($('#pTheme', b).value);
    if ($('#pGroup', b).checked !== tbCompact) { tbCompact = $('#pGroup', b).checked; lsSet('pdfwb.tbcompact', tbCompact ? '1' : '0'); applyToolbar(); }
    if ($('#pPencil', b)) setPencilOnly($('#pPencil', b).checked, true);
    pagesEl.classList.toggle('hidemarks', !S.prefs.showMarks); updateSideLater();
    S.pages.forEach(drawAnnots); markDirty(); renderProps();
    toast('Einstellungen übernommen');
  });
  const body = $('#dlgBody');
  body.querySelector('.stab').addEventListener('click', e => {
    const t = e.target.closest('[data-st]'); if (!t) return;
    $$('[data-st]', body).forEach(x => x.setAttribute('aria-pressed', String(x === t)));
    $$('[data-sp]', body).forEach(x => { x.hidden = x.dataset.sp !== t.dataset.st; });
  });
  $$('[data-sp]', body).forEach(x => { x.hidden = x.dataset.sp !== tab; });
  $('#pTb', body).onclick = () => { $('#dlgCancel').click(); setTimeout(toolbarDialog, 30); };
  $('#pTheme', body).onchange = e => setTheme(e.target.value);
  if (AIX) AIX.renderSetup($('#stAI', body), { onChange: () => aiUpdateHead() });
  const ex = () => { $('#pEx', body).textContent = fmtLen(100, $('#pUnit', body).value, +$('#pScale', body).value, +$('#pDec', body).value); };
  ['#pUnit', '#pDec', '#pScale'].forEach(s => $(s, body).addEventListener('change', ex));
}
const metaDialog = () => settingsDialog('doc');
const SCALES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
function duplicatePage() {
  commitEdit();
  const p = S.pages[S.cur]; if (!p) return;
  pushHist();
  const c = clone(p); c.id = uid('p'); c.annots = c.annots.map(a => ({ ...a, id: uid() }));
  S.pages.splice(S.cur + 1, 0, c);
  S.selPages.clear(); markDirty(); buildViewer(); scrollToPage(S.cur + 1);
  toast('Seite dupliziert');
}
async function exportPagePng() {
  commitEdit();
  const p = S.pages[S.cur]; if (!p || S.busy) return;
  busy(true, 'Bild wird erstellt …');
  try {
    const proxy = proxyOf(p), vp = proxy.getViewport({ scale: 2.5, rotation: rotOf(p) });
    const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    await proxy.render({ canvasContext: ctx, viewport: vp }).promise;
    if (p.annots.length) {
      const [W, H] = dims(p);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="0 0 ${W} ${H}">${p.annots.map(annotSVG).join('')}</svg>`;
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
      ctx.drawImage(img, 0, 0, c.width, c.height);
    }
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    busy(false);
    await saveBytes(blob, `${baseName()}-Seite-${S.cur + 1}.png`);
  } catch (e) { console.error(e); busy(false); toast('Das Bild konnte nicht erstellt werden.'); }
}
async function exportText() {
  commitEdit(); if (S.busy) return;
  busy(true, 'Text wird gelesen …');
  try {
    const parts = [];
    for (const [i, p] of S.pages.entries()) {
      const tc = await textContent(p), lines = [];
      let line = '', lastY = null;
      for (const it of tc.items) {
        const y = it.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 2 && line) { lines.push(line); line = ''; }
        line += it.str; lastY = y;
        if (it.hasEOL) { lines.push(line); line = ''; }
      }
      if (line) lines.push(line);
      const own = p.annots.filter(a => (a.t === 'text' || a.t === 'note') && a.text).map(a => (a.t === 'note' ? 'Notiz: ' : '') + a.text);
      parts.push(`--- Seite ${i + 1} ---\n` + lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + (own.length ? '\n\n' + own.join('\n') : ''));
    }
    busy(false);
    await saveBytes(new Blob(['﻿' + parts.join('\n\n') + '\n'], { type: 'text/plain;charset=utf-8' }), baseName() + '.txt');
  } catch (e) { console.error(e); busy(false); toast('Der Text konnte nicht gelesen werden.'); }
}
async function newDocument(kind = 'blank', size = A4, count = 1) {
  const bytes = await makePaper(kind, size, count);
  await openFiles([new File([bytes], kind === 'blank' ? 'Neues Dokument.pdf' : `Notizen ${PAPERS[kind].toLowerCase()}.pdf`, { type: 'application/pdf' })], 'replace', true);
}

