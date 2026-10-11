(() => {
'use strict';
const PDFJS = window.pdfjsLib;
const PL = window.PDFLib;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const SVGNS = 'http://www.w3.org/2000/svg';
const LH = 1.2;
const A4 = [595.28, 841.89];

const FONTS = {
  Helvetica: { css: 'Helvetica, Arial, "Liberation Sans", sans-serif', bl: 0.947, std: ['Helvetica', 'HelveticaBold'] },
  Times: { css: '"Times New Roman", Times, "Liberation Serif", serif', bl: 0.937, std: ['TimesRoman', 'TimesRomanBold'] },
  Courier: { css: '"Courier New", Courier, "Liberation Mono", monospace', bl: 0.866, std: ['Courier', 'CourierBold'] },
};

const ICONS = {
  open: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  add: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9 14h6',
  save: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  zin: 'M11 4a7 7 0 1 1 0 14a7 7 0 0 1 0-14zM20 20l-4-4M8 11h6M11 8v6',
  zout: 'M11 4a7 7 0 1 1 0 14a7 7 0 0 1 0-14zM20 20l-4-4M8 11h6',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  search: 'M11 5a6 6 0 1 1 0 12a6 6 0 0 1 0-12zM20 20l-4.5-4.5',
  up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6',
  sidebar: 'M4 5h16v14H4zM9 5v14',
  select: 'M6 3l12 7.5-5.5 1.5-2.5 5.5z',
  text: 'M5 7V5h14v2M12 5v14M9 19h6',
  edittext: 'M3 7V5h11v2M8.5 5v12M6.5 17h4M14 20l6.5-6.5-2-2L12 18v2z',
  objects: 'M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4M9 9l7 3-3 1-1 3z',
  white: 'M4 16l8.5-8.5 5 5L13 17H8zM15 5l2-2 4 4-2 2M9 20h11',
  pen: 'M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16zM14 7l3 3',
  hl: 'M4 20h16M7 16l1.5-5L16 3.5l4 4L12.5 15z',
  rect: 'M4 6h16v12H4z',
  ellipse: 'M12 6c4.4 0 8 2.7 8 6s-3.6 6-8 6-8-2.7-8-6 3.6-6 8-6z',
  line: 'M5 19L19 5',
  arrow: 'M5 19L19 5M10 5h9v9',
  check: 'M5 12.5l4.5 4.5L19 7',
  cross: 'M6 6l12 12M18 6L6 18',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 8.5h.01',
  sign: 'M3 16c3-1 4-9 6-9s-1 9 1 9 3-4 4-4 1 3 3 3 2-1 4-1M3 20.5h18',
  rotl: 'M4.5 13a7.5 7.5 0 1 0 2.2-6.3L4 9M4 4v5h5',
  rotr: 'M19.5 13a7.5 7.5 0 1 1-2.2-6.3L20 9M20 4v5h-5',
  blank: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9 14h6',
  extract: 'M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M13 3l5 5v3M13 3v5h5M15 17h7M19 14l3 3-3 3',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  copy: 'M8 8h11v12H8zM5 16V4h11',
  more: 'M5 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2zM12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2zM19 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2z',
  stamp: 'M9 4h6l-1 7h4a2 2 0 0 1 2 2v2H4v-2a2 2 0 0 1 2-2h4zM5 19h14',
  note: 'M5 4h14v11l-5 5H5zM14 20v-5h5M8 9h8M8 12h5',
  ul: 'M7 4v7a5 5 0 0 0 10 0V4M5 20h14',
  so: 'M5 12h14M16 6.5C15 5 13.6 4.5 12 4.5c-2.5 0-4 1.3-4 3 0 1.5 1 2.3 3 3M8 17c1 1.6 2.4 2.5 4.3 2.5 2.6 0 4.2-1.4 4.2-3.3 0-.9-.3-1.6-.9-2.2',
  close: 'M6 6l12 12M18 6L6 18',
};

const TOOL_NAMES = { select: 'Auswählen', objects: 'Inhalte', text: 'Text', edittext: 'Text ändern', pen: 'Stift', hl: 'Markieren', ul: 'Unterstreichen', so: 'Durchstreichen', rect: 'Rechteck', ellipse: 'Ellipse', line: 'Linie', arrow: 'Pfeil', white: 'Abdecken', check: 'Haken', cross: 'Kreuz', img: 'Bild', stamp: 'Stempel', note: 'Notiz', wm: 'Wasserzeichen' };
const PROPS_OF = { text: ['color', 'font'], pen: ['color', 'stroke', 'opacity'], hl: ['color', 'opacity'], ul: ['color'], so: ['color'], rect: ['color', 'stroke'], ellipse: ['color', 'stroke'], line: ['color', 'stroke'], arrow: ['color', 'stroke'], check: ['color', 'stroke'], cross: ['color', 'stroke'], white: [], img: [], stamp: ['color', 'stamp'], note: ['color'], wm: ['color', 'opacity'] };
const DRAW_TOOLS = new Set(['pen', 'hl', 'ul', 'so', 'rect', 'ellipse', 'line', 'arrow', 'white', 'check', 'cross', 'objects']);
const SNAP_TOOLS = new Set(['hl', 'ul', 'so']);
const KEYS = { v: 'select', m: 'objects', t: 'text', e: 'edittext', p: 'pen', h: 'hl', n: 'ul', d: 'so', r: 'rect', o: 'ellipse', l: 'line', a: 'arrow', w: 'white', k: 'check', x: 'cross', s: 'stamp', c: 'note' };
const STAMPS = [['GENEHMIGT', '#1e8a4c'], ['ERLEDIGT', '#1e8a4c'], ['BEZAHLT', '#1e8a4c'], ['ENTWURF', '#1f4fd8'], ['KOPIE', '#1f4fd8'], ['VERTRAULICH', '#d0342c'], ['ABGELEHNT', '#d0342c'], ['DRINGEND', '#e07b00'], ['{datum}', '#1b2130']];
const COARSE = matchMedia('(pointer: coarse)').matches;
const today = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const SWATCHES = ['#1b2130', '#1f4fd8', '#d0342c', '#1e8a4c', '#e07b00', '#7a3fd0', '#ffd400', '#ffffff'];
const HINTS = {
  select: 'Element anklicken zum Verschieben · Ecke ziehen zum Skalieren · Doppelklick auf Text zum Bearbeiten',
  edittext: 'Auf vorhandenen Text klicken und direkt in der PDF ändern · leer lassen entfernt die Zeile',
  objects: 'Klicken wählt ein Element der PDF · Rahmen ziehen wählt mehrere · Entf entfernt sie · Doppelklick auf Text bearbeitet ihn',
  white: 'Bereich aufziehen, um Inhalte mit Weiß abzudecken',
  text: '', img: 'Bild ausgewählt · Ecke ziehen zum Skalieren',
  hl: 'Auf eine Textzeile tippen oder einen Bereich aufziehen',
  ul: 'Auf eine Textzeile tippen oder eine Linie ziehen',
  so: 'Auf eine Textzeile tippen oder eine Linie ziehen',
  note: 'Auf die Seite tippen, um eine Notiz anzuheften · wird als echter PDF-Kommentar gespeichert',
  stamp: 'Stempel wählen und auf die Seite tippen',
};
if (COARSE) for (const k of ['pen', 'rect', 'ellipse', 'line', 'arrow', 'white', 'check', 'cross', 'objects']) HINTS[k] = (HINTS[k] ? HINTS[k] + ' · ' : '') + 'Mit zwei Fingern scrollen und zoomen';

const TP = {
  text: { color: '#1b2130', size: 12, font: 'Helvetica', bold: false },
  pen: { color: '#1f4fd8', sw: 2, op: 100 },
  hl: { color: '#ffd400', op: 40 },
  rect: { color: '#d0342c', sw: 2 }, ellipse: { color: '#d0342c', sw: 2 },
  line: { color: '#1b2130', sw: 2 }, arrow: { color: '#d0342c', sw: 2 },
  check: { color: '#1b2130', sw: 2 }, cross: { color: '#1b2130', sw: 2 },
  ul: { color: '#1f4fd8' }, so: { color: '#d0342c' },
  stamp: { color: '#1e8a4c', text: 'GENEHMIGT' }, note: { color: '#ffd400' },
};

const S = {
  sources: new Map(), proxies: new Map(), images: new Map(), textCache: new Map(),
  pages: [], zoom: 1, tool: 'select', sel: null, cur: 0, selPages: new Set(),
  docName: 'Beispiel-Dokument.pdf', sample: true, dirty: false,
  hist: [], fut: [], clip: null, find: null, editing: null, busy: false, blankSrc: null, propEdit: false,
  libDocs: new Map(), analysis: new Map(), derived: new Map(), csel: null, hover: null, cedit: null,
  meta: { title: '', author: '', subject: '', keywords: '' }, touchDrag: false,
};
const ENG = PL && window.createContentEngine ? window.createContentEngine(PL) : null;
const els = new Map(), tels = new Map();
let uidN = 1;
const uid = (p = 'a') => p + (uidN++).toString(36);

const pagesEl = $('#pages'), viewer = $('#viewer'), thumbsEl = $('#thumbs'), work = $('#work'), propbar = $('#propbar');

/* ---------- Hilfsfunktionen ---------- */
const r2 = n => Math.round(n * 100) / 100;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const pageById = id => S.pages.find(p => p.id === id);
const hasCE = p => !!(p && p.ce && ((p.ce.del && p.ce.del.length) || (p.ce.rep && Object.keys(p.ce.rep).length)));
function ceKey(p) {
  if (!hasCE(p)) return '';
  const s = JSON.stringify(p.ce); let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36) + '.' + s.length;
}
const pkey = p => p.src + ':' + p.idx + (hasCE(p) ? '#' + ceKey(p) : '');
const proxyOf = p => {
  if (hasCE(p)) { const d = S.derived.get(pkey(p)); if (d) return d.page; }
  return S.proxies.get(p.src + ':' + p.idx);
};
const rotOf = p => ((p.baseRot + p.rot) % 360 + 360) % 360;
const dims = p => (p.rot % 180 ? [p.h0, p.w0] : [p.w0, p.h0]);
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* nicht verfügbar */ } };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const icon = name => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ''}"/></svg>`;
function hex2rgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  const n = m ? parseInt(m[1], 16) : 0;
  return PL.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }
function setMsg(msg, spin) { $('#stMsg').innerHTML = (spin ? '<span class="spin"></span>' : '') + esc(msg || ''); }
function busy(on, msg) { S.busy = on; $('#btnSave').disabled = on; setMsg(on ? msg : '', on); document.body.style.cursor = on ? 'progress' : ''; }

const mctx = document.createElement('canvas').getContext('2d');
function measure(str, a) { mctx.font = `${a.bold ? 700 : 400} ${a.size}px ${FONTS[a.font].css}`; return mctx.measureText(str).width; }
function textWidth(a) { return Math.max(4, ...a.text.split('\n').map(l => measure(l || ' ', a))); }
const NOTE = 20;
function stampGeom(a) {
  const tw = measure(a.text, { bold: true, size: a.size, font: 'Helvetica' });
  const pad = a.size * 0.65;
  return { w: tw + 2 * pad, h: a.size * 1.75, pad, base: a.size * 1.75 / 2 + a.size * 0.36, sw: Math.max(1, a.size * 0.12) };
}

/* ---------- Geometrie der Elemente ---------- */
function bbox(a) {
  switch (a.t) {
    case 'pen': {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of a.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      return { x: x0, y: y0, w: Math.max(x1 - x0, 1), h: Math.max(y1 - y0, 1) };
    }
    case 'line': case 'arrow':
      return { x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2), w: Math.max(Math.abs(a.x2 - a.x1), 1), h: Math.max(Math.abs(a.y2 - a.y1), 1) };
    case 'text': return { x: a.x, y: a.y, w: textWidth(a), h: a.text.split('\n').length * LH * a.size };
    case 'check': case 'cross': return { x: a.x, y: a.y, w: a.s, h: a.s };
    case 'stamp': { const g = stampGeom(a); return { x: a.x, y: a.y, w: g.w, h: g.h }; }
    case 'note': return { x: a.x, y: a.y, w: NOTE, h: NOTE };
    case 'wm': {
      const w = measure(a.text, { bold: true, size: a.size, font: 'Helvetica' }), h = a.size * 0.75;
      const c = Math.cos(a.ang * Math.PI / 180), s = Math.sin(a.ang * Math.PI / 180);
      const bw = Math.abs(w * c) + Math.abs(h * s), bh = Math.abs(w * s) + Math.abs(h * c);
      return { x: a.x - bw / 2, y: a.y - bh / 2, w: bw, h: bh };
    }
    default: return { x: a.x, y: a.y, w: a.w, h: a.h };
  }
}
function segs(a) {
  const { x, y, w, h } = a;
  switch (a.t) {
    case 'pen': {
      if (a.pts.length === 1) return [['M', a.pts[0][0], a.pts[0][1]], ['L', a.pts[0][0] + 0.01, a.pts[0][1]]];
      return a.pts.map((p, i) => [i ? 'L' : 'M', p[0], p[1]]);
    }
    case 'rect': case 'hl': case 'white':
      return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
    case 'ellipse': {
      const k = 0.5523, rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry;
      return [['M', cx + rx, cy], ['C', cx + rx, cy + k * ry, cx + k * rx, cy + ry, cx, cy + ry], ['C', cx - k * rx, cy + ry, cx - rx, cy + k * ry, cx - rx, cy],
        ['C', cx - rx, cy - k * ry, cx - k * rx, cy - ry, cx, cy - ry], ['C', cx + k * rx, cy - ry, cx + rx, cy - k * ry, cx + rx, cy], ['Z']];
    }
    case 'line': return [['M', a.x1, a.y1], ['L', a.x2, a.y2]];
    case 'arrow': {
      const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1), L = Math.max(9, a.sw * 4.5);
      const h1 = [a.x2 - L * Math.cos(ang - 0.45), a.y2 - L * Math.sin(ang - 0.45)];
      const h2 = [a.x2 - L * Math.cos(ang + 0.45), a.y2 - L * Math.sin(ang + 0.45)];
      return [['M', a.x1, a.y1], ['L', a.x2, a.y2], ['M', h1[0], h1[1]], ['L', a.x2, a.y2], ['L', h2[0], h2[1]]];
    }
    case 'check': { const s = a.s; return [['M', x + 0.15 * s, y + 0.55 * s], ['L', x + 0.4 * s, y + 0.8 * s], ['L', x + 0.85 * s, y + 0.2 * s]]; }
    case 'cross': { const s = a.s; return [['M', x + 0.2 * s, y + 0.2 * s], ['L', x + 0.8 * s, y + 0.8 * s], ['M', x + 0.8 * s, y + 0.2 * s], ['L', x + 0.2 * s, y + 0.8 * s]]; }
  }
  return [];
}
function dOf(sg, map) {
  return sg.map(s => {
    if (s[0] === 'Z') return 'Z';
    const out = [s[0]];
    for (let i = 1; i < s.length; i += 2) { const pt = map ? map(s[i], s[i + 1]) : [s[i], s[i + 1]]; out.push(r2(pt[0]), r2(pt[1])); }
    return out.join(' ');
  }).join(' ');
}
function annotSVG(a) {
  const c = a.color;
  switch (a.t) {
    case 'pen': return `<path d="${dOf(segs(a))}" fill="none" stroke="${c}" stroke-width="${a.sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${a.op / 100}"/>`;
    case 'hl': return `<path d="${dOf(segs(a))}" fill="${c}" fill-opacity="${a.op / 100}"/>`;
    case 'white': return `<path d="${dOf(segs(a))}" fill="#ffffff"/>`;
    case 'rect': case 'ellipse': return `<path d="${dOf(segs(a))}" fill="none" stroke="${c}" stroke-width="${a.sw}"/>`;
    case 'line': case 'arrow': case 'check': case 'cross':
      return `<path d="${dOf(segs(a))}" fill="none" stroke="${c}" stroke-width="${a.sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'text': {
      const f = FONTS[a.font];
      const lines = a.text.split('\n');
      return `<text font-family='${f.css}' font-size="${a.size}" font-weight="${a.bold ? 700 : 400}" fill="${c}" xml:space="preserve">` +
        lines.map((ln, i) => `<tspan x="${r2(a.x)}" y="${r2(a.y + f.bl * a.size + i * LH * a.size)}">${esc(ln) || ' '}</tspan>`).join('') + '</text>';
    }
    case 'stamp': {
      const g = stampGeom(a);
      return `<g><rect x="${r2(a.x + g.sw / 2)}" y="${r2(a.y + g.sw / 2)}" width="${r2(g.w - g.sw)}" height="${r2(g.h - g.sw)}" rx="${r2(a.size * 0.22)}" fill="${c}" fill-opacity="0.07" stroke="${c}" stroke-width="${r2(g.sw)}"/>` +
        `<text x="${r2(a.x + g.pad)}" y="${r2(a.y + g.base)}" font-family='${FONTS.Helvetica.css}' font-size="${a.size}" font-weight="700" fill="${c}">${esc(a.text)}</text></g>`;
    }
    case 'note':
      return `<g><title>${esc(a.text || 'Notiz')}</title><path d="M${r2(a.x)} ${r2(a.y)}h${NOTE}v${NOTE * 0.68}l-${NOTE * 0.32} ${NOTE * 0.32}H${r2(a.x)}z" fill="${c}" stroke="#7a5c00" stroke-width="0.8" stroke-linejoin="round"/>` +
        `<path d="M${r2(a.x + NOTE * 0.22)} ${r2(a.y + NOTE * 0.3)}h${NOTE * 0.56}M${r2(a.x + NOTE * 0.22)} ${r2(a.y + NOTE * 0.5)}h${NOTE * 0.4}" stroke="#7a5c00" stroke-width="1" stroke-linecap="round"/></g>`;
    case 'wm':
      return `<text x="${r2(a.x)}" y="${r2(a.y + a.size * 0.35)}" text-anchor="middle" transform="rotate(${-a.ang} ${r2(a.x)} ${r2(a.y)})" font-family='${FONTS.Helvetica.css}' font-size="${a.size}" font-weight="700" fill="${c}" fill-opacity="${a.op / 100}">${esc(a.text)}</text>`;
    case 'img': {
      const im = S.images.get(a.img);
      return im ? `<image href="${im.url}" x="${r2(a.x)}" y="${r2(a.y)}" width="${r2(a.w)}" height="${r2(a.h)}" preserveAspectRatio="none"/>` : '';
    }
  }
  return '';
}
function distSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function hitsAnnot(a, pt, tol) {
  const b = bbox(a);
  const inBox = pt[0] >= b.x - tol && pt[0] <= b.x + b.w + tol && pt[1] >= b.y - tol && pt[1] <= b.y + b.h + tol;
  if (a.t === 'pen' || a.t === 'line' || a.t === 'arrow') {
    if (!inBox && a.t !== 'arrow') return false;
    const t = tol + (a.sw || 1) / 2;
    let prev = null;
    for (const s of segs(a)) {
      if (s[0] === 'M') prev = [s[1], s[2]];
      else if (s[0] === 'L') { const q = [s[1], s[2]]; if (distSeg(pt, prev, q) <= t) return true; prev = q; }
    }
    return false;
  }
  return inBox;
}
function hitTest(p, pt, type) {
  const tol = (COARSE ? 10 : 4) / S.zoom;
  for (let i = p.annots.length - 1; i >= 0; i--) {
    const a = p.annots[i];
    if (type && a.t !== type) continue;
    if (S.editing && S.editing.a.id === a.id) continue;
    if (hitsAnnot(a, pt, tol)) return a;
  }
  return null;
}
function translated(o, dx, dy) {
  const a = clone(o);
  if (a.pts) a.pts = a.pts.map(([x, y]) => [r2(x + dx), r2(y + dy)]);
  else if ('x1' in a) { a.x1 += dx; a.x2 += dx; a.y1 += dy; a.y2 += dy; }
  else { a.x += dx; a.y += dy; }
  return a;
}
function scaled(o, ob, fx, fy) {
  const a = clone(o);
  const sx = x => ob.x + (x - ob.x) * fx, sy = y => ob.y + (y - ob.y) * fy;
  if (a.pts) a.pts = a.pts.map(([x, y]) => [r2(sx(x)), r2(sy(y))]);
  else if ('x1' in a) { a.x1 = sx(a.x1); a.x2 = sx(a.x2); a.y1 = sy(a.y1); a.y2 = sy(a.y2); }
  else if (a.t === 'text') a.size = Math.max(4, Math.round(a.size * fx * 2) / 2);
  else if (a.t === 'check' || a.t === 'cross') a.s = Math.max(4, a.s * fx);
  else if (a.t === 'stamp' || a.t === 'wm') a.size = Math.max(4, Math.round(a.size * fx * 2) / 2);
  else if (a.t === 'note') { /* feste Größe */ }
  else { a.w = Math.max(2, a.w * fx); a.h = Math.max(2, a.h * fy); }
  return a;
}
function rotAnnot(o, W, H, d) {
  const f = d > 0 ? ([x, y]) => [H - y, x] : ([x, y]) => [y, W - x];
  const a = clone(o);
  if (a.pts) { a.pts = a.pts.map(p => f(p).map(r2)); return a; }
  if ('x1' in a) { [a.x1, a.y1] = f([a.x1, a.y1]); [a.x2, a.y2] = f([a.x2, a.y2]); return a; }
  if (['rect', 'hl', 'white', 'ellipse'].includes(a.t)) {
    const p1 = f([a.x, a.y]), p2 = f([a.x + a.w, a.y + a.h]);
    a.x = Math.min(p1[0], p2[0]); a.y = Math.min(p1[1], p2[1]); a.w = Math.abs(p2[0] - p1[0]); a.h = Math.abs(p2[1] - p1[1]);
    return a;
  }
  const b = bbox(a), c = [b.x + b.w / 2, b.y + b.h / 2], n = f(c);
  a.x += n[0] - c[0]; a.y += n[1] - c[1];
  return a;
}

/* ---------- Verlauf ---------- */
const snap = () => JSON.stringify(S.pages);
const structKey = pages => pages.map(p => p.id + ':' + p.rot).join('|');
function pushHist() { S.hist.push(snap()); if (S.hist.length > 150) S.hist.shift(); S.fut.length = 0; updateUndo(); }
async function restore(json) {
  const old = structKey(S.pages);
  const oldCE = new Map(S.pages.map(p => [p.id, ceKey(p)]));
  const next = JSON.parse(json);
  S.sel = null; S.csel = null; S.hover = null;
  const need = next.filter(p => hasCE(p) && !S.derived.has(pkey(p)));
  if (need.length) {
    busy(true, 'Seite wird neu aufgebaut …');
    try { await Promise.all(need.map(ensureDerived)); } catch (e) { console.error(e); }
    busy(false);
  }
  S.pages = next;
  S.cur = Math.min(S.cur, S.pages.length - 1);
  if (structKey(S.pages) !== old) buildViewer();
  else S.pages.forEach(p => { if (oldCE.get(p.id) !== ceKey(p)) refreshPage(p); else drawAnnots(p); });
  markDirty(); renderProps(); updateUndo();
  if (S.find) runFind(S.find.q);
}
let restoring = false;
async function undo() { commitEdit(); if (!S.hist.length || restoring) return; restoring = true; S.fut.push(snap()); try { await restore(S.hist.pop()); } finally { restoring = false; } }
async function redo() { commitEdit(); if (!S.fut.length || restoring) return; restoring = true; S.hist.push(snap()); try { await restore(S.fut.pop()); } finally { restoring = false; } }
function updateUndo() { $('#btnUndo').disabled = !S.hist.length; $('#btnRedo').disabled = !S.fut.length; }
function markDirty() { S.dirty = true; updateTitle(); scheduleAutosave(); }
function updateTitle() {
  const n = $('#docName');
  n.textContent = S.docName + (S.sample ? ' · Beispiel' : '') + (S.dirty && !S.sample ? ' ●' : '');
  n.title = S.docName;
}

/* ---------- Quellen laden ---------- */
async function addSource(bytes, name, fixedId) {
  const id = fixedId || uid('s');
  const pdf = await PDFJS.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  S.sources.set(id, { id, name, bytes, pdf });
  const out = [];
  for (let i = 0; i < pdf.numPages; i++) {
    const pg = await pdf.getPage(i + 1);
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
function newCE(p) { const c = p.ce || {}; return { del: [...(c.del || [])], rep: { ...(c.rep || {}) } }; }
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
  const del = new Set((p.ce && p.ce.del) || []), rep = (p.ce && p.ce.rep) || {};
  const vp = proxy.getViewport({ scale: 1, rotation: rotOf(p) });
  const db = b => {
    const pts = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(q => vp.convertToViewportPoint(q[0], q[1]));
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };
  const union = objs => [Math.min(...objs.map(o => o.bbox[0])), Math.min(...objs.map(o => o.bbox[1])), Math.max(...objs.map(o => o.bbox[2])), Math.max(...objs.map(o => o.bbox[3]))];
  const items = [];
  for (const g of an.groups) {
    const first = g.first, rt = rep[first.i];
    const alive = g.objs.filter(o => !del.has(o.i));
    let text, ub;
    if (rt !== undefined) {
      text = rt;
      const w = measure(rt, { bold: false, size: first.fs, font: 'Helvetica' });
      ub = first.dir[0] > 0 && Math.abs(first.dir[1]) < 1e-6 ? [first.bbox[0], first.bbox[1], Math.max(first.bbox[2], first.base[0] + w), first.bbox[3]] : first.bbox;
    } else {
      if (!alive.some(o => !o.blank)) continue;
      text = ENG.joinText(alive); ub = union(alive);
    }
    items.push({ kind: 'text', ids: g.objs.map(o => o.i), firstId: first.i, text: text.trimEnd(), box: db(ub), fs: first.fs, font: first.font, fill: first.fill, base: first.base, dir: first.dir });
  }
  for (const o of an.objects) if (o.kind !== 'text' && !del.has(o.i)) items.push({ kind: o.kind, ids: [o.i], box: db(o.bbox) });
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
const KIND_NAMES = { text: 'Text', path: 'Fläche', image: 'Bild', form: 'Grafik' };
function cuiSVG(p) {
  let out = '';
  const box = (b, cls) => `<rect class="${cls}" x="${r2(b.x)}" y="${r2(b.y)}" width="${r2(Math.max(b.w, 1))}" height="${r2(Math.max(b.h, 1))}"/>`;
  if (S.csel && S.csel.pid === p.id) for (const it of S.csel.items) out += box(it.box, 'csel');
  if (S.hover && S.hover.pid === p.id && !(S.csel && S.csel.items.includes(S.hover.it))) out += box(S.hover.it.box, 'chov');
  return out;
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
  for (const it of cs.items) for (const i of it.ids) { if (!ce.del.includes(i)) ce.del.push(i); delete ce.rep[i]; }
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
  Object.assign(ta.style, { left: (it.box.x - 3) * z + 'px', top: it.box.y * z + 'px', height: it.box.h * z + 'px', font: `${fg.bold ? 700 : 400} ${size * z}px/${it.box.h / size} ${FONTS[fg.name].css}`, paddingLeft: 3 * z + 'px' });
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
  else if (first && ENG.canEncode(an, first, txt)) {
    for (const i of it.ids) if (i !== it.firstId) { if (!ce.del.includes(i)) ce.del.push(i); delete ce.rep[i]; }
    ce.del = ce.del.filter(i => i !== it.firstId);
    ce.rep[it.firstId] = txt;
  } else {
    delAll(); fallback = true;
    const fg = fontGuess(p, it), vp = proxyOf(p).getViewport({ scale: 1, rotation: rotOf(p) });
    const [bx, by] = vp.convertToViewportPoint(it.base[0], it.base[1]);
    const size = Math.max(4, Math.round(it.fs * 2) / 2);
    p.annots.push({ id: uid(), t: 'text', x: bx, y: by - FONTS[fg.name].bl * size, text: txt, color: toHex(it.fill), size, font: fg.name, bold: fg.bold });
  }
  p.ce = ce;
  applyCE(p).then(() => {
    if (fallback) toast('Die Originalschrift enthält nicht alle Zeichen. Der Text wurde in Helvetica neu gesetzt.');
    else if (!txt.trim()) toast('Textzeile aus der PDF entfernt');
  });
}
async function openFiles(files, mode) {
  const pdfs = [...files].filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  if (!pdfs.length) { toast('Bitte eine PDF-Datei wählen.'); return; }
  if (S.busy) return;
  commitEdit();
  if (mode === 'replace' && S.dirty && !S.sample) {
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
    if (mode === 'replace') {
      oldIds.forEach(dropSource);
      S.blankSrc = null;
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
      scheduleAutosave();
    } else {
      pushHist();
      const at = S.pages.length;
      S.pages.push(...added);
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
const io = new IntersectionObserver(entries => {
  for (const en of entries) {
    const p = pageById(en.target.dataset.id); if (!p) continue;
    if (en.isIntersecting) renderPage(p); else releasePage(p);
  }
}, { root: viewer, rootMargin: '1200px 0px' });

function sizePageEl(p, e) {
  const [W, H] = dims(p);
  e.wrap.style.width = W * S.zoom + 'px';
  e.wrap.style.height = H * S.zoom + 'px';
  e.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
}
function buildViewer() {
  io.disconnect();
  for (const e of els.values()) if (e.task) try { e.task.cancel(); } catch (x) { /* egal */ }
  els.clear(); pagesEl.textContent = ''; S.csel = null; S.hover = null;
  S.pages.forEach((p, i) => {
    const wrap = document.createElement('div'); wrap.className = 'page'; wrap.dataset.id = p.id;
    const cv = document.createElement('canvas'); cv.className = 'pcv'; cv.width = 1; cv.height = 1;
    const svg = document.createElementNS(SVGNS, 'svg'); svg.classList.add('ov');
    const num = document.createElement('div'); num.className = 'pnum'; num.textContent = i + 1;
    const hbl = document.createElement('div'); hbl.className = 'hbl';
    wrap.append(cv, svg, hbl, num);
    pagesEl.append(wrap);
    const e = { wrap, cv, svg, hbl, key: null, task: null };
    els.set(p.id, e); sizePageEl(p, e); drawAnnots(p); io.observe(wrap);
  });
  S.cur = clamp(S.cur, 0, S.pages.length - 1);
  buildThumbs(); updateStatus(); renderProps();
}
async function renderPage(p) {
  const e = els.get(p.id); if (!e) return;
  const R = rotOf(p), key = S.zoom + '|' + R + '|' + ceKey(p);
  if (e.key === key) return;
  e.key = key;
  if (e.task) { try { e.task.cancel(); } catch (x) { /* egal */ } e.task = null; }
  const proxy = proxyOf(p); if (!proxy) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const base = proxy.getViewport({ scale: 1, rotation: R });
  let scale = S.zoom * dpr;
  const maxPx = 16e6;
  if (base.width * base.height * scale * scale > maxPx) scale = Math.sqrt(maxPx / (base.width * base.height));
  const vp = proxy.getViewport({ scale, rotation: R });
  const c = document.createElement('canvas'); c.className = 'pcv';
  c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
  const task = proxy.render({ canvasContext: c.getContext('2d'), viewport: vp });
  e.task = task;
  try { await task.promise; } catch (err) { if (err && err.name !== 'RenderingCancelledException') console.error(err); return; }
  if (e.key !== key || els.get(p.id) !== e) return;
  e.task = null; e.cv.replaceWith(c); e.cv = c;
}
function releasePage(p) {
  const e = els.get(p.id); if (!e || !e.key) return;
  if (e.task) { try { e.task.cancel(); } catch (x) { /* egal */ } e.task = null; }
  e.key = null; e.cv.width = 1; e.cv.height = 1;
}
function nearView(el) { const r = el.getBoundingClientRect(), v = viewer.getBoundingClientRect(); return r.bottom > v.top - 1200 && r.top < v.bottom + 1200; }
function renderVisible() { for (const p of S.pages) { const e = els.get(p.id); if (e && nearView(e.wrap)) renderPage(p); } }
function refreshPage(p) {
  const e = els.get(p.id);
  if (e) { sizePageEl(p, e); e.key = null; if (nearView(e.wrap)) renderPage(p); else releasePage(p); drawAnnots(p); }
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
  const editId = S.editing ? S.editing.a.id : null;
  const vis = p.annots.filter(a => a.id !== editId);
  const ann = vis.map(annotSVG).join('');
  // Griffflächen als HTML, damit touch-action greift: ein Finger auf einem Element verschiebt es statt zu scrollen
  if (e.hbl) {
    const [W, H] = dims(p), tol = COARSE ? 8 : 2;
    e.hbl.innerHTML = vis.map(a => {
      const b = bbox(a);
      return `<div style="left:${(b.x - tol) / W * 100}%;top:${(b.y - tol) / H * 100}%;width:${(b.w + 2 * tol) / W * 100}%;height:${(b.h + 2 * tol) / H * 100}%"></div>`;
    }).join('');
  }
  const a = selAnnot();
  const ui = a && S.sel.pid === p.id ? selUI(a) : '';
  e.svg.innerHTML = `<g class="ann">${ann}</g><g class="hits">${hitsSVG(p)}</g><g class="cui">${cuiSVG(p)}</g><g class="draft"></g><g class="ui">${ui}</g>`;
  queueThumb(p);
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
}
function fitZoom() {
  const maxW = Math.max(...S.pages.map(p => dims(p)[0]), 100);
  return clamp((viewer.clientWidth - 48) / maxW, 0.25, 5);
}
function initialZoom() { return clamp(Math.min(fitZoom(), 1.25), 0.3, 1.25); }
let zoomT;
function setZoom(z, anchor) {
  commitEdit();
  z = clamp(z, 0.25, 5);
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
  if (S.sel) drawAnnots(pageById(S.sel.pid));
  updateStatus();
  clearTimeout(zoomT); zoomT = setTimeout(renderVisible, 140);
}
const ZSTEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
const zoomStep = d => setZoom(d > 0 ? (ZSTEPS.find(s => s > S.zoom + 0.01) || 5) : ([...ZSTEPS].reverse().find(s => s < S.zoom - 0.01) || 0.25));
viewer.addEventListener('wheel', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  const vr = viewer.getBoundingClientRect();
  setZoom(S.zoom * Math.exp(-e.deltaY * 0.0022), { x: e.clientX - vr.left, y: e.clientY - vr.top });
}, { passive: false });

/* Touch: zwei Finger zoomen und verschieben, ein Finger zieht ausgewählte Elemente */
const tdist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
const tmid = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
viewer.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    e.preventDefault();
    cancelDrag(); commitEdit();
    const [a, b] = e.touches;
    S.pinch = { d0: Math.max(10, tdist(a, b)), z0: S.zoom, mid: tmid(a, b) };
  }
}, { passive: false });
viewer.addEventListener('touchmove', e => {
  if (S.pinch && e.touches.length === 2) {
    e.preventDefault();
    const [a, b] = e.touches, m = tmid(a, b), vr = viewer.getBoundingClientRect();
    setZoom(S.pinch.z0 * tdist(a, b) / S.pinch.d0, { x: m.x - vr.left, y: m.y - vr.top });
    viewer.scrollLeft -= m.x - S.pinch.mid.x; viewer.scrollTop -= m.y - S.pinch.mid.y;
    S.pinch.mid = m;
    return;
  }
  if (S.touchDrag && e.cancelable) e.preventDefault();
}, { passive: false });
const endPinch = e => { if (e.touches.length < 2 && S.pinch) { S.pinch = null; clearTimeout(zoomT); zoomT = setTimeout(renderVisible, 60); } };
viewer.addEventListener('touchend', endPinch);
viewer.addEventListener('touchcancel', endPinch);

/* ---------- Auswahl, Werkzeuge, Eigenschaften ---------- */
function selAnnot() {
  if (!S.sel) return null;
  const p = pageById(S.sel.pid);
  return (p && p.annots.find(a => a.id === S.sel.aid)) || null;
}
function select(pid, aid) {
  const prev = S.sel ? pageById(S.sel.pid) : null;
  S.sel = pid ? { pid, aid } : null;
  if (prev) drawAnnots(prev);
  if (pid && (!prev || prev.id !== pid)) drawAnnots(pageById(pid));
  renderProps();
}
function setTool(t) {
  commitEdit();
  S.tool = t;
  if (t !== 'select' && S.sel) select(null);
  if (t !== 'objects' && (S.csel || S.hover)) { const hp = S.hover && pageById(S.hover.pid); S.hover = null; setCsel(null, []); if (hp) drawCUI(hp); }
  if ((t === 'objects' || t === 'edittext') && S.pages[S.cur]) analysisOf(S.pages[S.cur]).catch(() => toast('Die Inhalte dieser PDF lassen sich nicht auslesen (z. B. verschlüsselt).'));
  if (SNAP_TOOLS.has(t) && S.pages[S.cur]) analysisOf(S.pages[S.cur]).catch(() => {});
  $$('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  pagesEl.dataset.tool = t;
  if (DRAW_TOOLS.has(t)) pagesEl.dataset.draw = ''; else delete pagesEl.dataset.draw;
  renderProps();
}
function propTarget() {
  if (S.editing) return { obj: S.editing.a, type: 'text', editing: true };
  const a = selAnnot();
  if (a) return { obj: a, type: a.t, isAnnot: true };
  if (TP[S.tool]) return { obj: TP[S.tool], type: S.tool };
  return null;
}
function renderProps() {
  const cs = S.csel && S.tool === 'objects' ? S.csel.items : null;
  const oneText = cs && cs.length === 1 && cs[0].kind === 'text';
  $('#cEditBtn').hidden = !oneText;
  if (cs || S.cedit) {
    $$('[data-for]', propbar).forEach(el => { el.hidden = true; });
    $('#dupBtn').hidden = true; $('#delBtn').hidden = !cs;
    if (S.cedit) { $('#pTarget').textContent = 'PDF-Text bearbeiten'; $('#pHint').textContent = 'Enter übernimmt · Esc bricht ab · leer lassen entfernt die Zeile'; return; }
    const kinds = {};
    cs.forEach(it => { kinds[it.kind] = (kinds[it.kind] || 0) + 1; });
    $('#pTarget').textContent = cs.length === 1 ? 'Auswahl · ' + KIND_NAMES[cs[0].kind] : `Auswahl · ${cs.length} Elemente`;
    $('#pHint').textContent = oneText ? `„${cs[0].text.slice(0, 60)}“ · Entf entfernt · Doppelklick bearbeitet` : Object.entries(kinds).map(([k, n]) => `${n}× ${KIND_NAMES[k]}`).join(' · ') + ' · Entf entfernt alles';
    return;
  }
  const tg = propTarget();
  const type = tg ? tg.type : S.tool;
  const show = new Set(PROPS_OF[type] || []);
  $$('[data-for]', propbar).forEach(el => { el.hidden = !show.has(el.dataset.for); });
  const sel = !!selAnnot();
  $('#delBtn').hidden = !sel; $('#dupBtn').hidden = !sel;
  $('#pTarget').textContent = tg && (tg.isAnnot || tg.editing) ? 'Auswahl · ' + (TOOL_NAMES[type] || type) : (TOOL_NAMES[S.tool] || '');
  let hint = '';
  if (!tg) hint = HINTS[S.tool] || '';
  else if (tg.isAnnot && type === 'img') hint = HINTS.img;
  else if (S.tool === 'text' && !tg.editing) hint = 'Auf die Seite klicken, um Text zu schreiben · Strg+Enter oder Esc zum Abschließen';
  $('#pHint').textContent = hint;
  if (!tg) return;
  const o = tg.obj;
  if (o.color) {
    $$('.sw', $('#swatches')).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c.toLowerCase() === o.color.toLowerCase())));
    $('#colorPick').value = o.color;
  }
  if ('sw' in o) { $('#strokeIn').value = o.sw; $('#strokeOut').textContent = o.sw + ' pt'; }
  if ('op' in o) { $('#opIn').value = o.op; $('#opOut').textContent = o.op + ' %'; }
  if (type === 'stamp') $('#stampSel').value = STAMPS.some(s => s[0] === o.text) ? o.text : (o.text === today() ? '{datum}' : '');
  if ('font' in o) { $('#fontSel').value = o.font; if (document.activeElement !== $('#sizeIn')) $('#sizeIn').value = o.size; $('#boldBtn').setAttribute('aria-pressed', String(!!o.bold)); }
}
function setProp(k, v, continuous) {
  const tg = propTarget(); if (!tg) return;
  if (tg.editing) {
    tg.obj[k] = v; S.editing.styled = true; TP.text[k] = v; styleTA();
  } else if (tg.isAnnot) {
    if (!(continuous && S.propEdit)) pushHist();
    S.propEdit = !!continuous;
    tg.obj[k] = v;
    if (TP[tg.type] && k in TP[tg.type]) TP[tg.type][k] = v;
    drawAnnots(pageById(S.sel.pid)); markDirty();
  } else tg.obj[k] = v;
  renderProps();
}
function deleteSel() {
  const a = selAnnot(); if (!a) return;
  const p = pageById(S.sel.pid);
  pushHist(); p.annots = p.annots.filter(x => x !== a); S.sel = null;
  drawAnnots(p); markDirty(); renderProps();
}
function pasteAnnot(src, dx) {
  const p = S.pages[S.cur]; if (!p || !src) return;
  const a = translated(src, dx, dx); a.id = uid();
  pushHist(); p.annots.push(a); markDirty();
  if (S.tool !== 'select') setTool('select');
  select(p.id, a.id); drawAnnots(p);
}

/* ---------- Zeiger ---------- */
function ptIn(e, el) { const r = el.svg.getBoundingClientRect(); return [(e.clientX - r.left) / S.zoom, (e.clientY - r.top) / S.zoom]; }
let drag = null;
pagesEl.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target.closest('textarea')) return;
  if ((e.pointerType === 'touch' && !e.isPrimary) || S.pinch) return;
  const wrap = e.target.closest('.page');
  if (!wrap) { if (S.editing) commitEdit(); else if (S.tool === 'select') select(null); return; }
  const p = pageById(wrap.dataset.id), el = els.get(p.id), pt = ptIn(e, el);
  setCurrent(S.pages.indexOf(p));
  if (S.cedit) { commitEdit(); return; }
  if (S.editing) { commitEdit(); if (S.tool === 'text') return; }
  const t = S.tool;
  if (t === 'objects') {
    e.preventDefault();
    drag = { mode: 'marquee', p, start: pt, shift: e.shiftKey, moved: false, r: null };
    return;
  }
  if (t === 'select') {
    const a = selAnnot();
    if (a && S.sel.pid === p.id) {
      const b = bbox(a), pad = 3 / S.zoom, hs = (COARSE ? 20 : 10) / S.zoom;
      if (a.t !== 'note' && Math.abs(pt[0] - (b.x + b.w + pad)) <= hs && Math.abs(pt[1] - (b.y + b.h + pad)) <= hs) {
        drag = { mode: 'resize', p, a, orig: clone(a), ob: b, start: pt, moved: false }; S.touchDrag = e.pointerType === 'touch'; e.preventDefault(); return;
      }
    }
    const hit = hitTest(p, pt);
    if (hit) {
      const was = S.sel && S.sel.aid === hit.id;
      select(p.id, hit.id); drag = { mode: 'move', p, a: hit, orig: clone(hit), start: pt, moved: false, tapNote: hit.t === 'note' && was };
      S.touchDrag = e.pointerType === 'touch'; e.preventDefault();
    }
    else select(null);
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
    else { const tp = TP.text; editText(p, { id: uid(), t: 'text', x: pt[0], y: pt[1] - tp.size * 0.65, text: '', color: tp.color, size: tp.size, font: tp.font, bold: tp.bold }, true); }
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
  const tp = TP[t] || {};
  let a;
  if (t === 'pen') a = { id: uid(), t, pts: [[r2(pt[0]), r2(pt[1])]], color: tp.color, sw: tp.sw, op: tp.op };
  else if (t === 'line' || t === 'arrow') a = { id: uid(), t, x1: pt[0], y1: pt[1], x2: pt[0], y2: pt[1], color: tp.color, sw: tp.sw };
  else if (t === 'ul' || t === 'so') a = { id: uid(), t: 'line', x1: pt[0], y1: pt[1], x2: pt[0], y2: pt[1], color: tp.color, sw: 1.5 };
  else if (t === 'hl') a = { id: uid(), t, x: pt[0], y: pt[1], w: 0, h: 0, color: tp.color, op: tp.op };
  else if (t === 'white') a = { id: uid(), t, x: pt[0], y: pt[1], w: 0, h: 0 };
  else a = { id: uid(), t, x: pt[0], y: pt[1], w: 0, h: 0, color: tp.color, sw: tp.sw };
  drag = { mode: 'draw', p, a, start: pt, tool: t, horiz: t === 'ul' || t === 'so' };
  if (SNAP_TOOLS.has(t)) analysisOf(p).catch(() => {});
});
window.addEventListener('pointermove', e => {
  if (!drag) {
    const w = e.target && e.target.closest ? e.target.closest('.page') : null;
    let hov = null;
    if (w) {
      const p = pageById(w.dataset.id), pt = ptIn(e, els.get(w.dataset.id));
      $('#stCursor').textContent = `x ${Math.round(pt[0] * 25.4 / 72)} · y ${Math.round(pt[1] * 25.4 / 72)} mm`;
      if (p && !S.cedit && (S.tool === 'objects' || S.tool === 'edittext')) { const it = itemAt(p, pt, S.tool === 'edittext' ? 'text' : null); if (it) hov = { pid: p.id, it }; }
    } else $('#stCursor').textContent = '';
    const prevHov = S.hover;
    if ((prevHov && prevHov.it) !== (hov && hov.it)) {
      S.hover = hov;
      if (prevHov) drawCUI(pageById(prevHov.pid));
      if (hov && (!prevHov || prevHov.pid !== hov.pid)) drawCUI(pageById(hov.pid));
    }
    return;
  }
  const el = els.get(drag.p.id); if (!el) return;
  const pt = ptIn(e, el), a = drag.a;
  if (drag.mode === 'marquee') {
    const x = Math.min(pt[0], drag.start[0]), y = Math.min(pt[1], drag.start[1]), w = Math.abs(pt[0] - drag.start[0]), h = Math.abs(pt[1] - drag.start[1]);
    if (!drag.moved && Math.hypot(w, h) * S.zoom < 4) return;
    drag.moved = true; drag.r = { x, y, w, h };
    $('.draft', el.svg).innerHTML = `<rect class="marq" x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}"/>`;
    return;
  }
  if (drag.mode === 'draw') {
    if (a.t === 'pen') {
      const l = a.pts[a.pts.length - 1];
      if (Math.hypot(pt[0] - l[0], pt[1] - l[1]) > 0.7 / S.zoom) a.pts.push([r2(pt[0]), r2(pt[1])]);
    } else if (a.t === 'line' || a.t === 'arrow') {
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
  let next;
  if (drag.mode === 'move') next = translated(drag.orig, dx, dy);
  else {
    const ob = drag.ob;
    let nw = Math.max(4, ob.w + dx), nh = Math.max(4, ob.h + dy);
    if (['text', 'img', 'check', 'cross', 'stamp', 'wm', 'note'].includes(a.t) || e.shiftKey) { const f = Math.max(nw / ob.w, nh / ob.h); nw = ob.w * f; nh = ob.h * f; }
    next = scaled(drag.orig, ob, nw / ob.w, nh / ob.h);
  }
  Object.assign(a, next);
  drawAnnots(drag.p);
});
function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
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
    const ok = a.t === 'pen' ? a.pts.length >= 1 : (a.t === 'line' || a.t === 'arrow') ? Math.hypot(a.x2 - a.x1, a.y2 - a.y1) > 2 : a.w > 2 && a.h > 2;
    if (ok) { pushHist(); d.p.annots.push(a); markDirty(); drawAnnots(d.p); }
    else if (SNAP_TOOLS.has(d.tool)) snapToText(d.p, d.start, d.tool);
  } else if (d.moved) { markDirty(); renderProps(); }
  else if (d.tapNote) editNote(d.p, d.a);
}
function cancelDrag() {
  S.touchDrag = false;
  if (!drag) return;
  const d = drag; drag = null;
  if (d.mode === 'draw' || d.mode === 'marquee') drawDraft(d.p, null);
  else if (d.moved) { Object.assign(d.a, d.orig); if (S.hist.length) S.hist.pop(); updateUndo(); drawAnnots(d.p); }
}
window.addEventListener('pointerup', () => { S.touchDrag = false; endDrag(); });
window.addEventListener('pointercancel', cancelDrag);

/* Markieren, Unterstreichen und Durchstreichen rasten auf Textzeilen ein */
function snapToText(p, pt, tool) {
  const it = cItems(p) && itemAt(p, pt, 'text');
  if (!it) { toast(tool === 'hl' ? 'Auf eine Textzeile tippen oder einen Bereich aufziehen.' : 'Auf eine Textzeile tippen oder eine Linie ziehen.'); return; }
  const b = it.box, tp = TP[tool];
  let a;
  if (tool === 'hl') a = { id: uid(), t: 'hl', x: b.x - 1, y: b.y, w: b.w + 2, h: b.h, color: tp.color, op: tp.op };
  else {
    const y = tool === 'ul' ? b.y + b.h * 0.84 : b.y + b.h * 0.52;
    a = { id: uid(), t: 'line', x1: b.x, y1: y, x2: b.x + b.w, y2: y, color: tp.color, sw: Math.max(0.75, Math.round(it.fs * 0.07 * 4) / 4) };
  }
  pushHist(); p.annots.push(a); markDirty(); drawAnnots(p);
}

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
pagesEl.addEventListener('dblclick', e => {
  const wrap = e.target.closest('.page'); if (!wrap) return;
  if (S.tool === 'select') {
    const p = pageById(wrap.dataset.id), n = hitTest(p, ptIn(e, els.get(p.id)), 'note');
    if (n) { editNote(p, n); return; }
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
  const { a, ta } = ed, z = S.zoom, f = FONTS[a.font];
  const lines = (ta.value || ' ').split('\n');
  ta.style.left = a.x * z + 'px'; ta.style.top = a.y * z + 'px';
  ta.style.font = `${a.bold ? 700 : 400} ${a.size * z}px/${LH} ${f.css}`;
  ta.style.color = a.color;
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
  const a = { id: uid(), t: 'text', x: g.x, y: g.y + 0.92 * g.fh - FONTS[font].bl * size, text: best.it.str, color: '#000000', size, font, bold: /bold|black|heavy/i.test(best.it.fontName + famRaw) };
  editText(p, a, true, before, true);
  if (S.editing) S.editing.ta.select();
}

/* ---------- Suche ---------- */
let findTok = 0, findT;
async function runFind(q) {
  const tok = ++findTok;
  q = q.trim().toLowerCase();
  if (q.length < 2) { S.find = null; S.pages.forEach(drawHits); $('#findCount').textContent = ''; return; }
  $('#findCount').textContent = '…';
  const hits = [];
  for (const p of S.pages) {
    let tc; try { tc = await textContent(p); } catch (e) { continue; }
    if (tok !== findTok) return;
    for (const it of tc.items) {
      const s = (it.str || '').toLowerCase(); let k = s.indexOf(q);
      while (k >= 0) { hits.push({ pid: p.id, it, s0: k / s.length, s1: (k + q.length) / s.length }); k = s.indexOf(q, k + q.length); }
    }
  }
  S.find = { q, hits, i: hits.length ? 0 : -1 };
  S.pages.forEach(drawHits);
  if (hits.length) goHit(0); else $('#findCount').textContent = 'Keine';
}
function hitsSVG(p) {
  if (!S.find || !S.find.hits.length) return '';
  const vp = proxyOf(p) ? proxyOf(p).getViewport({ scale: 1, rotation: rotOf(p) }) : null;
  if (!vp) return '';
  return S.find.hits.map((h, i) => {
    if (h.pid !== p.id) return '';
    const g = itemGeom(vp, h.it, h.s0, h.s1);
    return `<rect class="hit${i === S.find.i ? ' on' : ''}" x="${r2(g.x)}" y="${r2(g.y)}" width="${r2(g.w)}" height="${r2(g.h)}" rx="1.5"/>`;
  }).join('');
}
function drawHits(p) { const e = els.get(p.id); if (e) { const g = $('.hits', e.svg); if (g) g.innerHTML = hitsSVG(p); } }
function goHit(i) {
  const f = S.find; if (!f || !f.hits.length) return;
  const prev = f.hits[f.i];
  f.i = (i + f.hits.length) % f.hits.length;
  const h = f.hits[f.i], p = pageById(h.pid);
  if (prev && prev.pid !== h.pid) drawHits(pageById(prev.pid));
  drawHits(p);
  $('#findCount').textContent = `${f.i + 1}/${f.hits.length}`;
  const e = els.get(p.id), g = itemGeom(proxyOf(p).getViewport({ scale: 1, rotation: rotOf(p) }), h.it, h.s0, h.s1);
  viewer.scrollTo({ top: e.wrap.offsetTop + g.y * S.zoom - viewer.clientHeight * 0.35, left: Math.max(0, e.wrap.offsetLeft + g.x * S.zoom - viewer.clientWidth / 2), behavior: reduceMotion ? 'auto' : 'smooth' });
  setCurrent(S.pages.indexOf(p));
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
async function insertBlank() {
  commitEdit();
  try {
    if (!S.blankSrc || !S.sources.has(S.blankSrc)) {
      const d = await PL.PDFDocument.create(); d.addPage(A4);
      const before = new Set(S.sources.keys());
      await addSource(new Uint8Array(await d.save()), 'Leere Seite');
      S.blankSrc = [...S.sources.keys()].find(k => !before.has(k));
    }
    const src = S.blankSrc, pg = S.proxies.get(src + ':0'), vp = pg.getViewport({ scale: 1 });
    pushHist();
    const at = S.cur + 1;
    S.pages.splice(at, 0, { id: uid('p'), src, idx: 0, baseRot: 0, rot: 0, w0: vp.width, h0: vp.height, annots: [] });
    S.selPages.clear(); markDirty(); buildViewer(); scrollToPage(at);
  } catch (e) { console.error(e); toast('Die leere Seite konnte nicht erstellt werden.'); }
}
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
  $('#dlgTitle').textContent = title; $('#dlgBody').innerHTML = html; $('#dlgOk').textContent = okLabel;
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
function metaDialog() {
  const m = S.meta, f = (id, label, v) => `<label class="fld"><span>${label}</span><input class="field" id="${id}" value="${esc(v || '')}"></label>`;
  dialog('Dokumenteigenschaften', f('mTitle', 'Titel', m.title) + f('mAuthor', 'Autor', m.author) + f('mSubject', 'Betreff', m.subject) + f('mKeys', 'Stichwörter (mit Komma getrennt)', m.keywords) +
    '<p class="note">Werden beim Speichern in die PDF geschrieben. Der Autor erscheint auch bei Notizen.</p>', 'Übernehmen', b => {
    S.meta = { title: $('#mTitle', b).value.trim(), author: $('#mAuthor', b).value.trim(), subject: $('#mSubject', b).value.trim(), keywords: $('#mKeys', b).value.trim() };
    markDirty(); toast('Eigenschaften übernommen');
  });
}
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
async function newDocument() {
  const d = await PL.PDFDocument.create(); d.addPage(A4);
  await openFiles([new File([await d.save()], 'Neues Dokument.pdf', { type: 'application/pdf' })], 'replace');
}

/* ---------- Automatisch zwischenspeichern (IndexedDB) ---------- */
let idbP = null;
function idb() {
  if (!idbP) idbP = new Promise((res, rej) => {
    try { const r = indexedDB.open('pdf-werkbank', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
    catch (e) { rej(e); }
  });
  return idbP;
}
function idbReq(mode, fn) {
  return idb().then(db => new Promise((res, rej) => {
    const tx = db.transaction('kv', mode), r = fn(tx.objectStore('kv'));
    tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  }));
}
const idbGet = k => idbReq('readonly', s => s.get(k));
const idbSet = (k, v) => idbReq('readwrite', s => s.put(v, k));
const idbDel = k => idbReq('readwrite', s => s.delete(k));
const idbKeys = () => idbReq('readonly', s => s.getAllKeys());
const savedSrc = new Set();
let autoT = 0;
function scheduleAutosave() { if (S.sample || !S.pages.length) return; clearTimeout(autoT); autoT = setTimeout(autosave, 1500); }
async function autosave() {
  try {
    for (const s of S.sources.values()) if (!savedSrc.has(s.id)) { await idbSet('src:' + s.id, { name: s.name, bytes: s.bytes }); savedSrc.add(s.id); }
    const imgIds = new Set();
    for (const p of S.pages) for (const a of p.annots) if (a.img) imgIds.add(a.img);
    await idbSet('session', {
      v: 1, savedAt: Date.now(), docName: S.docName, meta: S.meta, pages: S.pages, srcIds: [...S.sources.keys()],
      images: [...S.images].filter(([id]) => imgIds.has(id)), uidN, blankSrc: S.blankSrc, dirty: S.dirty,
    });
    const keep = new Set([...S.sources.keys()].map(k => 'src:' + k));
    for (const k of await idbKeys()) if (String(k).startsWith('src:') && !keep.has(k)) { await idbDel(k); savedSrc.delete(String(k).slice(4)); }
  } catch (e) { /* Zwischenspeicher nicht verfügbar */ }
}
async function restoreSession() {
  let sess;
  try { sess = await idbGet('session'); } catch (e) { return false; }
  if (!sess || !sess.pages || !sess.pages.length) return false;
  const when = new Date(sess.savedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  if (!await ask('Letzte Sitzung fortsetzen?', `„${sess.docName}“ vom ${when}, mit allen Änderungen.`, 'Fortsetzen', 'Neu starten', false)) {
    try { await idbDel('session'); } catch (e) { /* egal */ }
    return false;
  }
  busy(true, 'Sitzung wird wiederhergestellt …');
  try {
    uidN = Math.max(uidN, sess.uidN || 0) + 1;
    for (const id of sess.srcIds) {
      const s = await idbGet('src:' + id);
      if (!s) throw new Error('Quelle fehlt');
      await addSource(s.bytes, s.name, id); savedSrc.add(id);
    }
    S.images = new Map(sess.images || []);
    S.pages = sess.pages; S.docName = sess.docName; S.meta = sess.meta || S.meta; S.blankSrc = sess.blankSrc || null;
    S.sample = false; S.dirty = !!sess.dirty; S.hist = []; S.fut = []; S.cur = 0;
    await Promise.all(S.pages.filter(hasCE).map(ensureDerived));
    S.zoom = initialZoom(); buildViewer(); updateTitle(); updateUndo();
    busy(false); setMsg('Sitzung wiederhergestellt');
    return true;
  } catch (e) {
    console.error(e); busy(false);
    for (const id of [...S.sources.keys()]) dropSource(id);
    S.pages = [];
    toast('Die letzte Sitzung konnte nicht wiederhergestellt werden.');
    return false;
  }
}

/* ---------- PDF erzeugen und speichern ---------- */
async function buildPdf(pageList) {
  const { PDFDocument, StandardFonts, degrees, LineCapStyle, BlendMode, rgb } = PL;
  const out = await PDFDocument.create();
  const libDocs = new Map(), fontCache = new Map(), imgCache = new Map();
  const getFont = async (name, bold) => {
    const key = FONTS[name].std[bold ? 1 : 0];
    if (!fontCache.has(key)) fontCache.set(key, await out.embedFont(StandardFonts[key]));
    return fontCache.get(key);
  };
  const clean = (font, str) => Array.from(str.replace(/\t/g, '    ')).map(ch => { try { font.encodeText(ch); return ch; } catch (e) { return '?'; } }).join('');
  for (const p of pageList) {
    let ld = libDocs.get(p.src);
    if (!ld) {
      try { ld = await PDFDocument.load(S.sources.get(p.src).bytes, { updateMetadata: false }); }
      catch (e) {
        if (e && /encrypt/i.test(e.message || e.name)) throw new Error(`„${S.sources.get(p.src).name}“ ist verschlüsselt. Mit Änderungen speichern ist dafür hier nicht möglich.`);
        throw e;
      }
      libDocs.set(p.src, ld);
    }
    const [pg] = await out.copyPages(ld, [p.idx]);
    out.addPage(pg);
    if (hasCE(p)) ENG.editPage(out, pg, await analysisOf(p), p.ce);
    const R = rotOf(p);
    pg.setRotation(degrees(R));
    const vp = proxyOf(p).getViewport({ scale: 1, rotation: R });
    const T = (x, y) => vp.convertToPdfPoint(x, y);
    const svgMap = (x, y) => { const q = T(x, y); return [q[0], -q[1]]; };
    for (const a of p.annots) {
      if (a.t === 'text') {
        const font = await getFont(a.font, a.bold), f = FONTS[a.font];
        a.text.split('\n').forEach((ln, i) => {
          if (!ln) return;
          const [x, y] = T(a.x, a.y + f.bl * a.size + i * LH * a.size);
          pg.drawText(clean(font, ln), { x, y, size: a.size, font, color: hex2rgb(a.color), rotate: degrees(R) });
        });
      } else if (a.t === 'img') {
        const im = S.images.get(a.img); if (!im) continue;
        let emb = imgCache.get(a.img);
        if (!emb) { emb = im.fmt === 'jpg' ? await out.embedJpg(im.url) : await out.embedPng(im.url); imgCache.set(a.img, emb); }
        const [x, y] = T(a.x, a.y + a.h);
        pg.drawImage(emb, { x, y, width: a.w, height: a.h, rotate: degrees(R) });
      } else if (a.t === 'stamp') {
        const g = stampGeom(a), font = await getFont('Helvetica', true), col = hex2rgb(a.color);
        const x = a.x + g.sw / 2, y = a.y + g.sw / 2, w = g.w - g.sw, h = g.h - g.sw, r = Math.min(a.size * 0.22, w / 2, h / 2), k = 0.5523 * r;
        const rr = [['M', x + r, y], ['L', x + w - r, y], ['C', x + w - r + k, y, x + w, y + r - k, x + w, y + r], ['L', x + w, y + h - r], ['C', x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h],
          ['L', x + r, y + h], ['C', x + r - k, y + h, x, y + h - r + k, x, y + h - r], ['L', x, y + r], ['C', x, y + r - k, x + r - k, y, x + r, y], ['Z']];
        pg.drawSvgPath(dOf(rr, svgMap), { x: 0, y: 0, color: col, opacity: 0.07, borderColor: col, borderWidth: g.sw, borderOpacity: 1 });
        const [tx, ty] = T(a.x + g.pad, a.y + g.base);
        pg.drawText(clean(font, a.text), { x: tx, y: ty, size: a.size, font, color: col, rotate: degrees(R) });
      } else if (a.t === 'wm') {
        const font = await getFont('Helvetica', true), txt = clean(font, a.text), w = font.widthOfTextAtSize(txt, a.size);
        const al = a.ang * Math.PI / 180, dx = -w / 2, dy = a.size * 0.35;
        const px = a.x + dx * Math.cos(al) + dy * Math.sin(al), py = a.y - dx * Math.sin(al) + dy * Math.cos(al);
        const [tx, ty] = T(px, py);
        pg.drawText(txt, { x: tx, y: ty, size: a.size, font, color: hex2rgb(a.color), opacity: a.op / 100, rotate: degrees(R + a.ang) });
      } else if (a.t === 'note') {
        const p1 = T(a.x, a.y + NOTE), p2 = T(a.x + NOTE, a.y), c = hex2rgb(a.color);
        const ann = out.context.obj({
          Type: 'Annot', Subtype: 'Text', F: 4, Name: 'Comment', Open: false,
          Rect: [Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]), Math.max(p1[0], p2[0]), Math.max(p1[1], p2[1])],
          Contents: PL.PDFHexString.fromText(a.text || ''), T: PL.PDFHexString.fromText(S.meta.author || 'PDF Werkbank'),
          M: PL.PDFString.fromDate(new Date()), C: [c.red, c.green, c.blue],
        });
        pg.node.addAnnot(out.context.register(ann));
      } else {
        const d = dOf(segs(a), svgMap), o = { x: 0, y: 0 };
        if (a.t === 'hl') Object.assign(o, { color: hex2rgb(a.color), opacity: a.op / 100, blendMode: BlendMode.Multiply });
        else if (a.t === 'white') Object.assign(o, { color: rgb(1, 1, 1) });
        else {
          Object.assign(o, { borderColor: hex2rgb(a.color), borderWidth: a.sw });
          if (a.t !== 'rect' && a.t !== 'ellipse') o.borderLineCap = LineCapStyle.Round;
          if (a.t === 'pen' && a.op < 100) o.borderOpacity = a.op / 100;
        }
        pg.drawSvgPath(d, o);
      }
    }
  }
  out.setProducer('PDF Werkbank'); out.setCreator('PDF Werkbank'); out.setModificationDate(new Date());
  const m = S.meta;
  if (m.title) out.setTitle(m.title);
  if (m.author) out.setAuthor(m.author);
  if (m.subject) out.setSubject(m.subject);
  if (m.keywords) out.setKeywords(m.keywords.split(/[,;]\s*/).filter(Boolean));
  return out.save();
}
async function saveBytes(bytes, filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: { pdf: 'application/pdf', png: 'image/png', txt: 'text/plain;charset=utf-8' }[ext] || 'application/octet-stream' });
  let dl = null;
  if (window.claude && typeof window.claude.use === 'function') { try { dl = await window.claude.use('downloads'); } catch (e) { dl = null; } }
  if (dl) {
    try { await dl.save({ filename, data: blob }); toast(`Gespeichert: ${filename}`); return true; }
    catch (e) {
      if (e && e.code === 'declined') toast('Speichern abgebrochen');
      else if (e && e.code === 'rate_limited') toast('Ein Speichern-Dialog ist bereits offen.');
      else toast('Speichern ist in dieser Ansicht nicht möglich.');
      return false;
    }
  }
  if (matchMedia('(display-mode: standalone)').matches && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return true; }
    } catch (e) { if (e && e.name === 'AbortError') { toast('Speichern abgebrochen'); return false; } }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`Gespeichert: ${filename}`);
  return true;
}
const baseName = () => S.docName.replace(/\.pdf$/i, '').replace(/-bearbeitet$/, '');
async function savePdf() {
  commitEdit(); if (S.busy || !S.pages.length) return;
  busy(true, 'PDF wird erstellt …');
  try {
    const bytes = await buildPdf(S.pages);
    busy(false);
    if (await saveBytes(bytes, baseName() + '-bearbeitet.pdf')) { S.dirty = false; updateTitle(); }
  } catch (e) { console.error(e); busy(false); toast(e && e.message && /„/.test(e.message) ? e.message : 'Die PDF konnte nicht erstellt werden.'); }
}
async function extractPages() {
  commitEdit(); if (S.busy) return;
  const ps = targetPages(); if (!ps.length) return;
  busy(true, 'Seiten werden extrahiert …');
  try {
    const bytes = await buildPdf(ps);
    busy(false);
    const nums = ps.map(p => S.pages.indexOf(p) + 1);
    await saveBytes(bytes, `${baseName()}-${nums.length === 1 ? 'Seite-' + nums[0] : 'Seiten-' + nums[0] + '-' + nums[nums.length - 1]}.pdf`);
  } catch (e) { console.error(e); busy(false); toast(e && e.message && /„/.test(e.message) ? e.message : 'Die Seiten konnten nicht extrahiert werden.'); }
}

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
    'Vorhandene Texte direkt in der PDF ändern und beliebige Inhalte wie Texte, Kästen, Bilder und Icons wirklich entfernen.',
    'Neuen Text hinzufügen und Bereiche bei Bedarf weiß abdecken.',
    'Mit dem Stift zeichnen, Stellen markieren und Rechtecke, Ellipsen, Linien oder Pfeile setzen.',
    'Formulare mit Haken und Kreuzen ausfüllen, Bilder einfügen und unterschreiben.',
    'Seiten drehen, löschen, per Ziehen umsortieren, leere Seiten einfügen und einzelne Seiten extrahieren.',
    'Weitere PDFs anhängen und alles zusammen als neue PDF speichern.',
  ];
  for (const b of bullets) {
    p1.drawText('•', { x: M + 2, y, size: 11, font: fb, color: blue });
    for (const l of wrapT(b, f, 11, CW - 18)) { p1.drawText(l, { x: M + 16, y, size: 11, font: f, color: ink }); y -= 16; }
    y -= 4;
  }
  y -= 18;
  const markY = y;
  p1.drawText('Tastenkürzel', { x: M, y, size: 14, font: fb, color: ink }); y -= 24;
  const keys = [['V', 'Auswählen'], ['M', 'PDF-Inhalte'], ['E', 'Text ändern'], ['T', 'Neuer Text'], ['W', 'Abdecken'], ['P', 'Stift'], ['H', 'Markieren'], ['R', 'Rechteck'], ['O', 'Ellipse'], ['L', 'Linie'],
    ['A', 'Pfeil'], ['K', 'Haken'], ['X', 'Kreuz'], ['I', 'Bild'], ['U', 'Unterschrift'], ['Entf', 'Löschen'], ['Strg+Z', 'Rückgängig'], ['Strg+S', 'Speichern']];
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
  const field = (label, x, yy, w) => { p2.drawText(label, { x, y: yy + 22, size: 8.5, font: fb, color: muted }); p2.drawLine({ start: { x, y: yy }, end: { x: x + w, y: yy }, thickness: 0.8, color: rgb(0.55, 0.58, 0.64) }); };
  const gap = 20, hw = (CW - gap) / 2;
  field('NAME', M, y, hw); field('VORNAME', M + hw + gap, y, hw); y -= 58;
  field('STRASSE UND HAUSNUMMER', M, y, CW); y -= 58;
  field('PLZ', M, y, 110); field('ORT', M + 130, y, CW - 130); y -= 58;
  field('E-MAIL', M, y, CW); y -= 52;
  for (const t of ['Ich habe die Teilnahmebedingungen gelesen und akzeptiere sie.', 'Ich möchte über künftige Termine informiert werden.']) {
    p2.drawRectangle({ x: M, y: y - 2, width: 12, height: 12, borderColor: rgb(0.45, 0.48, 0.54), borderWidth: 0.9 });
    p2.drawText(t, { x: M + 22, y, size: 11, font: f, color: ink }); y -= 26;
  }
  y = 170;
  field('ORT, DATUM', M, y, hw); field('UNTERSCHRIFT', M + hw + gap, y, hw);
  p2.drawText('PDF Werkbank · Beispielseite 2 von 2', { x: M, y: 36, size: 8, font: f, color: muted });

  const hw1 = fb.widthOfTextAtSize('Tastenkürzel', 14);
  return { bytes: await d.save(), mark: { x: M, y: H - markY, w: hw1 } };
}

/* ---------- Bedienelemente verbinden ---------- */
function bindUI() {
  $$('[data-i]').forEach(el => { el.outerHTML = icon(el.dataset.i); });
  $('#swatches').innerHTML = SWATCHES.map(c => `<button class="sw" data-c="${c}" style="background:${c}" title="${c}" aria-label="Farbe ${c}"></button>`).join('');
  $('#sigColors').innerHTML = ['#1b2a6b', '#111318', '#1f4fd8'].map((c, i) => `<button class="sw" data-c="${c}" style="background:${c}" aria-label="Stiftfarbe" aria-pressed="${i === 0}"></button>`).join('');

  $('#btnOpen').onclick = () => $('#fileOpen').click();
  $('#btnMerge').onclick = () => $('#fileMerge').click();
  $('#btnSave').onclick = savePdf;
  $('#fileOpen').onchange = e => { openFiles(e.target.files, 'replace'); e.target.value = ''; };
  $('#fileMerge').onchange = e => { openFiles(e.target.files, 'append'); e.target.value = ''; };
  $('#fileImg').onchange = e => { insertImages([...e.target.files]); e.target.value = ''; };
  $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
  $('#btnZoomIn').onclick = () => zoomStep(1); $('#btnZoomOut').onclick = () => zoomStep(-1);
  $('#zoomLbl').onclick = () => setZoom(1); $('#btnFit').onclick = () => setZoom(fitZoom());
  $$('[data-tool]').forEach(b => { b.onclick = () => setTool(b.dataset.tool); b.setAttribute('aria-label', b.title); });
  $('#btnImg').onclick = () => { commitEdit(); $('#fileImg').click(); };
  $('#btnSig').onclick = openSig;
  $('#pgRotL').onclick = () => rotatePages(-90); $('#pgRotR').onclick = () => rotatePages(90);
  $('#pgBlank').onclick = insertBlank; $('#pgExtract').onclick = extractPages; $('#pgDelete').onclick = deletePages;
  $('#delBtn').onclick = () => { if (S.csel) deleteContent(); else deleteSel(); };
  $('#cEditBtn').onclick = () => { if (S.csel && S.csel.items.length === 1) editContentText(pageById(S.csel.pid), S.csel.items[0]); };
  $('#dupBtn').onclick = () => { const a = selAnnot(); if (a) pasteAnnot(a, 12); };

  $('#btnMore').onclick = e => { e.stopPropagation(); if ($('#menu').hidden) openMenu(); else closeMenu(); };
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#menu, #btnMore')) closeMenu(); });
  const ACTS = { new: async () => { if (S.dirty && !S.sample && !await ask('Ungespeicherte Änderungen verwerfen?', `Die Änderungen an „${S.docName}“ gehen verloren.`)) return; S.dirty = false; newDocument(); },
    wm: watermarkDialog, pn: pageNumberDialog, dup: duplicatePage, png: exportPagePng, txt: exportText, meta: metaDialog,
    open: () => $('#fileOpen').click(), fit: () => setZoom(fitZoom()), merge: () => $('#fileMerge').click(), rotl: () => rotatePages(-90), rotr: () => rotatePages(90), blank: insertBlank, extract: extractPages, del: deletePages };
  $('#menu').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; closeMenu(); const f = ACTS[b.dataset.act]; if (f) f(); });
  $('#menu').addEventListener('keydown', e => {
    const items = $$('[data-act]', $('#menu')).filter(x => x.offsetParent), i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    if (e.key === 'Escape') { closeMenu(); $('#btnMore').focus(); }
  });

  const narrow = () => innerWidth <= 760;
  $('#btnThumbs').onclick = () => {
    if (narrow()) work.classList.toggle('thumbs-open'); else work.classList.toggle('nothumbs');
    const open = narrow() ? work.classList.contains('thumbs-open') : !work.classList.contains('nothumbs');
    $('#btnThumbs').setAttribute('aria-pressed', String(open));
  };
  if (narrow()) $('#btnThumbs').setAttribute('aria-pressed', 'false');

  $('#swatches').addEventListener('click', e => { const b = e.target.closest('.sw'); if (!b) return; setProp('color', b.dataset.c); if (S.editing) S.editing.ta.focus(); });
  $('#colorPick').addEventListener('input', e => setProp('color', e.target.value, true));
  $('#colorPick').addEventListener('change', () => { S.propEdit = false; });
  $('#strokeIn').addEventListener('input', e => setProp('sw', +e.target.value, true));
  $('#strokeIn').addEventListener('change', () => { S.propEdit = false; });
  $('#opIn').addEventListener('input', e => setProp('op', +e.target.value, true));
  $('#opIn').addEventListener('change', () => { S.propEdit = false; });
  $('#fontSel').addEventListener('change', e => { setProp('font', e.target.value); if (S.editing) S.editing.ta.focus(); });
  $('#sizeIn').addEventListener('change', e => { const v = clamp(+e.target.value || 12, 4, 144); setProp('size', v); S.propEdit = false; if (S.editing) S.editing.ta.focus(); });
  $('#boldBtn').onclick = () => { const tg = propTarget(); if (tg) setProp('bold', !tg.obj.bold); if (S.editing) S.editing.ta.focus(); };
  $('#stampSel').innerHTML = STAMPS.map(([t]) => `<option value="${t}">${t === '{datum}' ? 'Datum (' + today() + ')' : t}</option>`).join('') + '<option value="" hidden>Eigener Text</option>';
  $('#stampSel').addEventListener('change', e => {
    const v = e.target.value, st = STAMPS.find(s => s[0] === v); if (!st) return;
    const tg = propTarget(); if (!tg) return;
    TP.stamp.text = v; TP.stamp.color = st[1];
    if (tg.isAnnot) { pushHist(); tg.obj.text = v === '{datum}' ? today() : v; tg.obj.color = st[1]; drawAnnots(pageById(S.sel.pid)); markDirty(); }
    renderProps();
  });

  const fi = $('#findInput');
  fi.addEventListener('input', () => { clearTimeout(findT); findT = setTimeout(() => runFind(fi.value), 260); });
  fi.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); if (!S.find || S.find.q !== fi.value.trim().toLowerCase()) runFind(fi.value); else goHit(S.find.i + (e.shiftKey ? -1 : 1)); }
    if (e.key === 'Escape') { fi.value = ''; runFind(''); fi.blur(); }
  });
  $('#findNext').onclick = () => S.find && goHit(S.find.i + 1);
  $('#findPrev').onclick = () => S.find && goHit(S.find.i - 1);

  thumbsEl.addEventListener('click', e => {
    const t = e.target.closest('.thumb'); if (!t) return;
    const i = S.pages.findIndex(p => p.id === t.dataset.id);
    if (e.shiftKey) { const a = Math.min(S.cur, i), b = Math.max(S.cur, i); S.selPages = new Set(S.pages.slice(a, b + 1).map(p => p.id)); }
    else if (e.ctrlKey || e.metaKey) {
      if (S.selPages.size === 0 && S.pages[S.cur]) S.selPages.add(S.pages[S.cur].id);
      if (S.selPages.has(t.dataset.id)) S.selPages.delete(t.dataset.id); else S.selPages.add(t.dataset.id);
    } else S.selPages = new Set([t.dataset.id]);
    scrollToPage(i); markThumbSel();
    if (S.selPages.size > 1) setMsg(`${S.selPages.size} Seiten ausgewählt · Drehen, Löschen und Extrahieren gelten für alle`);
    else setMsg('');
    if (innerWidth <= 760) { work.classList.remove('thumbs-open'); $('#btnThumbs').setAttribute('aria-pressed', 'false'); }
  });
  let dragPid = null;
  const clearDrop = () => $$('.thumb.db,.thumb.da', thumbsEl).forEach(x => x.classList.remove('db', 'da'));
  thumbsEl.addEventListener('dragstart', e => { const t = e.target.closest('.thumb'); if (!t) return; dragPid = t.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'seite'); });
  thumbsEl.addEventListener('dragover', e => {
    if (!dragPid) return;
    const t = e.target.closest('.thumb'); if (!t) return;
    e.preventDefault(); clearDrop();
    const r = t.getBoundingClientRect(); t.classList.add(e.clientY < r.top + r.height / 2 ? 'db' : 'da');
  });
  thumbsEl.addEventListener('drop', e => {
    if (!dragPid) return;
    e.preventDefault();
    const t = e.target.closest('.thumb'); clearDrop();
    if (t) { const i = S.pages.findIndex(p => p.id === t.dataset.id), r = t.getBoundingClientRect(); movePage(dragPid, e.clientY < r.top + r.height / 2 ? i : i + 1); }
    dragPid = null;
  });
  thumbsEl.addEventListener('dragend', () => { dragPid = null; clearDrop(); });

  // Dateien ins Fenster ziehen
  let dragDepth = 0;
  const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; dragDepth++; $('#drop').hidden = false; });
  window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#drop').hidden = true; });
  window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; $('#drop').hidden = true;
    const files = [...e.dataTransfer.files];
    const pdfs = files.filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    const imgs = files.filter(f => /^image\//.test(f.type));
    if (pdfs.length) openFiles(pdfs, S.sample ? 'replace' : (e.shiftKey ? 'append' : 'replace'));
    else if (imgs.length) {
      const w = e.target.closest && e.target.closest('.page');
      const p = w ? pageById(w.dataset.id) : null;
      insertImages(imgs, p, p ? ptIn(e, els.get(p.id)) : null);
    } else toast('Nur PDFs und Bilder können hier abgelegt werden.');
  });

  // Unterschrift
  $('#sigTabDraw').onclick = () => setSigMode('draw');
  $('#sigTabType').onclick = () => setSigMode('type');
  $('#sigText').addEventListener('input', drawTypedSig);
  $('#sigClear').onclick = () => { clearSig(); if (sig.mode === 'type') { $('#sigText').value = ''; $('#sigText').focus(); } };
  $('#sigCancel').onclick = closeSig;
  $('#sigOk').onclick = sigOk;
  $('#sigSaved').onclick = () => { try { useSignature(JSON.parse(lsGet('pdfwb.signature'))); } catch (e) { toast('Die gespeicherte Unterschrift ist nicht mehr verfügbar.'); } };
  $('#sigColors').addEventListener('click', e => {
    const b = e.target.closest('.sw'); if (!b) return;
    sig.color = b.dataset.c;
    $$('.sw', $('#sigColors')).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (sig.mode === 'type') drawTypedSig();
  });
  $('#sigModal').addEventListener('pointerdown', e => { if (e.target.id === 'sigModal') closeSig(); });

  // Tastatur
  let lastNudge = 0;
  window.addEventListener('keydown', e => {
    const tgt = e.target, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName) || tgt.isContentEditable;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (!$('#sigModal').hidden || !$('#askModal').hidden || !$('#dlg').hidden || !$('#noteModal').hidden) {
      if (e.key === 'Escape') {
        if (!$('#sigModal').hidden) closeSig();
        else if (!$('#askModal').hidden) $('#askNo').click();
        else if (!$('#dlg').hidden) $('#dlgCancel').click();
        else $('#noteCancel').click();
      }
      if (e.key === 'Enter' && !$('#dlg').hidden && tgt.tagName !== 'BUTTON') { e.preventDefault(); $('#dlgOk').click(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !$('#noteModal').hidden) { e.preventDefault(); $('#noteOk').click(); }
      return;
    }
    if (!$('#menu').hidden && e.key === 'Escape') { closeMenu(); return; }
    if (mod && k === 's') { e.preventDefault(); savePdf(); return; }
    if (mod && k === 'o') { e.preventDefault(); $('#fileOpen').click(); return; }
    if (mod && k === 'f') { e.preventDefault(); fi.focus(); fi.select(); return; }
    if (typing) return;
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'c') { const a = selAnnot(); if (a) { S.clip = clone(a); toast('Element kopiert'); } return; }
    if (mod && k === 'v') { if (S.clip) { e.preventDefault(); pasteAnnot(S.clip, 12); } return; }
    if (mod && k === 'd') { e.preventDefault(); const a = selAnnot(); if (a) pasteAnnot(a, 12); return; }
    if (mod && (k === '+' || k === '=')) { e.preventDefault(); zoomStep(1); return; }
    if (mod && k === '-') { e.preventDefault(); zoomStep(-1); return; }
    if (mod && k === '0') { e.preventDefault(); setZoom(fitZoom()); return; }
    if (mod || e.altKey) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (S.csel) { e.preventDefault(); deleteContent(); }
      else if (selAnnot()) { e.preventDefault(); deleteSel(); }
      return;
    }
    if (e.key === 'Escape') { if (S.csel) setCsel(null, []); else if (S.sel) select(null); else setTool('select'); return; }
    if (e.key === 'Enter' && S.csel && S.csel.items.length === 1 && S.csel.items[0].kind === 'text') { e.preventDefault(); editContentText(pageById(S.csel.pid), S.csel.items[0]); return; }
    if (e.key.startsWith('Arrow') && selAnnot()) {
      e.preventDefault();
      const st = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
      const now = Date.now(); if (now - lastNudge > 700) pushHist(); lastNudge = now;
      const a = selAnnot(); Object.assign(a, translated(a, dx, dy)); drawAnnots(pageById(S.sel.pid)); markDirty();
      return;
    }
    if (e.key === 'PageDown') { e.preventDefault(); scrollToPage(Math.min(S.pages.length - 1, S.cur + 1)); return; }
    if (e.key === 'PageUp') { e.preventDefault(); scrollToPage(Math.max(0, S.cur - 1)); return; }
    if (k === 'i') { $('#fileImg').click(); return; }
    if (k === 'u') { openSig(); return; }
    if (KEYS[k]) setTool(KEYS[k]);
  });
  window.addEventListener('beforeunload', e => { if (S.dirty && !S.sample) { e.preventDefault(); e.returnValue = ''; } });
}

/* ---------- Start ---------- */
async function boot() {
  bindUI();
  setTool('select'); updateUndo(); updateTitle();
  if (innerWidth <= 760) work.classList.remove('thumbs-open');
  if (!PDFJS || !PL) { setMsg('Die PDF-Bibliotheken konnten nicht geladen werden. Bitte Seite neu laden.'); return; }
  PDFJS.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  if (ENG) {
    try {
      const d = await PL.PDFDocument.create(), fonts = new Map();
      for (const n of ENG.STD_FONTS) fonts.set(n, await d.embedFont(PL.StandardFonts[n.replace('Times-Roman', 'TimesRoman').replace(/^Times-/, 'TimesRoman').replace(/-/g, '')]));
      ENG.setStdWidths((name, ch) => { const f = fonts.get(name); if (!f) return null; try { return f.widthOfTextAtSize(ch, 1000); } catch (e) { return null; } });
    } catch (e) { console.warn('Standardschriften nicht geladen', e); }
  }
  if (await restoreSession()) return;
  busy(true, 'Beispiel wird geladen …');
  try {
    const { bytes, mark } = await makeSample();
    const pages = await addSource(bytes, 'Beispiel-Dokument.pdf');
    const m = mark;
    pages[0].annots.push(
      { id: uid(), t: 'hl', x: m.x - 4, y: m.y - 14, w: m.w + 8, h: 19, color: '#ffd400', op: 45 },
      { id: uid(), t: 'arrow', x1: m.x + m.w + 70, y1: m.y - 5, x2: m.x + m.w + 14, y2: m.y - 5, color: '#d0342c', sw: 1.5 },
      { id: uid(), t: 'text', x: m.x + m.w + 76, y: m.y - 11.5, text: 'Beispiel: anklicken, ziehen, mit Entf löschen', color: '#d0342c', size: 10, font: 'Helvetica', bold: false },
    );
    S.pages = pages;
    S.zoom = initialZoom();
    buildViewer();
    busy(false);
    setMsg('Beispiel geladen · Öffne dein eigenes PDF oder ziehe es ins Fenster');
  } catch (e) {
    console.error(e); busy(false);
    setMsg('Das Beispiel konnte nicht geladen werden. Öffne direkt ein eigenes PDF.');
  }
}
boot();
})();
