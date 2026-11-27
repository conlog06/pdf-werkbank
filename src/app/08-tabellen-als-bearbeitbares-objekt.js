/* ---------- Tabellen als bearbeitbares Objekt ---------- */
const TBL_PAD = 3;
function tableGeom(a) {
  const rows = a.rows.length || 1, cols = Math.max(1, ...a.rows.map(r => r.length));
  const cw = a.cw && a.cw.length === cols ? a.cw : Array(cols).fill(1), sum = cw.reduce((s, x) => s + x, 0);
  const xs = [a.x]; for (const c of cw) xs.push(xs[xs.length - 1] + a.w * c / sum);
  const rh = a.h / rows, ys = Array.from({ length: rows + 1 }, (_, i) => a.y + i * rh);
  return { rows, cols, xs, ys, rh };
}
function tableFit(a) { const g = tableGeom(a); return Math.min(a.size || 10, g.rh * 0.62); }
function cellText(s, w, size) { const max = Math.max(1, Math.floor((w - 2 * TBL_PAD) / (size * 0.5))); s = String(s == null ? '' : s); return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s; }
function tableSVG(a) {
  const g = tableGeom(a), c = a.color || '#1b2130', fs = tableFit(a), num = s => /^[-+−]?[\d.,\s]+%?$|^[-+−]?[\d.,]+\s?(€|\$|EUR)$/.test(String(s).trim());
  let o = `<g class="table"><rect x="${r2(a.x)}" y="${r2(a.y)}" width="${r2(a.w)}" height="${r2(a.h)}" fill="#ffffff"/>`;
  if (a.head) o += `<rect x="${r2(a.x)}" y="${r2(a.y)}" width="${r2(a.w)}" height="${r2(g.rh)}" fill="#3e63dd" fill-opacity="0.12"/>`;
  if (a.zebra) for (let r = a.head ? 2 : 1; r < g.rows; r += 2) o += `<rect x="${r2(a.x)}" y="${r2(g.ys[r])}" width="${r2(a.w)}" height="${r2(g.rh)}" fill="#000" fill-opacity="0.045"/>`;
  o += `<rect x="${r2(a.x)}" y="${r2(a.y)}" width="${r2(a.w)}" height="${r2(a.h)}" fill="none" stroke="${c}" stroke-width="0.9"/>`;
  for (let i = 1; i < g.cols; i++) o += `<line x1="${r2(g.xs[i])}" y1="${r2(a.y)}" x2="${r2(g.xs[i])}" y2="${r2(a.y + a.h)}" stroke="${c}" stroke-width="0.5"/>`;
  for (let i = 1; i < g.rows; i++) o += `<line x1="${r2(a.x)}" y1="${r2(g.ys[i])}" x2="${r2(a.x + a.w)}" y2="${r2(g.ys[i])}" stroke="${c}" stroke-width="${i === 1 && a.head ? 0.9 : 0.5}"/>`;
  a.rows.forEach((row, r) => row.forEach((s, ci) => {
    if (s == null || s === '') return;
    const w = g.xs[ci + 1] - g.xs[ci], right = num(s) && !(a.head && r === 0);
    const tx = right ? g.xs[ci + 1] - TBL_PAD : g.xs[ci] + TBL_PAD, ty = g.ys[r] + g.rh / 2 + fs * 0.35;
    o += `<text x="${r2(tx)}" y="${r2(ty)}" font-family='${FONTS.Helvetica.css}' font-size="${r2(fs)}"${a.head && r === 0 ? ' font-weight="700"' : ''}${right ? ' text-anchor="end"' : ''} fill="${c}">${esc(cellText(s, w, fs))}</text>`;
  }));
  return o + '</g>';
}
/* für den Export: Tabelle in Linien, Flächen und Texte zerlegen (bleibt Vektor und durchsuchbar) */
function tableParts(a) {
  const g = tableGeom(a), c = a.color || '#1b2130', fs = tableFit(a), out = [], num = s => /^[-+−]?[\d.,\s]+%?$|^[-+−]?[\d.,]+\s?(€|\$|EUR)$/.test(String(s).trim());
  out.push({ id: a.id + 'w', t: 'white', x: a.x, y: a.y, w: a.w, h: a.h });
  if (a.head) out.push({ id: a.id + 'h', t: 'hl', x: a.x, y: a.y, w: a.w, h: g.rh, color: '#3e63dd', op: 12 });
  if (a.zebra) for (let r = a.head ? 2 : 1; r < g.rows; r += 2) out.push({ id: a.id + 'z' + r, t: 'hl', x: a.x, y: g.ys[r], w: a.w, h: g.rh, color: '#000000', op: 4.5 });
  out.push({ id: a.id + 'b', t: 'rect', x: a.x, y: a.y, w: a.w, h: a.h, color: c, sw: 0.9 });
  for (let i = 1; i < g.cols; i++) out.push({ id: a.id + 'c' + i, t: 'line', x1: g.xs[i], y1: a.y, x2: g.xs[i], y2: a.y + a.h, color: c, sw: 0.5 });
  for (let i = 1; i < g.rows; i++) out.push({ id: a.id + 'r' + i, t: 'line', x1: a.x, y1: g.ys[i], x2: a.x + a.w, y2: g.ys[i], color: c, sw: i === 1 && a.head ? 0.9 : 0.5 });
  a.rows.forEach((row, r) => row.forEach((s, ci) => {
    if (s == null || s === '') return;
    const w = g.xs[ci + 1] - g.xs[ci], txt = cellText(s, w, fs), right = num(s) && !(a.head && r === 0), bold = !!(a.head && r === 0);
    const tw = measure(txt, { size: fs, font: 'Helvetica', bold });
    out.push({ id: a.id + 't' + r + '_' + ci, t: 'text', x: right ? g.xs[ci + 1] - TBL_PAD - tw : g.xs[ci] + TBL_PAD, y: g.ys[r] + g.rh / 2 + fs * 0.35 - FONT('Helvetica').bl * fs, text: txt, color: c, size: fs, font: 'Helvetica', bold });
  }));
  return out;
}
function parseTable(src) {
  const lines = String(src).replace(/\r/g, '').split('\n'); while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const sep = lines.some(l => l.includes('\t')) ? '\t' : lines.some(l => l.includes('|')) ? '|' : ';';
  return lines.map(l => (sep === '|' ? l.replace(/^\s*\|/, '').replace(/\|\s*$/, '') : l).split(sep).map(x => x.trim()));
}
function tableDialog(p, a) {
  const isNew = !a;
  const src = a ? a.rows.map(r => r.join(' | ')).join('\n') : 'Spalte A | Spalte B | Spalte C\n | | \n | | ';
  dialog(isNew ? 'Tabelle einfügen' : 'Tabelle bearbeiten', `
    <p class="note" style="margin:0 0 8px">Eine Zeile pro Tabellenzeile, Zellen mit <b>|</b> trennen. Aus Excel oder Numbers kopierte Zellen einfach einfügen.</p>
    <textarea class="field" id="tbSrc" rows="8" style="width:100%;font:13px/1.5 var(--f-mono);white-space:pre">${esc(src)}</textarea>
    <div class="frow" style="margin-top:8px;gap:14px;flex-wrap:wrap">
      <label class="chk"><input type="checkbox" id="tbHead"${!a || a.head ? ' checked' : ''}> Erste Zeile als Kopf</label>
      <label class="chk"><input type="checkbox" id="tbZebra"${a && a.zebra ? ' checked' : ''}> Zeilen abwechselnd tönen</label>
      <label class="fld" style="margin:0"><span>Schriftgröße</span><input class="field" id="tbSize" type="number" min="5" max="24" value="${a ? a.size || 10 : 10}" style="width:70px"></label>
    </div>`, isNew ? 'Einfügen' : 'Übernehmen', b => {
    const rows = parseTable($('#tbSrc', b).value); if (!rows.length) return false;
    const cols = Math.max(...rows.map(r => r.length)); for (const r of rows) while (r.length < cols) r.push('');
    const size = clamp(+$('#tbSize', b).value || 10, 5, 24), head = $('#tbHead', b).checked, zebra = $('#tbZebra', b).checked;
    pushHist();
    if (isNew) {
      p = p || S.pages[S.cur]; const [W] = dims(p), [cx, cy] = viewCenter(p);
      const w = Math.min(W - 40, Math.max(160, cols * 90)), h = rows.length * size * 1.9;
      a = { id: uid(), t: 'table', x: clamp(cx - w / 2, 10, W - w - 10), y: Math.max(10, cy - h / 2), w, h, rows, head, zebra, size, color: '#1b2130' };
      p.annots.push(a); setTool('select'); S.sel = { pid: p.id, aid: a.id };
    } else {
      const rh = a.h / a.rows.length; Object.assign(a, { rows, head, zebra, size }); a.h = Math.max(rh, size * 1.4) * rows.length;
      if (a.cw && a.cw.length !== cols) delete a.cw;
    }
    markDirty(); drawAnnots(p); renderProps();
    if (isNew) toast('Tabelle eingefügt · Doppelklick zum Bearbeiten');
  });
}

/* ---------- QR-Code als Bild ---------- */
function qrDialog() {
  if (!window.qrcode) { toast('QR-Codes sind hier nicht verfügbar.'); return; }
  const def = S.share && window.WBShare ? window.WBShare.linkOf(S.share.token) : '';
  dialog('QR-Code einfügen', `<label class="fld"><span>Link oder Text</span><input class="field" id="qrText" value="${esc(def)}" placeholder="https://…" style="width:100%"></label>
    <div id="qrPrev" style="display:grid;place-items:center;min-height:170px;margin-top:6px"></div>`, 'Einfügen', b => {
    const t = $('#qrText', b).value.trim(); if (!t) return false;
    let q; try { q = window.qrcode(0, 'M'); q.addData(t); q.make(); } catch (e) { toast('Der Text ist zu lang für einen QR-Code.'); return false; }
    const n = q.getModuleCount(), m = 3, k = 12, c = document.createElement('canvas'); c.width = c.height = (n + 2 * m) * k;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (q.isDark(r, col)) ctx.fillRect((col + m) * k, (r + m) * k, k, k);
    placeImage(registerImage(c.toDataURL('image/png'), 'png', c.width, c.height), 110);
  });
  const prev = () => { const t = $('#qrText').value.trim(), el = $('#qrPrev'); if (!t) { el.innerHTML = '<span class="note">Vorschau</span>'; return; } try { const q = window.qrcode(0, 'M'); q.addData(t); q.make(); const n = q.getModuleCount(); let d = ''; for (let r = 0; r < n; r++) for (let c2 = 0; c2 < n; c2++) if (q.isDark(r, c2)) d += `M${c2 + 2} ${r + 2}h1v1h-1z`; el.innerHTML = `<svg viewBox="0 0 ${n + 4} ${n + 4}" width="160" height="160" style="background:#fff;border-radius:8px"><path d="${d}"/></svg>`; } catch (e) { el.innerHTML = '<span class="note">Zu lang</span>'; } };
  $('#qrText').addEventListener('input', prev); prev();
}

/* ---------- Versionsverlauf (Bibliothek): automatische Zwischenstände ---------- */
const VER_MAX = 15, VER_GAP = 10 * 60e3;
async function versionList(id) {
  const keys = (await idbKeys()).map(String).filter(k => k.startsWith('ver:' + id + ':'));
  return keys.map(k => +k.split(':').pop()).sort((a, b) => b - a);
}
async function snapshotVersion(force, label) {
  if (!S.lib || !S.pages.length) return;
  try {
    const id = S.lib.id, list = await versionList(id);
    if (!force && list.length && Date.now() - list[0] < VER_GAP) return;
    const st = docState(); st.dirty = false;
    for (const sid of st.srcIds) if (!(await idbGet(`vsrc:${id}:${sid}`))) { const s = S.sources.get(sid); if (s) await idbSet(`vsrc:${id}:${sid}`, { name: s.name, bytes: s.bytes }); }
    const notes = S.pages.reduce((n, p) => n + p.annots.length, 0);
    await idbSet(`ver:${id}:${Date.now()}`, { state: st, pages: S.pages.length, notes, label: label || '' });
    const all = await versionList(id);
    // benannte Versionen bleiben (bis 30), automatische nur die letzten VER_MAX
    let auto = 0, named = 0;
    for (const ts of all) { const v = await idbGet(`ver:${id}:${ts}`); if (v && v.label) { if (++named > 30) await idbDel(`ver:${id}:${ts}`); } else if (++auto > VER_MAX) await idbDel(`ver:${id}:${ts}`); }
    // Quellen aufräumen, die keine Version mehr braucht
    const need = new Set();
    for (const ts of await versionList(id)) { const v = await idbGet(`ver:${id}:${ts}`); for (const sid of (v && v.state.srcIds) || []) need.add(sid); }
    for (const k of (await idbKeys()).map(String)) if (k.startsWith(`vsrc:${id}:`) && !need.has(k.split(':').pop())) await idbDel(k);
  } catch (e) { console.warn('Version sichern', e); }
}
async function versionsDialog() {
  if (!S.lib) { toast('Den Versionsverlauf gibt es für Dokumente in der Bibliothek.'); return; }
  await snapshotVersion(false);
  const id = S.lib.id, list = await versionList(id);
  const metas = await Promise.all(list.map(async ts => { const v = await idbGet(`ver:${id}:${ts}`); return { ts, pages: v ? v.pages : 0, notes: v ? v.notes : 0, label: (v && v.label) || '' }; }));
  const fmt = ts => new Date(ts).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  dialog('Versionsverlauf', metas.length ? `<p class="note" style="margin:0 0 10px">Beim Arbeiten wird höchstens alle 10 Minuten ein Zwischenstand auf diesem Gerät gesichert (die letzten ${VER_MAX}).</p>
    <div class="verlist">${metas.map((m, i) => `<div class="ver${m.label ? ' named' : ''}"><div style="flex:1;min-width:0"><b>${m.label ? esc(m.label) + ' · ' : ''}${fmt(m.ts)}</b>${i === 0 ? ' <span class="note">· neuester</span>' : ''}<div class="note">${m.pages} ${m.pages === 1 ? 'Seite' : 'Seiten'} · ${m.notes} eigene Elemente</div><div class="vdiff" data-vd="${m.ts}" hidden></div></div><button class="btn" data-cmp="${m.ts}">Vergleichen</button><button class="btn" data-ver="${m.ts}">Wiederherstellen</button></div>`).join('')}</div>
    <div class="row2"><button class="btn" data-vsave="1">${icon('save')}Jetzt Version mit Namen speichern …</button></div>`
    : '<p class="note">Noch keine Versionen. Sie entstehen automatisch beim Bearbeiten.</p>', 'Schließen', () => true);
  $('#dlgCancel').hidden = true;
  $('#dlgBody').onclick = async e => {
    if (e.target.closest('[data-vsave]')) { closeDlg(); await saveNamedVersion(); versionsDialog(); return; }
    const cmp = e.target.closest('[data-cmp]');
    if (cmp) {
      const box = $(`[data-vd="${cmp.dataset.cmp}"]`); if (!box.hidden) { box.hidden = true; return; }
      const v = await idbGet(`ver:${id}:${cmp.dataset.cmp}`); if (!v) return;
      const d = versionDiff(v.state, docState());
      const parts = [d.added && `${d.added} neu`, d.changed && `${d.changed} geändert`, d.removed && `${d.removed} entfernt`, d.pagesAdded && `${d.pagesAdded} Seiten dazu`, d.pagesRemoved && `${d.pagesRemoved} Seiten weg`].filter(Boolean);
      box.innerHTML = parts.length ? `<b>Seitdem:</b> ${parts.join(' · ')}${d.per.length ? `<br>${d.per.slice(0, 12).map(x => `<button class="lnk" data-vpg="${x.n}">S. ${x.n}</button> ${[x.ad && '+' + x.ad, x.ch && '~' + x.ch, x.rm && '−' + x.rm].filter(Boolean).join(' ')}`).join(' · ')}` : ''}` : 'Keine Unterschiede zum aktuellen Stand.';
      box.hidden = false; return;
    }
    const vp = e.target.closest('[data-vpg]'); if (vp) { closeDlg(); scrollToPage(+vp.dataset.vpg - 1); return; }
    const b = e.target.closest('[data-ver]'); if (!b) return;
    const v = await idbGet(`ver:${id}:${b.dataset.ver}`); if (!v) return;
    $('#dlgOk').click();
    await snapshotVersion(true);
    busy(true, 'Version wird wiederhergestellt …');
    try {
      await applyState(JSON.parse(JSON.stringify(v.state)), async sid => S.sources.get(sid) || await idbGet(`vsrc:${id}:${sid}`));
      busy(false); markDirty(); toast('Version vom ' + fmt(+b.dataset.ver) + ' wiederhergestellt · der vorherige Stand liegt als neueste Version bereit');
    } catch (er) { busy(false); toast('Wiederherstellen fehlgeschlagen: ' + (er.message || er)); }
  };
}

/* ---------- Sepia (augenschonend) ---------- */
function setSepia(on) {
  S.sepia = on; pagesEl.classList.toggle('sepia', on); lsSet('pdfwb.sepia', on ? '1' : '0');
  if (on && S.night) setNight(false);
  const m = $('#mSepia'); if (m) m.textContent = (on ? '✓ ' : '') + 'Sepia-Lesefarbe';
}

/* ---------- Dokument-Statistik ---------- */
async function statsDialog() {
  busy(true, 'Dokument wird gezählt …');
  try {
    let words = 0, chars = 0, empty = 0;
    const kinds = {};
    for (const p of S.pages) {
      const { text } = await pageText(p);
      const w = text.split(/\s+/).filter(x => /[\p{L}\p{N}]/u.test(x)).length; words += w; chars += text.replace(/\s/g, '').length; if (!w) empty++;
      for (const a of p.annots) { const k = a.t === 'mark' ? 'mark' : noteGroup(a) === 'draw' ? 'draw' : a.t; kinds[k] = (kinds[k] || 0) + 1; }
    }
    const bytes = [...S.sources.values()].reduce((s, x) => s + x.bytes.byteLength, 0);
    const label = { mark: 'Textmarkierungen', draw: 'Zeichnungen', text: 'Textfelder', note: 'Notizen', img: 'Bilder', hl: 'Flächenmarkierungen', graph: 'Live-Graphen', table: 'Tabellen', stamp: 'Stempel', white: 'Abdeckungen', redact: 'Schwärzungen', measure: 'Maße' };
    const rows = [['Seiten', S.pages.length], ['Wörter', words.toLocaleString('de-DE')], ['Zeichen (ohne Leerzeichen)', chars.toLocaleString('de-DE')], ['Lesezeit', words ? '≈ ' + Math.max(1, Math.round(words / 230)) + ' Min.' : '–'], ['Seiten ohne Text (Scan/Handschrift)', empty], ['Lesezeichen', S.bookmarks.length], ['Original-PDFs', S.sources.size + ' · ' + (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB']]
      .concat(Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => [label[k] || TOOL_NAMES[k] || k, n]));
    busy(false);
    dialog('Dokument-Statistik', `<table class="stattbl">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`).join('')}</table>`, 'Schließen', () => true);
    $('#dlgCancel').hidden = true;
  } catch (e) { busy(false); toast('Statistik fehlgeschlagen: ' + (e.message || e)); }
}

/* ---------- Markierungen und Kommentare als Text ---------- */
function exportMarks() {
  const out = [];
  S.pages.forEach((p, i) => {
    const items = p.annots.filter(a => (a.t === 'mark' && a.text) || a.comment || (a.t === 'note' && a.text))
      .sort((a, b) => (a.rects ? a.rects[0].y : a.y || 0) - (b.rects ? b.rects[0].y : b.y || 0));
    for (const a of items) {
      const kind = a.t === 'note' ? 'Notiz' : a.t === 'mark' ? { hl: 'Markiert', ul: 'Unterstrichen', so: 'Durchgestrichen' }[a.kind] || 'Markiert' : TOOL_NAMES[a.t] || a.t;
      let line = `S. ${i + 1} · ${kind}: ${(a.t === 'mark' ? '„' + a.text.trim().replace(/\s+/g, ' ') + '“' : (a.text || '').trim())}`;
      if (a.comment) line += `\n    Kommentar${a.author ? ' (' + a.author + ')' : ''}: ${a.comment}`;
      out.push(line);
    }
  });
  if (!out.length) { toast('Keine Textmarkierungen, Notizen oder Kommentare im Dokument.'); return; }
  const name = S.docName.replace(/\.pdf$/i, ''), txt = `Markierungen aus „${name}“\n${'='.repeat(20)}\n\n` + out.join('\n\n') + '\n';
  dialog('Markierungen', `<p class="note" style="margin:0 0 8px">${out.length} Einträge mit Seitenzahl.</p><textarea class="field" readonly rows="12" style="width:100%;font:12.5px/1.5 var(--f-mono)">${esc(txt)}</textarea>`, 'Als TXT speichern', () => { saveBytes(new TextEncoder().encode(txt), name + ' – Markierungen.txt'); });
  const c = document.createElement('button'); c.className = 'btn'; c.textContent = 'Kopieren'; c.style.marginRight = 'auto';
  c.onclick = () => navigator.clipboard.writeText(txt).then(() => toast('In die Zwischenablage kopiert'), () => {});
  const acts = $('#dlgOk').parentElement; acts.insertBefore(c, acts.firstChild);
  const done = () => { c.remove(); $('#dlg').removeEventListener('click', clean, true); };
  const clean = e => { if (e.target.closest('#dlgOk,#dlgCancel')) setTimeout(done, 0); };
  $('#dlg').addEventListener('click', clean, true);
}

/* ===================== Version 1.7 ===================== */
const closeDlg = () => { $('#dlg').hidden = true; $('#dlgOk').onclick = $('#dlgCancel').onclick = null; $('#dlgOk').disabled = false; $('#dlgCancel').hidden = false; };
/* Quelle austauschen (Texterkennung, Verkleinern): gleiche Seiten, gleiche Lage – Markierungen bleiben gültig.
   Die neue Fassung bekommt eine eigene Kennung (Bibliothek und Sync speichern sie so sicher neu, Rückgängig zeigt wieder die alte). */
async function replaceSource(id, bytes) {
  const s = S.sources.get(id); if (!s) return id;
  const pdf = await PDFJS.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  if (pdf.numPages !== s.pdf.numPages) { pdf.destroy(); throw new Error('Seitenzahl hat sich verändert'); }
  const nid = uid('s');
  S.sources.set(nid, { id: nid, name: s.name, bytes, pdf });
  for (let i = 0; i < pdf.numPages; i++) S.proxies.set(nid + ':' + i, await pdf.getPage(i + 1));
  for (const p of S.pages) if (p.src === id) p.src = nid;
  for (const [k, v] of [...S.paperSrc]) if (v === id) S.paperSrc.set(k, nid);
  if (S.decrypted.has(id)) S.decrypted.add(nid);
  charCache.clear(); citemCache.clear();
  for (const p of S.pages) if (p.src === nid && hasCE(p)) await ensureDerived(p).catch(() => {});
  return nid;
}
const usedSources = () => [...new Set(S.pages.map(p => p.src))].filter(id => S.sources.has(id));

/* ---------- Texterkennung (OCR) ---------- */
function ocrDialog() {
  if (!window.WBTools) { toast('Die Texterkennung ist hier nicht verfügbar.'); return; }
  dialog('Texterkennung (OCR)', `<p class="note" style="margin:0">Macht eingescannte Seiten und Fotos durchsuchbar: Text lässt sich danach suchen, markieren, kopieren und vorlesen. Die Erkennung läuft auf diesem Gerät, nichts wird hochgeladen.</p>
    <div class="frow"><label class="fld"><span>Sprache</span><select class="field" id="ocrLang">${Object.entries(WBTools.LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <label class="fld"><span>Seiten</span><select class="field" id="ocrPages"><option value="auto">Alle Seiten ohne Text</option><option value="cur">Nur diese Seite</option><option value="all">Alle Seiten neu erkennen</option></select></label></div>
    <p class="note" style="margin:0">Beim ersten Mal werden etwa 6 MB Erkennungsdaten geladen.</p>`, 'Text erkennen', b => {
    const langs = $('#ocrLang', b).value, sel = $('#ocrPages', b).value;
    closeDlg(); runOcr(langs, sel); return false;
  });
}
async function runOcr(langs, sel) {
  commitEdit(); if (S.busy) return;
  const cur = S.pages[S.cur];
  const plan = new Map();
  for (const p of sel === 'cur' ? [cur] : S.pages) { if (!plan.has(p.src)) plan.set(p.src, new Set()); plan.get(p.src).add(p.idx); }
  let words = 0, pagesDone = 0, stop = false;
  const total = [...plan.values()].reduce((n, s) => n + s.size, 0);
  const pl = pill(`<span class="spin"></span><span id="ocrMsg">Texterkennung startet …</span><button class="btn" data-x="stop">Abbrechen</button>`, k => { if (k === 'stop') { stop = true; WBTools.stopOcr(); } });
  busy(true, 'Texterkennung läuft …');
  pushHist();
  try {
    for (const [sid, idxs] of plan) {
      if (stop) break;
      const s = S.sources.get(sid); if (!s) continue;
      const r = await WBTools.ocr(s.bytes, {
        langs, mode: sel === 'all' || sel === 'cur' ? 'all' : 'auto', pages: [...idxs],
        onProgress: (d, t, m) => { const el = pl && pl.querySelector('#ocrMsg'); if (el) el.textContent = `${m} (${Math.min(total, pagesDone + d)}/${total})`; },
      });
      pagesDone += idxs.size;
      if (r.bytes) { await replaceSource(sid, r.bytes); words += r.words; }
    }
    busy(false); pill(null);
    if (stop) { toast('Texterkennung abgebrochen'); }
    if (words) { buildViewer(); scrollToPage(S.cur); markDirty(); toast(`${words} Wörter erkannt · Text ist jetzt durchsuchbar`); }
    else if (!stop) toast(sel === 'auto' ? 'Alle Seiten haben schon Text – nichts zu erkennen.' : 'Auf der Seite wurde kein Text erkannt.');
  } catch (e) { console.error(e); busy(false); pill(null); toast(stop ? 'Texterkennung abgebrochen' : 'Texterkennung fehlgeschlagen: ' + (e.message || e)); }
}

/* ---------- PDF verkleinern ---------- */
function compressDialog() {
  if (!window.WBTools) return;
  const size = usedSources().reduce((n, id) => n + S.sources.get(id).bytes.length, 0);
  dialog('PDF verkleinern', `<p class="note" style="margin:0">Aktuelle Größe der Original-PDFs: <b>${WBTools.fmtMB(size)}</b>. Fotos und Scans werden verkleinert und neu komprimiert, ungenutzte Reste entfernt. Text, Schriften, Vektorgrafiken und deine Markierungen bleiben unverändert.</p>
    <div class="radios">${Object.entries(WBTools.LEVELS).map(([k, v]) => `<label class="chkrow"><input type="radio" name="clv" value="${k}" ${k === 'medium' ? 'checked' : ''}> ${v.label}</label>`).join('')}</div>`, 'Verkleinern', b => {
    const level = $('[name=clv]:checked', b).value; closeDlg(); runCompress(level); return false;
  });
}
async function runCompress(level) {
  commitEdit(); if (S.busy) return;
  busy(true, 'PDF wird verkleinert …');
  let before = 0, after = 0, imgs = 0;
  pushHist();
  try {
    for (const sid of usedSources()) {
      const s = S.sources.get(sid);
      const r = await WBTools.compress(s.bytes, { level, onProgress: (d, t, m) => setMsg(`Verkleinern: ${m}`, true) });
      before += r.before;
      if (r.after < r.before * 0.97) { await replaceSource(sid, r.bytes); after += r.after; imgs += r.images; } else after += r.before;
    }
    busy(false);
    if (after < before * 0.97) { buildViewer(); scrollToPage(S.cur); markDirty(); toast(`Verkleinert: ${WBTools.fmtMB(before)} → ${WBTools.fmtMB(after)} (−${Math.round((1 - after / before) * 100)} %)`); }
    else toast(`Die PDF ist schon gut komprimiert (${WBTools.fmtMB(before)}).`);
  } catch (e) { console.error(e); busy(false); toast('Verkleinern fehlgeschlagen: ' + (e.message || e)); }
}

/* ---------- Suchen und schwärzen ---------- */
const RX = {
  email: ['E-Mail-Adressen', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  phone: ['Telefonnummern', /(?:\+|\b0)\d[\d /()–-]{5,}\d\b/g],
  iban: ['IBAN', /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,4})?\b/g],
  money: ['Geldbeträge', /(?:€|EUR)\s?\d[\d.,]*\d|\b\d[\d.]*(?:,\d{1,2})?\s?(?:€|EUR\b|Euro\b)/g],
  date: ['Datumsangaben', /\b\d{1,2}\.\s?\d{1,2}\.\s?(?:\d{4}|\d{2})\b/g],
};
function pageString(p) {
  const ch = charsOf(p); if (!ch) return null;
  let s = ''; const map = [];
  ch.flat.forEach((c, i) => {
    const prev = ch.flat[i - 1];
    if (prev) {
      if (prev.line !== c.line) { s += '\n'; map.push(-1); }
      else if (c.x - (prev.x + prev.w) > Math.max(prev.h, c.h) * 0.22 && prev.ch !== ' ' && c.ch !== ' ') { s += ' '; map.push(-1); }
    }
    for (const _ of c.ch) { s += _; map.push(i); }
  });
  return { s, map, flat: ch.flat };
}
async function findRedactions(terms, kinds, opt) {
  const res = [];
  const rxs = kinds.map(k => RX[k][1]);
  for (const t of terms) {
    let src = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    if (opt.word) src = '(?<![\\p{L}\\p{N}])' + src + '(?![\\p{L}\\p{N}])';
    rxs.push(new RegExp(src, 'gu' + (opt.cs ? '' : 'i')));
  }
  for (const p of S.pages) {
    try { await analysisOf(p); } catch (e) { continue; }
    const ps = pageString(p); if (!ps) continue;
    for (const rx of rxs) {
      rx.lastIndex = 0; let m;
      while ((m = rx.exec(ps.s))) {
        if (!m[0]) { rx.lastIndex++; continue; }
        const idx = []; for (let k = m.index; k < m.index + m[0].length; k++) if (ps.map[k] >= 0) idx.push(ps.map[k]);
        const lines = new Map();
        for (const i of idx) { const c = ps.flat[i]; if (!c.ch.trim()) continue; const b = lines.get(c.line); if (!b) lines.set(c.line, { x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h }); else { b.x0 = Math.min(b.x0, c.x); b.y0 = Math.min(b.y0, c.y); b.x1 = Math.max(b.x1, c.x + c.w); b.y1 = Math.max(b.y1, c.y + c.h); } }
        for (const b of lines.values()) res.push({ p, text: m[0], x: b.x0 - 1, y: b.y0 - 1, w: b.x1 - b.x0 + 2, h: b.y1 - b.y0 + 2 });
      }
    }
  }
  return res;
}
function redactSearchDialog() {
  let found = null;
  dialog('Suchen und schwärzen', `<p class="note" style="margin:0">Findet Begriffe oder persönliche Daten im ganzen Dokument und schwärzt alle Treffer. Der Text darunter wird endgültig aus der PDF gelöscht.</p>
    <label class="fld"><span>Begriffe (mehrere mit Komma trennen)</span><input class="field" id="rsTerms" placeholder="z. B. Max Mustermann, Musterstraße 5"></label>
    <div class="chkgrid">${Object.entries(RX).map(([k, [l]]) => `<label class="chkrow"><input type="checkbox" name="rsk" value="${k}"> ${l}</label>`).join('')}</div>
    <div class="chkgrid"><label class="chkrow"><input type="checkbox" id="rsWord" checked> Nur ganze Wörter</label><label class="chkrow"><input type="checkbox" id="rsCs"> Groß-/Kleinschreibung</label></div>
    <div class="row"><button type="button" class="btn" id="rsFind">Treffer suchen</button><span class="note" id="rsInfo"></span></div>`, 'Alle schwärzen', () => {
    (async () => {
      if (!found) await doFind();
      if (!found || !found.length) return;
      const list = found; closeDlg(); await applyRedactions(list);
    })();
    return false;
  });
  const b = $('#dlgBody');
  const read = () => ({ terms: $('#rsTerms', b).value.split(/[,;\n]/).map(x => x.trim()).filter(x => x.length >= 2), kinds: $$('[name=rsk]:checked', b).map(x => x.value), opt: { word: $('#rsWord', b).checked, cs: $('#rsCs', b).checked } });
  async function doFind() {
    const q = read();
    if (!q.terms.length && !q.kinds.length) { $('#rsInfo', b).textContent = 'Bitte einen Begriff eingeben oder eine Art wählen.'; found = null; return; }
    $('#rsInfo', b).textContent = 'Suche …';
    found = await findRedactions(q.terms, q.kinds, q.opt);
    const pages = new Set(found.map(f => f.p.id)).size;
    $('#rsInfo', b).textContent = found.length ? `${found.length} ${found.length === 1 ? 'Treffer' : 'Treffer'} auf ${pages} ${pages === 1 ? 'Seite' : 'Seiten'}: ${[...new Set(found.map(f => f.text))].slice(0, 4).join(', ')}${found.length > 4 ? ' …' : ''}` : 'Keine Treffer.';
  }
  b.onclick = e => { if (e.target.closest('#rsFind')) doFind(); };
  b.onchange = b.oninput = () => { found = null; };
}
async function applyRedactions(list) {
  busy(true, 'Wird geschwärzt …');
  pushHist();
  const by = new Map(); for (const r of list) { if (!by.has(r.p)) by.set(r.p, []); by.get(r.p).push(r); }
  try {
    for (const [p, rs] of by) {
      const f = d2u(p), ce = newCE(p);
      for (const r of rs) {
        p.annots.push({ id: uid(), t: 'redact', x: r2(r.x), y: r2(r.y), w: r2(r.w), h: r2(r.h) });
        const c1 = f(r.x, r.y), c2 = f(r.x + r.w, r.y + r.h);
        ce.red.push([Math.min(c1[0], c2[0]), Math.min(c1[1], c2[1]), Math.max(c1[0], c2[0]), Math.max(c1[1], c2[1])].map(r2));
      }
      p.ce = ce;
      await ensureDerived(p).catch(e => console.warn(e));
      drawAnnots(p); refreshPage(p);
    }
    busy(false); markDirty(); if (S.find) runFind(S.find.q);
    toast(`${list.length} Stellen auf ${by.size} ${by.size === 1 ? 'Seite' : 'Seiten'} geschwärzt · Text ist aus der PDF entfernt`);
  } catch (e) { console.error(e); busy(false); toast('Schwärzen fehlgeschlagen: ' + (e.message || e)); }
}

/* ---------- Formularfelder erstellen ---------- */
const FIELD_KINDS = { text: 'Textfeld', multi: 'Mehrzeiliges Textfeld', check: 'Kontrollkästchen', choice: 'Auswahlliste', date: 'Datum', sig: 'Unterschriftsfeld' };
const FIELD_SIZE = { text: [180, 20], multi: [260, 70], check: [13, 13], choice: [160, 20], date: [100, 20], sig: [200, 42] };
function fieldSVG(a) {
  const c = a.color || '#3e63dd', x = r2(a.x), y = r2(a.y), w = r2(a.w), h = r2(a.h);
  let o = `<g class="field"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" fill-opacity="0.08" stroke="${c}" stroke-width="0.8" stroke-dasharray="${a.kind === 'check' ? '' : '3 2'}" rx="${a.kind === 'check' ? 1.5 : 2}"/>`;
  const fs = Math.min(11, Math.max(6, h * 0.55)), ty = r2(a.y + Math.min(h, fs * 1.55) / 2 + fs * 0.36);
  const T = (s, col, extra = '') => `<text x="${r2(a.x + 3)}" y="${ty}" font-family='${FONTS.Helvetica.css}' font-size="${r2(fs)}" fill="${col}" ${extra}>${esc(s)}</text>`;
  if (a.kind === 'check') { if (a.value) o += `<path d="M${x + w * 0.2} ${y + h * 0.55}l${w * 0.22} ${h * 0.22} ${w * 0.4}-${h * 0.5}" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`; }
  else if (a.kind === 'sig') o += `<line x1="${r2(a.x + 6)}" y1="${r2(a.y + h - 8)}" x2="${r2(a.x + w - 6)}" y2="${r2(a.y + h - 8)}" stroke="${c}" stroke-width="0.6"/><text x="${r2(a.x + 6)}" y="${r2(a.y + h - 2)}" font-family='${FONTS.Helvetica.css}' font-size="5.5" fill="${c}">Unterschrift · ${esc(a.name || '')}</text>`;
  else {
    o += a.value ? T(cellText(a.value, a.w - 14, fs), '#1b2130') : T(cellText(a.kind === 'date' ? 'TT.MM.JJJJ' : a.name || '', a.w - 14, fs), c, 'fill-opacity="0.55"');
    if (a.kind === 'choice') o += `<path d="M${r2(a.x + w - 10)} ${r2(a.y + h / 2 - 1.5)}l3 3 3-3" fill="none" stroke="${c}" stroke-width="1"/>`;
  }
  if (a.req) o += `<text x="${r2(a.x + w - 2)}" y="${r2(a.y + 6)}" text-anchor="end" font-size="7" fill="#c4352b">*</text>`;
  return o + '</g>';
}
function uniqueFieldName(base, skip) {
  const names = new Set(S.pages.flatMap(p => p.annots.filter(a => a.t === 'field' && a !== skip).map(a => a.name)));
  let n = base || 'Feld', k = 2; while (names.has(n)) n = (base || 'Feld') + ' ' + k++;
  return n;
}
function fieldDialog(p, a) {
  const isNew = !a;
  const cur = a || { kind: 'text', name: '', value: '', options: [], req: false };
  dialog(isNew ? 'Formularfeld einfügen' : 'Formularfeld', `<div class="frow"><label class="fld"><span>Art</span><select class="field" id="ffKind">${Object.entries(FIELD_KINDS).map(([k, v]) => `<option value="${k}" ${k === cur.kind ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="fld"><span>Name</span><input class="field" id="ffName" value="${esc(cur.name)}" placeholder="z. B. Vorname"></label></div>
    <label class="fld" id="ffOptW"><span>Auswahlmöglichkeiten (eine pro Zeile)</span><textarea class="field area" id="ffOpts" rows="4">${esc((cur.options || []).join('\n'))}</textarea></label>
    <label class="fld" id="ffValW"><span>Vorausgefüllt</span><input class="field" id="ffVal" value="${esc(cur.kind === 'check' ? '' : cur.value || '')}"></label>
    <label class="chkrow" id="ffChkW"><input type="checkbox" id="ffChk" ${cur.kind === 'check' && cur.value ? 'checked' : ''}> Angekreuzt</label>
    <label class="chkrow"><input type="checkbox" id="ffReq" ${cur.req ? 'checked' : ''}> Pflichtfeld</label>
    <p class="note" style="margin:0">Wird als echtes PDF-Formularfeld gespeichert, das man in Acrobat, Vorschau, Browsern und Apps ausfüllen kann. Größe und Lage änderst du wie bei jedem Element.</p>`, isNew ? 'Einfügen' : 'Übernehmen', b => {
    const kind = $('#ffKind', b).value, name = $('#ffName', b).value.trim() || FIELD_KINDS[kind];
    const options = $('#ffOpts', b).value.split('\n').map(s => s.trim()).filter(Boolean);
    if (kind === 'choice' && !options.length) { toast('Bitte mindestens eine Auswahlmöglichkeit eintragen.'); return false; }
    const value = kind === 'check' ? $('#ffChk', b).checked : $('#ffVal', b).value;
    pushHist();
    if (isNew) {
      p = S.pages[S.cur]; const [W, H] = dims(p), [w, h] = FIELD_SIZE[kind], [cx, cy] = viewCenter(p);
      a = { id: uid(), t: 'field', kind, x: r2(clamp(cx - w / 2, 8, W - w - 8)), y: r2(clamp(cy - h / 2, 8, H - h - 8)), w, h, color: '#3e63dd' };
      p.annots.push(a);
    } else if (a.kind !== kind) { const [w, h] = FIELD_SIZE[kind]; if (kind === 'check' || a.kind === 'check') { a.w = w; a.h = h; } }
    Object.assign(a, { kind, name: uniqueFieldName(name, a), options, value: kind === 'choice' && value && !options.includes(value) ? '' : value, req: $('#ffReq', b).checked });
    drawAnnots(p); markDirty(); if (isNew) select(p.id, a.id);
    toast(isNew ? `${FIELD_KINDS[kind]} „${a.name}“ eingefügt` : 'Formularfeld geändert');
  });
  const b = $('#dlgBody');
  const sync = () => { const k = $('#ffKind', b).value; $('#ffOptW', b).hidden = k !== 'choice'; $('#ffValW', b).hidden = k === 'check' || k === 'sig'; $('#ffChkW', b).hidden = k !== 'check'; };
  b.onchange = sync; sync();
}
/* vorhandene Formularlinien (_____ oder ……) und Kästchen (☐) als Felder erkennen */
async function detectFields() {
  commitEdit();
  busy(true, 'Formular wird erkannt …');
  const add = [];
  for (const p of S.pages) {
    try { await analysisOf(p); } catch (e) { continue; }
    const ps = pageString(p); if (!ps) continue;
    const have = p.annots.filter(a => a.t === 'field');
    const free = b => !have.some(f => f.x < b.x + b.w && b.x < f.x + f.w && f.y < b.y + b.h && b.y < f.y + f.h);
    const rx = /(_{5,}|\.{8,}|…{3,})|([☐□❑▢◻])/g; let m;
    while ((m = rx.exec(ps.s))) {
      const idx = []; for (let k = m.index; k < m.index + m[0].length; k++) if (ps.map[k] >= 0) idx.push(ps.map[k]);
      if (!idx.length) continue;
      const cs = idx.map(i => ps.flat[i]), x0 = Math.min(...cs.map(c => c.x)), x1 = Math.max(...cs.map(c => c.x + c.w)), y1 = Math.max(...cs.map(c => c.y + c.h)), hh = Math.max(...cs.map(c => c.h));
      // Beschriftung: Text davor in derselben Zeile
      const lineStart = ps.s.lastIndexOf('\n', m.index - 1) + 1;
      let label = ps.s.slice(lineStart, m.index).replace(/[_.…☐□❑▢◻]+/g, ' ').trim().split(/\s{2,}/).pop() || '';
      label = label.replace(/[:\s]+$/, '').slice(-40);
      let f;
      if (m[2]) { const s = Math.max(8, Math.min(16, hh)); f = { kind: 'check', x: x0, y: y1 - s, w: s, h: s }; const after = ps.s.slice(m.index + 1, (ps.s.indexOf('\n', m.index) + 1 || ps.s.length + 1) - 1).trim().split(/\s{2,}|[☐□❑▢◻]/)[0]; label = (after || label).slice(0, 40); }
      else { const h = Math.max(12, Math.min(20, hh * 1.4)); f = { kind: 'text', x: x0, y: y1 - h + 1, w: Math.max(30, x1 - x0), h }; }
      if (!free(f)) continue;
      have.push(f);
      add.push({ p, a: { id: uid(), t: 'field', ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === 'number' ? r2(v) : v])), name: label || (f.kind === 'check' ? 'Auswahl' : 'Feld'), value: f.kind === 'check' ? false : '', options: [], req: false, color: '#3e63dd' } });
    }
  }
  busy(false);
  if (!add.length) { toast('Keine Formularlinien oder Kästchen gefunden. Felder lassen sich über ⋯ › Einfügen › Formularfeld setzen.'); return; }
  pushHist();
  for (const { p, a } of add) { a.name = uniqueFieldName(a.name); p.annots.push(a); }
  new Set(add.map(x => x.p)).forEach(drawAnnots); markDirty();
  toast(`${add.length} Formularfelder erkannt · Doppelklick ändert Name und Art`);
}
/* Export: echte AcroForm-Felder */
async function exportField(out, pg, a, T, R, used) {
  const { rgb, PDFName, PDFHexString } = PL;
  const form = out.getForm();
  let name = String(a.name || 'Feld').replace(/\./g, '_').trim() || 'Feld', k = 2; const base = name;
  while (used.has(name)) name = base + ' ' + k++;
  used.add(name);
  const c1 = T(a.x, a.y), c2 = T(a.x + a.w, a.y + a.h);
  const x = Math.min(c1[0], c2[0]), y = Math.min(c1[1], c2[1]), w = Math.abs(c2[0] - c1[0]), h = Math.abs(c2[1] - c1[1]);
  const vert = R % 180 !== 0;
  const o = { x, y, width: w, height: h, borderColor: rgb(0.55, 0.6, 0.72), borderWidth: 0.6, backgroundColor: rgb(0.94, 0.96, 1) };
  if (a.kind === 'check') { const f = form.createCheckBox(name); f.addToPage(pg, { ...o, backgroundColor: rgb(1, 1, 1) }); if (a.value) f.check(); if (a.req) f.enableRequired(); return; }
  if (a.kind === 'choice') { const f = form.createDropdown(name); f.setOptions(a.options || []); if (a.value) f.select(a.value); f.addToPage(pg, o); if (a.req) f.enableRequired(); return; }
  if (a.kind === 'sig') {
    const ctx = out.context;
    const ref = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Widget', FT: 'Sig', T: PDFHexString.fromText(name), F: 4, P: pg.ref, Rect: [x, y, x + w, y + h], MK: { BG: [0.94, 0.96, 1], BC: [0.55, 0.6, 0.72] } }));
    pg.node.addAnnot(ref); form.acroForm.addField(ref);
    if (a.req) ctx.lookup(ref).set(PDFName.of('Ff'), ctx.obj(2));
    return;
  }
  const f = form.createTextField(name);
  if (a.kind === 'multi') f.enableMultiline();
  if (a.kind === 'date') { try { f.setMaxLength(10); } catch (e) { /* egal */ } }
  if (a.value) f.setText(winAnsiSafe(String(a.value)));
  f.addToPage(pg, o);
  if (a.kind !== 'multi') f.setFontSize(Math.max(6, Math.min(12, (vert ? w : h) * 0.6)));
  if (a.req) f.enableRequired();
}

