/* ---------- Quellen laden ---------- */
const SIG_NOTED = new Set();
async function addSource(bytes, name, fixedId) {
  const id = fixedId || uid('s');
  if (window.WBSign && !S.renderMode && !SIG_NOTED.has(id) && WBSign.hasSignatures(bytes) && SIG_NOTED.add(id)) setTimeout(() => toast(`„${name}“ ist digital signiert · prüfen unter ⋯ › Datei › Signaturen prüfen`), 900);
  // mit Besitzer-Passwort geschützte PDFs entschlüsseln, sonst lassen sie sich nicht bearbeiten und speichern
  if (window.WBDecrypt && window.WBDecrypt.isEncrypted(bytes)) {
    const r = await window.WBDecrypt.plain(bytes);
    if (r.changed) { bytes = r.bytes; S.decrypted.add(id); setMsg(`„${name}“ war geschützt und wurde zum Bearbeiten entschlüsselt`); }
  }
  const pdf = await PDFJS.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  S.sources.set(id, { id, name, bytes, pdf });
  const out = [], n = pdf.numPages;
  // Seiten in Blöcken parallel laden: große PDFs (Hunderte Seiten) öffnen deutlich schneller
  const pgs = new Array(n);
  for (let i0 = 0; i0 < n; i0 += 24) await Promise.all(Array.from({ length: Math.min(24, n - i0) }, (_, k) => pdf.getPage(i0 + k + 1).then(pg => { pgs[i0 + k] = pg; })));
  for (let i = 0; i < n; i++) {
    const pg = pgs[i];
    S.proxies.set(id + ':' + i, pg);
    const vp = pg.getViewport({ scale: 1 });
    out.push({ id: uid('p'), src: id, idx: i, baseRot: pg.rotate || 0, rot: 0, w0: vp.width, h0: vp.height, annots: [] });
  }
  return out;
}
function dropSource(id) {
  const s = S.sources.get(id); if (!s) return;
  try { s.pdf.destroy(); } catch (e) { /* egal */ }
  S.sources.delete(id);
  for (const k of [...S.proxies.keys()]) if (k.startsWith(id + ':')) S.proxies.delete(k);
  for (const k of [...S.textCache.keys()]) if (k.startsWith(id + ':')) S.textCache.delete(k);
  for (const k of [...S.analysis.keys()]) if (k.startsWith(id + ':')) S.analysis.delete(k);
  for (const [k, d] of [...S.derived]) if (k.startsWith(id + ':')) { try { d.pdf.destroy(); } catch (e) { /* egal */ } S.derived.delete(k); }
  for (const k of [...S.forms.keys()]) if (k.startsWith(id + ':')) S.forms.delete(k);
  S.libDocs.delete(id);
}

/* ---------- Inhalte der PDF direkt bearbeiten ---------- */
async function libDocOf(src) {
  if (!S.libDocs.has(src)) S.libDocs.set(src, PL.PDFDocument.load(S.sources.get(src).bytes, { updateMetadata: false }));
  return S.libDocs.get(src);
}
const anPending = new Map();
function analysisOf(p) {
  const k = p.src + ':' + p.idx;
  if (S.analysis.has(k)) { const a = S.analysis.get(k); return a === 'error' ? Promise.reject(new Error('analyse')) : Promise.resolve(a); }
  if (!anPending.has(k)) {
    anPending.set(k, (async () => {
      try {
        if (!ENG) throw new Error('engine');
        const ld = await libDocOf(p.src);
        const an = ENG.analysePage(ld.getPage(p.idx));
        S.analysis.set(k, an); return an;
      } catch (e) { console.warn('Analyse fehlgeschlagen', e); S.analysis.set(k, 'error'); throw e; }
      finally { anPending.delete(k); }
    })());
  }
  return anPending.get(k);
}
async function ensureDerived(p) {
  if (!hasCE(p)) return;
  const k = pkey(p);
  if (S.derived.has(k)) return;
  const ld = await libDocOf(p.src), an = await analysisOf(p);
  const out = await PL.PDFDocument.create();
  const [pg] = await out.copyPages(ld, [p.idx]);
  out.addPage(pg);
  ENG.editPage(out, pg, an, p.ce);
  const bytes = await out.save();
  const pdf = await PDFJS.getDocument({ data: bytes, isEvalSupported: false }).promise;
  S.derived.set(k, { pdf, page: await pdf.getPage(1) });
  if (S.derived.size > 60) {
    const live = new Set(S.pages.map(pkey));
    for (const [dk, d] of S.derived) { if (S.derived.size <= 40) break; if (!live.has(dk)) { try { d.pdf.destroy(); } catch (e) { /* egal */ } S.derived.delete(dk); } }
  }
}
function newCE(p) { const c = p.ce || {}; return { del: [...(c.del || [])], rep: { ...(c.rep || {}) }, tf: { ...(c.tf || {}) }, red: (c.red || []).map(r => r.slice()), dup: (c.dup || []).map(d => ({ id: d.id, back: d.back, items: d.items.map(([i, A]) => [i, A.slice()]) })), zf: [...(c.zf || [])], zb: [...(c.zb || [])] }; }
async function applyCE(p) {
  busy(true, 'Seite wird neu aufgebaut …');
  try { await ensureDerived(p); }
  catch (e) { console.error(e); toast('Diese Seite konnte nicht verändert werden.'); }
  finally { busy(false); }
  refreshPage(p); markDirty(); renderProps();
  if (S.find) runFind(S.find.q);
}
const citemCache = new Map();
function cItems(p) {
  const an = S.analysis.get(p.src + ':' + p.idx);
  if (!an) { analysisOf(p).then(() => drawCUI(p), () => {}); return null; }
  if (an === 'error') return [];
  const k = p.id + '|' + ceKey(p) + '|' + rotOf(p);
  if (citemCache.has(k)) return citemCache.get(k);
  const proxy = proxyOf(p); if (!proxy) return [];
  const del = new Set((p.ce && p.ce.del) || []), rep = (p.ce && p.ce.rep) || {}, tf = (p.ce && p.ce.tf) || {}, red = (p.ce && p.ce.red) || [];
  // durch Schwärzen entfernte Objekte gelten als gelöscht, teilweise geschwärzter Text verliert die Zeichen
  const masked = new Map();
  if (red.length) for (const o of an.objects) {
    if (del.has(o.i)) continue;
    const info = ENG.redactInfo(o, tf[o.i], red);
    if (info === 'all') del.add(o.i);
    else if (info && o.kind === 'text') {
      const chars = Array.from(o.text);
      const t = chars.length === info.length ? chars.map((ch, k) => (info[k] ? ' ' : ch)).join('') : '';
      if (!t.trim()) del.add(o.i); else masked.set(o.i, t);
    }
  }
  const X = (b, i) => ENG.xbox(b, tf[i]);
  const tpt = (m, q) => (m ? [m[0] * q[0] + m[2] * q[1] + m[4], m[1] * q[0] + m[3] * q[1] + m[5]] : q);
  const vp = proxy.getViewport({ scale: 1, rotation: rotOf(p) });
  const db = b => {
    const pts = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(q => vp.convertToViewportPoint(q[0], q[1]));
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };
  const union = objs => [Math.min(...objs.map(o => o.bbox[0])), Math.min(...objs.map(o => o.bbox[1])), Math.max(...objs.map(o => o.bbox[2])), Math.max(...objs.map(o => o.bbox[3]))];
  const items = [];
  for (const g of an.groups) {
    const first = g.first, rt = rep[first.i], A = tf[first.i];
    const alive = g.objs.filter(o => !del.has(o.i));
    let text, ub;
    if (rt !== undefined) {
      text = rt;
      const w = measure(rt, { bold: false, size: first.fs, font: 'Helvetica' });
      ub = first.dir[0] > 0 && Math.abs(first.dir[1]) < 1e-6 ? [first.bbox[0], first.bbox[1], Math.max(first.bbox[2], first.base[0] + w), first.bbox[3]] : first.bbox;
    } else {
      if (!alive.some(o => !o.blank)) continue;
      text = ENG.joinText(alive.map(o => (masked.has(o.i) ? { ...o, text: masked.get(o.i) } : o))).replace(/\s{2,}/g, ' ').trim(); ub = union(alive);
    }
    const scale = A ? Math.sqrt(Math.abs(A[0] * A[3] - A[1] * A[2])) : 1;
    items.push({ kind: 'text', ids: g.objs.map(o => o.i), firstId: first.i, text: text.trimEnd(), box: db(ENG.xbox(ub, A)), fs: first.fs * scale, font: first.font, fill: first.fill, base: tpt(A, first.base), dir: first.dir, redacted: g.objs.some(o => masked.has(o.i) || (red.length && del.has(o.i) && !(p.ce.del || []).includes(o.i))) });
  }
  for (const o of an.objects) if (o.kind !== 'text' && !del.has(o.i)) items.push({ kind: o.kind, ids: [o.i], box: db(X(o.bbox, o.i)) });
  // eingefügte Kopien von PDF-Inhalten als eigene Elemente
  const byI = new Map(an.objects.map(o => [o.i, o]));
  for (const d of (p.ce && p.ce.dup) || []) {
    const bs = d.items.map(([i, A]) => byI.get(i) && ENG.xbox(byI.get(i).bbox, A)).filter(Boolean);
    if (!bs.length) continue;
    const ub = [Math.min(...bs.map(b => b[0])), Math.min(...bs.map(b => b[1])), Math.max(...bs.map(b => b[2])), Math.max(...bs.map(b => b[3]))];
    const txt = d.items.map(([i]) => byI.get(i)).filter(o => o && o.kind === 'text').map(o => o.text).join('').replace(/\s+/g, ' ').trim();
    items.push({ kind: 'copy', ids: [d.id], box: db(ub), text: txt });
  }
  citemCache.set(k, items);
  return items;
}
function itemAt(p, pt, kind) {
  const items = cItems(p); if (!items) return null;
  const tol = (COARSE ? 6 : 2) / S.zoom;
  let best = null;
  for (const it of items) {
    if (kind && it.kind !== kind) continue;
    const b = it.box;
    if (pt[0] >= b.x - tol && pt[0] <= b.x + b.w + tol && pt[1] >= b.y - tol && pt[1] <= b.y + b.h + tol) {
      const area = Math.max(b.w, 0.5) * Math.max(b.h, 0.5) * (it.kind === 'text' ? 0.5 : 1);
      if (!best || area < best.area) best = { it, area };
    }
  }
  return best ? best.it : null;
}
const KIND_NAMES = { text: 'Text', path: 'Fläche', image: 'Bild', form: 'Grafik', copy: 'Kopie' };
function cuiSVG(p) {
  let out = '';
  const box = (b, cls) => `<rect class="${cls}" x="${r2(b.x)}" y="${r2(b.y)}" width="${r2(Math.max(b.w, 1))}" height="${r2(Math.max(b.h, 1))}"/>`;
  if (S.csel && S.csel.pid === p.id) {
    for (const it of S.csel.items) out += box(it.box, 'csel');
    const u = cselBox(), pad = 4 / S.zoom, hs = (COARSE ? 16 : 9) / S.zoom;
    if (S.csel.items.length > 1) out += box({ x: u.x - pad, y: u.y - pad, w: u.w + 2 * pad, h: u.h + 2 * pad }, 'cunion');
    out += `<rect class="handle" x="${r2(u.x + u.w + pad - hs / 2)}" y="${r2(u.y + u.h + pad - hs / 2)}" width="${r2(hs)}" height="${r2(hs)}"/>`;
  }
  if (S.hover && S.hover.pid === p.id && !(S.csel && S.csel.items.includes(S.hover.it))) out += box(S.hover.it.box, 'chov');
  return out;
}
function cselBox(items) {
  items = items || (S.csel ? S.csel.items : []);
  const x = Math.min(...items.map(i => i.box.x)), y = Math.min(...items.map(i => i.box.y));
  return { x, y, w: Math.max(...items.map(i => i.box.x + i.box.w)) - x, h: Math.max(...items.map(i => i.box.y + i.box.h)) - y };
}
function onCselHandle(pt) {
  if (!S.csel) return false;
  const u = cselBox(), pad = 4 / S.zoom, hs = (COARSE ? 22 : 11) / S.zoom;
  return Math.abs(pt[0] - (u.x + u.w + pad)) <= hs && Math.abs(pt[1] - (u.y + u.h + pad)) <= hs;
}
function inCsel(pt) {
  if (!S.csel) return false;
  const tol = (COARSE ? 6 : 2) / S.zoom;
  return S.csel.items.some(it => pt[0] >= it.box.x - tol && pt[0] <= it.box.x + it.box.w + tol && pt[1] >= it.box.y - tol && pt[1] <= it.box.y + it.box.h + tol);
}

/* Transformation der ausgewählten PDF-Inhalte (Matrix im PDF-Koordinatensystem) */
function d2u(p) { const vp = proxyOf(p).getViewport({ scale: 1, rotation: rotOf(p) }); return (x, y) => vp.convertToPdfPoint(x, y); }
async function transformContent(p, items, M, msg) {
  if (!items.length || ENG.isId(M)) return;
  pushHist();
  const ce = newCE(p), ids = new Set(items.flatMap(it => it.ids));
  for (const i of ids) {
    const d = typeof i === 'string' && ce.dup.find(x => x.id === i);
    if (d) d.items = d.items.map(([j, A]) => [j, ENG.mul(A, M)]);
    else ce.tf[i] = ENG.mul(ce.tf[i] || [1, 0, 0, 1, 0, 0], M);
  }
  p.ce = ce;
  S.hover = null;
  await applyCE(p);
  const fresh = cItems(p) || [];
  setCsel(p.id, fresh.filter(it => it.ids.some(i => ids.has(i))));
  if (msg) toast(msg);
}
function moveMatrix(p, dx, dy, from) {
  const f = d2u(p), a = f(from[0], from[1]), b = f(from[0] + dx, from[1] + dy);
  return [1, 0, 0, 1, b[0] - a[0], b[1] - a[1]];
}
function scaleMatrix(p, k, anchor) {
  const [ax, ay] = d2u(p)(anchor[0], anchor[1]);
  return [k, 0, 0, k, ax * (1 - k), ay * (1 - k)];
}
function rotateContent(dir) {
  const cs = S.csel; if (!cs) return;
  const p = pageById(cs.pid), u = cselBox();
  const [cx, cy] = d2u(p)(u.x + u.w / 2, u.y + u.h / 2);
  const t = -dir * Math.PI / 2, c = Math.round(Math.cos(t)), s = Math.round(Math.sin(t));
  transformContent(p, cs.items, [c, s, -s, c, cx - cx * c + cy * s, cy - cx * s - cy * c]);
}
/* Ebenen der PDF-Inhalte: ganz nach vorne oder ganz nach hinten.
   Ein seitenfüllender Hintergrund (Bild oder Fläche) bleibt dabei ganz hinten, sonst würde er alles verdecken. */
async function zContent(front) {
  const cs = S.csel; if (!cs) return;
  const p = pageById(cs.pid), ids = cs.items.flatMap(it => it.ids);
  const num = ids.filter(i => typeof i === 'number').sort((a, b) => a - b), strs = new Set(ids.filter(i => typeof i === 'string'));
  pushHist();
  const ce = newCE(p);
  ce.zf = ce.zf.filter(i => !num.includes(i)); ce.zb = ce.zb.filter(i => !num.includes(i));
  if (front) ce.zf.push(...num);
  else {
    const [W, H] = dims(p), first = num.length ? num[0] : Infinity;
    const bg = (cItems(p) || []).filter(it => it.kind !== 'text' && it.kind !== 'copy' && it.ids[0] < first && it.box.w * it.box.h >= 0.8 * W * H).map(it => it.ids[0]);
    ce.zb = bg.sort((a, b) => a - b).concat(num, ce.zb.filter(i => !bg.includes(i)));
  }
  for (const d of ce.dup) if (strs.has(d.id)) { if (front) delete d.back; else d.back = true; }
  if (front && strs.size) ce.dup = ce.dup.filter(d => !strs.has(d.id)).concat(ce.dup.filter(d => strs.has(d.id)));
  p.ce = ce; S.hover = null;
  await applyCE(p);
  const set = new Set(ids);
  setCsel(p.id, (cItems(p) || []).filter(it => it.ids.some(i => set.has(i))));
  toast(front ? 'In den Vordergrund gebracht' : 'In den Hintergrund gelegt');
}
/* Ausgewählte PDF-Inhalte hervorheben: Textmarkierung über den Elementen, mit deren Text */
function markContent() {
  const cs = S.csel; if (!cs) return;
  const p = pageById(cs.pid), tp = TP.hl;
  const rects = cs.items.map(it => ({ x: r2(it.box.x - 1), y: r2(it.box.y - 1), w: r2(it.box.w + 2), h: r2(it.box.h + 2) }));
  const text = cs.items.map(it => it.text || '').filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const a = { id: uid(), t: 'mark', kind: 'hl', rects, text, color: tp.color, op: tp.op };
  if (rotOf(p) % 180) a.vert = true;
  pushHist(); p.annots.push(a); markDirty(); drawAnnots(p);
  setCsel(null, []);
  setMsg(text ? `Hervorgehoben: „${text.length > 60 ? text.slice(0, 59) + '…' : text}“` : 'Hervorgehoben');
  if (S.prefs.askComment) editComment(p, a);
}
let nudge = null;
function nudgeContent(dx, dy) {
  const cs = S.csel; if (!cs) return;
  const p = pageById(cs.pid);
  if (!nudge) nudge = { dx: 0, dy: 0, p, items: cs.items };
  nudge.dx += dx; nudge.dy += dy;
  showGhost(p, cs.items, nudge.dx, nudge.dy, 1);
  clearTimeout(nudge.t);
  nudge.t = setTimeout(() => {
    const n = nudge; nudge = null; hideGhost();
    transformContent(n.p, n.items, moveMatrix(n.p, n.dx, n.dy, [cselBox(n.items).x, cselBox(n.items).y]));
  }, 450);
}

/* Vorschau beim Ziehen: Ausschnitt der gerenderten Seite folgt dem Finger */
function showGhost(p, items, dx, dy, k) {
  const e = els.get(p.id); if (!e || !e.cv || e.cv.width < 2) return;
  const [W] = dims(p), z = S.zoom, s = e.cv.width / W, u = cselBox(items);
  let g = e.ghost;
  if (!g || g.dataset.key !== JSON.stringify(u)) {
    if (g) g.remove();
    g = document.createElement('canvas'); g.className = 'ghost'; g.dataset.key = JSON.stringify(u);
    g.width = Math.max(1, Math.round(u.w * s)); g.height = Math.max(1, Math.round(u.h * s));
    const ctx = g.getContext('2d');
    for (const it of items) {
      const b = it.box;
      ctx.drawImage(e.cv, b.x * s, b.y * s, b.w * s, b.h * s, (b.x - u.x) * s, (b.y - u.y) * s, b.w * s, b.h * s);
    }
    Object.assign(g.style, { left: u.x * z + 'px', top: u.y * z + 'px', width: u.w * z + 'px', height: u.h * z + 'px' });
    e.wrap.append(g); e.ghost = g;
  }
  g.style.transform = `translate(${dx * z}px, ${dy * z}px) scale(${k})`;
}
function hideGhost() { for (const e of els.values()) if (e.ghost) { e.ghost.remove(); e.ghost = null; } }

/* Ausrichtungshilfen: Kanten und Mitten von Seite, Kommentaren und PDF-Inhalten */
function snapLines(p, skipIds, skipAnnot, skipAnnotIds) {
  const [W, H] = dims(p), xs = [0, W / 2, W], ys = [0, H / 2, H];
  for (const a of p.annots) if (a !== skipAnnot && !(skipAnnotIds && skipAnnotIds.has(a.id))) { const b = bbox(a); xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h); }
  const items = S.analysis.get(p.src + ':' + p.idx) ? cItems(p) || [] : [];
  for (const it of items) {
    if (skipIds && it.ids.some(i => skipIds.has(i))) continue;
    const b = it.box; if (b.w * b.h > W * H * 0.6) continue;
    xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h);
  }
  return { xs, ys, W, H };
}
function snapBox(lines, b, noSnap) {
  if (noSnap || !S.prefs.snap) return { dx: 0, dy: 0, svg: '' };
  const tol = 5 / S.zoom;
  const pick = (cands, vals) => {
    let best = null;
    for (const v of vals) for (const c of cands) { const d = c - v; if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: c }; }
    return best;
  };
  const bx = pick(lines.xs, [b.x, b.x + b.w / 2, b.x + b.w]), by = pick(lines.ys, [b.y, b.y + b.h / 2, b.y + b.h]);
  let svg = '';
  if (bx) svg += `<line class="guide" x1="${r2(bx.at)}" y1="0" x2="${r2(bx.at)}" y2="${r2(lines.H)}"/>`;
  if (by) svg += `<line class="guide" x1="0" y1="${r2(by.at)}" x2="${r2(lines.W)}" y2="${r2(by.at)}"/>`;
  return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, svg };
}
function drawCUI(p) { const e = p && els.get(p.id); if (e) { const g = $('.cui', e.svg); if (g) g.innerHTML = cuiSVG(p); } }
function setCsel(pid, items) {
  const prev = S.csel ? pageById(S.csel.pid) : null;
  S.csel = pid && items.length ? { pid, items } : null;
  if (prev) drawCUI(prev);
  if (pid) drawCUI(pageById(pid));
  renderProps();
}
function deleteContent() {
  const cs = S.csel; if (!cs || !cs.items.length) return;
  const p = pageById(cs.pid); if (!p) return;
  pushHist();
  const ce = newCE(p);
  for (const it of cs.items) for (const i of it.ids) {
    if (typeof i === 'string') { ce.dup = ce.dup.filter(d => d.id !== i); continue; }
    if (!ce.del.includes(i)) ce.del.push(i); delete ce.rep[i]; delete ce.tf[i];
  }
  p.ce = ce;
  const n = cs.items.length;
  S.csel = null; S.hover = null;
  applyCE(p).then(() => toast(n === 1 ? 'Element aus der PDF entfernt' : `${n} Elemente aus der PDF entfernt`));
}
function fontGuess(p, it) {
  const an = S.analysis.get(p.src + ':' + p.idx);
  const f = an && an !== 'error' ? an.fonts.get(it.font) : null;
  const b = ((f && f.base) || '').replace(/^[A-Z]{6}\+/, '');
  return { name: /mono|courier|consol/i.test(b) ? 'Courier' : /times|serif|garamond|georgia|minion|cambria|book/i.test(b) && !/sans/i.test(b) ? 'Times' : 'Helvetica', bold: /bold|black|heavy|semibold/i.test(b), base: b };
}
const toHex = c => '#' + (c || [0, 0, 0]).map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
function editContentText(p, it) {
  commitEdit();
  const el = els.get(p.id); if (!el || !it || it.kind !== 'text') return;
  const fg = fontGuess(p, it);
  const ta = document.createElement('textarea');
  ta.className = 'ted ced'; ta.value = it.text; ta.spellcheck = false; ta.rows = 1;
  ta.setAttribute('aria-label', 'Text in der PDF bearbeiten');
  const z = S.zoom, size = it.fs;
  const fit = () => {
    const w = Math.max(it.box.w, measure(ta.value || ' ', { bold: fg.bold, size, font: fg.name }) + size);
    ta.style.width = (w + 6) * z + 'px';
  };
  Object.assign(ta.style, { left: (it.box.x - 3) * z + 'px', top: it.box.y * z + 'px', height: it.box.h * z + 'px', font: `${fg.bold ? 700 : 400} ${size * z}px/${it.box.h / size} ${FONT(fg.name).css}`, paddingLeft: 3 * z + 'px' });
  fit();
  el.wrap.append(ta);
  S.cedit = { p, it, ta };
  setCsel(null, []);
  requestAnimationFrame(() => { ta.focus(); ta.select(); });
  ta.addEventListener('input', fit);
  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); if (ev.key === 'Escape') ta.value = it.text; commitEdit(); }
    ev.stopPropagation();
  });
  ta.addEventListener('blur', () => setTimeout(() => { if (S.cedit && S.cedit.ta === ta && document.activeElement !== ta) commitEdit(); }, 0));
  renderProps();
}
function commitCEdit() {
  const ed = S.cedit; if (!ed) return;
  S.cedit = null;
  const { p, it, ta } = ed;
  const txt = ta.value.replace(/\s*\n\s*/g, ' ').replace(/\s+$/, '');
  ta.remove();
  if (txt === it.text) { renderProps(); return; }
  const an = S.analysis.get(p.src + ':' + p.idx);
  if (!an || an === 'error') return;
  pushHist();
  const ce = newCE(p);
  const delAll = () => { for (const i of it.ids) { if (!ce.del.includes(i)) ce.del.push(i); delete ce.rep[i]; } };
  const first = an.objects.find(o => o.i === it.firstId);
  let fallback = false;
  if (!txt.trim()) delAll();
  else if (first && !it.redacted && ENG.canEncode(an, first, txt)) {
    for (const i of it.ids) if (i !== it.firstId) { if (!ce.del.includes(i)) ce.del.push(i); delete ce.rep[i]; }
    ce.del = ce.del.filter(i => i !== it.firstId);
    ce.rep[it.firstId] = txt;
  } else {
    delAll(); fallback = true;
    const fg = fontGuess(p, it), vp = proxyOf(p).getViewport({ scale: 1, rotation: rotOf(p) });
    const [bx, by] = vp.convertToViewportPoint(it.base[0], it.base[1]);
    const size = Math.max(4, Math.round(it.fs * 2) / 2);
    p.annots.push({ id: uid(), t: 'text', x: bx, y: by - FONT(fg.name).bl * size, text: txt, color: toHex(it.fill), size, font: fg.name, bold: fg.bold });
  }
  p.ce = ce;
  applyCE(p).then(() => {
    if (fallback) toast('Die Originalschrift enthält nicht alle Zeichen. Der Text wurde in Helvetica neu gesetzt.');
    else if (!txt.trim()) toast('Textzeile aus der PDF entfernt');
  });
}
async function openFiles(files, mode, noAsk) {
  const xmlf = [...files].find(f => /\.xml$/i.test(f.name));
  if (xmlf && window.WBEInvoice && ![...files].some(f => /\.pdf$/i.test(f.name))) { await openEInvoiceXml(xmlf); return; }
  const wbf = [...files].find(f => /\.werkbank$/i.test(f.name));
  if (wbf && window.WBFile) { await openWerkbank(wbf, mode, noAsk); return; }
  const pdfs = [...files].filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  if (!pdfs.length) { toast('Bitte eine PDF-Datei wählen.'); return; }
  if (S.busy) return;
  commitEdit();
  if (mode === 'replace' && S.lib && LIB) { await openIntoLibrary(pdfs); return; }
  if (mode === 'replace' && S.dirty && !S.sample && !noAsk) {
    if (!await ask('Ungespeicherte Änderungen verwerfen?', `Wenn du „${pdfs[0].name}“ öffnest, gehen die Änderungen an „${S.docName}“ verloren.`)) return;
  }
  busy(true, 'PDF wird geladen …');
  const oldIds = [...S.sources.keys()];
  const newIds = [];
  try {
    const added = [];
    for (const f of pdfs) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const before = new Set(S.sources.keys());
      added.push(...await addSource(bytes, f.name));
      for (const k of S.sources.keys()) if (!before.has(k)) newIds.push(k);
    }
    // Inhaltsverzeichnis der geöffneten Dateien als Lesezeichen übernehmen
    const marks = [];
    for (const id of newIds) marks.push(...await importOutline(id, added.filter(p => p.src === id)));
    if (mode === 'replace') {
      oldIds.forEach(dropSource);
      S.blankSrc = null; S.paperSrc.clear();
      S.bookmarks = marks; S.formVals = {}; S.formTouched.clear(); S.recs = []; S.cards = []; S.audio = new Map(); if (S.player) closePlayer(); S.cite = null; S.exams = []; S.receipts = []; S.einv = null;
      S.pages = added; S.docName = pdfs[0].name; S.sample = false;
      S.hist = []; S.fut = []; S.dirty = false; S.cur = 0; S.sel = null; S.selPages.clear(); S.find = null;
      $('#findInput').value = ''; $('#findCount').textContent = '';
      S.zoom = initialZoom();
      S.meta = { title: '', author: '', subject: '', keywords: '' };
      try {
        const info = (await S.sources.get(added[0].src).pdf.getMetadata()).info || {};
        S.meta = { title: info.Title || '', author: info.Author || '', subject: info.Subject || '', keywords: info.Keywords || '' };
      } catch (e) { /* keine Metadaten */ }
      buildViewer(); viewer.scrollTop = 0;
      scheduleAutosave(); setTimeout(einvoiceCheck, 400);
    } else {
      pushHist();
      const at = S.pages.length;
      S.pages.push(...added);
      S.bookmarks.push(...marks);
      markDirty(); buildViewer(); scrollToPage(at);
      toast(`${added.length} Seite${added.length === 1 ? '' : 'n'} angehängt`);
    }
    updateTitle(); updateUndo();
  } catch (err) {
    console.error(err);
    newIds.forEach(dropSource);
    toast(err && err.name === 'PasswordException' ? 'Diese PDF ist passwortgeschützt und kann hier nicht geöffnet werden.' : 'Die Datei konnte nicht als PDF gelesen werden.');
  } finally { busy(false); }
}

/* ---------- Ansicht ---------- */
/* Seiten nahe am Sichtbereich merken; gerendert wird über eine Warteschlange mit begrenzter Parallelität,
   damit schnelles Scrollen durch große PDFs nicht Dutzende Leinwände gleichzeitig erzeugt (Speicher, iPad) */
const nearSet = new Set();
const io = new IntersectionObserver(entries => {
  for (const en of entries) {
    const p = pageById(en.target.dataset.id); if (!p) continue;
    if (en.isIntersecting) { nearSet.add(p.id); renderPage(p); } else { nearSet.delete(p.id); releasePage(p); }
  }
}, { root: viewer, rootMargin: '1200px 0px' });
const RQ = { queue: [], running: 0, max: COARSE ? 2 : 3 };
function rqDistance(id) {
  const e = els.get(id); if (!e) return 1e9;
  const r = e.wrap.getBoundingClientRect(), v = viewer.getBoundingClientRect();
  return r.bottom < v.top ? v.top - r.bottom : r.top > v.bottom ? r.top - v.bottom : 0;
}
function rqPump() {
  while (RQ.running < RQ.max && RQ.queue.length) {
    // zuerst die Seite, die dem Sichtbereich am nächsten ist
    let bi = 0, bd = Infinity;
    for (let i = 0; i < RQ.queue.length; i++) { const d = rqDistance(RQ.queue[i].id); if (d < bd) { bd = d; bi = i; } }
    const job = RQ.queue.splice(bi, 1)[0];
    RQ.running++;
    job.run().catch(err => console.error(err)).finally(() => { RQ.running--; rqPump(); });
  }
}

function sizePageEl(p, e) {
  const [W, H] = dims(p);
  e.wrap.style.width = W * S.zoom + 'px';
  e.wrap.style.height = H * S.zoom + 'px';
  e.wrap.style.setProperty('--z', S.zoom);
  e.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  if (e.under) e.under.setAttribute('viewBox', `0 0 ${W} ${H}`);
}
function buildViewer() {
  io.disconnect();
  for (const e of els.values()) if (e.task) try { e.task.cancel(); } catch (x) { /* egal */ }
  els.clear(); pagesEl.textContent = ''; S.csel = null; S.hover = null;
  S.pages.forEach((p, i) => {
    const wrap = document.createElement('div'); wrap.className = 'page'; wrap.dataset.id = p.id;
    const cv = document.createElement('canvas'); cv.className = 'pcv'; cv.width = 1; cv.height = 1;
    const svg = document.createElementNS(SVGNS, 'svg'); svg.classList.add('ov');
    const under = document.createElementNS(SVGNS, 'svg'); under.classList.add('ov', 'un'); // eigene Elemente hinter dem PDF-Inhalt
    const num = document.createElement('div'); num.className = 'pnum'; num.textContent = i + 1;
    const hbl = document.createElement('div'); hbl.className = 'hbl';
    const forml = document.createElement('div'); forml.className = 'forml';
    wrap.append(under, cv, svg, hbl, forml, num);
    pagesEl.append(wrap);
    const e = { wrap, cv, svg, under, hbl, forml, key: null, task: null };
    els.set(p.id, e); sizePageEl(p, e); drawAnnots(p); io.observe(wrap);
    buildFormLayer(p);
  });
  S.cur = clamp(S.cur, 0, S.pages.length - 1);
  buildThumbs(); updateStatus(); renderProps(); updateSideLater();
  ensureFontsOf(S.pages);
}
function renderPage(p) {
  const e = els.get(p.id); if (!e) return;
  const R = rotOf(p), key = S.zoom + '|' + R + '|' + ceKey(p);
  if (e.key === key) return;
  e.key = key;
  if (e.task) { try { e.task.cancel(); } catch (x) { /* egal */ } e.task = null; }
  RQ.queue = RQ.queue.filter(j => j.id !== p.id);
  RQ.queue.push({ id: p.id, run: () => (e.key === key && els.get(p.id) === e ? drawPage(p, e, key, R) : Promise.resolve()) });
  rqPump();
}
async function drawPage(p, e, key, R) {
  const proxy = proxyOf(p); if (!proxy) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const base = proxy.getViewport({ scale: 1, rotation: R });
  let scale = S.zoom * dpr;
  const maxPx = COARSE ? 9e6 : 16e6; // Tablets: weniger Grafikspeicher je Seite
  if (base.width * base.height * scale * scale > maxPx) scale = Math.sqrt(maxPx / (base.width * base.height));
  const vp = proxy.getViewport({ scale, rotation: R });
  const c = document.createElement('canvas'); c.className = 'pcv';
  c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
  // Formularfelder zeichnet die Werkbank selbst als bearbeitbare Felder darüber
  const task = proxy.render({ canvasContext: c.getContext('2d'), viewport: vp, annotationMode: PDFJS.AnnotationMode ? PDFJS.AnnotationMode.ENABLE_FORMS : undefined, background: 'rgba(0,0,0,0)' });
  e.task = task;
  try { await task.promise; } catch (err) { if (err && err.name !== 'RenderingCancelledException') console.error(err); return; }
  if (e.key !== key || els.get(p.id) !== e) { c.width = c.height = 0; return; }
  e.task = null; const old = e.cv; e.cv.replaceWith(c); e.cv = c; old.width = old.height = 0; // Speicher sofort freigeben
}
function releasePage(p) {
  RQ.queue = RQ.queue.filter(j => j.id !== p.id);
  const e = els.get(p.id); if (!e || !e.key) return;
  if (e.task) { try { e.task.cancel(); } catch (x) { /* egal */ } e.task = null; }
  e.key = null; e.cv.width = 1; e.cv.height = 1;
}
function nearView(el) { const r = el.getBoundingClientRect(), v = viewer.getBoundingClientRect(); return r.bottom > v.top - 1200 && r.top < v.bottom + 1200; }
function renderVisible() {
  // nur die vom IntersectionObserver gemeldeten Seiten prüfen statt alle (große Dokumente)
  const ids = nearSet.size ? [...nearSet] : S.pages.map(p => p.id);
  for (const id of ids) { const p = pageById(id), e = p && els.get(id); if (e && nearView(e.wrap)) renderPage(p); }
}
function refreshPage(p) {
  const e = els.get(p.id);
  if (e) { sizePageEl(p, e); e.key = null; if (nearView(e.wrap)) renderPage(p); else releasePage(p); drawAnnots(p); buildFormLayer(p); }
  const t = tels.get(p.id);
  if (t) { sizeThumb(p); t.key = null; renderThumb(p); }
}
function selUI(a) {
  const b = bbox(a), z = S.zoom, pad = 3 / z, hs = (COARSE ? 16 : 9) / z;
  if (a.t === 'note') return `<rect class="selbox" x="${r2(b.x - pad)}" y="${r2(b.y - pad)}" width="${r2(b.w + 2 * pad)}" height="${r2(b.h + 2 * pad)}"/>`;
  return `<rect class="selbox" x="${r2(b.x - pad)}" y="${r2(b.y - pad)}" width="${r2(b.w + 2 * pad)}" height="${r2(b.h + 2 * pad)}"/>` +
    `<rect class="handle" x="${r2(b.x + b.w + pad - hs / 2)}" y="${r2(b.y + b.h + pad - hs / 2)}" width="${r2(hs)}" height="${r2(hs)}"/>`;
}
function drawAnnots(p) {
  if (!p) return;
  const e = els.get(p.id); if (!e) return;
  // neues Element bei ausgeblendeten Markierungen: wieder einblenden, sonst wirkt es, als sei nichts passiert
  if (e.nAnn != null && p.annots.length > e.nAnn && !S.prefs.showMarks) {
    S.prefs.showMarks = true; savePrefs(); pagesEl.classList.remove('hidemarks'); updateSideLater();
    toast('Markierungen und Kommentare werden wieder angezeigt (war in den Einstellungen ausgeschaltet)');
  }
  e.nAnn = p.annots.length;
  const editId = S.editing ? S.editing.a.id : null;
  const vis = p.annots.filter(a => a.id !== editId);
  const ann = vis.filter(a => !a.under).map(a => (S.player && playFuture(a) ? `<g opacity="0.16">${annotSVG(a)}</g>` : annotSVG(a))).join('') + vis.filter(a => a.comment && a.t !== 'note').map(a => {
    const b = bbox(a);
    return `<g class="cmk" transform="translate(${r2(b.x + b.w + 1)} ${r2(b.y - 1)})"><title>${esc(a.comment)}</title><path d="M0 -10h11a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H5l-3.5 3v-3H0a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 0 -10z"/></g>`;
  }).join('');
  // Griffflächen als HTML, damit touch-action greift: ein Finger auf einem Element verschiebt es statt zu scrollen
  if (e.hbl) {
    const [W, H] = dims(p), tol = COARSE ? 8 : 2;
    e.hbl.innerHTML = vis.map(a => {
      const b = bbox(a);
      return `<div style="left:${(b.x - tol) / W * 100}%;top:${(b.y - tol) / H * 100}%;width:${(b.w + 2 * tol) / W * 100}%;height:${(b.h + 2 * tol) / H * 100}%"></div>`;
    }).join('');
  }
  const a = selAnnot();
  let ui = a && S.sel.pid === p.id ? selUI(a) : '';
  if (S.msel && S.msel.pid === p.id) {
    const list = p.annots.filter(x => S.msel.ids.includes(x.id)), pad = 3 / S.zoom;
    if (list.length) {
      const u = unionBox(list);
      ui = list.map(x => { const b = bbox(x); return `<rect class="msel" x="${r2(b.x)}" y="${r2(b.y)}" width="${r2(b.w)}" height="${r2(b.h)}"/>`; }).join('') +
        `<rect class="selbox" x="${r2(u.x - pad)}" y="${r2(u.y - pad)}" width="${r2(u.w + 2 * pad)}" height="${r2(u.h + 2 * pad)}"/>`;
    }
  }
  if (e.under) e.under.innerHTML = `<g class="ann">${vis.filter(a => a.under).map(annotSVG).join('')}</g>`;
  e.svg.innerHTML = `<g class="ann">${ann}</g><g class="hits">${hitsSVG(p)}</g><g class="cui">${cuiSVG(p)}</g><g class="draft"></g><g class="ui">${ui}</g>`;
  drawQbar(p, e);
  queueThumb(p);
  updateSideLater();
}
function drawDraft(p, a) { const e = els.get(p.id); if (e) $('.draft', e.svg).innerHTML = a ? annotSVG(a) : ''; }

/* ---------- Miniaturen ---------- */
const tio = new IntersectionObserver(entries => {
  for (const en of entries) if (en.isIntersecting) { const p = pageById(en.target.dataset.id); if (p) renderThumb(p); }
}, { root: thumbsEl, rootMargin: '400px 0px' });
function buildThumbs() {
  tio.disconnect(); tels.clear(); thumbsEl.textContent = '';
  S.pages.forEach((p, i) => {
    const t = document.createElement('div'); t.className = 'thumb'; t.dataset.id = p.id; t.draggable = true;
    t.title = `Seite ${i + 1} · ziehen zum Umsortieren`;
    const box = document.createElement('div'); box.className = 'tbox';
    const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
    const svg = document.createElementNS(SVGNS, 'svg');
    box.append(cv, svg);
    const n = document.createElement('span'); n.className = 'tn'; n.textContent = i + 1;
    t.append(box, n); thumbsEl.append(t);
    tels.set(p.id, { t, box, cv, svg, key: null, s: 1 });
    sizeThumb(p); updThumbSvg(p); tio.observe(t);
  });
  markThumbSel();
}
function sizeThumb(p) {
  const e = tels.get(p.id); if (!e) return;
  const [W, H] = dims(p), s = Math.min(112 / W, 148 / H);
  e.s = s; e.box.style.width = W * s + 'px'; e.box.style.height = H * s + 'px';
  e.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
}
async function renderThumb(p) {
  const e = tels.get(p.id); if (!e) return;
  const R = rotOf(p), key = R + '|' + ceKey(p);
  if (e.key === key) return;
  e.key = key;
  const proxy = proxyOf(p); if (!proxy) return;
  const vp = proxy.getViewport({ scale: e.s * Math.min(window.devicePixelRatio || 1, 2), rotation: R });
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
  try { await proxy.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; } catch (err) { return; }
  if (e.key !== key || tels.get(p.id) !== e) return;
  e.cv.replaceWith(c); e.cv = c;
}
function updThumbSvg(p) { const e = tels.get(p.id); if (e) e.svg.innerHTML = p.annots.map(annotSVG).join(''); }
const thumbQ = new Set(); let thumbRaf = 0;
function queueThumb(p) {
  thumbQ.add(p.id);
  if (!thumbRaf) thumbRaf = requestAnimationFrame(() => { thumbRaf = 0; for (const id of thumbQ) { const q = pageById(id); if (q) updThumbSvg(q); } thumbQ.clear(); });
}
function markThumbSel() {
  S.pages.forEach((p, i) => {
    const e = tels.get(p.id); if (!e) return;
    e.t.classList.toggle('cur', i === S.cur);
    e.t.classList.toggle('sel', S.selPages.size > 1 && S.selPages.has(p.id));
  });
}

/* ---------- Seite, Zoom, Status ---------- */
function setCurrent(i, fromScroll) {
  if (i < 0 || i >= S.pages.length) return;
  const changed = i !== S.cur;
  S.cur = i;
  if (fromScroll && S.selPages.size <= 1) S.selPages.clear();
  markThumbSel(); updateStatus();
  if (changed) rememberPos();
  if (changed && S.shareSess) { clearTimeout(setCurrent.t); setCurrent.t = setTimeout(() => S.shareSess && S.shareSess.setPage(S.cur), 600); }
  if (changed && fromScroll) { const e = tels.get(S.pages[i].id); if (e && !work.classList.contains('nothumbs')) e.t.scrollIntoView({ block: 'nearest' }); }
}
function scrollToPage(i) {
  const p = S.pages[i]; if (!p) return;
  const e = els.get(p.id);
  viewer.scrollTo({ top: e.wrap.offsetTop - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
  setCurrent(i);
}
let scrollRaf = 0;
viewer.addEventListener('scroll', () => {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    const v = viewer.getBoundingClientRect(), line = v.top + v.height * 0.35;
    for (let i = 0; i < S.pages.length; i++) {
      const r = els.get(S.pages[i].id).wrap.getBoundingClientRect();
      if (r.bottom >= line) { if (i !== S.cur) setCurrent(i, true); break; }
    }
  });
}, { passive: true });

function paperLabel(W, H) {
  const mw = Math.round(W * 25.4 / 72), mh = Math.round(H * 25.4 / 72);
  const a = Math.min(mw, mh), b = Math.max(mw, mh);
  const known = [['A3', 297, 420], ['A4', 210, 297], ['A5', 148, 210], ['A6', 105, 148], ['Letter', 216, 279], ['Legal', 216, 356]];
  const k = known.find(([, x, y]) => Math.abs(a - x) <= 3 && Math.abs(b - y) <= 3);
  return (k ? `${k[0]} ${mw > mh ? 'quer' : 'hoch'} · ` : '') + `${mw} × ${mh} mm`;
}
function updateStatus() {
  const p = S.pages[S.cur];
  $('#stPage').textContent = p ? `Seite ${S.cur + 1} / ${S.pages.length}` : '–';
  $('#stSize').textContent = p ? paperLabel(...dims(p)) : '';
  const z = Math.round(S.zoom * 100) + ' %';
  $('#stZoom').textContent = 'Zoom ' + z; $('#zoomLbl').textContent = z;
  $('#readPage').textContent = p ? `${S.cur + 1} / ${S.pages.length}` : '';
}
function fitZoom() {
  const maxW = Math.max(...S.pages.map(p => dims(p)[0]), 100);
  return clamp((viewer.clientWidth - (innerWidth <= 760 ? 24 : 48)) / maxW, 0.25, ZMAX);
}
/* Startzoom: auf Tablets und Handys immer Seitenbreite, am Rechner höchstens 125 % */
function initialZoom() {
  const f = fitZoom();
  if (COARSE) { S.fitMode = true; return clamp(f, 0.3, 3); }
  S.fitMode = f <= 1.25;
  return clamp(Math.min(f, 1.25), 0.3, 1.25);
}
const ZMAX = 6;
let zoomT;
function setZoom(z, anchor, fit) {
  commitEdit();
  if (S.live) { S.live = null; pagesEl.style.transform = ''; pagesEl.style.transformOrigin = ''; pagesEl.classList.remove('live'); }
  S.fitMode = !!fit;
  z = clamp(z, 0.25, ZMAX);
  if (Math.abs(z - S.zoom) < 0.001) return;
  const vr = viewer.getBoundingClientRect();
  const cx = vr.left + (anchor ? anchor.x : vr.width / 2), cy = vr.top + (anchor ? anchor.y : vr.height * 0.35);
  let ref = null, rx = 0.5, ry = 0;
  for (const p of S.pages) {
    const r = els.get(p.id).wrap.getBoundingClientRect();
    if (r.bottom >= cy) { ref = p; rx = (cx - r.left) / r.width; ry = (cy - r.top) / r.height; break; }
  }
  S.zoom = z;
  for (const p of S.pages) sizePageEl(p, els.get(p.id));
  if (ref) {
    const r = els.get(ref.id).wrap.getBoundingClientRect();
    viewer.scrollTop += (r.top + ry * r.height) - cy;
    viewer.scrollLeft += (r.left + rx * r.width) - cx;
  }
  if (S.sel || S.msel) drawAnnots(pageById((S.sel || S.msel).pid));
  updateStatus();
  clearTimeout(zoomT); zoomT = setTimeout(renderVisible, 140);
}
const fitWidth = () => setZoom(fitZoom(), null, true);
/* Flüssiges Zoomen: während der Geste nur per GPU skalieren (CSS-Transform), erst am Ende neu setzen und rendern */
function liveStart(cx, cy) {
  const r = pagesEl.getBoundingClientRect();
  S.live = { z0: S.zoom, z: S.zoom, ox: cx, oy: cy, cx, cy };
  pagesEl.style.transformOrigin = `${cx - r.left}px ${cy - r.top}px`;
  pagesEl.classList.add('live');
}
function liveMove(z, cx, cy) {
  const L = S.live; if (!L) return;
  L.z = clamp(z, 0.25, ZMAX); L.cx = cx; L.cy = cy;
  pagesEl.style.transform = `translate(${cx - L.ox}px, ${cy - L.oy}px) scale(${L.z / L.z0})`;
  $('#zoomLbl').textContent = Math.round(L.z * 100) + ' %';
}
function liveEnd() {
  const L = S.live; if (!L) return;
  S.live = null;
  pagesEl.style.transform = ''; pagesEl.style.transformOrigin = ''; pagesEl.classList.remove('live');
  const vr = viewer.getBoundingClientRect();
  // auf Seitenbreite einrasten, wenn knapp daneben
  const f = fitZoom(), snapFit = Math.abs(L.z / f - 1) < 0.06;
  setZoom(snapFit ? f : L.z, { x: L.ox - vr.left, y: L.oy - vr.top }, snapFit);
  viewer.scrollLeft -= L.cx - L.ox; viewer.scrollTop -= L.cy - L.oy;
  updateStatus();
}
const ZSTEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6];
const zoomStep = d => setZoom(d > 0 ? (ZSTEPS.find(s => s > S.zoom + 0.01) || ZMAX) : ([...ZSTEPS].reverse().find(s => s < S.zoom - 0.01) || 0.25));
/* Strg/⌘ + Mausrad bzw. Trackpad-Pinch: live skalieren, nach kurzer Pause festschreiben */
let wheelT = 0;
viewer.addEventListener('wheel', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  if (!S.live) liveStart(e.clientX, e.clientY);
  liveMove(S.live.z * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
  clearTimeout(wheelT); wheelT = setTimeout(liveEnd, 160);
}, { passive: false });
// Safari am Mac: Trackpad-Pinch kommt als Gesture-Event (auf iPad übernehmen das die Touch-Events)
if (!window.TouchEvent) {
  let g0 = 1;
  document.addEventListener('gesturestart', e => { if (!viewer.contains(e.target)) return; e.preventDefault(); liveStart(e.clientX, e.clientY); g0 = S.zoom; }, { passive: false });
  document.addEventListener('gesturechange', e => { if (!S.live) return; e.preventDefault(); liveMove(g0 * e.scale, e.clientX, e.clientY); }, { passive: false });
  document.addEventListener('gestureend', e => { if (!S.live) return; e.preventDefault(); liveEnd(); }, { passive: false });
}
/* Seitenbreite bleibt beim Drehen des Tablets oder Ändern der Fenstergröße erhalten */
let fitRO = 0;
new ResizeObserver(() => { clearTimeout(fitRO); fitRO = setTimeout(() => { if (S.fitMode && S.pages.length && !S.live) setZoom(fitZoom(), null, true); }, 120); }).observe(viewer);

/* Touch: zwei Finger zoomen und verschieben, ein Finger zieht ausgewählte Elemente.
   Der Apple Pencil (touchType „stylus“) zählt nicht als Finger und scrollt nie. */
const tdist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
const tmid = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
const fingers = list => Array.from(list).filter(t => t.touchType !== 'stylus');
let tap = null, lastTap = null;
/* Doppeltipp mit einem Finger: zwischen Seitenbreite und Vergrößerung wechseln (nur wo der Finger nicht zeichnet) */
function fingerIsFree(target) {
  if (target && target.closest && target.closest('.hbl div, .forml, textarea, .cmk')) return false;
  return S.reading || S.tool === 'select' || S.tool === 'laser' || (S.pencil.only && PENCIL_TOOLS.has(S.tool));
}
function doubleTapZoom(x, y) {
  const vr = viewer.getBoundingClientRect(), f = fitZoom();
  if (S.zoom > f * 1.15) setZoom(f, { x: x - vr.left, y: y - vr.top }, true);
  else setZoom(Math.min(ZMAX, Math.max(f * 2, 1.5)), { x: x - vr.left, y: y - vr.top });
}
viewer.addEventListener('touchstart', e => {
  const stylus = Array.from(e.changedTouches).some(t => t.touchType === 'stylus');
  if (stylus) {
    notePencil();
    const onField = e.target && e.target.closest && e.target.closest('.forml .ff, textarea');
    if (!onField && (PENCIL_TOOLS.has(S.tool) || S.tool === 'objects' || S.tool === 'select')) e.preventDefault();
    return;
  }
  const f = fingers(e.touches), now = performance.now();
  // Mehrfinger-Tippen erkennen: zwei Finger = rückgängig, drei = wiederholen
  if (!tap || f.length === 1) tap = { t0: now, n: f.length, start: new Map(), moved: false, z0: S.zoom, target: e.target };
  tap.n = Math.max(tap.n, f.length);
  for (const t of e.changedTouches) tap.start.set(t.identifier, [t.clientX, t.clientY]);
  if (f.length === 2) {
    e.preventDefault();
    if (!(drag && drag.ptype === 'pen')) cancelDrag();
    commitEdit();
    const [a, b] = f, m = tmid(a, b);
    S.pinch = { d0: Math.max(10, tdist(a, b)) };
    liveStart(m.x, m.y);
  } else if (f.length > 2) e.preventDefault();
}, { passive: false });
viewer.addEventListener('touchmove', e => {
  if (tap) for (const t of e.changedTouches) {
    const s = tap.start.get(t.identifier);
    if (s && Math.hypot(t.clientX - s[0], t.clientY - s[1]) > 12) tap.moved = true;
  }
  const f = fingers(e.touches);
  if (S.pinch && f.length === 2 && S.live) {
    e.preventDefault();
    const [a, b] = f, m = tmid(a, b);
    liveMove(S.live.z0 * tdist(a, b) / S.pinch.d0, m.x, m.y);
    return;
  }
  if (Array.from(e.touches).some(t => t.touchType === 'stylus') && e.cancelable) { e.preventDefault(); return; }
  if (S.touchDrag && e.cancelable) e.preventDefault();
}, { passive: false });
const endPinch = e => {
  const f = fingers(e.touches);
  if (f.length < 2 && S.pinch) { S.pinch = null; liveEnd(); }
  if (tap && f.length === 0) {
    const t = tap; tap = null;
    const quick = e.type === 'touchend' && !t.moved && performance.now() - t.t0 < 350 && Math.abs(S.zoom / t.z0 - 1) < 0.03;
    if (quick) {
      if (t.n === 2) { undo(); setMsg('Rückgängig (zwei Finger)'); }
      else if (t.n === 3) { redo(); setMsg('Wiederholt (drei Finger)'); }
      else if (t.n === 1) {
        const pt = [...t.start.values()][0], now = performance.now();
        if (lastTap && now - lastTap.t < 320 && Math.hypot(pt[0] - lastTap.x, pt[1] - lastTap.y) < 40 && fingerIsFree(t.target)) {
          lastTap = null; if (e.cancelable) e.preventDefault(); doubleTapZoom(pt[0], pt[1]);
        } else lastTap = { t: now, x: pt[0], y: pt[1] };
      }
    }
    if (!quick || t.n !== 1) lastTap = null;
  }
};
viewer.addEventListener('touchend', endPinch);
viewer.addEventListener('touchcancel', endPinch);
// Safari: Seiten-Zoom des Browsers unterdrücken, die App zoomt selbst
if (window.TouchEvent) for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });

