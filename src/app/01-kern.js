(() => {
'use strict';
const PDFJS = window.pdfjsLib;
const PL = window.PDFLib;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const SVGNS = 'http://www.w3.org/2000/svg';
const LH = 1.2;
const A4 = [595.28, 841.89];

/* Schriften: die drei PDF-Standardschriften plus mitgelieferte Google Fonts (fonts/*.ttf, Open Font License),
   die beim Speichern als Teilmenge in die PDF eingebettet werden. bl = Grundlinie bei Zeilenhöhe 1,2 */
const FONTS = {
  Helvetica: { css: 'Helvetica, Arial, "Liberation Sans", sans-serif', bl: 0.947, std: ['Helvetica', 'HelveticaBold'], g: 'Standard' },
  Times: { css: '"Times New Roman", Times, "Liberation Serif", serif', bl: 0.937, std: ['TimesRoman', 'TimesRomanBold'], g: 'Standard' },
  Courier: { css: '"Courier New", Courier, "Liberation Mono", monospace', bl: 0.866, std: ['Courier', 'CourierBold'], g: 'Standard' },
};
[['Roboto', 'Roboto', 0.942, 'Serifenlos'], ['OpenSans', 'Open Sans', 0.988, 'Serifenlos'], ['Inter', 'Inter', 0.964, 'Serifenlos'], ['Montserrat', 'Montserrat', 0.959, 'Serifenlos'], ['Nunito', 'Nunito', 0.929, 'Serifenlos'],
  ['Merriweather', 'Merriweather', 0.955, 'Serif'], ['Lora', 'Lora', 0.966, 'Serif'], ['PlayfairDisplay', 'Playfair Display', 1.015, 'Serif'],
  ['JetBrainsMono', 'JetBrains Mono', 0.96, 'Schreibmaschine'],
  ['Caveat', 'Caveat', 0.93, 'Handschrift'], ['DancingScript', 'Dancing Script', 0.92, 'Handschrift'], ['PatrickHand', 'Patrick Hand', 0.965, 'Handschrift', true], ['PermanentMarker', 'Permanent Marker', 0.996, 'Handschrift', true],
].forEach(([key, label, bl, g, noBold]) => { FONTS[key] = { css: `"WB ${label}", "${label}", ${g === 'Serif' ? 'serif' : g === 'Handschrift' ? 'cursive' : g === 'Schreibmaschine' ? 'monospace' : 'sans-serif'}`, family: 'WB ' + label, label, bl, file: key, noBold: !!noBold, g }; });
const FONT = name => FONTS[name] || FONTS.Helvetica;
const fw = a => (a.bold && !FONT(a.font).noBold ? 700 : 400);
/* eigene Schrift fürs Anzeigen laden, danach neu messen und zeichnen */
const fontLoads = new Map();
function ensureFont(name, bold) {
  const f = FONTS[name]; if (!f || !f.file || !document.fonts) return Promise.resolve(true);
  const k = name + (bold && !f.noBold ? 'b' : '');
  if (!fontLoads.has(k)) fontLoads.set(k, document.fonts.load(`${bold && !f.noBold ? 700 : 400} 16px "${f.family}"`).then(r => r.length > 0).catch(() => false));
  return fontLoads.get(k);
}
async function ensureFontsOf(pages) {
  const need = new Set();
  for (const p of pages) for (const a of p.annots) if (a.t === 'text' && FONT(a.font) && FONT(a.font).file) need.add(a.font + '|' + (a.bold ? 1 : 0));
  if (!need.size) return;
  await Promise.all([...need].map(k => { const [n, b] = k.split('|'); return ensureFont(n, b === '1'); }));
  for (const p of pages) if (p.annots.some(a => a.t === 'text' && FONT(a.font) && FONT(a.font).file)) drawAnnots(p);
}
/* fontkit (zum Einbetten eigener Schriften) erst laden, wenn er gebraucht wird */
let fontkitP = null;
function loadFontkit() {
  if (window.fontkit) return Promise.resolve(window.fontkit);
  if (!fontkitP) fontkitP = new Promise((res, rej) => {
    const urls = ['js/vendor/fontkit.umd.min.js', 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'];
    const next = () => {
      const u = urls.shift(); if (!u) { fontkitP = null; rej(new Error('Schrift-Modul konnte nicht geladen werden (offline?).')); return; }
      const sc = document.createElement('script'); sc.src = u; sc.onload = () => (window.fontkit ? res(window.fontkit) : next()); sc.onerror = () => { sc.remove(); next(); };
      document.head.appendChild(sc);
    };
    next();
  });
  return fontkitP;
}
const fontBytes = new Map();
function fontFile(name, bold) {
  const f = FONT(name), file = `fonts/${f.file}-${bold && !f.noBold ? 'Bold' : 'Regular'}.ttf`;
  if (!fontBytes.has(file)) fontBytes.set(file, fetch(file).then(r => { if (!r.ok) throw new Error('Schrift fehlt: ' + file); return r.arrayBuffer(); }).catch(e => { fontBytes.delete(file); throw e; }));
  return fontBytes.get(file);
}

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
  front: 'M8 8h12v12H8zM4 16V4h12',
  under: 'M12 3L2 8l10 5 10-5zM2 12.5l10 5 10-5M2 17l10 5 10-5',
  mark: 'M3 6h18v5H3zM3 15h12M3 19h8',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z',
  eyeoff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  back: 'M4 4h12v12H4zM8 20h12V8',
  gear: 'M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1',
  comment: 'M4 5h16v11H9l-5 4z',
  paste: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4',
  dup: 'M9 9h11v11H9zM5 15V4h11M14.5 12v5M12 14.5h5',
  calc: 'M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01',
  eraser: 'M8 20h12M5.5 14.5l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 18H8.5l-3-3a.7.7 0 0 1 0-.5zM9 11l5 5',
  redact: 'M4 6h16v5H4zM4 15h9M4 19h12',
  measure: 'M3 15l12-12 6 6-12 12zM7 11l2 2M10 8l2 2M13 5l2 2',
  book: 'M4 5c3-1 6-1 8 1v14c-2-2-5-2-8-1zM20 5c-3-1-6-1-8 1v14c2-2 5-2 8-1z',
  library: 'M4 4h4v16H4zM10 4h4v16h-4zM16.5 4.5l3.8 1-3.9 14.5-3.8-1z',
  laser: 'M4 20l8.5-8.5M14.5 9.5a2 2 0 1 0 0-.01M14.5 3v2M20.5 9.5h-2M18.7 5.3l-1.4 1.4M18.7 13.7l-1.4-1.4M10.3 5.3l1.4 1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  pages: 'M7 3h10v7H7zM7 14h10v7H7z',
  bookmark: 'M7 3h10v18l-5-4-5 4z',
  pencil: 'M4 20l3-1 12-12-2-2L5 17zM15 5l2-2 2 2-2 2',
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z',
  restart: 'M4 12a8 8 0 1 0 2.4-5.7L4 9M4 4v5h5', send: 'M4 12l16-8-6 16-2.4-6.6z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01', bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.6 1.5 2.6V17h4v-.5c0-1 .7-2 1.5-2.6A6 6 0 0 0 12 3z',
  cards: 'M8 4h12v12H8zM4 8v12h12', quiz: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01',
  checks: 'M4 7l2 2 4-4M4 17l2 2 4-4M13 7h7M13 17h7', translate: 'M4 5h8M8 3v2M5.5 5c.5 3 2.5 5.5 5.5 7M11 5c-.5 3-3 6.5-6.5 8M13 21l4-10 4 10M14.5 17.5h5',
  hand: 'M3 17c2.5-3 4-9 6-9s-1 9 1.5 9 3-5 5-5 1 3 3 3 2-1 2.5-1.5',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  aleft: 'M4 6h16M4 10h10M4 14h16M4 18h10', acenter: 'M4 6h16M7 10h10M4 14h16M7 18h10', aright: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6', play: 'M8 5l11 7-11 7z', pause: 'M8 5v14M16 5v14',
  cards: 'M7 4h11a2 2 0 0 1 2 2v9M4 8h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM7 13h5M7 16h3', tasks: 'M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9',
  split: 'M3 5h18v14H3zM12 5v14', sig: 'M4 17c3-1 4-7 6-7s1 6 3 6 2-3 4-3 2 2 3 2M4 21h16', warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  convert: 'M4 7h12l-3-3M20 17H8l3 3', template: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5', toc: 'M4 6h2M9 6h11M4 12h2M11 12h9M4 18h2M11 18h9', hf: 'M4 3h16v18H4zM4 7h16M4 17h16',
  quote: 'M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6', exam: 'M6 3h9l4 4v14H6zM9 9h6M9 13h6M9 17h3M15 3v4h4', mindmap: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 5h4v3H4zM16 5h4v3h-4zM4 16h4v3H4zM16 16h4v3h-4zM8 7l2 3M16 7l-2 3M8 17l2-3M16 17l-2-3',
  chart: 'M4 20h16M7 16v-5M12 16V7M17 16v-8', sigma: 'M18 5H6l6 7-6 7h12', receipt: 'M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21zM9 8h6M9 12h6M9 16h3', mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5', archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4', access: 'M12 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM5 9l7 1.5L19 9M12 10.5V15l-3 5M12 15l3 5', xml: 'M6 3h9l4 4v14H6zM10 12l-2 2 2 2M14 12l2 2-2 2M15 3v4h4', timer: 'M12 7a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 10v4l2 2M9 3h6',
  calendar: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4', bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', scan: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 9h10M7 12h10M7 15h6',
  compress: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5', compare: 'M4 4h7v16H4zM13 4h7v16h-7zM6.5 8h2M15.5 8h2M6.5 12h2M15.5 12h2',
  field: 'M3 7h18v10H3zM7 10v4M6 10h2M6 14h2', qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  cloud: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z', users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c2 .7 3 2.8 3 6',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3', insert: 'M12 5v14M5 12h14', chev: 'M9 6l6 6-6 6',
  lsolid: 'M3 12h18', ldash: 'M3 12h4M10 12h4M17 12h4', ldot: 'M4 12h.01M8 12h.01M12 12h.01M16 12h.01M20 12h.01',
};

const TOOL_NAMES = { laser: 'Laserpointer', mark: 'Textmarkierung', select: 'Auswählen', objects: 'Inhalte', text: 'Text', edittext: 'Text ändern', pen: 'Stift', eraser: 'Radierer', hl: 'Markieren', ul: 'Unterstreichen', so: 'Durchstreichen', rect: 'Rechteck', ellipse: 'Ellipse', line: 'Linie', arrow: 'Pfeil', measure: 'Messen', white: 'Abdecken', redact: 'Schwärzen', check: 'Haken', cross: 'Kreuz', img: 'Bild', graph: 'Live-Graph', table: 'Tabelle', field: 'Formularfeld', stamp: 'Stempel', note: 'Notiz', wm: 'Wasserzeichen' };
const PROPS_OF = { multi: ['color'], mark: ['color', 'opacity'], text: ['color', 'font', 'align'], pen: ['penkind', 'color', 'stroke', 'opacity'], eraser: ['esize'], hl: ['color', 'opacity'], ul: ['color'], so: ['color'], rect: ['color', 'stroke', 'fill', 'dash'], ellipse: ['color', 'stroke', 'fill', 'dash'], line: ['color', 'stroke', 'dash'], arrow: ['color', 'stroke', 'dash'], measure: ['color', 'scale'], check: ['color', 'stroke'], cross: ['color', 'stroke'], white: [], redact: [], img: [], graph: [], table: ['color'], field: [], stamp: ['color', 'stamp'], note: ['color'], wm: ['color', 'opacity'] };
const DRAW_TOOLS = new Set(['laser', 'pen', 'eraser', 'hl', 'ul', 'so', 'rect', 'ellipse', 'line', 'arrow', 'measure', 'white', 'redact', 'check', 'cross', 'objects']);
const SNAP_TOOLS = new Set(['hl', 'ul', 'so']);
const KEYS = { j: 'laser', v: 'select', m: 'objects', t: 'text', e: 'edittext', p: 'pen', g: 'eraser', h: 'hl', n: 'ul', d: 'so', r: 'rect', o: 'ellipse', l: 'line', a: 'arrow', q: 'measure', w: 'white', b: 'redact', k: 'check', x: 'cross', s: 'stamp', c: 'note' };
const STAMPS = [['GENEHMIGT', '#1e8a4c'], ['ERLEDIGT', '#1e8a4c'], ['BEZAHLT', '#1e8a4c'], ['ENTWURF', '#1f4fd8'], ['KOPIE', '#1f4fd8'], ['VERTRAULICH', '#d0342c'], ['ABGELEHNT', '#d0342c'], ['DRINGEND', '#e07b00'], ['{datum}', '#1b2130']];
const COARSE = matchMedia('(pointer: coarse)').matches || matchMedia('(any-pointer: coarse)').matches;
/* Stiftarten: jede Art merkt sich eigene Stärke, Deckkraft und Farbe */
const PEN_KINDS = {
  fount: { sw: 2, op: 100, color: '#1b2a6b' },
  ball: { sw: 1.25, op: 100, color: '#1f4fd8' },
  marker: { sw: 12, op: 40, color: '#ffd400' },
};
const today = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const SWATCHES = ['#1b2130', '#1f4fd8', '#d0342c', '#1e8a4c', '#e07b00', '#7a3fd0', '#ffd400', '#ffffff'];
const HINTS = {
  select: 'Element anklicken zum Verschieben · Ecke ziehen zum Skalieren · Doppelklick auf Text zum Bearbeiten',
  edittext: 'Auf vorhandenen Text klicken und direkt in der PDF ändern · leer lassen entfernt die Zeile',
  objects: 'Element der PDF antippen oder Rahmen aufziehen, dann ziehen zum Verschieben · Doppelklick auf Text bearbeitet ihn',
  white: 'Bereich aufziehen, um Inhalte mit Weiß abzudecken',
  text: '', img: 'Bild ausgewählt · Ecke ziehen zum Skalieren',
  hl: 'Auf eine Textzeile tippen oder einen Bereich aufziehen',
  ul: 'Auf eine Textzeile tippen oder eine Linie ziehen',
  so: 'Auf eine Textzeile tippen oder eine Linie ziehen',
  note: 'Auf die Seite tippen, um eine Notiz anzuheften · wird als echter PDF-Kommentar gespeichert',
  stamp: 'Stempel wählen und auf die Seite tippen',
  eraser: 'Über eigene Striche und Elemente wischen, um sie zu löschen',
  redact: 'Bereich aufziehen: Text und Grafik darunter werden dauerhaft aus der PDF entfernt',
  measure: 'Linie ziehen, um die Strecke in mm zu messen · Umschalt rastet auf 45° ein',
  pen: 'Strich am Ende kurz halten: wird zu gerader Linie, Rechteck oder Ellipse',
};
const TOUCH_HINT = 'Zwei Finger scrollen und zoomen · zwei Finger tippen = rückgängig';
if (COARSE) for (const k of ['pen', 'eraser', 'rect', 'ellipse', 'line', 'arrow', 'measure', 'white', 'redact', 'check', 'cross', 'objects']) HINTS[k] = (HINTS[k] ? HINTS[k] + ' · ' : '') + TOUCH_HINT;

const TP = {
  text: { color: '#1b2130', size: 12, font: 'Helvetica', bold: false, bg: '', align: 'left' },
  pen: { kind: 'fount', color: '#1b2a6b', sw: 2, op: 100, shapes: true },
  eraser: { size: 12 },
  measure: { color: '#d0342c', sw: 1, scale: 1, unit: 'mm' },
  hl: { color: '#ffd400', op: 40 },
  rect: { color: '#d0342c', sw: 2, fill: '', dash: '' }, ellipse: { color: '#d0342c', sw: 2, fill: '', dash: '' },
  line: { color: '#1b2130', sw: 2, dash: '' }, arrow: { color: '#d0342c', sw: 2, dash: '' },
  check: { color: '#1b2130', sw: 2 }, cross: { color: '#1b2130', sw: 2 },
  ul: { color: '#1f4fd8' }, so: { color: '#d0342c' },
  stamp: { color: '#1e8a4c', text: 'GENEHMIGT' }, note: { color: '#ffd400' },
};

const S = {
  decrypted: new Set(),
  sources: new Map(), proxies: new Map(), images: new Map(), textCache: new Map(),
  pages: [], zoom: 1, tool: 'select', sel: null, cur: 0, selPages: new Set(),
  docName: 'Beispiel-Dokument.pdf', sample: true, dirty: false,
  hist: [], fut: [], clip: null, find: null, editing: null, busy: false, blankSrc: null, propEdit: false,
  libDocs: new Map(), analysis: new Map(), derived: new Map(), csel: null, hover: null, cedit: null,
  meta: { title: '', author: '', subject: '', keywords: '' }, touchDrag: false,
  pencil: { seen: false, only: false }, forms: new Map(), formVals: {}, formTouched: new Set(), bookmarks: [], paperSrc: new Map(),
  sideTab: 'pages', reading: false, night: false, msel: null, prefs: null,
  recs: [], audio: new Map(), cards: [], player: null,
  cite: null, exams: [], receipts: [], einv: null,
};
/* Einheiten fürs Messen: Faktor von PDF-Punkt (1/72 Zoll) */
const UNITS = { mm: [25.4 / 72, 'mm', 'Millimeter'], cm: [2.54 / 72, 'cm', 'Zentimeter'], m: [0.0254 / 72, 'm', 'Meter'], in: [1 / 72, 'in', 'Zoll'], ft: [1 / 864, 'ft', 'Fuß'], pt: [1, 'pt', 'Punkt'] };
const PREF_DEFAULTS = { author: '', unit: 'mm', decimals: 1, scale: 1, exportMarks: 'annots', askComment: false, snap: true, showMarks: true, hlColor: '#ffd400', ulColor: '#1f4fd8', soColor: '#d0342c' };
const ENG = PL && window.createContentEngine ? window.createContentEngine(PL) : null;
const els = new Map(), tels = new Map();
let uidN = 1;
// Kennungen je Sitzung eindeutig (gemeinsames Bearbeiten: zwei Geräte dürfen nie dieselbe ID vergeben)
const UIDTAG = Math.random().toString(36).slice(2, 6);
const uid = (p = 'a') => p + UIDTAG + (uidN++).toString(36);

const pagesEl = $('#pages'), viewer = $('#viewer'), thumbsEl = $('#thumbs'), work = $('#work'), propbar = $('#propbar');

/* ---------- Hilfsfunktionen ---------- */
const r2 = n => Math.round(n * 100) / 100;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const pageById = id => S.pages.find(p => p.id === id);
const hasCE = p => !!(p && p.ce && ((p.ce.del && p.ce.del.length) || (p.ce.rep && Object.keys(p.ce.rep).length) || (p.ce.tf && Object.keys(p.ce.tf).length) || (p.ce.red && p.ce.red.length) || (p.ce.dup && p.ce.dup.length) || (p.ce.zf && p.ce.zf.length) || (p.ce.zb && p.ce.zb.length)));
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
S.prefs = (() => { try { return { ...PREF_DEFAULTS, ...JSON.parse(lsGet('pdfwb.prefs') || '{}') }; } catch (e) { return { ...PREF_DEFAULTS }; } })();
const savePrefs = () => lsSet('pdfwb.prefs', JSON.stringify(S.prefs));
/* Hell, dunkel oder wie das System (gilt für Editor und Bibliothek) */
function setTheme(v) {
  if (v === 'light' || v === 'dark') { document.documentElement.dataset.theme = v; lsSet('pdfwb.theme', v); }
  else { delete document.documentElement.dataset.theme; try { localStorage.removeItem('pdfwb.theme'); } catch (e) { /* egal */ } }
}
setTheme(lsGet('pdfwb.theme'));
TP.measure.unit = S.prefs.unit; TP.measure.scale = S.prefs.scale;
TP.hl.color = S.prefs.hlColor; TP.ul.color = S.prefs.ulColor; TP.so.color = S.prefs.soColor;
/* Länge in PDF-Punkt in der gewählten Einheit, deutsch formatiert */
function fmtLen(pt, unit, scale = 1, dec = S.prefs.decimals) {
  const u = UNITS[unit] || UNITS.mm, v = pt * u[0] * scale;
  return v.toFixed(dec).replace('.', ',') + ' ' + u[1];
}
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
function measure(str, a) { mctx.font = `${fw(a)} ${a.size}px ${FONT(a.font).css}`; return mctx.measureText(str).width; }
function textWidth(a) { return Math.max(4, ...a.text.split('\n').map(l => measure(l || ' ', a))); }
/* Textausrichtung: linker Rand je Zeile innerhalb der Textbox */
function lineX(a, ln, W) {
  if (!a.align || a.align === 'left') return a.x;
  const w = measure(ln || ' ', a);
  W = W == null ? textWidth(a) : W;
  return a.x + (a.align === 'center' ? (W - w) / 2 : W - w);
}
/* Linienstil und Füllung für Formen */
const dashOf = a => (a.dash === 'dash' ? [a.sw * 3, a.sw * 2] : a.dash === 'dot' ? [0.01, a.sw * 2] : null);
const FILL_OP = { soft: 0.22, solid: 1 };
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
    case 'measure': {
      const m = 9;
      return { x: Math.min(a.x1, a.x2) - m, y: Math.min(a.y1, a.y2) - m, w: Math.abs(a.x2 - a.x1) + 2 * m, h: Math.abs(a.y2 - a.y1) + 2 * m };
    }
    case 'text': return { x: a.x, y: a.y, w: textWidth(a), h: a.text.split('\n').length * LH * a.size };
    case 'check': case 'cross': return { x: a.x, y: a.y, w: a.s, h: a.s };
    case 'mark': {
      const x = Math.min(...a.rects.map(r => r.x)), y = Math.min(...a.rects.map(r => r.y));
      return { x, y, w: Math.max(...a.rects.map(r => r.x + r.w)) - x, h: Math.max(...a.rects.map(r => r.y + r.h)) - y };
    }
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
    case 'rect': case 'hl': case 'white': case 'redact':
      return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
    case 'measure': {
      const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1), nx = -Math.sin(ang) * 5, ny = Math.cos(ang) * 5;
      return [['M', a.x1, a.y1], ['L', a.x2, a.y2], ['M', a.x1 - nx, a.y1 - ny], ['L', a.x1 + nx, a.y1 + ny], ['M', a.x2 - nx, a.y2 - ny], ['L', a.x2 + nx, a.y2 + ny]];
    }
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
/* Füller: Umriss aus Mittellinie und Druck (0–1) je Punkt, als geschlossene Fläche */
function penOutline(a) {
  const n = a.pts.length, pr = q => (q[2] == null ? 0.5 : q[2]);
  const P = n > 2 ? a.pts.map((q, i) => (i === 0 || i === n - 1 ? q : [(a.pts[i - 1][0] + 2 * q[0] + a.pts[i + 1][0]) / 4, (a.pts[i - 1][1] + 2 * q[1] + a.pts[i + 1][1]) / 4, (pr(a.pts[i - 1]) + 2 * pr(q) + pr(a.pts[i + 1])) / 4])) : a.pts;
  const rad = P.map(q => Math.max(0.15, a.sw * (0.28 + 1.05 * pr(q)) / 2));
  if (n === 1 || (n === 2 && Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]) < 0.3)) {
    const [cx, cy] = P[0], r = rad[0], k = 0.5523 * r;
    return [['M', cx + r, cy], ['C', cx + r, cy + k, cx + k, cy + r, cx, cy + r], ['C', cx - k, cy + r, cx - r, cy + k, cx - r, cy], ['C', cx - r, cy - k, cx - k, cy - r, cx, cy - r], ['C', cx + k, cy - r, cx + r, cy - k, cx + r, cy], ['Z']];
  }
  const L = [], R = [];
  let nxp = 0, nyp = 1;
  for (let i = 0; i < n; i++) {
    const a0 = P[Math.max(0, i - 1)], a1 = P[Math.min(n - 1, i + 1)];
    let dx = a1[0] - a0[0], dy = a1[1] - a0[1];
    const l = Math.hypot(dx, dy);
    if (l > 1e-6) { dx /= l; dy /= l; nxp = -dy; nyp = dx; }
    L.push([P[i][0] + nxp * rad[i], P[i][1] + nyp * rad[i]]);
    R.push([P[i][0] - nxp * rad[i], P[i][1] - nyp * rad[i]]);
  }
  const cap = (c, r, from) => {
    const out = [];
    for (let k = 1; k < 6; k++) { const t = from - Math.PI * k / 6; out.push(['L', c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r]); }
    return out;
  };
  const angOf = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]);
  const end = P[n - 1], start = P[0];
  return [['M', L[0][0], L[0][1]], ...L.slice(1).map(q => ['L', q[0], q[1]]),
    ...cap(end, rad[n - 1], angOf(end, L[n - 1])),
    ...R.slice().reverse().map(q => ['L', q[0], q[1]]),
    ...cap(start, rad[0], angOf(start, R[0])), ['Z']];
}
const penKind = a => a.kind || 'ball';
/* Textmarkierung: je Zeile ein Rechteck; Unter- und Durchstreichen als Linie (bei gedrehter Seite senkrecht) */
function markSegs(a) {
  return a.rects.map(r => {
    const rect = [['M', r.x, r.y], ['L', r.x + r.w, r.y], ['L', r.x + r.w, r.y + r.h], ['L', r.x, r.y + r.h], ['Z']];
    if (a.kind === 'hl') return ['fill', rect];
    const v = !!a.vert, size = v ? r.w : r.h, w = Math.max(0.8, size * 0.075);
    const f = a.kind === 'ul' ? 0.9 : 0.55;
    if (!v) { const y = r.y + r.h * f; return ['line', { d: [['M', r.x, y], ['L', r.x + r.w, y]], w }]; }
    const x = r.x + r.w * (1 - f);
    return ['line', { d: [['M', x, r.y], ['L', x, r.y + r.h]], w }];
  });
}
function measureLabel(a) {
  return fmtLen(Math.hypot(a.x2 - a.x1, a.y2 - a.y1), a.unit || S.prefs.unit, a.scale || 1, a.dec != null ? a.dec : S.prefs.decimals);
}
function measureGeom(a) {
  let ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1) * 180 / Math.PI;
  if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
  const label = measureLabel(a), size = 8, w = measure(label, { bold: false, size, font: 'Helvetica' });
  return { ang, label, size, w, mx: (a.x1 + a.x2) / 2, my: (a.y1 + a.y2) / 2 };
}
function annotSVG(a) {
  const c = a.color;
  switch (a.t) {
    case 'pen': {
      const k = penKind(a);
      if (k === 'fount') return `<path d="${dOf(penOutline(a))}" fill="${c}" fill-opacity="${a.op / 100}"/>`;
      return `<path d="${dOf(segs(a))}" fill="none" stroke="${c}" stroke-width="${a.sw}" stroke-linecap="round" stroke-linejoin="round" ${k === 'marker' ? `stroke-opacity="${a.op / 100}"` : `opacity="${a.op / 100}"`}/>`;
    }
    case 'measure': {
      const g = measureGeom(a);
      return `<g><path d="${dOf(segs(a))}" fill="none" stroke="${c}" stroke-width="${a.sw}" stroke-linecap="round"/>` +
        `<g transform="translate(${r2(g.mx)} ${r2(g.my)}) rotate(${r2(g.ang)})"><rect x="${r2(-g.w / 2 - 2)}" y="${-g.size - 4}" width="${r2(g.w + 4)}" height="${g.size + 3}" rx="1.5" fill="#ffffff" fill-opacity="0.85"/>` +
        `<text x="0" y="-4" text-anchor="middle" font-family='${FONTS.Helvetica.css}' font-size="${g.size}" fill="${c}">${esc(g.label)}</text></g></g>`;
    }
    case 'redact': return `<path d="${dOf(segs(a))}" fill="#000000"/>`;
    case 'mark': return markSegs(a).map(([k, q]) => k === 'fill'
      ? `<path d="${dOf(q)}" fill="${c}" fill-opacity="${(a.op || 40) / 100}"/>`
      : `<path d="${dOf(q.d)}" fill="none" stroke="${c}" stroke-width="${r2(q.w)}" stroke-linecap="butt"/>`).join('');
    case 'hl': return `<path d="${dOf(segs(a))}" fill="${c}" fill-opacity="${a.op / 100}"/>`;
    case 'white': return `<path d="${dOf(segs(a))}" fill="#ffffff"/>`;
    case 'rect': case 'ellipse': {
      const da = dashOf(a), fo = FILL_OP[a.fill];
      return `<path d="${dOf(segs(a))}" fill="${fo ? c : 'none'}"${fo ? ` fill-opacity="${fo}"` : ''} stroke="${c}" stroke-width="${a.sw}"${da ? ` stroke-dasharray="${da.map(r2).join(' ')}"${a.dash === 'dot' ? ' stroke-linecap="round"' : ''}` : ''}/>`;
    }
    case 'line': case 'arrow': {
      const da = dashOf(a);
      if (da && a.t === 'arrow') { const sg = segs(a); return `<path d="${dOf(sg.slice(0, 2))}" fill="none" stroke="${c}" stroke-width="${a.sw}" stroke-linecap="round" stroke-dasharray="${da.map(r2).join(' ')}"/><path d="${dOf(sg.slice(2))}" fill="none" stroke="${c}" stroke-width="${a.sw}" stroke-linecap="round" stroke-linejoin="round"/>`; }
      return `<path d="${dOf(segs(a))}" fill="none" stroke="${c}" stroke-width="${a.sw}" stroke-linecap="round" stroke-linejoin="round"${da ? ` stroke-dasharray="${da.map(r2).join(' ')}"` : ''}/>`;
    }
    case 'check': case 'cross':
      return `<path d="${dOf(segs(a))}" fill="none" stroke="${c}" stroke-width="${a.sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'text': {
      const f = FONT(a.font);
      const lines = a.text.split('\n'), W = a.align && a.align !== 'left' ? textWidth(a) : 0;
      const bgr = a.bg ? (() => { const b = bbox(a), pd = a.size * 0.18; return `<rect x="${r2(b.x - pd)}" y="${r2(b.y - pd * 0.4)}" width="${r2(b.w + 2 * pd)}" height="${r2(b.h + pd * 0.8)}" fill="${a.bg}"/>`; })() : '';
      return bgr + `<text font-family='${f.css}' font-size="${a.size}" font-weight="${fw(a)}" fill="${c}" xml:space="preserve">` +
        lines.map((ln, i) => `<tspan x="${r2(lineX(a, ln, W))}" y="${r2(a.y + f.bl * a.size + i * LH * a.size)}">${esc(ln) || ' '}</tspan>`).join('') + '</text>';
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
    case 'graph': return graphSVG(a);
    case 'table': return tableSVG(a);
    case 'field': return fieldSVG(a);
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
  if (a.t === 'mark') return a.rects.some(r => pt[0] >= r.x - tol && pt[0] <= r.x + r.w + tol && pt[1] >= r.y - tol && pt[1] <= r.y + r.h + tol);
  const b = bbox(a);
  const inBox = pt[0] >= b.x - tol && pt[0] <= b.x + b.w + tol && pt[1] >= b.y - tol && pt[1] <= b.y + b.h + tol;
  if (a.t === 'pen' || a.t === 'line' || a.t === 'arrow' || a.t === 'measure') {
    if (!inBox && a.t !== 'arrow') return false;
    const t = tol + (a.sw || 1) / 2 * (a.t === 'pen' && penKind(a) === 'fount' ? 1.4 : 1);
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
  if (a.pts) a.pts = a.pts.map(([x, y, p]) => (p == null ? [r2(x + dx), r2(y + dy)] : [r2(x + dx), r2(y + dy), p]));
  else if ('x1' in a) { a.x1 += dx; a.x2 += dx; a.y1 += dy; a.y2 += dy; }
  else if (a.rects) a.rects = a.rects.map(r => ({ ...r, x: r.x + dx, y: r.y + dy }));
  else { a.x += dx; a.y += dy; }
  return a;
}
function scaled(o, ob, fx, fy) {
  const a = clone(o);
  const sx = x => ob.x + (x - ob.x) * fx, sy = y => ob.y + (y - ob.y) * fy;
  if (a.pts) { a.pts = a.pts.map(([x, y, p]) => (p == null ? [r2(sx(x)), r2(sy(y))] : [r2(sx(x)), r2(sy(y)), p])); if (a.t === 'pen') a.sw = Math.max(0.25, r2(a.sw * Math.sqrt(fx * fy))); }
  else if ('x1' in a) { a.x1 = sx(a.x1); a.x2 = sx(a.x2); a.y1 = sy(a.y1); a.y2 = sy(a.y2); }
  else if (a.rects) a.rects = a.rects.map(r => ({ x: sx(r.x), y: sy(r.y), w: r.w * fx, h: r.h * fy }));
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
  if (a.pts) { a.pts = a.pts.map(p => (p[2] == null ? f(p).map(r2) : [...f(p).map(r2), p[2]])); return a; }
  if ('x1' in a) { [a.x1, a.y1] = f([a.x1, a.y1]); [a.x2, a.y2] = f([a.x2, a.y2]); return a; }
  if (a.rects) {
    a.rects = a.rects.map(r => { const p1 = f([r.x, r.y]), p2 = f([r.x + r.w, r.y + r.h]); return { x: Math.min(p1[0], p2[0]), y: Math.min(p1[1], p2[1]), w: Math.abs(p2[0] - p1[0]), h: Math.abs(p2[1] - p1[1]) }; });
    a.vert = !a.vert;
    return a;
  }
  if (['rect', 'hl', 'white', 'ellipse', 'redact'].includes(a.t)) {
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
function markDirty() { if (REC.mr) recStamp(); if (S.shareSess) mentionScan(); const was = S.dirty; S.dirty = true; updateTitle(); scheduleAutosave(); if (!was && S.file) fileState(); }
function updateTitle() {
  const n = $('#docName');
  n.textContent = S.docName + (S.sample ? ' · Beispiel' : '') + (S.dirty && !S.sample ? ' ●' : '');
  n.title = S.docName;
}

