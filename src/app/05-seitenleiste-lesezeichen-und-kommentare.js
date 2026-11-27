/* ---------- Seitenleiste: Lesezeichen und Kommentare ---------- */
function setSideTab(t) {
  S.sideTab = t;
  $$('.stabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  thumbsEl.hidden = t !== 'pages'; $('#marksPanel').hidden = t !== 'marks'; $('#notesPanel').hidden = t !== 'notes'; $('#tasksPanel').hidden = t !== 'tasks'; $('#learnPanel').hidden = t !== 'learn';
  if (t === 'marks') renderMarks();
  if (t === 'notes') renderNotes();
  if (t === 'tasks') renderTasks();
  if (t === 'learn') renderLearn();
  if (t === 'pages') markThumbSel();
}
function openSide(t) {
  if (innerWidth <= 760) work.classList.add('thumbs-open'); else work.classList.remove('nothumbs');
  $('#btnThumbs').setAttribute('aria-pressed', 'true');
  setSideTab(t);
}
let sideT = 0;
function updateSideLater() { clearTimeout(sideT); sideT = setTimeout(() => { updateNoteBadge(); if (S.sideTab === 'notes') renderNotes(); if (S.sideTab === 'marks') renderMarks(); if (S.sideTab === 'tasks') renderTasks(); if (S.sideTab === 'learn') renderLearn(); taskBadge(); }, 220); }
const pageNo = pid => { const i = S.pages.findIndex(p => p.id === pid); return i < 0 ? null : i + 1; };

async function importOutline(srcId, pages) {
  const s = S.sources.get(srcId); if (!s) return [];
  let ol = null;
  try { ol = await s.pdf.getOutline(); } catch (e) { return []; }
  if (!ol || !ol.length) return [];
  const byIdx = new Map(pages.map(p => [p.idx, p.id]));
  let budget = 400;
  const conv = async (items, depth) => {
    const out = [];
    for (const it of items) {
      if (--budget < 0) break;
      let pid = null;
      try {
        let dest = it.dest;
        if (typeof dest === 'string') dest = await s.pdf.getDestination(dest);
        if (Array.isArray(dest) && dest[0] != null) {
          const ix = typeof dest[0] === 'object' ? await s.pdf.getPageIndex(dest[0]) : Number.isInteger(dest[0]) ? dest[0] : null;
          if (ix != null) pid = byIdx.get(ix) || null;
        }
      } catch (e) { pid = null; }
      const kids = depth < 6 && it.items && it.items.length ? await conv(it.items, depth + 1) : [];
      if (pid || kids.length) out.push({ id: uid('b'), title: (it.title || 'Ohne Titel').trim(), pid: pid || kids[0].pid, kids });
    }
    return out;
  };
  return conv(ol, 0);
}
function findMark(id, list = S.bookmarks, parent = null) {
  for (const b of list) { if (b.id === id) return { b, list, parent }; const r = findMark(id, b.kids, b); if (r) return r; }
  return null;
}
function addBookmark() {
  const p = S.pages[S.cur]; if (!p) return;
  const b = { id: uid('b'), title: `Seite ${S.cur + 1}`, pid: p.id, kids: [] };
  // nach Seitenreihenfolge einsortieren
  const i = S.bookmarks.findIndex(x => (pageNo(x.pid) || 1e9) > S.cur + 1);
  if (i < 0) S.bookmarks.push(b); else S.bookmarks.splice(i, 0, b);
  markDirty(); openSide('marks'); renameMark(b.id);
}
function renameMark(id) {
  const row = $(`#marksPanel [data-bid="${id}"]`); if (!row) return;
  const f = findMark(id); if (!f) return;
  const tx = $('.tx', row), inp = document.createElement('input');
  inp.value = f.b.title; inp.setAttribute('aria-label', 'Name des Lesezeichens');
  tx.replaceWith(inp); inp.focus(); inp.select();
  const done = save => { if (save && inp.value.trim()) { f.b.title = inp.value.trim(); markDirty(); } renderMarks(); };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
  inp.addEventListener('blur', () => done(true));
  inp.addEventListener('click', e => e.stopPropagation());
}
function renderMarks() {
  const el = $('#marksPanel');
  const rows = [];
  const walk = (list, depth) => {
    for (const b of list) {
      const n = pageNo(b.pid);
      rows.push(`<div class="sitem" role="button" tabindex="0" data-bid="${b.id}" style="padding-left:${8 + depth * 14}px" title="Doppelklick zum Umbenennen">
        <i data-i="bookmark"></i><span class="tx">${esc(b.title)}</span><span class="pg">${n || '–'}</span><button class="x" data-del="${b.id}" aria-label="Lesezeichen löschen" title="Löschen">×</button></div>`);
      walk(b.kids, depth + 1);
    }
  };
  walk(S.bookmarks, 0);
  el.innerHTML = `<div class="sphead"><span>Lesezeichen</span><button class="btn" id="bmAdd" title="Lesezeichen für die aktuelle Seite">+ Seite ${S.cur + 1}</button></div>` +
    (rows.length ? rows.join('') : '<p class="sempty">Noch keine Lesezeichen. Sie werden beim Speichern als Inhaltsverzeichnis in die PDF geschrieben und in jedem PDF-Programm angezeigt.</p>');
  $$('[data-i]', el).forEach(i => { i.outerHTML = icon(i.dataset.i); });
}
/* Kommentarliste: Art, markierter Text, Kommentar, Seite; filterbar und exportierbar */
const NOTE_FILTERS = [['all', 'Alle'], ['cmt', 'Mit Kommentar'], ['mark', 'Textmarkierungen'], ['note', 'Notizen'], ['draw', 'Zeichnungen und Formen'], ['other', 'Sonstiges']];
const noteGroup = a => (a.t === 'note' ? 'note' : a.t === 'mark' || a.t === 'hl' ? 'mark' : ['pen', 'rect', 'ellipse', 'line', 'arrow', 'check', 'cross'].includes(a.t) ? 'draw' : 'other');
function noteEntry(a) {
  let title = TOOL_NAMES[a.t] || a.t, quote = '', body = '';
  if (a.t === 'note') { title = 'Notiz'; body = a.text || 'Leere Notiz'; }
  else if (a.t === 'mark') { title = { hl: 'Markierung', ul: 'Unterstreichung', so: 'Durchstreichung' }[a.kind]; quote = a.text || ''; }
  else if (a.t === 'text') { title = 'Text'; quote = a.text.split('\n')[0]; }
  else if (a.t === 'stamp' || a.t === 'wm') quote = a.text;
  else if (a.t === 'measure') body = measureLabel(a) + ((a.scale || 1) > 1 ? ` (1 : ${a.scale})` : '');
  else if (a.t === 'pen') title = { fount: 'Füller', ball: 'Kugelschreiber', marker: 'Textmarker' }[penKind(a)] || 'Stift';
  if (a.comment) body = a.comment;
  return { title, quote, body };
}
function renderNotes() {
  const el = $('#notesPanel'), rows = [], f = S.noteFilter || 'all';
  let total = 0;
  S.pages.forEach((p, i) => {
    for (const a of p.annots) {
      if (a.pn) continue;
      total++;
      if (f === 'cmt' ? !(a.comment || (a.t === 'note' && a.text)) : f !== 'all' && noteGroup(a) !== f) continue;
      const { title, quote, body } = noteEntry(a);
      const col = a.t === 'redact' ? '#000000' : a.t === 'white' ? '#ffffff' : a.t === 'img' ? '#9aa1ad' : a.color || '#1b2130';
      rows.push(`<button class="sitem" data-pid="${p.id}" data-aid="${a.id}"><span class="dot" style="background:${col}"></span><span class="tx"><small>${esc(title)}</small>${quote ? `<q>${esc(quote.length > 140 ? quote.slice(0, 139) + '…' : quote)}</q>` : ''}${body ? `<span class="cb">${esc(body)}</span>` : ''}</span><span class="pg">${i + 1}</span></button>`);
    }
  });
  el.innerHTML = `<div class="sphead"><span>Kommentare</span><span>${rows.length === total ? total : rows.length + ' / ' + total}</span></div>
    <div class="nfbar"><select class="field" id="noteFilter" aria-label="Kommentare filtern">${NOTE_FILTERS.map(([k, l]) => `<option value="${k}"${k === f ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <button class="ibtn" id="noteExport" title="Kommentare als Textdatei speichern" aria-label="Kommentare exportieren"${total ? '' : ' disabled'}>${icon('save')}</button>
    <button class="ibtn" id="noteEye" title="${S.prefs.showMarks ? 'Markierungen auf den Seiten ausblenden' : 'Markierungen sind ausgeblendet – einblenden'}" aria-label="Markierungen ein- oder ausblenden" aria-pressed="${!S.prefs.showMarks}">${icon(S.prefs.showMarks ? 'eye' : 'eyeoff')}</button>
    <button class="ibtn" id="noteSettings" title="Einstellungen für Kommentare" aria-label="Einstellungen für Kommentare">${icon('gear')}</button></div>` +
    (rows.length ? rows.join('') : `<p class="sempty">${total ? 'Keine Einträge für diesen Filter.' : 'Noch keine Kommentare. Notizen, Markierungen, Stempel und Zeichnungen erscheinen hier, geordnet nach Seiten. Jedes Element kann über die Sprechblase einen eigenen Kommentar bekommen.'}</p>`);
}
async function exportNotes() {
  const lines = [`Kommentare zu ${S.docName}`, `Erstellt am ${new Date().toLocaleString('de-DE')} von ${commentAuthor()}`, ''];
  S.pages.forEach((p, i) => {
    const list = p.annots.filter(a => !a.pn);
    if (!list.length) return;
    lines.push(`--- Seite ${i + 1} ---`);
    for (const a of list) {
      const { title, quote, body } = noteEntry(a);
      lines.push(`• ${title}${quote ? `: „${quote}“` : ''}`);
      if (body) lines.push(`  ${body.replace(/\n/g, '\n  ')}`);
    }
    lines.push('');
  });
  await saveBytes(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/plain;charset=utf-8' }), baseName() + '-Kommentare.txt');
}
function updateNoteBadge() {
  let n = 0;
  for (const p of S.pages) for (const a of p.annots) if (!a.pn) n++;
  const b = $('#noteBadge'); b.hidden = !n; b.textContent = n > 99 ? '99+' : n;
}
function gotoAnnot(pid, aid) {
  const p = pageById(pid); if (!p) return;
  const a = p.annots.find(x => x.id === aid); if (!a) return;
  setTool('select'); select(p.id, a.id);
  const e = els.get(p.id), b = bbox(a);
  viewer.scrollTo({ top: e.wrap.offsetTop + b.y * S.zoom - viewer.clientHeight * 0.3, left: Math.max(0, e.wrap.offsetLeft + b.x * S.zoom - viewer.clientWidth / 3), behavior: reduceMotion ? 'auto' : 'smooth' });
  setCurrent(S.pages.indexOf(p));
  if (innerWidth <= 760) { work.classList.remove('thumbs-open'); $('#btnThumbs').setAttribute('aria-pressed', 'false'); }
}
/* Lesezeichen als PDF-Gliederung schreiben */
function writeOutline(out, pageList) {
  if (!S.bookmarks.length) return;
  const idx = new Map(pageList.map((p, i) => [p.id, i])), pages = out.getPages(), ctx = out.context;
  const { PDFName, PDFHexString, PDFNumber } = PL;
  const valid = list => list.flatMap(b => {
    const kids = valid(b.kids);
    if (!idx.has(b.pid)) return kids;   // Seite gelöscht: Unterpunkte rücken auf
    return [{ title: b.title, page: pages[idx.get(b.pid)], kids }];
  });
  const items = valid(S.bookmarks);
  if (!items.length) return;
  const count = list => list.reduce((s, b) => s + 1 + count(b.kids), 0);
  const build = (list, parentRef) => {
    const refs = list.map(() => ctx.nextRef());
    list.forEach((b, i) => {
      const d = ctx.obj({ Title: PDFHexString.fromText(b.title), Parent: parentRef, Dest: [b.page.ref, PDFName.of('Fit')] });
      if (i > 0) d.set(PDFName.of('Prev'), refs[i - 1]);
      if (i < list.length - 1) d.set(PDFName.of('Next'), refs[i + 1]);
      if (b.kids.length) {
        const kr = build(b.kids, refs[i]);
        d.set(PDFName.of('First'), kr[0]); d.set(PDFName.of('Last'), kr[kr.length - 1]);
        d.set(PDFName.of('Count'), PDFNumber.of(-count(b.kids)));
      }
      ctx.assign(refs[i], d);
    });
    return refs;
  };
  const rootRef = ctx.nextRef(), top = build(items, rootRef);
  ctx.assign(rootRef, ctx.obj({ Type: 'Outlines', First: top[0], Last: top[top.length - 1], Count: PDFNumber.of(count(items)) }));
  out.catalog.set(PDFName.of('Outlines'), rootRef);
  if (!S.meta.pageMode) out.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}

/* ---------- Formularfelder (AcroForm) ausfüllen ---------- */
const formKey = (src, name) => src + '|' + name;
const formPending = new Map();
function formsOf(p) {
  const k = p.src + ':' + p.idx;
  if (S.forms.has(k)) return Promise.resolve(S.forms.get(k));
  if (!formPending.has(k)) formPending.set(k, (async () => {
    let list = [];
    try {
      const anns = await S.proxies.get(k).getAnnotations({ intent: 'display' });
      list = anns.filter(a => a.subtype === 'Widget' && a.fieldName && ['Tx', 'Btn', 'Ch'].includes(a.fieldType) && !a.pushButton && !a.hidden).map(a => ({
        name: a.fieldName, type: a.fieldType === 'Tx' ? 'text' : a.fieldType === 'Ch' ? 'choice' : a.radioButton ? 'radio' : 'check',
        rect: a.rect, multi: !!a.multiLine, ro: !!a.readOnly, max: a.maxLen || 0,
        options: (a.options || []).map(o => [o.exportValue, o.displayValue]),
        on: a.radioButton ? a.buttonValue : a.exportValue || 'Yes',
        init: a.fieldValue, fs: (a.defaultAppearanceData && a.defaultAppearanceData.fontSize) || 0,
        bc: a.borderColor && a.borderColor.length === 3 ? Array.from(a.borderColor) : null,
        bw: a.borderStyle && a.borderStyle.width != null ? a.borderStyle.width : 1,
      }));
    } catch (e) { list = []; }
    S.forms.set(k, list); formPending.delete(k);
    return list;
  })());
  return formPending.get(k);
}
function formValue(p, f) {
  const k = formKey(p.src, f.name);
  if (k in S.formVals) return S.formVals[k];
  if (f.type === 'check') return f.init != null && f.init !== 'Off' && (f.init === f.on || f.init === true);
  if (f.type === 'radio') return f.init && f.init !== 'Off' ? String(f.init) : '';
  return Array.isArray(f.init) ? f.init.join(', ') : f.init == null ? '' : String(f.init);
}
function setFormValue(p, f, v) {
  S.formVals[formKey(p.src, f.name)] = v;
  S.formTouched.add(p.src);
  // gleiche Felder auf anderen Seiten mitziehen
  for (const q of S.pages) if (q.src === p.src) { const e = els.get(q.id); if (e && e.forml) syncFormLayer(q); }
  markDirty();
}
async function buildFormLayer(p) {
  const e = els.get(p.id); if (!e) return;
  const list = await formsOf(p);
  if (!list.length || els.get(p.id) !== e) return;
  const [W, H] = dims(p), vp = S.proxies.get(p.src + ':' + p.idx).getViewport({ scale: 1, rotation: rotOf(p) });
  e.forml.innerHTML = '';
  list.forEach((f, i) => {
    const r = vp.convertToViewportRectangle(f.rect), x = Math.min(r[0], r[2]), y = Math.min(r[1], r[3]), w = Math.abs(r[2] - r[0]), h = Math.abs(r[3] - r[1]);
    let el;
    if (f.type === 'text') { el = document.createElement(f.multi ? 'textarea' : 'input'); if (!f.multi) el.type = 'text'; if (f.max) el.maxLength = f.max; }
    else if (f.type === 'choice') { el = document.createElement('select'); el.innerHTML = '<option value=""></option>' + f.options.map(([v, d]) => `<option value="${esc(v)}">${esc(d)}</option>`).join(''); }
    else { el = document.createElement('button'); el.type = 'button'; el.setAttribute('role', f.type === 'radio' ? 'radio' : 'checkbox'); }
    el.className = 'ff'; el.dataset.fi = i; el.title = f.name; el.setAttribute('aria-label', f.name);
    if (f.ro) el.disabled = true;
    const fs = f.fs || clamp((f.multi ? 10 : h * 0.62), 6, 12);
    Object.assign(el.style, { left: x / W * 100 + '%', top: y / H * 100 + '%', width: w / W * 100 + '%', height: h / H * 100 + '%' });
    el.style.setProperty('--fs', fs + 'px');
    if (f.bc && f.bw > 0) el.style.setProperty('--fbc', `rgb(${f.bc.join(',')})`);
    if (f.type === 'radio') el.style.borderRadius = '50%';
    el.addEventListener('pointerdown', ev => ev.stopPropagation());
    if (f.type === 'text') el.addEventListener('input', () => setFormValue(p, f, el.value));
    else if (f.type === 'choice') el.addEventListener('change', () => setFormValue(p, f, el.value));
    else el.addEventListener('click', () => {
      if (f.type === 'check') setFormValue(p, f, !formValue(p, f));
      else setFormValue(p, f, formValue(p, f) === f.on ? '' : f.on);
    });
    el.addEventListener('keydown', ev => ev.stopPropagation());
    e.forml.append(el);
  });
  syncFormLayer(p);
}
function syncFormLayer(p) {
  const e = els.get(p.id), list = S.forms.get(p.src + ':' + p.idx);
  if (!e || !e.forml || !list) return;
  for (const el of e.forml.children) {
    const f = list[+el.dataset.fi], v = formValue(p, f);
    if (f.type === 'check' || f.type === 'radio') { const on = f.type === 'check' ? !!v : v === f.on; el.textContent = on ? (f.type === 'radio' ? '●' : '✓') : ''; el.setAttribute('aria-checked', String(on)); }
    else if (document.activeElement !== el) el.value = v;
  }
}
/* Beim Speichern: Werte als Seiteninhalt einzeichnen, die ausgefüllten Felder werden dabei eingebettet */
async function drawFormValues(pg, p, getFont, clean) {
  if (!S.formTouched.has(p.src)) return;
  const list = await formsOf(p); if (!list.length) return;
  const font = await getFont('Helvetica', false), black = PL.rgb(0.07, 0.07, 0.1);
  for (const f of list) {
    const v = formValue(p, f), [x0, y0, x1, y1] = [Math.min(f.rect[0], f.rect[2]), Math.min(f.rect[1], f.rect[3]), Math.max(f.rect[0], f.rect[2]), Math.max(f.rect[1], f.rect[3])];
    const w = x1 - x0, h = y1 - y0;
    // Rahmen des Feldes bleibt sichtbar, auch wenn das Feld selbst eingebettet wird
    if (f.bc && f.bw > 0) {
      const bc = PL.rgb(f.bc[0] / 255, f.bc[1] / 255, f.bc[2] / 255);
      if (f.type === 'radio') pg.drawCircle({ x: x0 + w / 2, y: y0 + h / 2, size: Math.min(w, h) / 2 - f.bw / 2, borderColor: bc, borderWidth: f.bw });
      else pg.drawRectangle({ x: x0 + f.bw / 2, y: y0 + f.bw / 2, width: w - f.bw, height: h - f.bw, borderColor: bc, borderWidth: f.bw });
    }
    if (f.type === 'check' && v) {
      const s = Math.min(w, h) * 0.8, cx = x0 + w / 2, cy = y0 + h / 2;
      pg.drawSvgPath(`M ${cx - s * 0.35} ${-(cy + 0.02 * s)} L ${cx - s * 0.08} ${-(cy - 0.28 * s)} L ${cx + s * 0.4} ${-(cy + 0.32 * s)}`, { x: 0, y: 0, borderColor: black, borderWidth: Math.max(0.8, s * 0.12), borderLineCap: PL.LineCapStyle.Round });
    } else if (f.type === 'radio' && v === f.on) {
      pg.drawCircle({ x: x0 + w / 2, y: y0 + h / 2, size: Math.min(w, h) * 0.25, color: black });
    } else if ((f.type === 'text' || f.type === 'choice') && v) {
      const label = f.type === 'choice' ? ((f.options.find(o => o[0] === v) || [v, v])[1]) : v;
      const size = f.fs || clamp(f.multi ? 10 : h * 0.62, 6, 12);
      const lines = f.multi ? String(label).split('\n') : [String(label).replace(/\n/g, ' ')];
      lines.forEach((ln, i) => {
        const y = f.multi ? y1 - 2 - size * 0.9 - i * size * 1.15 : y0 + (h - size * 0.7) / 2;
        if (y < y0 - 1) return;
        pg.drawText(clean(font, ln), { x: x0 + 2, y, size, font, color: black });
      });
    }
  }
  // Widgets der Felder entfernen, die Werte stehen jetzt fest im Seiteninhalt
  const annots = pg.node.Annots(); if (!annots) return;
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1);
  const keep = [];
  for (let i = 0; i < annots.size(); i++) {
    const ref = annots.get(i), d = annots.lookup(i);
    const st = d && d.lookup ? d.lookup(PL.PDFName.of('Subtype')) : null, rect = d && d.lookup ? d.lookup(PL.PDFName.of('Rect')) : null;
    const r = rect && rect.asArray ? rect.asArray().map(n => n.asNumber ? n.asNumber() : 0) : null;
    const isField = st && st.toString() === '/Widget' && r && list.some(f => near([Math.min(f.rect[0], f.rect[2]), Math.min(f.rect[1], f.rect[3]), Math.max(f.rect[0], f.rect[2]), Math.max(f.rect[1], f.rect[3])], [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])]));
    if (!isField) keep.push(ref);
  }
  pg.node.set(PL.PDFName.of('Annots'), pg.doc.context.obj(keep));
}

/* ---------- Lesemodus und Nachtmodus ---------- */
function setReading(on) {
  commitEdit();
  S.reading = on;
  document.body.classList.toggle('reading', on);
  $('#readbar').hidden = !on;
  if (on) {
    if (S.tool !== 'select') setTool('select');
    const el = document.documentElement, r = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null;
    if (r && r.catch) r.catch(() => {});
  } else if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  setTimeout(fitWidth, 60);
  updateStatus();
}
function setNight(on) {
  S.night = on; if (on && S.sepia) setSepia(false);
  pagesEl.classList.toggle('night', on);
  lsSet('pdfwb.night', on ? '1' : '0');
  $('#readNight').setAttribute('aria-pressed', String(on));
  $('#mNight').textContent = (on ? '✓ ' : '') + 'Nachtmodus für Seiten';
}

/* ---------- Teilen (iPad/iPhone: Teilen-Menü) ---------- */
function canShareFiles() {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; }
}
async function sharePdf() {
  commitEdit(); if (S.busy) return;
  busy(true, 'PDF wird für das Teilen erstellt …');
  let file;
  try { file = new File([await buildPdf(S.pages)], baseName() + '-bearbeitet.pdf', { type: 'application/pdf' }); }
  catch (e) { console.error(e); busy(false); toast('Die PDF konnte nicht erstellt werden.'); return; }
  busy(false);
  // Teilen braucht eine frische Nutzeraktion, deshalb noch ein Tippen
  if (!await ask('PDF ist bereit', `„${file.name}“ über das Teilen-Menü senden, speichern oder in einer anderen App öffnen.`, 'Teilen', 'Abbrechen', false)) return;
  try { await navigator.share({ files: [file], title: file.name }); }
  catch (e) { if (!e || e.name !== 'AbortError') toast('Teilen ist hier nicht möglich. Bitte „Speichern“ verwenden.'); }
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
function scheduleAutosave() {
  if (S.sample || !S.pages.length) return;
  if (S.shareSess) { S.shareSess.changed(); if (!S.lib) return; }
  clearTimeout(autoT);
  if (S.lib) { libState('pending'); autoT = setTimeout(libSave, 1200); return; }
  autoT = setTimeout(autosave, 1500);
}
/* kompletter Bearbeitungsstand (Seiten, Elemente, Lesezeichen, Formulare); Quellen-PDFs separat */
function docState(imgIds) {
  if (!imgIds) { imgIds = new Set(); for (const p of S.pages) for (const a of p.annots) if (a.img) imgIds.add(a.img); }
  return {
    v: 1, savedAt: Date.now(), docName: S.docName, meta: S.meta, pages: S.pages, srcIds: [...S.sources.keys()],
    images: [...S.images].filter(([id]) => imgIds.has(id)), uidN, blankSrc: S.blankSrc, dirty: S.dirty,
    bookmarks: S.bookmarks, formVals: S.formVals, formTouched: [...S.formTouched], paperSrc: [...S.paperSrc],
    recs: S.recs || [], cards: S.cards || [], cite: S.cite || null, exams: S.exams || [], receipts: S.receipts || [],
  };
}
/* gespeicherten Stand in den Editor laden (Sitzung oder Bibliothek) */
async function applyState(sess, sourceOf) {
  uidN = Math.max(uidN, sess.uidN || 0) + 1;
  for (const id of sess.srcIds) {
    if (S.sources.has(id)) continue;
    const src = await sourceOf(id);
    if (!src) throw new Error('Quelle fehlt');
    await addSource(src.bytes, src.name, id);
  }
  S.images = new Map(sess.images || []);
  S.pages = sess.pages; S.docName = sess.docName; S.meta = sess.meta || S.meta; S.blankSrc = sess.blankSrc || null;
  S.recs = sess.recs || []; S.cards = sess.cards || []; S.audio = new Map(); savedAud.clear();
  S.cite = sess.cite || null; S.exams = sess.exams || []; S.receipts = sess.receipts || []; S.einv = null;
  S.bookmarks = sess.bookmarks || []; S.formVals = sess.formVals || {}; S.formTouched = new Set(sess.formTouched || []); S.paperSrc = new Map(sess.paperSrc || []);
  S.sample = false; S.dirty = !!sess.dirty; S.hist = []; S.fut = []; S.cur = 0;
  await Promise.all(S.pages.filter(hasCE).map(ensureDerived));
  S.zoom = initialZoom(); buildViewer(); updateTitle(); updateUndo();
}
async function autosave() {
  try {
    for (const s of S.sources.values()) if (!savedSrc.has(s.id)) { await idbSet('src:' + s.id, { name: s.name, bytes: s.bytes }); savedSrc.add(s.id); }
    const imgIds = new Set();
    for (const p of S.pages) for (const a of p.annots) if (a.img) imgIds.add(a.img);
    await idbSet(sessKey(), docState(imgIds));
    await persistAudio();
    // Quellen behalten, die irgendeine gespeicherte Sitzung braucht (mehrere Fenster der Desktop-App)
    const keys = await idbKeys(), keep = new Set([...S.sources.keys()].map(k => 'src:' + k));
    for (const k of keys) if (String(k).startsWith('session') && k !== sessKey()) { try { const o = await idbGet(k); for (const id of (o && o.srcIds) || []) keep.add('src:' + id); } catch (e) { /* egal */ } }
    for (const k of keys) if (String(k).startsWith('src:') && !keep.has(k)) { await idbDel(k); savedSrc.delete(String(k).slice(4)); }
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
    await applyState(sess, async id => { const s = await idbGet('src:' + id); if (s) savedSrc.add(id); return s; });
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

/* ---------- Markierungen als echte PDF-Kommentare ---------- */
const EXPORTABLE = new Set(['mark', 'hl', 'pen', 'rect', 'ellipse', 'line', 'arrow', 'text', 'stamp']);
const PDF_MARK = { hl: 'Highlight', ul: 'Underline', so: 'StrikeOut' };
const commentAuthor = () => S.prefs.author || S.meta.author || 'PDF Werkbank';
function addTextNote(out, pg, [x, y], text, color) {
  const c = hex2rgb(color), ctx = out.context;
  const ann = ctx.obj({
    Type: 'Annot', Subtype: 'Text', F: 4, Name: 'Comment', Open: false, Rect: [x, y - 16, x + 16, y],
    Contents: PL.PDFHexString.fromText(text), T: PL.PDFHexString.fromText(commentAuthor()), M: PL.PDFString.fromDate(new Date()), C: [c.red, c.green, c.blue],
  });
  pg.node.addAnnot(ctx.register(ann));
}
async function exportAnnot(out, pg, a, T, R, getFont) {
  const { PDFName, PDFHexString, PDFString } = PL, ctx = out.context;
  const col = hex2rgb(a.color || '#000000'), C = [col.red, col.green, col.blue];
  const n = v => Math.round(v * 1000) / 1000;
  const rgbOp = op => `${n(C[0])} ${n(C[1])} ${n(C[2])} ${op}`;
  const pathOps = sg => sg.map(sx => {
    if (sx[0] === 'Z') return 'h';
    const pts = [];
    for (let i = 1; i < sx.length; i += 2) { const q = T(sx[i], sx[i + 1]); pts.push(n(q[0]), n(q[1])); }
    return pts.join(' ') + ' ' + { M: 'm', L: 'l', C: 'c' }[sx[0]];
  }).join(' ');
  const vb = bbox(a), pad = (a.sw || 1) + 2;
  const cs = [[vb.x - pad, vb.y - pad], [vb.x + vb.w + pad, vb.y - pad], [vb.x - pad, vb.y + vb.h + pad], [vb.x + vb.w + pad, vb.y + vb.h + pad]].map(([x, y]) => T(x, y));
  const rect = [Math.min(...cs.map(q => q[0])), Math.min(...cs.map(q => q[1])), Math.max(...cs.map(q => q[0])), Math.max(...cs.map(q => q[1]))].map(n);
  const extra = {}, res = {};
  let subtype, ops = '', contents = a.comment || '';
  const useGS = gs => { res.ExtGState = { G0: { Type: 'ExtGState', ...gs } }; ops = '/G0 gs ' + ops; };
  const textOps = async (font, fname, size, color, lines) => {
    const th = R * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
    res.Font = { ...(res.Font || {}), [fname]: font.ref };
    return lines.map(([str, x, y]) => {
      if (!str) return '';
      const [px, py] = T(x, y), enc = font.encodeText(Array.from(str).map(ch => { try { font.encodeText(ch); return ch; } catch (e) { return '?'; } }).join(''));
      return `BT /${fname} ${n(size)} Tf ${color} ${n(c)} ${n(s)} ${n(-s)} ${n(c)} ${n(px)} ${n(py)} Tm ${enc.toString()} Tj ET`;
    }).join(' ');
  };
  switch (a.t) {
    case 'mark': case 'hl': {
      const rects = a.t === 'mark' ? a.rects : [{ x: a.x, y: a.y, w: a.w, h: a.h }], kind = a.t === 'hl' ? 'hl' : a.kind;
      subtype = PDF_MARK[kind];
      extra.QuadPoints = rects.flatMap(r => [T(r.x, r.y), T(r.x + r.w, r.y), T(r.x, r.y + r.h), T(r.x + r.w, r.y + r.h)].flat()).map(n);
      if (kind === 'hl') {
        const op = (a.op || 40) / 100;
        ops = rgbOp('rg') + ' ' + rects.map(r => pathOps([['M', r.x, r.y], ['L', r.x + r.w, r.y], ['L', r.x + r.w, r.y + r.h], ['L', r.x, r.y + r.h], ['Z']]) + ' f').join(' ');
        useGS({ ca: op, CA: op, BM: 'Multiply' }); extra.CA = op;
      } else ops = rgbOp('RG') + ' ' + markSegs({ ...a, kind, rects }).map(([, q]) => `${n(q.w)} w ` + pathOps(q.d) + ' S').join(' ');
      // wie in Acrobat: markierter Text im Kommentar, eigener Kommentar hat Vorrang
      if (a.text) contents = a.comment ? `${a.comment}\n\n„${a.text}“` : a.text;
      break;
    }
    case 'pen': {
      subtype = 'Ink';
      extra.InkList = [a.pts.flatMap(q => T(q[0], q[1]).map(n))];
      extra.BS = { W: a.sw };
      ops = penKind(a) === 'fount' ? rgbOp('rg') + ' ' + pathOps(penOutline(a)) + ' f' : `${n(a.sw)} w 1 J 1 j ` + rgbOp('RG') + ' ' + pathOps(segs(a)) + ' S';
      const op = (a.op == null ? 100 : a.op) / 100;
      if (op < 1 || penKind(a) === 'marker') { useGS({ ca: op, CA: op, ...(penKind(a) === 'marker' ? { BM: 'Multiply' } : {}) }); extra.CA = op; }
      break;
    }
    case 'rect': case 'ellipse':
      subtype = a.t === 'rect' ? 'Square' : 'Circle'; extra.BS = { W: a.sw };
      {
        const da = dashOf(a), fo = FILL_OP[a.fill];
        if (da) { extra.BS = { W: a.sw, S: PDFName.of('D'), D: da.map(n) }; }
        const dop = da ? `[${da.map(n).join(' ')}] 0 d ${a.dash === 'dot' ? '1 J ' : ''}` : '';
        if (fo) {
          extra.IC = C;
          ops = rgbOp('rg') + ' ' + pathOps(segs(a)) + ' f ';
          if (fo < 1) { res.ExtGState = { G0: { Type: 'ExtGState', ca: fo }, G1: { Type: 'ExtGState', ca: 1 } }; ops = '/G0 gs ' + ops + '/G1 gs '; }
        }
        ops += `${n(a.sw)} w ${dop}` + rgbOp('RG') + ' ' + pathOps(segs(a)) + ' S';
      }
      break;
    case 'line': case 'arrow':
      subtype = 'Line'; extra.L = [...T(a.x1, a.y1), ...T(a.x2, a.y2)].map(n); extra.BS = { W: a.sw };
      if (a.t === 'arrow') extra.LE = [PDFName.of('None'), PDFName.of('OpenArrow')];
      {
        const da = dashOf(a), sg = segs(a);
        if (da) { extra.BS = { W: a.sw, S: PDFName.of('D'), D: da.map(n) }; ops = `${n(a.sw)} w 1 J 1 j [${da.map(n).join(' ')}] 0 d ` + rgbOp('RG') + ' ' + pathOps(sg.slice(0, 2)) + ' S' + (sg.length > 2 ? ' [] 0 d ' + pathOps(sg.slice(2)) + ' S' : ''); }
        else ops = `${n(a.sw)} w 1 J 1 j ` + rgbOp('RG') + ' ' + pathOps(sg) + ' S';
      }
      break;
    case 'text': {
      subtype = 'FreeText';
      const font = await getFont(a.font, a.bold), f = FONT(a.font);
      const W = textWidth(a), lines = a.text.split('\n').map((ln, i) => [ln, lineX(a, ln, W), a.y + f.bl * a.size + i * LH * a.size]);
      if (a.bg) { const bc = hex2rgb(a.bg), b = bbox(a), pd = a.size * 0.18; ops += `${n(bc.red)} ${n(bc.green)} ${n(bc.blue)} rg ` + pathOps([['M', b.x - pd, b.y - pd * 0.4], ['L', b.x + b.w + pd, b.y - pd * 0.4], ['L', b.x + b.w + pd, b.y + b.h + pd * 0.4], ['L', b.x - pd, b.y + b.h + pd * 0.4], ['Z']]) + ' f '; }
      ops += await textOps(font, 'F0', a.size, rgbOp('rg'), lines);
      extra.DA = PDFString.of(`/Helv ${n(a.size)} Tf ${rgbOp('rg')}`);
      contents = a.text + (a.comment ? '\n\n' + a.comment : '');
      break;
    }
    case 'stamp': {
      subtype = 'Stamp'; extra.Name = PDFName.of('Approved');
      const g = stampGeom(a), font = await getFont('Helvetica', true);
      const x = a.x + g.sw / 2, y = a.y + g.sw / 2, w = g.w - g.sw, h = g.h - g.sw;
      ops = `${n(g.sw)} w ` + rgbOp('RG') + ' ' + pathOps([['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']]) + ' S ';
      ops += await textOps(font, 'F0', a.size, rgbOp('rg'), [[a.text, a.x + g.pad, a.y + g.base]]);
      contents = a.comment || a.text;
      break;
    }
    default: return false;
  }
  const ap = ctx.register(ctx.flateStream(ops, { Type: 'XObject', Subtype: 'Form', FormType: 1, BBox: rect, Resources: res }));
  const dict = ctx.obj({
    Type: 'Annot', Subtype: subtype, Rect: rect, F: 4, C, NM: PDFHexString.fromText(a.id),
    T: PDFHexString.fromText(commentAuthor()), M: PDFString.fromDate(new Date()), Contents: PDFHexString.fromText(contents), AP: { N: ap }, ...extra,
  });
  pg.node.addAnnot(ctx.register(dict));
  return true;
}

/* ---------- PDF erzeugen und speichern ---------- */
/* zuletzt gezeichneten Inhaltsstrom von pdf-lib an den Anfang der Seite stellen (= unter den Seiteninhalt) */
function sinkStream(pg) {
  const ref = pg.contentStreamRef; if (!ref) return;
  const arr = pg.node.Contents(), i = arr && typeof arr.indexOf === 'function' ? arr.indexOf(ref) : null;
  if (i == null) return;
  arr.remove(i); arr.insert(0, ref);
  pg.contentStream = undefined; pg.contentStreamRef = undefined;
}
async function buildPdf(pageList) {
  const conv = await pagesForExport(pageList);
  try { return await buildPdfInner(conv.pages); } finally { for (const id of conv.temp) S.images.delete(id); }
}
async function buildPdfInner(pageList) {
  const { PDFDocument, StandardFonts, degrees, LineCapStyle, BlendMode, rgb } = PL;
  await ensureFontsOf(pageList); // Textbreiten (Ausrichtung, Hintergrund) mit der echten Schrift messen
  const out = await PDFDocument.create();
  const libDocs = new Map(), fontCache = new Map(), imgCache = new Map();
  let fkReady = false;
  const getFont = async (name, bold) => {
    const f = FONT(name);
    if (f.file) {
      const key = f.file + (bold && !f.noBold ? 'B' : '');
      if (!fontCache.has(key)) {
        try {
          if (!fkReady) { out.registerFontkit(await loadFontkit()); fkReady = true; }
          fontCache.set(key, await out.embedFont(await fontFile(name, bold), { subset: true }));
        } catch (e) { console.warn('Schrift', name, e); toast('Schrift „' + f.label + '“ nicht verfügbar, ersatzweise Helvetica'); fontCache.set(key, await getFont('Helvetica', bold)); }
      }
      return fontCache.get(key);
    }
    const key = f.std[bold ? 1 : 0];
    if (!fontCache.has(key)) fontCache.set(key, await out.embedFont(StandardFonts[key]));
    return fontCache.get(key);
  };
  const clean = (font, str) => Array.from(str.replace(/\t/g, '    ')).map(ch => { try { font.encodeText(ch); return ch; } catch (e) { return '?'; } }).join('');
  const usedFields = new Set();
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
    // Elemente „hinter dem PDF-Inhalt“ kommen zuerst in einen eigenen Inhaltsstrom, der vor den Seiteninhalt gestellt wird
    const unders = p.annots.filter(a => a.under && a.t !== 'note');
    let sunk = !unders.length;
    for (const a of unders.concat(p.annots.filter(a => !(a.under && a.t !== 'note')))) {
      if (!sunk && !a.under) { sinkStream(pg); sunk = true; }
      // als bearbeitbarer PDF-Kommentar speichern (mit eigener Darstellung)
      if (S.prefs.exportMarks === 'annots' && EXPORTABLE.has(a.t) && !a.under) {
        try { if (await exportAnnot(out, pg, a, T, R, getFont)) continue; } catch (e) { console.warn('Kommentar wird eingebettet', e); }
      }
      if (a.t === 'mark') {
        for (const [k, q] of markSegs(a)) {
          if (k === 'fill') pg.drawSvgPath(dOf(q, svgMap), { x: 0, y: 0, color: hex2rgb(a.color), opacity: (a.op || 40) / 100, blendMode: BlendMode.Multiply });
          else pg.drawSvgPath(dOf(q.d, svgMap), { x: 0, y: 0, borderColor: hex2rgb(a.color), borderWidth: q.w });
        }
      } else if (a.t === 'text') {
        const font = await getFont(a.font, a.bold), f = FONT(a.font);
        if (a.bg) {
          const b = bbox(a), pd = a.size * 0.18, x = b.x - pd, y = b.y - pd * 0.4, w = b.w + 2 * pd, h = b.h + pd * 0.8;
          pg.drawSvgPath(dOf([['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']], svgMap), { x: 0, y: 0, color: hex2rgb(a.bg) });
        }
        const W = textWidth(a);
        a.text.split('\n').forEach((ln, i) => {
          if (!ln) return;
          const [x, y] = T(lineX(a, ln, W), a.y + f.bl * a.size + i * LH * a.size);
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
      } else if (a.t === 'field') {
        try { await exportField(out, pg, a, T, R, usedFields); } catch (e) { console.warn('Formularfeld', e); }
        continue;
      } else if (a.t === 'note') {
        const p1 = T(a.x, a.y + NOTE), p2 = T(a.x + NOTE, a.y), c = hex2rgb(a.color);
        const ann = out.context.obj({
          Type: 'Annot', Subtype: 'Text', F: 4, Name: 'Comment', Open: false,
          Rect: [Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]), Math.max(p1[0], p2[0]), Math.max(p1[1], p2[1])],
          Contents: PL.PDFHexString.fromText(a.text || ''), T: PL.PDFHexString.fromText(S.meta.author || 'PDF Werkbank'),
          M: PL.PDFString.fromDate(new Date()), C: [c.red, c.green, c.blue],
        });
        pg.node.addAnnot(out.context.register(ann));
      } else if (a.t === 'pen' && penKind(a) === 'fount') {
        pg.drawSvgPath(dOf(penOutline(a), svgMap), { x: 0, y: 0, color: hex2rgb(a.color), opacity: a.op / 100 });
      } else if (a.t === 'measure') {
        const col = hex2rgb(a.color), g = measureGeom(a), font = await getFont('Helvetica', false);
        pg.drawSvgPath(dOf(segs(a), svgMap), { x: 0, y: 0, borderColor: col, borderWidth: a.sw, borderLineCap: LineCapStyle.Round });
        const th = g.ang * Math.PI / 180, loc = (u, v) => [g.mx + u * Math.cos(th) - v * Math.sin(th), g.my + u * Math.sin(th) + v * Math.cos(th)];
        const w = font.widthOfTextAtSize(g.label, g.size), x0 = -w / 2 - 2, y0 = -g.size - 4, x1 = w / 2 + 2, y1 = -1;
        const box = [loc(x0, y0), loc(x1, y0), loc(x1, y1), loc(x0, y1)];
        pg.drawSvgPath(dOf([['M', ...box[0]], ['L', ...box[1]], ['L', ...box[2]], ['L', ...box[3]], ['Z']], svgMap), { x: 0, y: 0, color: rgb(1, 1, 1), opacity: 0.85 });
        const [tx, ty] = T(...loc(-w / 2, -4));
        pg.drawText(g.label, { x: tx, y: ty, size: g.size, font, color: col, rotate: degrees(R - g.ang) });
      } else {
        const d = dOf(segs(a), svgMap), o = { x: 0, y: 0 };
        if (a.t === 'hl') Object.assign(o, { color: hex2rgb(a.color), opacity: a.op / 100, blendMode: BlendMode.Multiply });
        else if (a.t === 'white') Object.assign(o, { color: rgb(1, 1, 1) });
        else if (a.t === 'redact') Object.assign(o, { color: rgb(0, 0, 0) });
        else {
          Object.assign(o, { borderColor: hex2rgb(a.color), borderWidth: a.sw });
          if (a.t !== 'rect' && a.t !== 'ellipse') o.borderLineCap = LineCapStyle.Round;
          const da = (a.t === 'rect' || a.t === 'ellipse' || a.t === 'line') && dashOf(a);
          if (da) { o.borderDashArray = da; if (a.dash === 'dot') o.borderLineCap = LineCapStyle.Round; }
          if ((a.t === 'rect' || a.t === 'ellipse') && FILL_OP[a.fill]) Object.assign(o, { color: hex2rgb(a.color), opacity: FILL_OP[a.fill] });
          if (a.t === 'arrow' && dashOf(a)) {
            const sg = segs(a);
            pg.drawSvgPath(dOf(sg.slice(0, 2), svgMap), { ...o, borderDashArray: dashOf(a) });
            pg.drawSvgPath(dOf(sg.slice(2), svgMap), o);
            o.done = true;
          }
          if (a.t === 'pen' && a.op < 100) o.borderOpacity = a.op / 100;
          if (a.t === 'pen' && penKind(a) === 'marker') o.blendMode = BlendMode.Multiply;
        }
        if (!o.done) pg.drawSvgPath(d, o);
      }
      // Kommentar eines eingebetteten Elements bleibt als Notiz erhalten
      if (a.comment && a.t !== 'note') { const b = bbox(a); addTextNote(out, pg, T(b.x + b.w, b.y), a.comment, a.color || '#ffd400'); }
    }
    if (!sunk) sinkStream(pg);
    await drawFormValues(pg, p, getFont, clean);
  }
  writeOutline(out, pageList);
  out.setProducer('PDF Werkbank'); out.setCreator('PDF Werkbank'); out.setModificationDate(new Date());
  const m = S.meta;
  if (m.title) out.setTitle(m.title, { showInWindowTitleBar: true });
  if (m.lang) out.catalog.set(PL.PDFName.of('Lang'), PL.PDFString.of(m.lang));
  if (m.author) out.setAuthor(m.author);
  if (m.subject) out.setSubject(m.subject);
  if (m.keywords) out.setKeywords(m.keywords.split(/[,;]\s*/).filter(Boolean));
  if (m.pageMode) out.catalog.set(PL.PDFName.of('PageMode'), PL.PDFName.of(m.pageMode));
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
  // Desktop-App: echter Speichern-Dialog des Systems
  if (window.wbDesktop && window.wbDesktop.saveFile) {
    try {
      const r = await window.wbDesktop.saveFile(filename, new Uint8Array(await blob.arrayBuffer()));
      if (r && r.path) { toast(`Gespeichert: ${r.path}`); return true; }
      toast('Speichern abgebrochen'); return false;
    } catch (e) { toast('Speichern fehlgeschlagen: ' + (e.message || e)); return false; }
  }
  // als App auf dem Home-Bildschirm (iPad, iPhone, Android): über das Teilen-Menü in „Dateien“ sichern
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare({ files: [file] })) {
        // Teilen braucht eine frische Berührung; nach dem Erzeugen der PDF ist die oft abgelaufen
        if (navigator.userActivation && !navigator.userActivation.isActive && !await ask('Datei ist bereit', `„${filename}“ über das Teilen-Menü in „Dateien“ sichern oder an eine App senden.`, 'Teilen', 'Abbrechen', false)) return false;
        await navigator.share({ files: [file], title: filename }); return true;
      }
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

