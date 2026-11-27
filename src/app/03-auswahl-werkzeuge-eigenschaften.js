/* ---------- Auswahl, Werkzeuge, Eigenschaften ---------- */
function selAnnot() {
  if (!S.sel) return null;
  const p = pageById(S.sel.pid);
  return (p && p.annots.find(a => a.id === S.sel.aid)) || null;
}
function select(pid, aid) {
  const prev = S.sel ? pageById(S.sel.pid) : S.msel ? pageById(S.msel.pid) : null;
  S.msel = null;
  S.sel = pid ? { pid, aid } : null;
  if (prev) drawAnnots(prev);
  if (pid && (!prev || prev.id !== pid)) drawAnnots(pageById(pid));
  renderProps();
}
function setTool(t) {
  commitEdit();
  if (S.qbar) { const qp = pageById(S.qbar.pid); S.qbar = null; if (qp) setTimeout(() => drawAnnots(qp), 0); }
  S.tool = t;
  if (t !== 'select' && (S.sel || S.msel)) setMulti(null, []);
  if (t !== 'objects' && (S.csel || S.hover)) { const hp = S.hover && pageById(S.hover.pid); S.hover = null; setCsel(null, []); if (hp) drawCUI(hp); }
  if ((t === 'objects' || t === 'edittext') && S.pages[S.cur]) analysisOf(S.pages[S.cur]).catch(() => toast('Die Inhalte dieser PDF lassen sich nicht auslesen (z. B. verschlüsselt).'));
  if (SNAP_TOOLS.has(t) && S.pages[S.cur]) analysisOf(S.pages[S.cur]).catch(() => {});
  if (tbCompact && TB_DEFAULT) { const g = groupOf(t), el = g && tbEl(t); if (el && el.classList.contains('gh')) { lsSet('pdfwb.tbrep.' + g, t); applyToolbar(); } }
  $$('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  pagesEl.dataset.tool = t;
  if (DRAW_TOOLS.has(t)) pagesEl.dataset.draw = ''; else delete pagesEl.dataset.draw;
  renderProps();
}
function propTarget() {
  if (S.editing) return { obj: S.editing.a, type: 'text', editing: true };
  if (S.msel) { const s = selectedAnnots(); if (s && s.list.length) return { obj: s.list.find(a => a.color) || s.list[0], objs: s.list, type: 'multi', isAnnot: true, multi: true }; }
  const a = selAnnot();
  if (a) return { obj: a, type: a.t, isAnnot: true };
  if (TP[S.tool]) return { obj: TP[S.tool], type: S.tool };
  return null;
}
function renderProps() {
  const cs = S.csel && S.tool === 'objects' ? S.csel.items : null;
  const oneText = cs && cs.length === 1 && cs[0].kind === 'text';
  $('#cEditBtn').hidden = !oneText;
  $('#cRotL').hidden = $('#cRotR').hidden = !cs;
  const selA = !cs && !S.cedit ? selAnnot() : null;
  $('#zFront').hidden = $('#zBack').hidden = !(selA || cs);
  $('#zUnder').hidden = !selA || selA.t === 'note';
  if (selA) $('#zUnder').setAttribute('aria-pressed', String(!!selA.under));
  $('#cMark').hidden = !cs;
  $('#cmtBtn').hidden = !selA;
  $('#copyBtn').hidden = !(selA || S.msel || cs);
  $('#pasteBtn').hidden = !S.clip;
  $('#cmtBtn').setAttribute('aria-pressed', String(!!(selA && (selA.comment || (selA.t === 'note' && selA.text)))));
  if (cs || S.cedit) {
    $$('[data-for]', propbar).forEach(el => { el.hidden = true; });
    $('#dupBtn').hidden = true; $('#delBtn').hidden = !cs;
    if (S.cedit) { $('#pTarget').textContent = 'PDF-Text bearbeiten'; $('#pHint').textContent = 'Enter übernimmt · Esc bricht ab · leer lassen entfernt die Zeile'; return; }
    const kinds = {};
    cs.forEach(it => { kinds[it.kind] = (kinds[it.kind] || 0) + 1; });
    $('#pTarget').textContent = cs.length === 1 ? 'Auswahl · ' + KIND_NAMES[cs[0].kind] : `Auswahl · ${cs.length} Elemente`;
    $('#pHint').textContent = (oneText ? `„${cs[0].text.slice(0, 50)}“ · Doppelklick bearbeitet` : Object.entries(kinds).map(([k, n]) => `${n}× ${KIND_NAMES[k]}`).join(' · ')) + ' · Ziehen verschiebt, Ecke skaliert, Entf entfernt';
    return;
  }
  const tg = propTarget();
  const type = tg ? tg.type : S.tool;
  const show = new Set(PROPS_OF[type] || []);
  $$('[data-for]', propbar).forEach(el => { el.hidden = !show.has(el.dataset.for); });
  const sel = !!selAnnot() || !!S.msel;
  $('#delBtn').hidden = !sel; $('#dupBtn').hidden = !sel;
  $('#pTarget').textContent = tg && tg.multi ? `Auswahl · ${tg.objs.length} Elemente` : tg && (tg.isAnnot || tg.editing) ? 'Auswahl · ' + (TOOL_NAMES[type] || type) + (type === 'mark' ? ' (' + { hl: 'Markieren', ul: 'Unterstreichen', so: 'Durchstreichen' }[tg.obj.kind] + ')' : '') : (TOOL_NAMES[S.tool] || '');
  let hint = '';
  if (tg && tg.multi) hint = 'Ziehen verschiebt alle · Strg+C kopiert · Entf löscht · Umschalt+Klick ändert die Auswahl';
  else if (tg && tg.isAnnot && type === 'mark') hint = tg.obj.text ? `„${tg.obj.text.length > 80 ? tg.obj.text.slice(0, 79) + '…' : tg.obj.text}“` + (tg.obj.comment ? ' · ' + tg.obj.comment.slice(0, 60) : '') : '';
  else if (tg && tg.isAnnot && type === 'img') hint = HINTS.img;
  else if (S.tool === 'text' && !(tg && tg.editing)) hint = 'Auf die Seite klicken, um Text zu schreiben · Strg+Enter oder Esc zum Abschließen';
  else if (!tg || !(tg.isAnnot || tg.editing)) hint = HINTS[S.tool] || '';
  $('#pHint').textContent = hint;
  if (!tg) return;
  const o = tg.obj;
  if (type === 'pen') {
    const k = o.kind || 'ball';
    $$('#penKind button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
    $('#shapeChk').checked = !!TP.pen.shapes;
    $('#shapeChk').closest('label').hidden = !!tg.isAnnot;
  }
  if (type === 'eraser') { $('#eraseIn').value = o.size; $('#eraseOut').textContent = o.size + ' pt'; }
  if (type === 'measure') { $('#scaleSel').value = String(o.scale || 1); $('#unitSel').value = o.unit || S.prefs.unit; }
  if (o.color) {
    $$('.sw', $('#swatches')).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c.toLowerCase() === o.color.toLowerCase())));
    $('#colorPick').value = o.color;
  }
  if ('sw' in o) { $('#strokeIn').value = o.sw; $('#strokeOut').textContent = o.sw + ' pt'; }
  if ('op' in o) { $('#opIn').value = o.op; $('#opOut').textContent = o.op + ' %'; }
  if (type === 'stamp') $('#stampSel').value = STAMPS.some(s => s[0] === o.text) ? o.text : (o.text === today() ? '{datum}' : '');
  if ('font' in o) $('#bgSel').value = o.bg || '';
  if ('font' in o) { $('#fontSel').value = FONTS[o.font] ? o.font : 'Helvetica'; if (document.activeElement !== $('#sizeIn')) $('#sizeIn').value = o.size; $('#boldBtn').setAttribute('aria-pressed', String(!!o.bold)); $('#boldBtn').disabled = !!FONT(o.font).noBold; }
  const seg = (sel, v) => $$(sel + ' button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === (v || ''))));
  if (show.has('align')) seg('#alignSeg', o.align || 'left');
  if (show.has('fill')) seg('#fillSeg', o.fill);
  if (show.has('dash')) seg('#dashSeg', o.dash);
  if (type === 'pen') renderPenFavs(o);
}
function setProp(k, v, continuous) {
  const tg = propTarget(); if (!tg) return;
  if (tg.editing) {
    tg.obj[k] = v; S.editing.styled = true; TP.text[k] = v; styleTA();
  } else if (tg.multi) {
    if (!(continuous && S.propEdit)) pushHist();
    S.propEdit = !!continuous;
    tg.objs.forEach(o => { if (k in o) o[k] = v; });
    drawAnnots(pageById(S.msel.pid)); markDirty();
  } else if (tg.isAnnot) {
    if (!(continuous && S.propEdit)) pushHist();
    S.propEdit = !!continuous;
    tg.obj[k] = v;
    if (TP[tg.type] && k in TP[tg.type]) TP[tg.type][k] = v;
    drawAnnots(pageById(S.sel.pid)); markDirty();
  } else tg.obj[k] = v;
  renderProps();
}
/* ---------- Auswahl mehrerer eigener Elemente ---------- */
function selectedAnnots() {
  if (S.msel) { const p = pageById(S.msel.pid); return p ? { p, list: p.annots.filter(a => S.msel.ids.includes(a.id)) } : null; }
  const a = selAnnot(); return a ? { p: pageById(S.sel.pid), list: [a] } : null;
}
function setMulti(pid, ids) {
  const prevP = (S.msel && pageById(S.msel.pid)) || (S.sel && pageById(S.sel.pid));
  S.sel = null; S.msel = null;
  if (ids.length === 1) S.sel = { pid, aid: ids[0] };
  else if (ids.length > 1) S.msel = { pid, ids };
  if (prevP) drawAnnots(prevP);
  if (pid && (!prevP || prevP.id !== pid)) drawAnnots(pageById(pid));
  renderProps();
}
const unionBox = list => { const bs = list.map(bbox), x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y)); return { x, y, w: Math.max(...bs.map(b => b.x + b.w)) - x, h: Math.max(...bs.map(b => b.y + b.h)) - y }; };
function restoreMulti(d) { d.orig.forEach(o => { const a = d.p.annots.find(x => x.id === o.id); if (a) Object.assign(a, clone(o)); }); if (S.hist.length) S.hist.pop(); updateUndo(); drawAnnots(d.p); }
function deleteSel() {
  const s = selectedAnnots(); if (!s) return;
  const ids = new Set(s.list.map(a => a.id));
  pushHist(); s.p.annots = s.p.annots.filter(x => !ids.has(x.id)); S.sel = null; S.msel = null;
  drawAnnots(s.p); markDirty(); renderProps();
  if (ids.size > 1) toast(`${ids.size} Elemente gelöscht`);
}

/* ---------- Kopieren und Einfügen ---------- */
async function writeSysClip(text) {
  if (!text) return false;
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}
function copySelection(cut) {
  commitEdit();
  if (S.csel && S.tool === 'objects') { copyContent(); return true; }
  const s = selectedAnnots(); if (!s) return false;
  const text = s.list.map(a => (a.t === 'mark' ? a.text : a.text) || a.comment || '').filter(Boolean).join('\n');
  S.clip = { type: 'annots', pid: s.p.id, items: s.list.map(clone), n: 0, sysText: text, stale: false };
  writeSysClip(text);
  if (cut) deleteSel();
  const n = s.list.length;
  toast(cut ? (n === 1 ? 'Element ausgeschnitten' : `${n} Elemente ausgeschnitten`) : (n === 1 ? 'Element kopiert' : `${n} Elemente kopiert`) + (text ? ' (Text auch in der Zwischenablage)' : ''));
  renderProps();
  return true;
}
function pasteClip() {
  const c = S.clip, p = S.pages[S.cur]; if (!c || !p) return false;
  commitEdit();
  if (c.type === 'content') { pasteContent(c, p); return true; }
  c.n = (c.n || 0) + 1;
  const same = p.id === c.pid, off = same ? 12 * c.n : 0, [W, H] = dims(p);
  const items = c.items.map(o => { const a = translated(o, off, off); a.id = uid(); return a; });
  // auf kleineren Seiten in den sichtbaren Bereich schieben
  const u = unionBox(items), dx = Math.min(0, W - (u.x + u.w)) - Math.min(0, u.x), dy = Math.min(0, H - (u.y + u.h)) - Math.min(0, u.y);
  const placed = dx || dy ? items.map(a => ({ ...translated(a, dx, dy), id: a.id })) : items;
  pushHist(); p.annots.push(...placed); markDirty();
  if (S.tool !== 'select') setTool('select');
  setMulti(p.id, placed.map(a => a.id)); drawAnnots(p);
  toast(placed.length === 1 ? 'Eingefügt' : `${placed.length} Elemente eingefügt`);
  return true;
}
function duplicateSel() {
  const s = selectedAnnots(); if (!s) return;
  const items = s.list.map(o => { const a = translated(o, 12, 12); a.id = uid(); return a; });
  pushHist(); s.p.annots.push(...items); markDirty();
  setMulti(s.p.id, items.map(a => a.id));
}
/* PDF-Inhalte kopieren: auf derselben Seite als echte Vektor-Kopie, auf anderen Seiten als Bild */
async function copyContent() {
  const cs = S.csel; if (!cs) return;
  const p = pageById(cs.pid), u = cselBox(cs.items);
  const text = cs.items.filter(i => i.text).map(i => i.text).join('\n');
  const ids = cs.items.flatMap(i => i.ids);
  S.clip = { type: 'content', pid: p.id, ids, box: u, n: 0, sysText: text, stale: false, png: null };
  const clip = S.clip;
  writeSysClip(text);
  toast(`${cs.items.length === 1 ? 'Element' : cs.items.length + ' Elemente'} kopiert` + (text ? ' (Text auch in der Zwischenablage)' : ''));
  renderProps();
  try { clip.png = await renderObjects(p, ids, u, 3); } catch (e) { console.warn('Bild der Auswahl nicht erstellt', e); }
}
async function renderObjects(p, ids, box, scale) {
  const an = await analysisOf(p), keep = new Set(ids);
  const ce = newCE(p);
  ce.del = [...new Set([...ce.del, ...an.objects.filter(o => !keep.has(o.i)).map(o => o.i)])];
  ce.dup = ce.dup.filter(d => keep.has(d.id));
  const ld = await libDocOf(p.src), out = await PL.PDFDocument.create(), [pg] = await out.copyPages(ld, [p.idx]);
  out.addPage(pg); ENG.editPage(out, pg, an, ce); pg.node.delete(PL.PDFName.of('Annots'));
  const pdf = await PDFJS.getDocument({ data: await out.save(), isEvalSupported: false }).promise;
  try {
    const page = await pdf.getPage(1), vp = page.getViewport({ scale, rotation: rotOf(p), offsetX: -box.x * scale, offsetY: -box.y * scale });
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(box.w * scale)); c.height = Math.max(1, Math.ceil(box.h * scale));
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp, background: 'rgba(0,0,0,0)' }).promise;
    return { url: c.toDataURL('image/png'), w: c.width, h: c.height };
  } finally { pdf.destroy(); }
}
async function pasteContent(c, p) {
  c.n = (c.n || 0) + 1;
  if (p.id === c.pid) {
    const src = pageById(c.pid), T = moveMatrix(p, 12 * c.n, 12 * c.n, [c.box.x, c.box.y]);
    const ce = newCE(p), items = [];
    for (const i of c.ids) {
      const d = typeof i === 'string' && ce.dup.find(x => x.id === i);
      if (d) d.items.forEach(([j, A]) => items.push([j, ENG.mul(A, T)]));
      else if (typeof i === 'number') items.push([i, ENG.mul((src.ce && src.ce.tf && src.ce.tf[i]) || [1, 0, 0, 1, 0, 0], T)]);
    }
    if (!items.length) return;
    const id = uid('d');
    pushHist(); ce.dup.push({ id, items }); p.ce = ce;
    await applyCE(p);
    if (S.tool !== 'objects') setTool('objects');
    const fresh = cItems(p) || [];
    setCsel(p.id, fresh.filter(it => it.ids.includes(id)));
    toast('Kopie eingefügt · ziehen zum Verschieben');
    return;
  }
  if (!c.png) { toast('Die Kopie wird noch vorbereitet. Bitte gleich noch einmal einfügen.'); c.n--; return; }
  const id = registerImage(c.png.url, 'png', c.png.w, c.png.h), [W, H] = dims(p);
  const a = { id: uid(), t: 'img', img: id, x: clamp(c.box.x, 0, Math.max(0, W - c.box.w)), y: clamp(c.box.y, 0, Math.max(0, H - c.box.h)), w: c.box.w, h: c.box.h };
  pushHist(); p.annots.push(a); markDirty(); setTool('select'); setMulti(p.id, [a.id]);
  toast('Als Bild eingefügt (PDF-Inhalte lassen sich nur auf derselben Seite als Vektor kopieren)');
}
/* Zeichen, die die PDF-Standardschriften nicht kennen, lesbar ersetzen (für Rechenergebnisse) */
function winAnsiSafe(t) {
  const SUPD = '⁰¹²³⁴⁵⁶⁷⁸⁹', SUBD = '₀₁₂₃₄₅₆₇₈₉';
  return t.replace(/−/g, '-').replace(/√/g, 'sqrt').replace(/∛/g, 'cbrt').replace(/π/g, 'pi').replace(/≈/g, '~').replace(/≠/g, '!=').replace(/∞/g, 'unendlich')
    .replace(/[⁰⁴-⁹⁻]+/g, m => '^' + m.split('').map(c => (c === '⁻' ? '-' : SUPD.indexOf(c))).join(''))
    .replace(/[₀-₉]/g, c => SUBD.indexOf(c));
}
/* Text oder Bilder aus anderen Programmen einfügen */
function viewCenter(p) {
  const e = els.get(p.id), r = e.wrap.getBoundingClientRect(), v = viewer.getBoundingClientRect(), [W, H] = dims(p);
  const top = Math.max(r.top, v.top), bot = Math.min(r.bottom, v.bottom), left = Math.max(r.left, v.left), right = Math.min(r.right, v.right);
  return [bot > top && right > left ? ((left + right) / 2 - r.left) / S.zoom : W / 2, bot > top ? ((top + bot) / 2 - r.top) / S.zoom : H / 2];
}
function insertTextAnnot(text, p = S.pages[S.cur]) {
  if (!p || !text) return;
  const tp = TP.text, [cx, cy] = viewCenter(p), [W] = dims(p);
  const a = { id: uid(), t: 'text', x: 0, y: 0, text: text.replace(/\r/g, '').slice(0, 5000), color: tp.color, size: tp.size, font: tp.font, bold: tp.bold, bg: tp.bg || '' };
  const b = bbox(a); a.x = clamp(cx - b.w / 2, 4, Math.max(4, W - b.w - 4)); a.y = cy - b.h / 2;
  pushHist(); p.annots.push(a); markDirty(); setTool('select'); setMulti(p.id, [a.id]);
}

/* ---------- Zeiger ---------- */
function ptIn(e, el) { const r = el.svg.getBoundingClientRect(); return [(e.clientX - r.left) / S.zoom, (e.clientY - r.top) / S.zoom]; }
let drag = null;
/* Werkzeuge, die im Modus „Nur Pencil zeichnet“ nicht auf Finger reagieren */
const PENCIL_TOOLS = new Set(['laser', 'pen', 'eraser', 'hl', 'ul', 'so', 'rect', 'ellipse', 'line', 'arrow', 'measure', 'white', 'redact', 'check', 'cross', 'text', 'note', 'stamp']);
const pressureOf = e => (e.pointerType === 'pen' ? clamp(e.pressure || 0.5, 0.05, 1) : 0.5);
function notePencil() {
  if (S.pencil.seen) return;
  S.pencil.seen = true;
  const pref = lsGet('pdfwb.pencilOnly');
  setPencilOnly(pref == null ? true : pref === '1', true);
  $('#pencilChip').hidden = false;
  if (S.pencil.only) toast('Apple Pencil erkannt: Der Pencil zeichnet, Finger scrollen und zoomen');
}
function setPencilOnly(on, silent) {
  S.pencil.only = on;
  lsSet('pdfwb.pencilOnly', on ? '1' : '0');
  if (on) pagesEl.dataset.pencil = ''; else delete pagesEl.dataset.pencil;
  $('#mPencil').textContent = (on ? '✓ ' : '') + 'Nur Apple Pencil zeichnet';
  $('#pencilLbl').textContent = on ? 'Nur Pencil' : 'Pencil + Finger';
  $('#pencilChip').setAttribute('aria-pressed', String(on));
  if (!silent) toast(on ? 'Nur der Pencil zeichnet, Finger scrollen und zoomen' : 'Pencil und Finger zeichnen');
}
function hoverRing(p, pt, r) {
  for (const [id, e] of els) { const g = e.svg.querySelector('.draft'); if (g && (!p || id !== p.id) && g.firstChild && g.firstChild.classList && g.firstChild.classList.contains('hov')) g.innerHTML = ''; }
  if (!p) return;
  const e = els.get(p.id); if (!e) return;
  $('.draft', e.svg).innerHTML = `<circle class="hov" cx="${r2(pt[0])}" cy="${r2(pt[1])}" r="${r2(Math.max(r, 1.5))}"/>`;
}
/* ---------- Laserpointer: leuchtende Spur, die nach einer knappen Sekunde verblasst (nichts wird gespeichert) ---------- */
const laser = { cv: null, pts: [], dot: null, raf: 0, down: false };
function laserCanvas() {
  if (!laser.cv) {
    laser.cv = document.createElement('canvas');
    laser.cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:60';
    document.body.appendChild(laser.cv);
  }
  const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if (laser.cv.width !== w || laser.cv.height !== h) { laser.cv.width = w; laser.cv.height = h; }
  return laser.cv;
}
function laserAdd(e, pressed) {
  const now = performance.now();
  const evs = pressed && e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  for (const ce of evs.length ? evs : [e]) { const q = [ce.clientX, ce.clientY, now]; if (pressed) laser.pts.push(q); laser.dot = q; }
  if (!laser.raf) laser.raf = requestAnimationFrame(laserDraw);
}
function laserDraw() {
  laser.raf = 0;
  const cv = laserCanvas(), ctx = cv.getContext('2d'), dpr = cv.width / innerWidth, now = performance.now(), LIFE = 850;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  laser.pts = laser.pts.filter(q => now - q[2] < LIFE);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 1; i < laser.pts.length; i++) {
    const a = laser.pts[i - 1], b = laser.pts[i];
    if (b[2] - a[2] > 120) continue; // neue Spur
    const k = 1 - (now - b[2]) / LIFE;
    ctx.strokeStyle = `rgba(255,40,60,${(k * 0.9).toFixed(3)})`; ctx.shadowColor = 'rgba(255,30,50,.9)'; ctx.shadowBlur = 14 * k;
    ctx.lineWidth = 2 + 4 * k;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  const d = laser.dot;
  if (d && (laser.down || now - d[2] < 1200)) {
    ctx.shadowColor = 'rgba(255,30,50,.95)'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff2b44'; ctx.beginPath(); ctx.arc(d[0], d[1], laser.down ? 7 : 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(d[0], d[1], 2.2, 0, Math.PI * 2); ctx.fill();
  }
  if (laser.pts.length || (d && now - d[2] < 1200) || laser.down) laser.raf = requestAnimationFrame(laserDraw);
  else ctx.clearRect(0, 0, innerWidth, innerHeight);
}
pagesEl.addEventListener('pointerdown', e => {
  if (S.viewonly && S.tool !== 'laser') return; // nur ansehen
  if (S.tool === 'laser' && e.button === 0 && !S.pinch && !(e.pointerType === 'touch' && (!e.isPrimary || S.pencil.only))) {
    e.preventDefault(); if (drag) endDrag();
    drag = { mode: 'laser', pointerId: e.pointerId }; laser.down = true; laserAdd(e, true);
    return;
  }
  const stylusErase = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32));
  if ((e.button !== 0 && !stylusErase) || e.target.closest('textarea') || e.target.closest('.forml .ff')) return;
  if (e.pointerType === 'pen') notePencil();
  if (drag && drag.pointerId !== e.pointerId) return;
  if (drag) endDrag();
  if ((e.pointerType === 'touch' && !e.isPrimary) || S.pinch) return;
  // Handballen-Erkennung: Finger zeichnen nicht, wenn nur der Pencil zeichnen soll
  if (S.pencil.only && e.pointerType === 'touch' && PENCIL_TOOLS.has(S.tool)) return;
  const wrap = e.target.closest('.page');
  if (!wrap) { if (S.editing) commitEdit(); else if (S.tool === 'select') select(null); return; }
  const p = pageById(wrap.dataset.id), el = els.get(p.id), pt = ptIn(e, el);
  hoverRing(null);
  setCurrent(S.pages.indexOf(p));
  if (S.cedit) { commitEdit(); return; }
  if (S.editing) { commitEdit(); if (S.tool === 'text') return; }
  const t = stylusErase ? 'eraser' : S.tool;
  if (t === 'eraser') {
    e.preventDefault();
    drag = { mode: 'erase', p, pointerId: e.pointerId, last: pt, removed: 0 };
    eraseAt(drag, pt);
    return;
  }
  if (t === 'objects') {
    e.preventDefault();
    if (S.csel && S.csel.pid === p.id && onCselHandle(pt)) {
      drag = { mode: 'cresize', p, pointerId: e.pointerId, start: pt, u: cselBox(), items: S.csel.items, k: 1 };
      S.touchDrag = e.pointerType === 'touch';
      return;
    }
    const startMove = items => {
      drag = { mode: 'cmove', p, pointerId: e.pointerId, start: pt, items, dx: 0, dy: 0, moved: false, lines: snapLines(p, new Set(items.flatMap(i => i.ids))) };
      S.touchDrag = e.pointerType === 'touch';
    };
    // Innerhalb der Auswahl ziehen verschiebt, sonst Rahmen aufziehen (Antippen wählt ein Element)
    if (S.csel && S.csel.pid === p.id && inCsel(pt) && !e.shiftKey) { startMove(S.csel.items); return; }
    drag = { mode: 'marquee', p, pointerId: e.pointerId, start: pt, shift: e.shiftKey, moved: false, r: null };
    return;
  }
  if (t === 'select') {
    const a = selAnnot();
    if (a && S.sel.pid === p.id) {
      const b = bbox(a), pad = 3 / S.zoom, hs = (COARSE ? 20 : 10) / S.zoom;
      if (a.t !== 'note' && Math.abs(pt[0] - (b.x + b.w + pad)) <= hs && Math.abs(pt[1] - (b.y + b.h + pad)) <= hs) {
        drag = { mode: 'resize', p, pointerId: e.pointerId, a, orig: clone(a), ob: b, start: pt, moved: false }; S.touchDrag = e.pointerType === 'touch'; e.preventDefault(); return;
      }
    }
    // Mehrfachauswahl: in die Auswahl tippen und ziehen verschiebt alle
    if (S.msel && S.msel.pid === p.id && !e.shiftKey) {
      const list = p.annots.filter(x => S.msel.ids.includes(x.id)), u = unionBox(list), tol = 4 / S.zoom;
      if (pt[0] >= u.x - tol && pt[0] <= u.x + u.w + tol && pt[1] >= u.y - tol && pt[1] <= u.y + u.h + tol) {
        drag = { mode: 'mmove', p, pointerId: e.pointerId, list, orig: list.map(clone), start: pt, moved: false, lines: snapLines(p, null, null, new Set(S.msel.ids)) };
        S.touchDrag = e.pointerType === 'touch'; e.preventDefault(); return;
      }
    }
    const hit = hitTest(p, pt);
    if (hit && (e.shiftKey || e.metaKey || e.ctrlKey)) {
      const cur = S.msel && S.msel.pid === p.id ? S.msel.ids.slice() : S.sel && S.sel.pid === p.id ? [S.sel.aid] : [];
      const k = cur.indexOf(hit.id); if (k >= 0) cur.splice(k, 1); else cur.push(hit.id);
      setMulti(p.id, cur); e.preventDefault(); return;
    }
    if (hit) {
      const was = S.sel && S.sel.aid === hit.id;
      if (S.msel) S.msel = null;
      select(p.id, hit.id); drag = { mode: 'move', p, pointerId: e.pointerId, a: hit, orig: clone(hit), start: pt, moved: false, tapNote: hit.t === 'note' && was, lines: snapLines(p, null, hit) };
      S.touchDrag = e.pointerType === 'touch'; e.preventDefault();
    } else if (e.pointerType !== 'touch') {
      // Rahmen aufziehen wählt mehrere Elemente
      e.preventDefault();
      drag = { mode: 'amarq', p, pointerId: e.pointerId, start: pt, moved: false, r: null, add: e.shiftKey };
    } else setMulti(null, []);
    return;
  }
  if (t === 'note') {
    e.preventDefault();
    const hit = hitTest(p, pt, 'note');
    if (hit) { editNote(p, hit); return; }
    const a = { id: uid(), t: 'note', x: pt[0] - NOTE / 2, y: pt[1] - NOTE / 2, text: '', color: TP.note.color };
    editNote(p, a, true);
    return;
  }
  if (t === 'stamp') {
    e.preventDefault();
    const tp = TP.stamp, a = { id: uid(), t: 'stamp', x: 0, y: 0, text: tp.text === '{datum}' ? today() : tp.text, color: tp.color, size: 14 };
    const g = stampGeom(a); a.x = pt[0] - g.w / 2; a.y = pt[1] - g.h / 2;
    pushHist(); p.annots.push(a); markDirty(); setTool('select'); select(p.id, a.id); drawAnnots(p);
    return;
  }
  e.preventDefault();
  if (t === 'text') {
    const hit = hitTest(p, pt, 'text');
    if (hit) editText(p, hit, false);
    else { const tp = TP.text; editText(p, { id: uid(), t: 'text', x: pt[0], y: pt[1] - tp.size * 0.65, text: '', color: tp.color, size: tp.size, font: tp.font, bold: tp.bold, bg: tp.bg || '' }, true); }
    return;
  }
  if (t === 'edittext') {
    analysisOf(p).then(() => {
      const it = itemAt(p, pt, 'text');
      if (it) editContentText(p, it); else toast('An dieser Stelle wurde kein Text gefunden.');
    }, () => replaceTextAt(p, pt));
    return;
  }
  if (t === 'check' || t === 'cross') {
    const tp = TP[t], s = 14;
    pushHist(); p.annots.push({ id: uid(), t, x: pt[0] - s / 2, y: pt[1] - s / 2, s, color: tp.color, sw: tp.sw });
    drawAnnots(p); markDirty(); return;
  }
  // Markieren, Unterstreichen, Durchstreichen: auf Text beginnen = Text auswählen wie in Acrobat
  if (SNAP_TOOLS.has(t)) {
    // Finger und Pencil treffen nicht so genau wie die Maus: größere Toleranz
    const ch = charsOf(p), i = ch ? charAt(ch, pt, (e.pointerType === 'mouse' ? 3 : 9) / S.zoom) : -1;
    if (i >= 0) { drag = { mode: 'tsel', p, pointerId: e.pointerId, tool: t, ch, i0: i, i1: i, start: pt, moved: false, ptype: e.pointerType }; return; }
  }
  const tp = TP[t] || {};
  let a;
  if (t === 'pen') a = { id: uid(), t, kind: tp.kind, pts: [[r2(pt[0]), r2(pt[1]), r2(pressureOf(e))]], color: tp.color, sw: tp.sw, op: tp.op };
  else if (t === 'line' || t === 'arrow') a = { id: uid(), t, x1: pt[0], y1: pt[1], x2: pt[0], y2: pt[1], color: tp.color, sw: tp.sw, ...(tp.dash ? { dash: tp.dash } : {}) };
  else if (t === 'measure') a = { id: uid(), t, x1: pt[0], y1: pt[1], x2: pt[0], y2: pt[1], color: tp.color, sw: tp.sw, scale: tp.scale, unit: tp.unit };
  else if (t === 'ul' || t === 'so') a = { id: uid(), t: 'line', x1: pt[0], y1: pt[1], x2: pt[0], y2: pt[1], color: tp.color, sw: 1.5 };
  else if (t === 'hl') a = { id: uid(), t, x: pt[0], y: pt[1], w: 0, h: 0, color: tp.color, op: tp.op };
  else if (t === 'white' || t === 'redact') a = { id: uid(), t, x: pt[0], y: pt[1], w: 0, h: 0 };
  else a = { id: uid(), t, x: pt[0], y: pt[1], w: 0, h: 0, color: tp.color, sw: tp.sw, ...(tp.fill ? { fill: tp.fill } : {}), ...(tp.dash ? { dash: tp.dash } : {}) };
  drag = { mode: 'draw', p, pointerId: e.pointerId, a, start: pt, tool: t, horiz: t === 'ul' || t === 'so', ptype: e.pointerType };
  if (SNAP_TOOLS.has(t)) analysisOf(p).catch(() => {});
  if (t === 'redact') analysisOf(p).catch(() => {});
});

/* Radierer: entfernt eigene Elemente, die er berührt (auch zwischen zwei Bewegungspunkten) */
function eraseAt(d, pt) {
  const p = d.p, r = TP.eraser.size / 2;
  const steps = Math.max(1, Math.ceil(Math.hypot(pt[0] - d.last[0], pt[1] - d.last[1]) / Math.max(r / 2, 1)));
  const hitIds = new Set();
  for (let s = 1; s <= steps; s++) {
    const q = [d.last[0] + (pt[0] - d.last[0]) * s / steps, d.last[1] + (pt[1] - d.last[1]) * s / steps];
    for (const a of p.annots) if (!hitIds.has(a.id) && hitsAnnot(a, q, r)) hitIds.add(a.id);
  }
  d.last = pt;
  if (hitIds.size) {
    if (!d.removed) pushHist();
    d.removed += hitIds.size;
    p.annots = p.annots.filter(a => !hitIds.has(a.id));
    if (S.sel && hitIds.has(S.sel.aid)) S.sel = null;
    drawAnnots(p); markDirty();
  }
  const e = els.get(p.id);
  if (e) $('.draft', e.svg).innerHTML = `<circle class="hov" cx="${r2(pt[0])}" cy="${r2(pt[1])}" r="${r2(r)}"/>`;
}

/* Formerkennung: Strich kurz halten → gerade Linie, Rechteck oder Ellipse */
function recognizeShape(a) {
  // Punkte ausdünnen und das Zittern am Ende (beim Halten) abschneiden, sonst wirkt der Strich krumm und zu lang
  const step = 3 / Math.max(S.zoom, 0.5), P = [];
  for (const q of a.pts) { const l = P[P.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) >= step) P.push(q); }
  const last = a.pts[a.pts.length - 1], tail = 7 / Math.max(S.zoom, 0.5);
  while (P.length > 2 && Math.hypot(P[P.length - 1][0] - last[0], P[P.length - 1][1] - last[1]) < tail) P.pop();
  P.push(last);
  if (P.length < 3) return null;
  let len = 0;
  for (let i = 1; i < P.length; i++) len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  const b = bbox(a), size = Math.max(b.w, b.h);
  if (size < 12 / Math.max(S.zoom, 0.5)) return null;
  const f = P[0], l = P[P.length - 1], chord = Math.hypot(l[0] - f[0], l[1] - f[1]);
  const avgP = P.reduce((s, q) => s + (q[2] == null ? 0.5 : q[2]), 0) / P.length;
  if (chord / len > 0.88) {
    const dev = Math.max(...P.map(q => distSeg(q, f, l)));
    if (dev < Math.max(3, chord * 0.09)) return { ...a, pts: [[f[0], f[1], r2(avgP)], [l[0], l[1], r2(avgP)]] };
  }
  if (penKind(a) === 'marker' || chord > 0.25 * size || b.w < 10 || b.h < 10) return null;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, ry = b.h / 2;
  let ee = 0, re = 0;
  for (const [x, y] of P) {
    ee += Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1);
    re += Math.min(Math.abs(x - b.x), Math.abs(x - b.x - b.w), Math.abs(y - b.y), Math.abs(y - b.y - b.h)) / Math.min(b.w, b.h);
  }
  ee /= P.length; re /= P.length;
  const se = ee / 0.11, sr = re / 0.055;
  if (Math.min(se, sr) > 1) return null;
  const sw = penKind(a) === 'fount' ? Math.max(0.5, r2(a.sw * 0.8)) : a.sw;
  return { id: a.id, t: sr < se ? 'rect' : 'ellipse', x: b.x, y: b.y, w: b.w, h: b.h, color: a.color, sw };
}
function tryShape(d) {
  if (drag !== d || d.shaped || !TP.pen.shapes) return;
  const s = recognizeShape(d.a);
  if (!s) return;
  d.a = s; d.shaped = true;
  drawDraft(d.p, s);
  if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) { /* egal */ }
  setMsg(s.t === 'pen' ? 'Gerade Linie erkannt' : s.t === 'rect' ? 'Rechteck erkannt' : 'Ellipse erkannt');
}
window.addEventListener('pointermove', e => {
  if (drag && drag.pointerId != null && e.pointerId !== drag.pointerId) return;
  // verlorenes pointerup (Stift oder Maus schon abgehoben): Ziehen sauber beenden
  if (drag && e.buttons === 0 && (e.pointerType === 'mouse' || (e.pointerType === 'pen' && !e.pressure))) { S.touchDrag = false; endDrag(); return; }
  if (!drag) {
    if (S.tool === 'laser' && (e.pointerType === 'mouse' || (e.pointerType === 'pen' && !e.buttons)) && e.target.closest && e.target.closest('#pages')) laserAdd(e, false);
    const w = e.target && e.target.closest ? e.target.closest('.page') : null;
    let hov = null;
    if (w) {
      const p = pageById(w.dataset.id), pt = ptIn(e, els.get(w.dataset.id));
      $('#stCursor').textContent = `x ${fmtLen(pt[0], S.prefs.unit, 1, 0)} · y ${fmtLen(pt[1], S.prefs.unit, 1, 0)}`;
      if (p && !S.cedit && (S.tool === 'objects' || S.tool === 'edittext')) { const it = itemAt(p, pt, S.tool === 'edittext' ? 'text' : null); if (it) hov = { pid: p.id, it }; }
      // Pencil-Hover (iPad mit Hover-Unterstützung): Vorschau der Spitze
      if (e.pointerType === 'pen' && !e.buttons && p) {
        const r = S.tool === 'eraser' ? TP.eraser.size / 2 : S.tool === 'pen' ? TP.pen.sw / 2 : S.tool === 'hl' ? 4 : 0;
        if (r) hoverRing(p, pt, r); else hoverRing(null);
      }
    } else { $('#stCursor').textContent = ''; if (e.pointerType === 'pen') hoverRing(null); }
    const prevHov = S.hover;
    if ((prevHov && prevHov.it) !== (hov && hov.it)) {
      S.hover = hov;
      if (prevHov) drawCUI(pageById(prevHov.pid));
      if (hov && (!prevHov || prevHov.pid !== hov.pid)) drawCUI(pageById(hov.pid));
    }
    return;
  }
  if (drag.mode === 'laser') { laserAdd(e, true); return; }
  const el = els.get(drag.p.id); if (!el) return;
  const pt = ptIn(e, el), a = drag.a;
  if (drag.mode === 'erase') {
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ce of evs.length ? evs : [e]) eraseAt(drag, ptIn(ce, el));
    return;
  }
  if (drag.mode === 'amarq') {
    const x = Math.min(pt[0], drag.start[0]), y = Math.min(pt[1], drag.start[1]), w = Math.abs(pt[0] - drag.start[0]), h = Math.abs(pt[1] - drag.start[1]);
    if (!drag.moved && Math.hypot(w, h) * S.zoom < 4) return;
    drag.moved = true; drag.r = { x, y, w, h };
    $('.draft', el.svg).innerHTML = `<rect class="marq" x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}"/>`;
    return;
  }
  if (drag.mode === 'mmove') {
    let dx = pt[0] - drag.start[0], dy = pt[1] - drag.start[1];
    if (!drag.moved) { if (Math.hypot(dx, dy) * S.zoom < 2) return; pushHist(); drag.moved = true; }
    const u = unionBox(drag.orig), sn = snapBox(drag.lines, { x: u.x + dx, y: u.y + dy, w: u.w, h: u.h }, e.altKey);
    dx += sn.dx; dy += sn.dy;
    drag.orig.forEach((o, k) => Object.assign(drag.list[k], translated(o, dx, dy)));
    drawAnnots(drag.p);
    if (sn.svg) $('.draft', el.svg).innerHTML = sn.svg;
    return;
  }
  if (drag.mode === 'tsel') {
    if (!drag.moved && Math.hypot(pt[0] - drag.start[0], pt[1] - drag.start[1]) * S.zoom < 4) return;
    drag.moved = true;
    const j = nearestChar(drag.ch, pt); if (j >= 0) drag.i1 = j;
    const m = markFromChars(drag.ch, drag.i0, drag.i1), tp = TP[drag.tool];
    $('.draft', el.svg).innerHTML = m ? annotSVG({ t: 'mark', kind: drag.tool, rects: m.rects, color: tp.color, op: tp.op || 40, vert: rotOf(drag.p) % 180 !== 0 }) : '';
    if (m) $('#stMsg').textContent = `„${m.text.length > 70 ? m.text.slice(0, 69) + '…' : m.text}“`;
    return;
  }
  if (drag.mode === 'cmove') {
    let dx = pt[0] - drag.start[0], dy = pt[1] - drag.start[1];
    if (!drag.moved && Math.hypot(dx, dy) * S.zoom < 4) return;
    drag.moved = true;
    const u = cselBox(drag.items), sn = snapBox(drag.lines, { x: u.x + dx, y: u.y + dy, w: u.w, h: u.h }, e.altKey);
    dx += sn.dx; dy += sn.dy; drag.dx = dx; drag.dy = dy;
    showGhost(drag.p, drag.items, dx, dy, 1);
    $('.draft', el.svg).innerHTML = sn.svg;
    $('#stCursor').textContent = `Δ ${Math.round(dx * 25.4 / 72)} · ${Math.round(dy * 25.4 / 72)} mm`;
    return;
  }
  if (drag.mode === 'cresize') {
    const u = drag.u;
    drag.k = clamp(Math.max((pt[0] - u.x) / Math.max(u.w, 1), (pt[1] - u.y) / Math.max(u.h, 1)), 0.1, 10);
    showGhost(drag.p, drag.items, 0, 0, drag.k);
    $('#stCursor').textContent = `${Math.round(drag.k * 100)} %`;
    return;
  }
  if (drag.mode === 'marquee') {
    const x = Math.min(pt[0], drag.start[0]), y = Math.min(pt[1], drag.start[1]), w = Math.abs(pt[0] - drag.start[0]), h = Math.abs(pt[1] - drag.start[1]);
    if (!drag.moved && Math.hypot(w, h) * S.zoom < 4) return;
    drag.moved = true; drag.r = { x, y, w, h };
    $('.draft', el.svg).innerHTML = `<rect class="marq" x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}"/>`;
    return;
  }
  if (drag.mode === 'draw') {
    if (drag.shaped) {
      // nach der Formerkennung: gerade Linie folgt noch dem Stift, Rechteck und Ellipse bleiben
      if (a.t === 'pen' && a.pts.length === 2) { a.pts[1] = [r2(pt[0]), r2(pt[1]), a.pts[1][2]]; drawDraft(drag.p, a); }
      return;
    }
    if (a.t === 'pen') {
      // alle Zwischenpunkte des Pencil (bis 240 Hz) für glatte Linien
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      let movedFar = false;
      for (const ce of evs.length ? evs : [e]) {
        const q = ptIn(ce, el), l = a.pts[a.pts.length - 1], dist = Math.hypot(q[0] - l[0], q[1] - l[1]);
        if (dist > 0.5 / S.zoom) a.pts.push([r2(q[0]), r2(q[1]), r2(pressureOf(ce))]);
        // Halten erkennen: der Pencil zittert beim Stillhalten um 1–3 px, erst echte Bewegung startet die Zeit neu
        if (!drag.anchor || Math.hypot(q[0] - drag.anchor[0], q[1] - drag.anchor[1]) * S.zoom > 6) { drag.anchor = q; movedFar = true; }
      }
      if (movedFar || !drag.hold) {
        clearTimeout(drag.hold);
        const d = drag;
        if (TP.pen.shapes) d.hold = setTimeout(() => tryShape(d), 500);
      }
      drawDraft(drag.p, a);
      return;
    } else if (a.t === 'line' || a.t === 'arrow' || a.t === 'measure') {
      let [x, y] = pt;
      if (drag.horiz) y = a.y1;
      else if (e.shiftKey) {
        const dx = x - a.x1, dy = y - a.y1, ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy);
        x = a.x1 + len * Math.cos(ang); y = a.y1 + len * Math.sin(ang);
      }
      a.x2 = x; a.y2 = y;
    } else {
      let w = pt[0] - drag.start[0], h = pt[1] - drag.start[1];
      if (e.shiftKey && a.t !== 'hl') { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      a.x = Math.min(drag.start[0], drag.start[0] + w); a.y = Math.min(drag.start[1], drag.start[1] + h);
      a.w = Math.abs(w); a.h = Math.abs(h);
    }
    drawDraft(drag.p, a);
    return;
  }
  const dx = pt[0] - drag.start[0], dy = pt[1] - drag.start[1];
  if (!drag.moved) { if (Math.hypot(dx, dy) * S.zoom < 2) return; pushHist(); drag.moved = true; }
  let next, guides = '';
  if (drag.mode === 'move') {
    next = translated(drag.orig, dx, dy);
    if (drag.lines) {
      const sn = snapBox(drag.lines, bbox(next), e.altKey);
      if (sn.dx || sn.dy) next = translated(drag.orig, dx + sn.dx, dy + sn.dy);
      guides = sn.svg;
    }
  } else {
    const ob = drag.ob;
    let nw = Math.max(4, ob.w + dx), nh = Math.max(4, ob.h + dy);
    if (['text', 'img', 'check', 'cross', 'stamp', 'wm', 'note'].includes(a.t) || e.shiftKey) { const f = Math.max(nw / ob.w, nh / ob.h); nw = ob.w * f; nh = ob.h * f; }
    next = scaled(drag.orig, ob, nw / ob.w, nh / ob.h);
  }
  Object.assign(a, next);
  drawAnnots(drag.p);
  if (guides) $('.draft', el.svg).innerHTML = guides;
});
function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  clearTimeout(d.hold);
  if (d.mode === 'laser') { laser.down = false; if (!laser.raf) laser.raf = requestAnimationFrame(laserDraw); return; }
  if (d.mode === 'amarq') {
    drawDraft(d.p, null);
    if (!d.moved) { setMulti(null, []); return; }
    const r = d.r, cur = d.add && S.msel && S.msel.pid === d.p.id ? S.msel.ids.slice() : d.add && S.sel && S.sel.pid === d.p.id ? [S.sel.aid] : [];
    for (const a of d.p.annots) {
      const b = bbox(a), ix = Math.max(0, Math.min(b.x + b.w, r.x + r.w) - Math.max(b.x, r.x)), iy = Math.max(0, Math.min(b.y + b.h, r.y + r.h) - Math.max(b.y, r.y));
      if (ix * iy >= 0.5 * Math.max(b.w, 1) * Math.max(b.h, 1) && !cur.includes(a.id)) cur.push(a.id);
    }
    setMulti(d.p.id, cur);
    if (!cur.length) toast('Im Rahmen liegt kein eigenes Element.');
    return;
  }
  if (d.mode === 'mmove') { drawDraft(d.p, null); if (d.moved) markDirty(); return; }
  if (d.mode === 'tsel') {
    drawDraft(d.p, null);
    if (d.moved) createMark(d.p, d.ch, d.i0, d.i1, d.tool); else snapToText(d.p, d.start, d.tool);
    return;
  }
  if (d.mode === 'erase') {
    drawDraft(d.p, null);
    if (d.removed) setMsg(d.removed === 1 ? '1 Element gelöscht' : `${d.removed} Elemente gelöscht`);
    return;
  }
  if (d.mode === 'draw' && d.a.t === 'redact') {
    drawDraft(d.p, null);
    if (d.a.w > 2 && d.a.h > 2) applyRedaction(d.p, d.a);
    return;
  }
  if (d.mode === 'cmove') {
    drawDraft(d.p, null);
    if (!d.moved) { const it = itemAt(d.p, d.start); if (it && d.items.length > 1) setCsel(d.p.id, [it]); return; }
    transformContent(d.p, d.items, moveMatrix(d.p, d.dx, d.dy, d.start)).finally(hideGhost);
    return;
  }
  if (d.mode === 'cresize') {
    if (Math.abs(d.k - 1) < 0.01) { hideGhost(); return; }
    transformContent(d.p, d.items, scaleMatrix(d.p, d.k, [d.u.x, d.u.y])).finally(hideGhost);
    return;
  }
  if (d.mode === 'marquee') {
    drawDraft(d.p, null);
    const items = cItems(d.p);
    if (!items) { toast('Die Seite wird noch analysiert. Bitte gleich noch einmal klicken.'); return; }
    const cur = S.csel && S.csel.pid === d.p.id && d.shift ? S.csel.items.slice() : [];
    if (!d.moved) {
      const it = itemAt(d.p, d.start);
      if (!it) { if (!d.shift) setCsel(null, []); return; }
      const k = cur.indexOf(it);
      if (d.shift) { if (k >= 0) cur.splice(k, 1); else cur.push(it); setCsel(d.p.id, cur); }
      else setCsel(d.p.id, [it]);
      return;
    }
    const r = d.r;
    const picked = items.filter(it => {
      const b = it.box, ix = Math.max(0, Math.min(b.x + b.w, r.x + r.w) - Math.max(b.x, r.x)), iy = Math.max(0, Math.min(b.y + b.h, r.y + r.h) - Math.max(b.y, r.y));
      const area = Math.max(b.w, 0.5) * Math.max(b.h, 0.5);
      return (Math.max(ix, 0.5) * Math.max(iy, 0.5)) / area >= 0.7 && ix > 0 && iy > 0;
    });
    for (const it of picked) if (!cur.includes(it)) cur.push(it);
    setCsel(d.p.id, cur);
    if (!picked.length) toast('Im Rahmen liegt kein Element vollständig.');
    return;
  }
  if (d.mode === 'draw') {
    drawDraft(d.p, null);
    const a = d.a;
    // mit dem Markier-Werkzeug über Text gezogen: Markierung rastet auf die Zeichen ein
    if (SNAP_TOOLS.has(d.tool) && markRegion(d.p, a, d.tool)) return;
    const ok = a.t === 'pen' ? a.pts.length >= 1 : (a.t === 'line' || a.t === 'arrow' || a.t === 'measure') ? Math.hypot(a.x2 - a.x1, a.y2 - a.y1) > 2 : a.w > 2 && a.h > 2;
    if (ok) { pushHist(); d.p.annots.push(a); markDirty(); drawAnnots(d.p); }
    else if (SNAP_TOOLS.has(d.tool)) snapToText(d.p, d.start, d.tool);
  } else if (d.moved) { drawDraft(d.p, null); markDirty(); renderProps(); }
  else if (d.tapNote) editNote(d.p, d.a);
}
function cancelDrag(e) {
  if (e && e.pointerId != null && drag && drag.pointerId != null && e.pointerId !== drag.pointerId) return;
  S.touchDrag = false;
  if (!drag) return;
  const d = drag; drag = null;
  clearTimeout(d.hold);
  if (d.mode === 'laser') { laser.down = false; return; }
  if (d.mode === 'erase') { drawDraft(d.p, null); return; }
  // ein Pencil-Strich, den Safari abbricht, bleibt erhalten
  if (d.mode === 'draw' && d.ptype === 'pen' && d.a.t === 'pen' && d.a.pts.length > 2) { drag = d; endDrag(); return; }
  // eine begonnene Textauswahl wird trotzdem markiert
  if (d.mode === 'tsel' && d.moved) { drag = d; endDrag(); return; }
  if (['draw', 'marquee', 'cmove', 'cresize', 'tsel', 'amarq', 'mmove'].includes(d.mode)) { drawDraft(d.p, null); hideGhost(); if (d.mode === 'mmove' && d.moved) restoreMulti(d); }
  else if (d.moved) { Object.assign(d.a, d.orig); if (S.hist.length) S.hist.pop(); updateUndo(); drawAnnots(d.p); }
}
window.addEventListener('pointerup', e => {
  if (drag && drag.pointerId != null && e.pointerId !== drag.pointerId) return;
  S.touchDrag = false; endDrag();
});
window.addEventListener('pointercancel', cancelDrag);
pagesEl.addEventListener('pointerleave', e => { if (e.pointerType === 'pen' && !drag) hoverRing(null); });

/* Schwärzen: schwarzer Balken plus dauerhaftes Entfernen der Inhalte darunter */
async function applyRedaction(p, a) {
  const f = d2u(p), c1 = f(a.x, a.y), c2 = f(a.x + a.w, a.y + a.h);
  const rect = [Math.min(c1[0], c2[0]), Math.min(c1[1], c2[1]), Math.max(c1[0], c2[0]), Math.max(c1[1], c2[1])].map(r2);
  pushHist();
  p.annots.push(a);
  const ce = newCE(p); ce.red.push(rect); p.ce = ce;
  drawAnnots(p);
  await applyCE(p);
  toast('Geschwärzt: Der Inhalt darunter ist aus der PDF entfernt');
}

/* Rahmen oder Strich über Text → Textmarkierung der getroffenen Zeichen */
function markRegion(p, a, tool) {
  const ch = charsOf(p); if (!ch || !ch.flat.length) return false;
  const r = a.t === 'line' ? { x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2), w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1) } : { x: a.x, y: a.y, w: a.w, h: a.h };
  if (r.w < 3 && r.h < 3) return false;
  let hit = [];
  ch.flat.forEach((c, k) => {
    if (!c.ch.trim()) return;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2, pad = Math.max(2, c.h * 0.45);
    if (cx >= r.x && cx <= r.x + r.w && cy >= r.y - pad && cy <= r.y + r.h + pad) hit.push(k);
  });
  if (!hit.length) return false;
  const hs = hit.map(k => ch.flat[k].h).sort((x, y) => x - y), med = hs[hs.length >> 1];
  if (a.t === 'hl' && r.h > med * 3.2) return false; // großer Rahmen bleibt Flächenmarkierung
  if (r.h < med * 1.6) {
    // dünner Strich: nur die Zeile, durch die er am ehesten geht
    const my = r.y + r.h / 2, byLine = new Map();
    for (const k of hit) { const c = ch.flat[k], d = Math.abs(c.y + c.h / 2 - my); if (!byLine.has(c.line) || d < byLine.get(c.line)) byLine.set(c.line, d); }
    const best = [...byLine].sort((x, y) => x[1] - y[1])[0][0];
    hit = hit.filter(k => ch.flat[k].line === best);
  }
  return !!createMark(p, ch, Math.min(...hit), Math.max(...hit), tool);
}
/* Markieren, Unterstreichen und Durchstreichen rasten auf Textzeilen ein */
function snapToText(p, pt, tool) {
  const ch = charsOf(p), i = ch ? charAt(ch, pt, 8 / S.zoom) : -1;
  if (i < 0) { toast(tool === 'hl' ? 'Auf Text tippen und ziehen oder einen Bereich aufziehen.' : 'Auf Text tippen und ziehen oder eine Linie ziehen.'); return; }
  const line = ch.flat[i].line, idx = ch.flat.map((c, k) => (c.line === line ? k : -1)).filter(k => k >= 0);
  createMark(p, ch, idx[0], idx[idx.length - 1], tool);
}

/* ---------- Zeichenindex für Textmarkierungen ----------
   Jedes Zeichen der Seite mit Box (Ansichtskoordinaten) in Reihenfolge des Inhaltsstroms,
   berücksichtigt verschobene, gelöschte und geschwärzte Inhalte. */
const charCache = new Map();
function charsOf(p) {
  const an = S.analysis.get(p.src + ':' + p.idx);
  if (!an) { analysisOf(p).catch(() => {}); return null; }
  if (an === 'error') return null;
  const key = p.id + '|' + ceKey(p) + '|' + rotOf(p);
  if (charCache.has(key)) return charCache.get(key);
  const proxy = proxyOf(p); if (!proxy) return null;
  const vp = proxy.getViewport({ scale: 1, rotation: rotOf(p) });
  const ce = p.ce || {}, del = new Set(ce.del || []), tf = ce.tf || {}, red = ce.red || [], rep = ce.rep || {};
  const box = (M, x0, x1, y0, y1) => {
    const q = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => vp.convertToViewportPoint(M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]));
    const xs = q.map(v => v[0]), ys = q.map(v => v[1]), x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };
  const flat = [];
  let line = 0;
  for (const g of an.groups) {
    const start = flat.length;
    for (const o of g.objs) {
      if (del.has(o.i) || rep[o.i] !== undefined || !o.M) continue;
      const A = tf[o.i], M = A ? ENG.mul(o.M, A) : o.M;
      const info = red.length ? ENG.redactInfo(o, A, red) : null;
      if (info === 'all') continue;
      const txt = Array.from(o.text), [y0, y1] = o.gy;
      if (txt.length === o.glyphs.length) o.glyphs.forEach(([gx, adv], k) => { if (!(info && info[k])) flat.push({ ch: txt[k], line, ...box(M, gx, gx + adv, y0, y1) }); });
      else if (txt.length && !info) flat.push({ ch: o.text, line, ...box(M, 0, o.adv, y0, y1) });
    }
    if (flat.slice(start).some(c => c.ch.trim())) line++;
    else flat.length = start;
  }
  const res = { flat };
  charCache.set(key, res);
  if (charCache.size > 80) charCache.delete(charCache.keys().next().value);
  return res;
}
function charAt(ch, pt, tol) {
  let best = -1, bd = Infinity;
  ch.flat.forEach((c, k) => {
    const dx = Math.max(c.x - pt[0], 0, pt[0] - c.x - c.w), dy = Math.max(c.y - pt[1], 0, pt[1] - c.y - c.h), d = Math.hypot(dx, dy);
    if (d <= tol && d < bd) { bd = d; best = k; }
  });
  return best;
}
function nearestChar(ch, pt) {
  let best = -1, bd = Infinity;
  ch.flat.forEach((c, k) => {
    const dx = Math.max(c.x - pt[0], 0, pt[0] - c.x - c.w), dy = Math.max(c.y - pt[1], 0, pt[1] - c.y - c.h), d = dx + dy * 3;
    if (d < bd) { bd = d; best = k; }
  });
  return best;
}
/* Zeichen i0..i1 → je Zeile ein Rechteck plus der markierte Text */
function markFromChars(ch, i0, i1) {
  const [a, b] = i0 <= i1 ? [i0, i1] : [i1, i0];
  const sel = ch.flat.slice(a, b + 1);
  while (sel.length && !sel[0].ch.trim()) sel.shift();
  while (sel.length && !sel[sel.length - 1].ch.trim()) sel.pop();
  if (!sel.length) return null;
  const rects = [], parts = [];
  let cur = null, txt = '', prev = null;
  for (const c of sel) {
    if (!cur || c.line !== cur.line) {
      if (cur) { rects.push(cur.r); parts.push(txt.trim()); }
      cur = { line: c.line, r: { x: c.x, y: c.y, w: c.w, h: c.h } }; txt = ''; prev = null;
    } else {
      const r = cur.r, x1 = Math.max(r.x + r.w, c.x + c.w), y1 = Math.max(r.y + r.h, c.y + c.h);
      r.x = Math.min(r.x, c.x); r.y = Math.min(r.y, c.y); r.w = x1 - r.x; r.h = y1 - r.y;
    }
    if (prev && !/\s$/.test(txt) && c.ch.trim() && c.x - (prev.x + prev.w) > Math.min(c.h, prev.h) * 0.22) txt += ' ';
    txt += c.ch; prev = c;
  }
  rects.push(cur.r); parts.push(txt.trim());
  return { rects: rects.map(r => ({ x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h) })), text: parts.join(' ').replace(/-\s(?=[a-zäöüß])/g, '').replace(/\s+/g, ' ').trim() };
}
function createMark(p, ch, i0, i1, tool) {
  const m = markFromChars(ch, i0, i1); if (!m) return null;
  const tp = TP[tool], a = { id: uid(), t: 'mark', kind: tool, rects: m.rects, text: m.text, color: tp.color };
  if (tool === 'hl') a.op = tp.op;
  if (rotOf(p) % 180) a.vert = true;
  pushHist(); p.annots.push(a); markDirty(); S.qbar = { pid: p.id, aid: a.id }; drawAnnots(p); setTimeout(() => { if (S.qbar && S.qbar.aid === a.id) drawAnnots(p); }, 0);
  setMsg(`Markiert: „${m.text.length > 60 ? m.text.slice(0, 59) + '…' : m.text}“`);
  if (S.prefs.askComment) editComment(p, a);
  return a;
}

/* Kommentar zu einem beliebigen Element */
function editComment(p, a) {
  commitEdit();
  const m = $('#noteModal'), ta = $('#noteText');
  $('#noteTitle').textContent = 'Kommentar';
  $('#noteInfo').textContent = a.t === 'mark' && a.text ? `Zu „${a.text.length > 90 ? a.text.slice(0, 89) + '…' : a.text}“` : `Zu: ${TOOL_NAMES[a.t] || 'Element'}`;
  ta.value = a.comment || '';
  $('#noteDelete').hidden = !a.comment;
  m.hidden = false;
  setTimeout(() => ta.focus(), 30);
  const close = () => { m.hidden = true; $('#noteTitle').textContent = 'Notiz'; $('#noteInfo').textContent = NOTE_INFO; $('#noteOk').onclick = $('#noteCancel').onclick = $('#noteDelete').onclick = null; };
  $('#noteCancel').onclick = close;
  $('#noteDelete').onclick = () => { close(); pushHist(); delete a.comment; drawAnnots(p); markDirty(); renderProps(); };
  $('#noteOk').onclick = () => {
    const txt = ta.value.trim(); close();
    if (txt === (a.comment || '')) return;
    pushHist(); if (txt) a.comment = txt; else delete a.comment;
    drawAnnots(p); markDirty(); renderProps();
  };
}
const NOTE_INFO = 'Wird als Kommentar in der PDF gespeichert und in Acrobat, Vorschau und Browsern angezeigt.';

/* Notizen */
function editNote(p, a, isNew) {
  commitEdit();
  const m = $('#noteModal'), ta = $('#noteText');
  ta.value = a.text || '';
  $('#noteDelete').hidden = !!isNew;
  m.hidden = false;
  setTimeout(() => ta.focus(), 30);
  const close = () => { m.hidden = true; $('#noteOk').onclick = $('#noteCancel').onclick = $('#noteDelete').onclick = null; };
  $('#noteCancel').onclick = close;
  $('#noteDelete').onclick = () => { close(); pushHist(); p.annots = p.annots.filter(x => x.id !== a.id); S.sel = null; drawAnnots(p); markDirty(); renderProps(); };
  $('#noteOk').onclick = () => {
    const txt = ta.value.trim(); close();
    if (isNew) { if (!txt) return; pushHist(); a.text = txt; p.annots.push(a); setTool('select'); select(p.id, a.id); }
    else if (txt !== a.text) { pushHist(); a.text = txt; }
    drawAnnots(p); markDirty();
  };
}
/* Doppelklick/-tipp auf Graph, Tabelle oder Notiz – eigene Erkennung, weil das Neuzeichnen beim
   ersten Klick das Zielelement austauscht und der Browser dann kein dblclick meldet */
{
  let last = null;
  pagesEl.addEventListener('pointerdown', e => {
    if (S.tool !== 'select' || e.button !== 0 || S.viewonly) { last = null; return; }
    const wrap = e.target.closest('.page'); if (!wrap) { last = null; return; }
    const p = pageById(wrap.dataset.id), pt = ptIn(e, els.get(p.id)), now = performance.now();
    const a = hitTest(p, pt, 'table') || hitTest(p, pt, 'graph') || hitTest(p, pt, 'field');
    if (a && last && last.id === a.id && now - last.t < 450 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 12) {
      last = null; e.preventDefault(); e.stopImmediatePropagation();
      if (drag) endDrag();
      if (a.t === 'table') tableDialog(p, a); else if (a.t === 'field') fieldDialog(p, a); else editGraph(p, a);
      return;
    }
    last = a ? { id: a.id, t: now, x: e.clientX, y: e.clientY } : null;
  }, true);
}
pagesEl.addEventListener('dblclick', e => {
  const wrap = e.target.closest('.page'); if (!wrap) return;
  if (S.tool === 'select') {
    const p = pageById(wrap.dataset.id), n = hitTest(p, ptIn(e, els.get(p.id)), 'note');
    if (n) { editNote(p, n); return; }
    const gr = hitTest(p, ptIn(e, els.get(p.id)), 'graph');
    if (gr) { editGraph(p, gr); return; }
    const tb = hitTest(p, ptIn(e, els.get(p.id)), 'table');
    if (tb) { tableDialog(p, tb); return; }
    const fd = hitTest(p, ptIn(e, els.get(p.id)), 'field');
    if (fd) { fieldDialog(p, fd); return; }
  }
  if (S.tool === 'objects') {
    const p = pageById(wrap.dataset.id), it = itemAt(p, ptIn(e, els.get(p.id)), 'text');
    if (it) editContentText(p, it);
    return;
  }
  if (S.tool !== 'select') return;
  const p = pageById(wrap.dataset.id), hit = hitTest(p, ptIn(e, els.get(p.id)), 'text');
  if (hit) { select(null); editText(p, hit, false); }
});

