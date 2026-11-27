/* ======================= Version 1.9 ======================= */
const dlTo = (bytes, name, type = 'application/octet-stream') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000); };
const cleanFile = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
async function docText(pages = S.pages, max = 26000) {
  let text = '';
  for (const p of pages) {
    const i = S.pages.indexOf(p);
    try { await analysisOf(p); const ps = pageString(p); if (ps && ps.s.trim()) text += `\n[Seite ${i + 1}]\n` + ps.s; } catch (e) { /* weiter */ }
    if (text.length > max) break;
  }
  return text.slice(0, max);
}
const aiReady = () => !!(AIX && AIX.info().ready);
const aiJson = (out, arr = true) => JSON.parse((String(out).match(arr ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/) || [arr ? '[]' : '{}'])[0]);

/* ---------- 1. Zitieren und Literatur ---------- */
const citeStyle = () => lsGet('pdfwb.citestyle') || 'apa';
const citePage = p => (S.pages.indexOf(p) + 1) + ((S.cite && +S.cite.offset) || 0);
function citeForm(r) {
  const T = WBCite.TYPES, f = (k, l, ph = '', w = '') => `<label class="fld"${w ? ` style="grid-column:span ${w}"` : ''}><span>${l}</span><input class="field" data-c="${k}" value="${esc(r[k] || '')}" placeholder="${esc(ph)}"></label>`;
  return `<div class="cgrid">
    <label class="fld"><span>Art</span><select class="field" data-c="type">${Object.entries(T).map(([k, v]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    ${f('year', 'Jahr', '2024')}
    <label class="fld" style="grid-column:span 2"><span>Autorinnen und Autoren</span><input class="field" data-c="authors" value="${esc(WBCite.authorsText(r.authors))}" placeholder="Nachname, Vorname; Nachname, Vorname"></label>
    ${f('title', 'Titel', '', 2)}
    ${f('container', r.type === 'article' ? 'Zeitschrift' : 'Sammelband / Reihe', '', 2)}
    ${f('publisher', 'Verlag / Hochschule')}${f('place', 'Ort')}
    ${f('edition', 'Auflage', '3')}${f('pages', 'Seiten', '45–67')}
    ${f('volume', 'Jahrgang / Band')}${f('issue', 'Heft / Nr.')}
    ${f('doi', 'DOI', '10.…')}${f('isbn', 'ISBN')}
    ${f('url', 'URL (bei Webseiten)')}${f('accessed', 'Abgerufen am', new Date().toLocaleDateString('de-DE'))}
  </div>`;
}
function citeRead(b) {
  const r = {}; $$('[data-c]', b).forEach(i => { r[i.dataset.c] = i.value.trim(); });
  r.authors = WBCite.parseAuthors(r.authors); return r;
}
async function citeDialog(then) {
  if (!window.WBCite) return;
  commitEdit();
  const r = (S.cite && S.cite.ref) || WBCite.fromMeta(S.meta, S.docName);
  const st = citeStyle();
  dialog('Quellenangabe und Zitieren', `<p class="note" style="margin:0">Einmal eintragen, dann kopiert <b>Zitieren</b> markierten Text mit Beleg und Seitenzahl. DOI oder ISBN im Dokument werden automatisch nachgeschlagen.</p>
    <div class="row2"><button type="button" class="btn" data-cx="find">${icon('search')}Automatisch ausfüllen</button><span class="note" id="cMsg"></span></div>
    ${citeForm(r)}
    <div class="frow"><label class="fld"><span>Zitierstil</span><select class="field" id="cStyle">${Object.entries(WBCite.STYLES).map(([k, v]) => `<option value="${k}" ${k === st ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="fld"><span>Erste PDF-Seite ist Buchseite</span><input class="field num" type="number" id="cOff" value="${1 + ((S.cite && +S.cite.offset) || 0)}" min="-999" max="9999"></label></div>
    <div class="cprev" id="cPrev"></div>
    <div class="row2"><button type="button" class="btn" data-cx="copy">${icon('copy')}Literaturangabe kopieren</button><button type="button" class="btn" data-cx="bib">BibTeX (.bib)</button><button type="button" class="btn" data-cx="ris">Zotero / Citavi (.ris)</button></div>`, 'Speichern', b => {
    S.cite = { ref: citeRead(b), offset: (+$('#cOff', b).value || 1) - 1 };
    lsSet('pdfwb.citestyle', $('#cStyle', b).value);
    markDirty(); toast('Quellenangabe gespeichert');
    if (then) setTimeout(then, 50);
  });
  $('#dlg .card').classList.add('wide');
  const b = $('#dlgBody');
  const prev = () => { const ref = citeRead(b), s = $('#cStyle', b).value; const e = WBCite.entry(ref, s, 1); const q = WBCite.quote('…', ref, s, (+$('#cOff', b).value || 1) + S.cur); $('#cPrev', b).innerHTML = `<small>Literaturverzeichnis</small><p>${e.html}</p><small>Im Text (Seite ${S.cur + 1} der PDF)</small><p>${esc(q.text)}${q.foot ? '<br>' + esc(q.foot) : ''}</p>`; };
  b.oninput = b.onchange = prev; prev();
  b.onclick = async e => {
    const x = e.target.closest('[data-cx]'); if (!x) return;
    const ref = citeRead(b), s = $('#cStyle', b).value;
    if (x.dataset.cx === 'copy') { const en = WBCite.entry(ref, s, 1); toast(await WBCite.copy(en.text, en.html) ? 'Literaturangabe kopiert' : 'Kopieren nicht möglich'); }
    else if (x.dataset.cx === 'bib') dlTo(WBCite.bibtex([ref]), cleanFile(baseName()) + '.bib', 'application/x-bibtex');
    else if (x.dataset.cx === 'ris') dlTo(WBCite.ris([ref]), cleanFile(baseName()) + '.ris', 'application/x-research-info-systems');
    else if (x.dataset.cx === 'find') {
      const msg = $('#cMsg', b); msg.textContent = 'Sucht DOI oder ISBN …';
      const id = WBCite.detect([ref.doi && 'doi ' + ref.doi, ref.isbn && 'ISBN ' + ref.isbn, S.meta.subject, S.meta.keywords, await docText(S.pages.slice(0, 4), 12000)].filter(Boolean).join('\n'));
      if (ref.doi) id.doi = ref.doi; if (ref.isbn && !id.isbn) id.isbn = ref.isbn.replace(/[-\s]/g, '');
      if (!id.doi && !id.isbn) { msg.textContent = 'Keine DOI oder ISBN gefunden. Bitte von Hand ausfüllen oder DOI eintragen.'; return; }
      try {
        msg.textContent = id.doi ? `Schlägt DOI ${id.doi} nach …` : `Schlägt ISBN ${id.isbn} nach …`;
        const got = await WBCite.lookup(id);
        $('.cgrid', b).outerHTML = citeForm({ ...ref, ...Object.fromEntries(Object.entries(got).filter(([, v]) => v && (!Array.isArray(v) || v.length))) });
        msg.textContent = 'Gefunden ✓ Bitte kurz prüfen.'; prev();
      } catch (er) { msg.textContent = 'Nachschlagen fehlgeschlagen: ' + (er.message || er) + (id.doi ? ` (DOI ${id.doi})` : ''); }
    }
  };
}
async function citeQuote(pp, aa) {
  if (!window.WBCite) return;
  const a = aa || selAnnot(), sel = pp || (S.sel && pageById(S.sel.pid));
  const text = a && (a.text || a.comment);
  if (!a || !text) { toast('Erst Text markieren (Textmarker), dann die Markierung auswählen und „Zitieren“ tippen.'); return; }
  if (!S.cite || !S.cite.ref || !S.cite.ref.title) { citeDialog(() => citeQuote(sel, a)); return; }
  const q = WBCite.quote(text, S.cite.ref, citeStyle(), citePage(sel));
  const full = q.foot ? q.text + '\n\n' + q.foot : q.text;
  toast(await WBCite.copy(full) ? `Zitat kopiert: ${q.cite}` : 'Kopieren nicht möglich');
}

/* ---------- 2. Probeklausur ---------- */
const NOTEN = [[95, '1,0'], [90, '1,3'], [85, '1,7'], [80, '2,0'], [75, '2,3'], [70, '2,7'], [65, '3,0'], [60, '3,3'], [55, '3,7'], [50, '4,0']];
const noteOf = pct => (NOTEN.find(([p]) => pct >= p) || [0, '5,0'])[1];
function examDialog() {
  commitEdit();
  const cards = (S.cards || []).length, ai = aiReady();
  if (!ai && cards < 4) { toast('Für eine Probeklausur zuerst den KI-Assistenten einrichten (Funken-Symbol) oder mindestens 4 Lernkarten anlegen.'); return; }
  const last = (S.exams || []).slice(-3).reverse();
  dialog('Probeklausur', `<p class="note" style="margin:0">${ai ? 'Die KI stellt aus dem Stoff eine Klausur mit Multiple Choice und offenen Fragen zusammen und korrigiert sie danach.' : 'Ohne KI entsteht die Klausur aus deinen Lernkarten (Multiple Choice).'}</p>
    <div class="frow"><label class="fld"><span>Stoff</span><select class="field" id="exSrc">${ai ? '<option value="doc">ganzes Dokument</option><option value="range">bestimmte Seiten</option><option value="marks">meine Markierungen</option>' : ''}${cards >= 4 ? `<option value="cards">meine Lernkarten (${cards})</option>` : ''}</select></label>
    <label class="fld" id="exRangeW" hidden><span>Seiten</span><input class="field" id="exRange" placeholder="z. B. 1-12, 15"></label></div>
    <div class="frow"><label class="fld"><span>Fragen</span><select class="field" id="exN"><option>5</option><option selected>10</option><option>15</option><option>20</option></select></label>
    <label class="fld"><span>Zeit</span><select class="field" id="exT"><option value="0">ohne Limit</option><option value="10">10 Min.</option><option value="20" selected>20 Min.</option><option value="30">30 Min.</option><option value="45">45 Min.</option><option value="60">60 Min.</option><option value="90">90 Min.</option></select></label>
    ${ai ? '<label class="fld"><span>Fragen</span><select class="field" id="exMix"><option value="mix">gemischt</option><option value="mc">nur Multiple Choice</option><option value="open">nur offene Fragen</option></select></label><label class="fld"><span>Niveau</span><select class="field" id="exLvl"><option value="normal">Klausurniveau</option><option value="hard">anspruchsvoll</option><option value="easy">Grundlagen</option></select></label>' : ''}</div>
    ${last.length ? `<p class="note" style="margin:6px 0 0">Zuletzt: ${last.map(x => `${new Date(x.at).toLocaleDateString('de-DE')} Note ${x.grade} (${x.pct} %)`).join(' · ')}</p>` : ''}`, 'Klausur erstellen', b => {
    const src = $('#exSrc', b).value, n = +$('#exN', b).value, mins = +$('#exT', b).value, mix = $('#exMix', b) ? $('#exMix', b).value : 'mc', lvl = $('#exLvl', b) ? $('#exLvl', b).value : 'normal', range = $('#exRange', b).value;
    closeDlg(); examBuild({ src, n, mins, mix, lvl, range }); return false;
  });
  $('#dlgBody').onchange = () => { $('#exRangeW').hidden = $('#exSrc').value !== 'range'; };
}
async function examBuild(o) {
  let qs = [];
  if (o.src === 'cards') {
    const all = S.cards.filter(c => c.front && c.back);
    qs = [...all].sort(() => Math.random() - 0.5).slice(0, o.n).map(c => {
      const others = all.filter(x => x.id !== c.id && x.back !== c.back).sort(() => Math.random() - 0.5).slice(0, 3).map(x => x.back);
      const opts = [...others, c.back].sort(() => Math.random() - 0.5);
      return { t: 'mc', q: c.front, o: opts, c: opts.indexOf(c.back), pid: c.pid, pts: 1, topic: '' };
    });
  } else {
    busy(true, 'Die KI stellt die Klausur zusammen …');
    try {
      let text = '';
      if (o.src === 'marks') { for (const p of S.pages) { const m = p.annots.filter(a => a.t === 'mark' && a.text).map(a => a.text.trim()); if (m.length) text += `\n[Seite ${S.pages.indexOf(p) + 1}]\n` + m.join('\n'); } }
      else text = await docText(o.src === 'range' ? parseRange(o.range, S.pages.length).map(i => S.pages[i]) : S.pages);
      if (!text.trim()) throw new Error(o.src === 'marks' ? 'Keine Markierungen gefunden.' : 'Kein Text gefunden (bei Scans zuerst die Texterkennung ausführen).');
      const kinds = o.mix === 'mc' ? 'nur Multiple-Choice-Fragen' : o.mix === 'open' ? 'nur offene Fragen' : 'etwa zwei Drittel Multiple Choice und ein Drittel offene Fragen (Begriffe erklären, Zusammenhänge, kleine Rechnungen)';
      const lvl = { normal: 'auf dem Niveau einer Hochschulklausur', hard: 'anspruchsvoll, mit Transfer- und Anwendungsfragen', easy: 'zu den Grundlagen und Definitionen' }[o.lvl];
      const out = await AIX.ask({ instructions: `Du erstellst eine Probeklausur auf Deutsch ${lvl}. ${kinds}. Nur Inhalte aus dem Text. Antworte NUR mit einem JSON-Array ohne Codeblock. Formate:
{"t":"mc","q":"Frage","o":["A","B","C","D"],"c":Index der richtigen Antwort (0-3),"s":Seitenzahl,"topic":"Thema in 1-3 Wörtern","x":"kurze Begründung"}
{"t":"open","q":"Frage","a":"Musterlösung mit den erwarteten Kernpunkten","pts":Punkte 2-6,"s":Seitenzahl,"topic":"Thema in 1-3 Wörtern"}
Genau ${o.n} Fragen. Falsche Antwortoptionen plausibel, gleich lang wie die richtige, Position der richtigen zufällig.`, messages: [{ role: 'user', text }], maxTokens: 6000 });
      qs = aiJson(out).filter(q => q && q.q && ((q.t === 'mc' && Array.isArray(q.o) && q.o.length >= 2 && q.c >= 0 && q.c < q.o.length) || (q.t === 'open' && q.a))).map(q => ({ ...q, pts: q.t === 'mc' ? 1 : Math.max(1, Math.min(10, +q.pts || 3)), pid: (S.pages[(+q.s || 1) - 1] || {}).id || null }));
      busy(false);
    } catch (e) { busy(false); toast(e.setup ? 'Bitte zuerst den KI-Assistenten einrichten.' : 'Klausur konnte nicht erstellt werden: ' + (e.message || e)); return; }
  }
  if (!qs.length) { toast('Es konnten keine Fragen erstellt werden.'); return; }
  examOverlay({ qs, mins: o.mins, title: baseName() });
}
function examOverlay(ex) {
  const el = document.createElement('div'); el.className = 'study exam'; document.body.appendChild(el);
  const ans = ex.qs.map(() => ({ v: null, t: '' }));
  const end = ex.mins ? Date.now() + ex.mins * 60000 : 0;
  let res = null, tm = 0, grading = false;
  const total = ex.qs.reduce((s, q) => s + q.pts, 0);
  const close = () => { clearInterval(tm); el.remove(); document.removeEventListener('keydown', key, true); };
  const clock = () => { const t = el.querySelector('[data-clock]'); if (!t || !end) return; const s = Math.max(0, Math.round((end - Date.now()) / 1000)); t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; t.classList.toggle('warn', s < 120); if (!s && !res && !grading) submit(true); };
  const render = () => {
    if (!res) {
      el.innerHTML = `<div class="sbox xbox"><header><b>Probeklausur</b><span class="note">${esc(ex.title)} · ${ex.qs.length} Aufgaben · ${total} Punkte</span><span class="grow"></span>${end ? `<span class="xclock" data-clock></span>` : ''}<button class="ibtn" data-s="close" title="Abbrechen">✕</button></header>
        <div class="xlist">${ex.qs.map((q, i) => `<section class="xq"><div class="xh"><b>Aufgabe ${i + 1}</b><span class="note">${q.pts} ${q.pts === 1 ? 'Punkt' : 'Punkte'}</span></div><p class="xt">${esc(q.q)}</p>${q.t === 'mc'
          ? `<div class="xopts">${q.o.map((o, k) => `<label class="xopt"><input type="radio" name="x${i}" value="${k}" ${ans[i].v === k ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`
          : `<textarea class="field area" data-a="${i}" rows="4" placeholder="Deine Antwort …">${esc(ans[i].t)}</textarea>`}</section>`).join('')}</div>
        <footer class="xfoot"><span class="note">${ans.filter(a => a.v != null || a.t.trim()).length} von ${ex.qs.length} beantwortet</span><span class="grow"></span><button class="btn primary" data-s="submit">${grading ? 'Wird korrigiert …' : 'Abgeben'}</button></footer></div>`;
      clock(); return;
    }
    const weak = Object.entries(res.topics).filter(([, t]) => t.max && t.got / t.max < 0.6).map(([k]) => k);
    el.innerHTML = `<div class="sbox xbox"><header><b>Ergebnis</b><span class="grow"></span><button class="ibtn" data-s="close">✕</button></header>
      <div class="xres"><div class="xgrade"><b>${res.grade}</b><small>Note</small></div><div><h2>${res.got.toLocaleString('de-DE')} von ${total} Punkten (${res.pct} %)</h2><p class="note">${res.pct >= 50 ? 'Bestanden.' : 'Noch nicht bestanden.'} ${weak.length ? `Noch unsicher: <b>${weak.map(esc).join(', ')}</b>.` : res.pct >= 85 ? 'Sehr gut vorbereitet.' : ''}</p>
      <div class="row2">${res.wrong.length ? `<button class="btn primary" data-s="cards">${icon('cards')}${res.wrong.length} Fehler als Lernkarten</button>` : ''}<button class="btn" data-s="again">Neue Klausur</button><button class="btn" data-s="close">Fertig</button></div></div></div>
      <div class="xlist">${ex.qs.map((q, i) => { const r = res.per[i]; return `<section class="xq ${r.got >= q.pts ? 'ok' : r.got > 0 ? 'part' : 'bad'}"><div class="xh"><b>Aufgabe ${i + 1}</b><span class="note">${r.got.toLocaleString('de-DE')} / ${q.pts}</span>${q.pid ? `<button class="btn sm" data-pg="${q.pid}">Seite ${pageNo(q.pid) || ''}</button>` : ''}</div><p class="xt">${esc(q.q)}</p>${q.t === 'mc'
        ? `<div class="xopts">${q.o.map((o, k) => `<div class="xopt ${k === q.c ? 'right' : k === ans[i].v ? 'wrong' : ''}"><span>${esc(o)}</span></div>`).join('')}</div>${q.x ? `<p class="note">${esc(q.x)}</p>` : ''}`
        : `<p class="xmy"><small>Deine Antwort</small>${esc(ans[i].t || '–')}</p><p class="xsol"><small>Musterlösung</small>${esc(q.a)}</p>${r.fb ? `<p class="note">${esc(r.fb)}</p>` : ''}`}</section>`; }).join('')}</div></div>`;
  };
  const submit = async auto => {
    if (grading) return;
    if (!auto && ans.some(a => a.v == null && !a.t.trim()) && !await ask('Wirklich abgeben?', 'Es sind noch Aufgaben offen.', 'Abgeben', 'Weiter bearbeiten', false)) return;
    grading = true; render();
    const per = ex.qs.map((q, i) => ({ got: q.t === 'mc' ? (ans[i].v === q.c ? q.pts : 0) : 0, fb: '' }));
    const open = ex.qs.map((q, i) => [q, i]).filter(([q]) => q.t === 'open');
    if (open.length) {
      if (aiReady()) {
        try {
          const out = await AIX.ask({ instructions: 'Du korrigierst offene Klausurfragen fair wie eine Dozentin. Vergleiche jede Antwort mit der Musterlösung, vergib Teilpunkte. Antworte NUR mit einem JSON-Array: [{"i":Nummer,"p":Punkte,"f":"kurzes Feedback, was fehlt oder falsch ist (1-2 Sätze)"}].', messages: [{ role: 'user', text: open.map(([q, i]) => `Nummer ${i}\nFrage: ${q.q}\nMusterlösung: ${q.a}\nHöchstpunktzahl: ${q.pts}\nAntwort: ${ans[i].t.trim() || '(keine Antwort)'}`).join('\n\n') }], maxTokens: 2500 });
          for (const g of aiJson(out)) { const k = +g.i; if (per[k] && ex.qs[k].t === 'open') { per[k].got = Math.max(0, Math.min(ex.qs[k].pts, Math.round((+g.p || 0) * 2) / 2)); per[k].fb = String(g.f || ''); } }
        } catch (e) { toast('Die offenen Fragen konnten nicht automatisch korrigiert werden.'); }
      }
    }
    const got = per.reduce((s, r) => s + r.got, 0), pct = Math.round(got / total * 100);
    const topics = {};
    ex.qs.forEach((q, i) => { const t = q.topic || ''; if (!t) return; topics[t] = topics[t] || { got: 0, max: 0 }; topics[t].got += per[i].got; topics[t].max += q.pts; });
    res = { per, got, pct, grade: noteOf(pct), topics, wrong: ex.qs.filter((q, i) => per[i].got < q.pts) };
    S.exams = [...(S.exams || []), { at: Date.now(), pct, grade: res.grade, n: ex.qs.length }].slice(-20); markDirty();
    if (window.WBStats) WBStats.exam(pct);
    grading = false; clearInterval(tm); render(); el.scrollTop = 0;
  };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (res) close(); } };
  document.addEventListener('keydown', key, true);
  el.addEventListener('change', e => { const r = e.target.closest('input[type=radio]'); if (r) { ans[+r.name.slice(1)].v = +r.value; const f = el.querySelector('.xfoot .note'); if (f) f.textContent = `${ans.filter(a => a.v != null || a.t.trim()).length} von ${ex.qs.length} beantwortet`; } });
  el.addEventListener('input', e => { const t = e.target.closest('[data-a]'); if (t) ans[+t.dataset.a].t = t.value; });
  el.addEventListener('click', async e => {
    const pg = e.target.closest('[data-pg]'); if (pg) { close(); scrollToPage(pageNo(pg.dataset.pg) - 1); return; }
    const s = e.target.closest('[data-s]'); if (!s) return;
    if (s.dataset.s === 'close') { if (res || await ask('Klausur abbrechen?', 'Deine Antworten gehen verloren.', 'Abbrechen', 'Weiter', true)) close(); }
    else if (s.dataset.s === 'submit') submit(false);
    else if (s.dataset.s === 'again') { close(); examDialog(); }
    else if (s.dataset.s === 'cards') {
      pushHist();
      const add = res.wrong.map(q => ({ id: uid('c'), front: q.q, back: q.t === 'mc' ? q.o[q.c] + (q.x ? ' – ' + q.x : '') : q.a, pid: q.pid, ai: true, due: Date.now(), created: Date.now() }));
      S.cards = [...(S.cards || []), ...add]; markDirty(); renderLearn(); s.disabled = true; s.textContent = `${add.length} Lernkarten angelegt ✓`;
    }
  });
  render(); if (end) tm = setInterval(clock, 1000);
}

/* ---------- 3. Mindmap und Kapitel-Zusammenfassung ---------- */
async function mindmapOverlay() {
  commitEdit();
  busy(true, 'Mindmap wird erstellt …');
  let hs = []; try { hs = window.WBConvert ? await findHeadings() : []; } catch (e) { hs = []; }
  busy(false);
  const root = { id: 'root', text: (S.meta.title || baseName()).slice(0, 80), kids: [], lvl: 0, i: 0, y: 0 };
  const flat = [];
  if (hs.length) {
    const stack = [root];
    for (const h of hs) {
      const n = { id: uid('m'), text: h.text.slice(0, 90), kids: [], lvl: h.lvl, i: h.i, y: h.y, pid: h.pid, head: true };
      while (stack.length > 1 && stack[stack.length - 1].lvl >= h.lvl) stack.pop();
      stack[stack.length - 1].kids.push(n); stack.push(n); flat.push(n);
    }
  } else {
    S.pages.forEach((p, i) => { if (p.annots.some(a => (a.t === 'mark' && a.text) || (a.t === 'note' && a.text))) { const n = { id: uid('m'), text: `Seite ${i + 1}`, kids: [], lvl: 1, i, y: 0, pid: p.id, head: true }; root.kids.push(n); flat.push(n); } });
  }
  // Markierungen und Notizen dem passenden Abschnitt zuordnen
  const owner = (i, y) => { let o = root; for (const n of flat) { if (n.i < i || (n.i === i && n.y <= y + 2)) o = n; else break; } return o; };
  S.pages.forEach((p, i) => {
    for (const a of p.annots) {
      if (!((a.t === 'mark' && a.text) || (a.t === 'note' && a.text))) continue;
      const b = bbox(a), o = owner(i, b.y);
      const t = a.text.replace(/\s+/g, ' ').trim();
      o.kids.push({ id: uid('m'), text: t.length > 70 ? t.slice(0, 68) + '…' : t, full: t, kids: [], leaf: true, note: a.t === 'note', pid: p.id, aid: a.id, color: a.color });
    }
  });
  if (!root.kids.length) { toast('Keine Überschriften oder Markierungen gefunden. Markiere wichtige Stellen oder führe bei Scans die Texterkennung aus.'); return; }
  // Layout: von links nach rechts
  const W0 = 210, GAP = 34, LH = 15;
  const ctx = document.createElement('canvas').getContext('2d'); ctx.font = '13px system-ui, sans-serif';
  const lines = t => { const ws = t.split(' '), out = []; let l = ''; for (const w of ws) { const s = l ? l + ' ' + w : w; if (ctx.measureText(s).width > W0 - 22 && l) { out.push(l); l = w; } else l = s; } out.push(l); return out.slice(0, 4); };
  let yy = 0;
  const place = (n, d) => {
    n.d = d; n.ls = lines(n.text); n.h = n.ls.length * LH + 14; n.x = d * (W0 + 60);
    if (!n.kids.length) { n.y0 = yy; yy += n.h + 10; n.cy = n.y0 + n.h / 2; return; }
    n.kids.forEach(k => place(k, d + 1));
    n.cy = (n.kids[0].cy + n.kids[n.kids.length - 1].cy) / 2; n.y0 = n.cy - n.h / 2;
    if (n.y0 < 0) n.y0 = 0;
  };
  place(root, 0);
  const all = []; const walk = n => { all.push(n); n.kids.forEach(walk); }; walk(root);
  const maxX = Math.max(...all.map(n => n.x)) + W0 + GAP, maxY = Math.max(yy, ...all.map(n => n.y0 + n.h)) + GAP;
  const PAL = ['#1f4fd8', '#0f8a6a', '#b4561b', '#8a3ffc', '#c4352b', '#0072b1', '#7a6a00'];
  let ci = 0; root.kids.forEach(k => { const c = PAL[ci++ % PAL.length]; const paint = n => { n.col = n.col || c; n.kids.forEach(paint); }; k.col = c; paint(k); });
  const svgOf = () => `<svg xmlns="http://www.w3.org/2000/svg" class="mmsvg" viewBox="${-GAP} ${-GAP} ${maxX + GAP} ${maxY + GAP}" width="${maxX + 2 * GAP}" height="${maxY + 2 * GAP}" font-family="system-ui, sans-serif">
    <rect x="${-GAP}" y="${-GAP}" width="${maxX + 2 * GAP}" height="${maxY + 2 * GAP}" fill="#ffffff"/>
    ${all.filter(n => n !== root || true).flatMap(n => n.kids.map(k => `<path d="M${n.x + W0} ${n.cy} C${n.x + W0 + 30} ${n.cy} ${k.x - 30} ${k.cy} ${k.x} ${k.cy}" fill="none" stroke="${k.col || '#9aa3b2'}" stroke-opacity=".55" stroke-width="${n === root ? 2.5 : 1.6}"/>`)).join('')}
    ${all.map(n => `<g class="mmn${n.leaf ? ' leaf' : ''}" data-n="${n.id}" style="cursor:pointer"><rect x="${n.x}" y="${n.y0}" width="${W0}" height="${n.h}" rx="${n.leaf ? 6 : 10}" fill="${n === root ? '#1b2130' : n.leaf ? (n.note ? '#fff8d6' : '#ffffff') : n.col}" fill-opacity="${n === root || n.leaf ? 1 : n.d === 1 ? 1 : 0.14}" stroke="${n.leaf ? (n.note ? '#e0c24a' : n.col || '#cfd5df') : n.col || '#1b2130'}" stroke-width="${n.leaf ? 1 : 1.4}"/>${n.ls.map((l, k) => `<text x="${n.x + 11}" y="${n.y0 + 18 + k * LH}" font-size="${n === root ? 14 : 12.5}" font-weight="${n.leaf ? 400 : 600}" fill="${n === root || (!n.leaf && n.d === 1) ? '#ffffff' : '#1b2130'}">${esc(l)}</text>`).join('')}${n.pid && !n.leaf ? `<text x="${n.x + W0 - 8}" y="${n.y0 + n.h - 6}" font-size="9.5" text-anchor="end" fill="${n.d === 1 ? '#ffffffcc' : '#5f6878'}">S. ${pageNo(n.pid) || ''}</text>` : ''}</g>`).join('')}</svg>`;
  const el = document.createElement('div'); el.className = 'study mmap';
  el.innerHTML = `<div class="sbox mbox"><header><b>Mindmap</b><span class="note">${hs.length ? `${hs.length} Überschriften` : 'nach Seiten'} · ${all.filter(n => n.leaf).length} Markierungen und Notizen</span><span class="grow"></span>
    <button class="ibtn" data-m="out" title="Verkleinern">−</button><button class="ibtn" data-m="in" title="Vergrößern">+</button>
    <button class="btn" data-m="png">${icon('image')}Als Bild</button>${aiReady() && hs.length ? `<button class="btn" data-m="sumall">${icon('spark')}Alle Kapitel zusammenfassen</button>` : ''}<button class="ibtn" data-m="close" title="Schließen (Esc)">✕</button></header>
    <div class="mmwrap"><div class="mmstage">${svgOf()}</div><aside class="mmside" hidden></aside></div></div>`;
  document.body.appendChild(el);
  let z = 1; const stage = $('.mmstage', el), svg = () => $('svg', stage);
  const zoom = f => { z = clamp(z * f, 0.3, 2.5); const s = svg(); s.style.width = (maxX + 2 * GAP) * z + 'px'; s.style.height = (maxY + 2 * GAP) * z + 'px'; };
  zoom(Math.min(1, ($('.mmwrap', el).clientWidth - 20) / (maxX + 2 * GAP)) / 1);
  const byId = new Map(all.map(n => [n.id, n]));
  const close = () => { el.remove(); document.removeEventListener('keydown', key, true); };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  document.addEventListener('keydown', key, true);
  // Text eines Abschnitts: von der Überschrift bis zur nächsten gleich hohen oder höheren
  const sectionText = async n => {
    const k = flat.indexOf(n), next = flat.slice(k + 1).find(m => m.lvl <= n.lvl);
    let t = '';
    for (let i = n.i; i <= (next ? next.i : S.pages.length - 1); i++) {
      const p = S.pages[i];
      try {
        const r = await WBConvert._linesOf(proxyOf(p));
        for (const l of r.lines) { if (i === n.i && l.y < n.y - 2) continue; if (next && i === next.i && l.y >= next.y - 2) continue; t += l.text.replace(/\t/g, ' ') + '\n'; }
      } catch (e) { /* weiter */ }
      if (t.length > 16000) break;
    }
    return t.trim();
  };
  const side = $('.mmside', el);
  const showSide = async n => {
    side.hidden = false;
    side.innerHTML = `<h3>${esc(n.leaf ? (n.note ? 'Notiz' : 'Markierung') : n.text)}</h3>${n.leaf ? `<p>${esc(n.full || n.text)}</p>` : ''}<div class="row2">${n.pid ? `<button class="btn" data-m="goto" data-id="${n.id}">Zur Seite ${pageNo(n.pid) || ''}</button>` : ''}${!n.leaf && n.head && aiReady() ? `<button class="btn primary" data-m="sum" data-id="${n.id}">${icon('spark')}Zusammenfassen</button>` : ''}</div><div class="mmsum"></div>`;
    if (!n.leaf && n.head && !aiReady()) side.insertAdjacentHTML('beforeend', '<p class="note">Mit eingerichteter KI (Funken-Symbol) gibt es hier eine Zusammenfassung des Kapitels.</p>');
  };
  const summarize = async (n, box) => {
    box.innerHTML = '<p class="note"><span class="spin"></span> Die KI fasst zusammen …</p>';
    try {
      const t = await sectionText(n);
      if (!t) throw new Error('Kein Text in diesem Abschnitt.');
      const out = await AIX.ask({ instructions: 'Fasse den Abschnitt eines Skripts für die Klausurvorbereitung auf Deutsch zusammen: 3–7 Stichpunkte mit den wichtigsten Begriffen, Definitionen und Zusammenhängen. Nur Inhalte aus dem Text. Markdown-Stichpunkte, keine Einleitung.', messages: [{ role: 'user', text: `Abschnitt: ${n.text}\n\n${t}` }], maxTokens: 900 });
      n.sum = out.trim();
      box.innerHTML = `<div class="tx">${aiMd(n.sum)}</div><div class="row2"><button class="btn sm" data-m="sumcopy" data-id="${n.id}">${icon('copy')}Kopieren</button><button class="btn sm" data-m="sumnote" data-id="${n.id}">${icon('note')}Als Notiz</button></div>`;
    } catch (e) { box.innerHTML = `<p class="note">Zusammenfassen fehlgeschlagen: ${esc(e.message || e)}</p>`; }
  };
  el.addEventListener('click', async e => {
    const g = e.target.closest('[data-n]');
    if (g) { const n = byId.get(g.dataset.n); $$('.mmn.on', el).forEach(x => x.classList.remove('on')); g.classList.add('on'); if (n === root) { side.hidden = true; return; } showSide(n); return; }
    const m = e.target.closest('[data-m]'); if (!m) return;
    const n = m.dataset.id && byId.get(m.dataset.id);
    if (m.dataset.m === 'close') close();
    else if (m.dataset.m === 'in') zoom(1.2);
    else if (m.dataset.m === 'out') zoom(1 / 1.2);
    else if (m.dataset.m === 'goto' && n) { close(); scrollToPage(pageNo(n.pid) - 1); if (n.aid) setTimeout(() => gotoAnnot(n.aid), 150); }
    else if (m.dataset.m === 'sum' && n) summarize(n, $('.mmsum', side));
    else if (m.dataset.m === 'sumcopy' && n) toast(await writeSysClip(aiPlain(n.sum)) ? 'Zusammenfassung kopiert' : 'Kopieren nicht möglich');
    else if (m.dataset.m === 'sumnote' && n) {
      const p = pageById(n.pid) || S.pages[0], [W] = dims(p);
      pushHist(); p.annots.push({ id: uid(), t: 'note', x: W - NOTE - 18, y: Math.max(18, (n.y || 40) - 10), color: '#ffd400', text: `Zusammenfassung: ${n.text}\n\n${aiPlain(n.sum)}` }); drawAnnots(p); markDirty(); toast('Als Notiz an der Überschrift angeheftet');
    }
    else if (m.dataset.m === 'png') {
      const s = svg().cloneNode(true); s.removeAttribute('style');
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(s)); await img.decode();
      const k = Math.min(2, 8000 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(bl => { bl.arrayBuffer().then(ab => dlTo(new Uint8Array(ab), cleanFile(baseName()) + ' – Mindmap.png', 'image/png')); }, 'image/png');
    }
    else if (m.dataset.m === 'sumall') {
      const top = flat.filter(x => x.lvl === Math.min(...flat.map(f => f.lvl))).slice(0, 14);
      if (!await ask('Alle Kapitel zusammenfassen?', `Die KI fasst ${top.length} Kapitel zusammen und fügt das Ergebnis als neue Seite hinter der aktuellen ein. Das dauert etwas.`, 'Los', 'Abbrechen', false)) return;
      m.disabled = true; let md = `# Zusammenfassung: ${root.text}\n`;
      for (let k = 0; k < top.length; k++) {
        m.textContent = `Kapitel ${k + 1} von ${top.length} …`;
        try {
          const t = await sectionText(top[k]); if (!t) continue;
          const out = await AIX.ask({ instructions: 'Fasse diesen Abschnitt eines Skripts für die Klausurvorbereitung auf Deutsch in 3–6 Stichpunkten zusammen. Nur Inhalte aus dem Text. Markdown-Stichpunkte, keine Überschrift, keine Einleitung.', messages: [{ role: 'user', text: t }], maxTokens: 700 });
          md += `\n## ${top[k].text} (S. ${top[k].i + 1})\n${out.trim()}\n`;
        } catch (er) { md += `\n## ${top[k].text}\n- (nicht zusammengefasst)\n`; }
      }
      close();
      busy(true, 'Seite wird erstellt …');
      try { await insertPdfBytes(await aiPagePdf(md), 'Zusammenfassung.pdf'); busy(false); toast('Zusammenfassung als neue Seite eingefügt'); }
      catch (er) { busy(false); toast('Seite konnte nicht erstellt werden.'); }
    }
  });
  // Ziehen zum Verschieben
  const wrap = $('.mmwrap', el); let dr = null;
  wrap.addEventListener('pointerdown', e => { if (e.target.closest('[data-n],.mmside')) return; dr = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => { if (!dr) return; stage.scrollLeft = dr.l - (e.clientX - dr.x); stage.scrollTop = dr.t - (e.clientY - dr.y); });
  stage.addEventListener('pointerup', () => { dr = null; });
  stage.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
}

/* ---------- 4. Lernstatistik und Pomodoro ---------- */
const STU = { last: Date.now(), tick: 0 };
function statsBind() {
  if (!window.WBStats) return;
  const act = () => { STU.last = Date.now(); };
  ['pointerdown', 'keydown', 'wheel'].forEach(t => addEventListener(t, act, { passive: true, capture: true }));
  viewer.addEventListener('scroll', act, { passive: true });
  STU.tick = setInterval(() => {
    if (document.hidden || S.sample || !S.pages.length || S.renderMode) return;
    if (Date.now() - STU.last > 120000 && !(REC && REC.mr)) return;
    WBStats.tick(S.lib ? S.lib.id : 'f:' + S.docName, baseName(), 15);
  }, 15000);
  pomoResume();
}
const POMO = { t: 0, el: null };
const pomoState = () => { try { return JSON.parse(lsGet('pdfwb.pomo') || 'null'); } catch (e) { return null; } };
function pomoBeep() {
  try { const ac = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.25, 0.5].forEach(d => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ac.currentTime + d); g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d + 0.2); o.connect(g).connect(ac.destination); o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.22); }); setTimeout(() => ac.close(), 1200); } catch (e) { /* kein Ton */ }
}
function pomoNotify(title, body) {
  pomoBeep(); toast(title + ' ' + body);
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch (e) { /* egal */ }
}
function pomoStart(work = 25, brk = 5) {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  lsSet('pdfwb.pomo', JSON.stringify({ phase: 'work', end: Date.now() + work * 60000, work, brk, n: 0 }));
  pomoResume(); toast(`Pomodoro läuft: ${work} Minuten konzentriert lernen`);
}
function pomoStop() { try { localStorage.removeItem('pdfwb.pomo'); } catch (e) { /* egal */ } clearInterval(POMO.t); if (POMO.el) { POMO.el.remove(); POMO.el = null; } }
function pomoResume() {
  const st = pomoState(); clearInterval(POMO.t);
  if (!st) { if (POMO.el) { POMO.el.remove(); POMO.el = null; } return; }
  if (!POMO.el) {
    POMO.el = document.createElement('div'); POMO.el.className = 'pomochip';
    POMO.el.innerHTML = `<span class="pdot"></span><b data-pt></b><small data-pp></small><button class="ibtn" data-pm="skip" title="Phase beenden">⏭</button><button class="ibtn" data-pm="stop" title="Pomodoro beenden">✕</button>`;
    document.body.appendChild(POMO.el);
    POMO.el.addEventListener('click', e => { const b = e.target.closest('[data-pm]'); if (!b) return; if (b.dataset.pm === 'stop') pomoStop(); else { const s = pomoState(); if (s) { s.end = Date.now(); lsSet('pdfwb.pomo', JSON.stringify(s)); pomoTick(); } } });
  }
  const pomoTick = () => {
    const s = pomoState(); if (!s) { pomoStop(); return; }
    let left = Math.round((s.end - Date.now()) / 1000);
    if (left <= 0) {
      if (s.phase === 'work') { s.n = (s.n || 0) + 1; if (window.WBStats) WBStats.pomo(); s.phase = 'break'; s.end = Date.now() + (s.n % 4 === 0 ? s.brk * 3 : s.brk) * 60000; pomoNotify('Pause!', s.n % 4 === 0 ? `${s.n} Pomodoros geschafft – jetzt eine längere Pause.` : `Pomodoro ${s.n} geschafft. ${s.brk} Minuten Pause.`); }
      else { s.phase = 'work'; s.end = Date.now() + s.work * 60000; pomoNotify('Weiter geht’s', `Nächster Pomodoro: ${s.work} Minuten.`); }
      lsSet('pdfwb.pomo', JSON.stringify(s)); left = Math.round((s.end - Date.now()) / 1000);
    }
    POMO.el.classList.toggle('brk', s.phase === 'break');
    $('[data-pt]', POMO.el).textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    $('[data-pp]', POMO.el).textContent = s.phase === 'work' ? `Lernen · ${(s.n || 0) + 1}.` : 'Pause';
  };
  pomoTick(); POMO.t = setInterval(pomoTick, 1000);
}
function studyStatsDialog() {
  if (!window.WBStats) return;
  const ex = (S.exams || []).slice(-5).reverse(), due = cardsDue().length, run = pomoState();
  dialog('Lernstatistik', `${WBStats.html()}
    <h4 class="lh">Pomodoro</h4><p class="note" style="margin:0 0 6px">Konzentriert lernen, dann kurz Pause. Nach vier Runden gibt es eine längere Pause. Der Timer läuft weiter, auch wenn du das Dokument wechselst.</p>
    <div class="row2">${run ? `<button class="btn" data-ps="stop">Pomodoro beenden</button>` : `<button class="btn primary" data-ps="25">${icon('timer')}25 / 5 Minuten</button><button class="btn" data-ps="50">50 / 10 Minuten</button>`}</div>
    <h4 class="lh">Dieses Dokument</h4><p class="note" style="margin:0">${(S.cards || []).length} Lernkarten, davon ${due} fällig${ex.length ? ` · Probeklausuren: ${ex.map(x => `Note ${x.grade} (${x.pct} %, ${new Date(x.at).toLocaleDateString('de-DE')})`).join(', ')}` : ''}.</p>
    <div class="row2" style="margin-top:8px">${due ? `<button class="btn" data-ps="learn">${icon('cards')}Fällige Karten lernen</button>` : ''}<button class="btn" data-ps="exam">${icon('exam')}Probeklausur</button></div>`, 'Schließen', () => true);
  $('#dlgCancel').hidden = true; $('#dlg .card').classList.add('wide');
  $('#dlgBody').onclick = e => {
    const b = e.target.closest('[data-ps]'); if (!b) return; const k = b.dataset.ps;
    closeDlg();
    if (k === 'stop') pomoStop(); else if (k === '25') pomoStart(25, 5); else if (k === '50') pomoStart(50, 10); else if (k === 'learn') studyOverlay('learn'); else if (k === 'exam') examDialog();
  };
}

