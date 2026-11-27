/* ======================= Version 2.0 ======================= */
/* ---------- 1. Vorlesung als Transkript ---------- */
const TX = { sr: null, on: false, rid: null, segs: [], t0: null };
const txSR = () => (window.wbDesktop ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);
function txLiveStart() {
  const C = txSR(); if (!C || lsGet('pdfwb.txlive') === '0') return;
  const r = new C(); r.lang = S.meta.lang || 'de-DE'; r.continuous = true; r.interimResults = true;
  Object.assign(TX, { sr: r, on: true, rid: REC.id, segs: [], t0: null });
  r.onresult = e => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (TX.t0 == null) TX.t0 = Math.max(0, recNow() - 1200);
      if (res.isFinal) { const text = res[0].transcript.trim(); if (text) TX.segs.push({ t: Math.round(TX.t0), text }); TX.t0 = null; }
      const el = REC.bar && $('.rtx', REC.bar); if (el) el.textContent = res[0].transcript.trim().slice(-80);
    }
  };
  r.onerror = ev => { if (/not-allowed|service-not-allowed|language-not-supported/.test(ev.error)) TX.on = false; };
  r.onend = () => { if (TX.on && REC.mr && REC.mr.state === 'recording') { try { r.start(); } catch (er) { /* läuft schon */ } } };
  try { r.start(); } catch (e) { TX.on = false; }
}
function txLiveStop(rid) {
  if (!TX.sr) return;
  TX.on = false; try { TX.sr.stop(); } catch (e) { /* egal */ }
  const rec = (S.recs || []).find(r => r.id === (rid || TX.rid));
  if (rec && TX.segs.length) { rec.tx = TX.segs.slice(); rec.txVia = 'live'; markDirty(); }
  TX.sr = null;
}
async function decode16k(blob) {
  const AC = window.AudioContext || window.webkitAudioContext, ac = new AC({ sampleRate: 16000 });
  try { const buf = await ac.decodeAudioData(await blob.arrayBuffer()); return buf.getChannelData(0); } finally { ac.close(); }
}
let asrP = null;
async function whisperLocal(blob, onProg) {
  if (!asrP) asrP = (async () => {
    const T = await import(/* webpackIgnore: true */ (window.WB_CONFIG && WB_CONFIG.transformersUrl) || 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2');
    const files = new Map();
    return T.pipeline('automatic-speech-recognition', (window.WB_CONFIG && WB_CONFIG.whisperModel) || 'onnx-community/whisper-base', {
      dtype: 'q8', device: 'wasm',
      progress_callback: p => { if (p.status === 'progress' && p.file) { files.set(p.file, [p.loaded || 0, p.total || 0]); const [l, t] = [...files.values()].reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]); if (onProg) onProg(`Sprachmodell wird geladen (einmalig) … ${Math.round(l / 1048576)} von ${Math.round(t / 1048576)} MB`); } },
    });
  })().catch(e => { asrP = null; throw e; });
  const asr = await asrP;
  if (onProg) onProg('Ton wird vorbereitet …');
  const audio = await decode16k(blob);
  if (onProg) onProg(`Wird verschriftlicht (${fmtDur(audio.length / 16)}) … das dauert etwa halb so lange wie die Aufnahme`);
  const out = await asr(audio, { language: 'german', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
  return (out.chunks || [{ timestamp: [0], text: out.text }]).map(c => ({ t: Math.round(((c.timestamp && c.timestamp[0]) || 0) * 1000), text: String(c.text || '').trim() })).filter(s => s.text);
}
async function transcribeRec(rid, how) {
  const r = (S.recs || []).find(x => x.id === rid); if (!r) return;
  const blob = await audioOf(r.id);
  if (!blob) { toast('Die Aufnahme ist auf diesem Gerät noch nicht vorhanden.'); return; }
  busy(true, 'Transkript wird erstellt …');
  try {
    let segs;
    if (how === 'openai') segs = await AIX.transcribe(blob, { lang: (S.meta.lang || 'de').slice(0, 2), name: 'aufnahme.' + (/mp4/.test(r.mime) ? 'm4a' : /ogg/.test(r.mime) ? 'ogg' : 'webm') });
    else segs = await whisperLocal(blob, m => setMsg(m, true));
    r.tx = segs; r.txVia = how; markDirty(); busy(false); setMsg('');
    toast(`Transkript fertig: ${segs.length} Abschnitte`);
    transcriptDialog(rid);
  } catch (e) { busy(false); setMsg(''); console.error(e); toast('Transkript fehlgeschlagen: ' + (e.message || e)); }
}
function transcriptDialog(rid) {
  const recs = S.recs || [];
  const r = recs.find(x => x.id === rid) || recs[0];
  if (!r) { toast('Noch keine Aufnahme. Über das Mikrofon oben eine Vorlesung aufnehmen.'); return; }
  const canAI = AIX && AIX.info().provider === 'openai';
  const segs = r.tx || [];
  dialog('Transkript', `${recs.length > 1 ? `<select class="field" id="txPick">${recs.map(x => `<option value="${x.id}" ${x.id === r.id ? 'selected' : ''}>${esc(x.name)}${x.tx ? '' : ' (ohne Text)'}</option>`).join('')}</select>` : `<p class="note" style="margin:0"><b>${esc(r.name)}</b> · ${fmtDur(r.dur)}</p>`}
    ${segs.length ? `<input class="field" id="txQ" type="search" placeholder="Im Transkript suchen …" style="width:100%;margin-top:8px"><div class="txlist" id="txList">${segs.map((s, i) => `<button type="button" class="txs" data-t="${s.t}" data-i="${i}"><span class="tt">${fmtDur(s.t)}</span><span class="tx">${esc(s.text)}</span></button>`).join('')}</div>
      <div class="row2"><button type="button" class="btn" data-tx="copy">${icon('copy')}Kopieren</button><button type="button" class="btn" data-tx="txt">Als Text speichern</button>${aiReady() ? `<button type="button" class="btn" data-tx="sum">${icon('spark')}Zusammenfassung als Seite</button><button type="button" class="btn" data-tx="cards">${icon('cards')}Lernkarten daraus</button>` : ''}<button type="button" class="btn" data-tx="redo">Neu erstellen …</button></div>`
      : `<p class="note">Zu dieser Aufnahme gibt es noch keinen Text.${txSR() ? ' Tipp: Bei neuen Aufnahmen schreibt Chrome bzw. Edge live mit.' : ''}</p>`}
    <div id="txHow" ${segs.length ? 'hidden' : ''}><div class="row2"><button type="button" class="btn primary" data-tx="local">Auf diesem Gerät verschriftlichen</button>${canAI ? '<button type="button" class="btn" data-tx="openai">Mit OpenAI (schneller)</button>' : ''}</div>
      <p class="note" style="margin:0">Auf dem Gerät: Whisper läuft im Browser, nichts verlässt den Rechner. Beim ersten Mal wird das Sprachmodell geladen (ca. 80 MB).${canAI ? ' OpenAI: der Ton wird an OpenAI geschickt und nach Nutzung abgerechnet.' : ''}</p></div>`, 'Schließen', () => true);
  $('#dlgCancel').hidden = true; $('#dlg .card').classList.add('wide');
  const b = $('#dlgBody');
  const mark = () => { if (!S.player || S.player.rid !== r.id) return; const t = S.player.au.currentTime * 1000; let k = -1; segs.forEach((s, i) => { if (s.t <= t) k = i; }); $$('.txs.on', b).forEach(x => x.classList.remove('on')); const el = $(`.txs[data-i="${k}"]`, b); if (el) { el.classList.add('on'); } };
  const iv = setInterval(() => { if (!document.body.contains(b) || $('#dlg').hidden) { clearInterval(iv); return; } mark(); }, 500);
  b.oninput = e => { if (e.target.id !== 'txQ') return; const q = e.target.value.trim().toLowerCase(); $$('.txs', b).forEach(x => { x.hidden = q.length > 1 && !x.textContent.toLowerCase().includes(q); }); };
  b.onchange = e => { if (e.target.id === 'txPick') { closeDlg(); transcriptDialog(e.target.value); } };
  b.onclick = async e => {
    const s = e.target.closest('.txs'); if (s) { openPlayer(r.id, +s.dataset.t); return; }
    const x = e.target.closest('[data-tx]'); if (!x) return;
    const full = segs.map(s2 => `[${fmtDur(s2.t)}] ${s2.text}`).join('\n');
    if (x.dataset.tx === 'copy') toast(await writeSysClip(segs.map(s2 => s2.text).join(' ')) ? 'Transkript kopiert' : 'Kopieren nicht möglich');
    else if (x.dataset.tx === 'txt') saveBytes(new TextEncoder().encode(full), `${baseName()} – ${r.name.replace(/[\\/:*?"<>|·]/g, '-')}.txt`);
    else if (x.dataset.tx === 'redo') { $('#txHow', b).hidden = false; }
    else if (x.dataset.tx === 'local' || x.dataset.tx === 'openai') { closeDlg(); transcribeRec(r.id, x.dataset.tx); }
    else if (x.dataset.tx === 'sum') {
      closeDlg(); busy(true, 'Die KI fasst die Vorlesung zusammen …');
      try {
        const md = await AIX.ask({ instructions: 'Fasse das Transkript einer Vorlesung für die Klausurvorbereitung auf Deutsch zusammen: Überschrift, die wichtigsten Themen als Abschnitte (## …) mit Stichpunkten, Definitionen fett. Am Ende „Offene Fragen“ falls die Vorlesung Hinweise auf Prüfungsrelevantes enthält. Nur Inhalte aus dem Transkript. Markdown.', messages: [{ role: 'user', text: full.slice(0, 60000) }], maxTokens: 3000 });
        await insertPdfBytes(await aiPagePdf(md), 'Zusammenfassung Vorlesung.pdf'); busy(false); toast('Zusammenfassung als neue Seite eingefügt');
      } catch (er) { busy(false); toast('Zusammenfassen fehlgeschlagen: ' + (er.message || er)); }
    }
    else if (x.dataset.tx === 'cards') {
      closeDlg(); busy(true, 'Die KI erstellt Lernkarten …');
      try {
        const out = await AIX.ask({ instructions: 'Erstelle aus dem Vorlesungstranskript 8–15 Lernkarten auf Deutsch (Begriffe, Definitionen, Zusammenhänge). Antworte NUR mit JSON: [{"q":"Frage","a":"Antwort"}].', messages: [{ role: 'user', text: full.slice(0, 50000) }], maxTokens: 3000 });
        const add = aiJson(out).filter(c => c.q && c.a).map(c => ({ id: uid('c'), front: c.q, back: c.a, ai: true, due: Date.now(), created: Date.now(), rec: r.id }));
        pushHist(); S.cards = [...(S.cards || []), ...add]; markDirty(); renderLearn(); busy(false); toast(`${add.length} Lernkarten aus der Vorlesung`); setSideTab && setSideTab('learn');
      } catch (er) { busy(false); toast('Lernkarten fehlgeschlagen: ' + (er.message || er)); }
    }
  };
  setTimeout(mark, 50);
}

/* ---------- 2. Bibliothek fragen ---------- */
function askLibrary(q) {
  if (!window.WBLibChat) return;
  if (!LIB || !window.WBSearch) { toast('Fragen an alle Dokumente gibt es in der Bibliothek. Öffne Dokumente über die Bibliothek.'); return; }
  window.WBSearch.indexAll();
  window.WBLibChat.open({ q, items: async () => (await LIB.all()).filter(i => i.kind === 'doc' && !i.trashed && !i.missing), open: (id, n) => { if (S.lib && id === S.lib.id) { scrollToPage(n - 1); return; } libSave().then(() => { location.href = 'index.html?doc=' + encodeURIComponent(id) + '&page=' + n; }); } });
}

/* ---------- 3. + 4. Lernkarten austauschen: Anki und Lerngruppe ---------- */
function cardsExchangeDialog() {
  commitEdit();
  const cards = S.cards || [];
  dialog('Lernkarten austauschen', `<h4 class="lh" style="margin-top:0">Anki</h4>
    <p class="note" style="margin:0">Als Anki-Stapel (.apkg) für Anki, AnkiDroid und AnkiMobile. Der Lernstand wird mitgenommen.</p>
    <div class="row2"><button type="button" class="btn" data-cx="apkg" ${cards.length ? '' : 'disabled'}>${icon('save')}Anki-Stapel (${cards.length})</button><button type="button" class="btn" data-cx="txt" ${cards.length ? '' : 'disabled'}>Als Text (Tab getrennt)</button><button type="button" class="btn" data-cx="imp">Aus Anki oder CSV importieren …</button></div>
    <h4 class="lh">Lerngruppe</h4>
    <p class="note" style="margin:0">Ein Lernpaket enthält deine Karten und Markierungen. Kommilitonen importieren es in ihr eigenes Exemplar desselben Skripts; doppelte Karten werden erkannt. Für gemeinsames Arbeiten in Echtzeit: Bibliothek › Dokument › „Gemeinsam bearbeiten“.</p>
    <div class="row2"><button type="button" class="btn primary" data-cx="pack" ${cards.length || allAnnots().some(x => x.a.t === 'mark') ? '' : 'disabled'}>Lernpaket teilen</button><button type="button" class="btn" data-cx="unpack">Lernpaket importieren …</button></div>`, 'Schließen', () => true);
  $('#dlgCancel').hidden = true;
  $('#dlgBody').onclick = async e => {
    const x = e.target.closest('[data-cx]'); if (!x || x.disabled) return;
    const k = x.dataset.cx, name = cleanFile(baseName());
    const withSrc = () => cards.map(c => ({ ...c, source: `${baseName()}${c.pid && pageNo(c.pid) ? ', S. ' + pageNo(c.pid) : ''}` }));
    if (k === 'apkg') { busy(true, 'Anki-Stapel wird erstellt …'); try { const b = await WBAnki.exportApkg(withSrc(), name); busy(false); await saveBytes(b, name + '.apkg'); } catch (er) { busy(false); toast(er.message || String(er)); } }
    else if (k === 'txt') saveBytes(new TextEncoder().encode(WBAnki.exportText(cards)), name + ' (Anki).txt');
    else if (k === 'imp' || k === 'unpack') {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = k === 'imp' ? '.apkg,.txt,.csv,.tsv' : '.wblern,application/json';
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        try {
          let got = [], marks = [];
          if (k === 'imp') got = await WBAnki.importFile(f);
          else { const j = JSON.parse(await f.text()); if (j.format !== 'pdfwb-lernpaket') throw new Error('Das ist kein Lernpaket der PDF Werkbank.'); got = j.cards || []; marks = j.marks || []; }
          const have = new Set((S.cards || []).map(c => (c.front || '').trim().toLowerCase()));
          const add = got.filter(c => c.front && c.back && !have.has(c.front.trim().toLowerCase())).map(c => ({ id: uid('c'), front: c.front, back: c.back, pid: c.page && S.pages[c.page - 1] ? S.pages[c.page - 1].id : null, due: Date.now(), created: Date.now(), from: f.name }));
          pushHist();
          S.cards = [...(S.cards || []), ...add];
          let mk = 0;
          for (const m of marks) { const p = S.pages[m.page - 1]; if (!p || p.annots.some(a => a.t === 'mark' && a.text === m.text)) continue; p.annots.push({ ...m.a, id: uid() }); mk++; drawAnnots(p); }
          markDirty(); renderLearn(); closeDlg();
          toast(`${add.length} neue Lernkarten${got.length - add.length ? ` (${got.length - add.length} schon vorhanden)` : ''}${mk ? `, ${mk} Markierungen` : ''} übernommen`);
        } catch (er) { toast(er.message || String(er)); }
      };
      inp.click();
    } else if (k === 'pack') {
      const marks = []; S.pages.forEach((p, i) => p.annots.forEach(a => { if (a.t === 'mark' && a.text) marks.push({ page: i + 1, text: a.text, a: { ...a } }); }));
      const pack = { format: 'pdfwb-lernpaket', v: 1, doc: baseName(), pages: S.pages.length, by: (window.WBShare && WBShare.me.name) || '', at: new Date().toISOString(), cards: cards.map(c => ({ front: c.front, back: c.back, page: c.pid ? pageNo(c.pid) : null })), marks };
      const bytes = new TextEncoder().encode(JSON.stringify(pack));
      const file = new File([bytes], name + '.wblern', { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Lernpaket ' + baseName(), text: `${cards.length} Lernkarten und ${marks.length} Markierungen für „${baseName()}“ (PDF Werkbank)` }); return; } catch (er) { if (er.name === 'AbortError') return; } }
      saveBytes(bytes, name + '.wblern');
    }
  };
}

/* ---------- 6. Verträge auswerten ---------- */
async function contractDialog() {
  commitEdit();
  if (!aiReady()) { toast('Verträge prüft die KI. Bitte zuerst den KI-Assistenten einrichten (Funken-Symbol oben).'); return; }
  busy(true, 'Die KI liest den Vertrag …');
  let c;
  try {
    const text = await docText(S.pages, 40000);
    if (!text.trim()) throw new Error('Kein Text gefunden (bei Scans zuerst die Texterkennung ausführen).');
    const out = await AIX.ask({ instructions: `Du wertest einen Vertrag für eine Privatperson bzw. einen Kleinunternehmer aus. Heute ist der ${new Date().toLocaleDateString('de-DE')}. Antworte NUR mit JSON:
{"art":"Vertragsart","parteien":["…"],"beginn":"TT.MM.JJJJ oder leer","laufzeit":"z. B. 24 Monate","ende":"TT.MM.JJJJ oder leer","verlaengerung":"Regel zur automatischen Verlängerung oder leer","kuendigung":"Kündigungsfrist in Worten","fristen":[{"was":"z. B. Spätester Kündigungstermin zum Laufzeitende","datum":"TT.MM.JJJJ","s":Seitenzahl}],"kosten":[{"was":"…","betrag":"z. B. 39,99 €","intervall":"monatlich/jährlich/einmalig"}],"pflichten":["…"],"auffaellig":["ungewöhnliche oder nachteilige Klauseln, kurz"],"zusammenfassung":"2-3 Sätze"}
Berechne konkrete Daten für Fristen, wenn Beginn, Laufzeit und Kündigungsfrist bekannt sind (z. B. Ende minus Kündigungsfrist). Nur Angaben aus dem Text, nichts erfinden.`, messages: [{ role: 'user', text }], maxTokens: 2500 });
    c = aiJson(out, false); busy(false);
  } catch (e) { busy(false); toast('Auswertung fehlgeschlagen: ' + (e.message || e)); return; }
  const L = (t, v) => (v && (!Array.isArray(v) || v.length) ? `<div class="kvr"><span>${t}</span><b>${Array.isArray(v) ? v.map(esc).join('<br>') : esc(v)}</b></div>` : '');
  const fr = (c.fristen || []).filter(f => f && f.datum);
  dialog('Vertrag auf einen Blick', `${c.zusammenfassung ? `<p style="margin:0 0 10px">${esc(c.zusammenfassung)}</p>` : ''}<div class="kv">${L('Art', c.art)}${L('Parteien', c.parteien)}${L('Beginn', c.beginn)}${L('Laufzeit', c.laufzeit)}${L('Ende', c.ende)}${L('Verlängerung', c.verlaengerung)}${L('Kündigung', c.kuendigung)}</div>
    ${(c.kosten || []).length ? `<h4 class="lh">Kosten</h4><div class="kv">${c.kosten.map(k => `<div class="kvr"><span>${esc(k.was)}</span><b>${esc(k.betrag)} ${esc(k.intervall || '')}</b></div>`).join('')}</div>` : ''}
    ${fr.length ? `<h4 class="lh">Fristen</h4><div class="kv">${fr.map((f, i) => `<label class="kvr chk"><span><input type="checkbox" data-fr="${i}" checked> ${esc(f.was)}</span><b>${esc(f.datum)}</b></label>`).join('')}</div>` : ''}
    ${(c.pflichten || []).length ? `<h4 class="lh">Pflichten</h4><ul class="kl">${c.pflichten.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
    ${(c.auffaellig || []).length ? `<h4 class="lh">Auffällig</h4><ul class="kl warn">${c.auffaellig.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
    <p class="note">Automatische Auswertung ohne Gewähr, keine Rechtsberatung. Wichtige Fristen bitte im Vertrag nachlesen.</p>`, fr.length ? 'Fristen als Aufgaben' : 'Schließen', b => {
    if (!fr.length) return true;
    const pick = fr.filter((f, i) => { const el = $(`[data-fr="${i}"]`, b); return el && el.checked; });
    if (!pick.length) return true;
    pushHist();
    const p0 = S.pages[0], [W] = dims(p0);
    pick.forEach((f, i) => { const p = S.pages[(+f.s || 1) - 1] || p0; p.annots.push({ id: uid(), t: 'note', x: W - NOTE - 18, y: 30 + i * 34, color: '#ff8a65', text: `[ ] ${f.was} bis ${f.datum}` }); drawAnnots(p); });
    markDirty(); updateSideLater(); toast(`${pick.length} ${pick.length === 1 ? 'Frist' : 'Fristen'} als Aufgabe angelegt · Erinnerung und Kalender-Export unter „Aufgaben“`);
    if (typeof setSideTab === 'function') setSideTab('tasks');
  });
  $('#dlg .card').classList.add('wide');
}

/* ---------- 8. Gemeinsam: Zeiger der anderen und @-Erwähnungen ---------- */
const CURS = new Map();
function showCursor(c) {
  const p = pageById(c.pid), el = p && els.get(p.id); if (!el) return;
  let k = CURS.get(c.id);
  if (!k) { k = { el: document.createElement('div'), t: 0 }; k.el.className = 'pcur'; CURS.set(c.id, k); }
  k.el.style.setProperty('--c', c.color || '#3e63dd');
  k.el.innerHTML = `<svg width="16" height="18" viewBox="0 0 16 18"><path d="M1 1l13 7-6 1.5L5 16z" fill="var(--c)" stroke="#fff" stroke-width="1.2"/></svg><span>${esc(c.name || 'Gast')}</span>`;
  if (k.el.parentNode !== el.wrap) el.wrap.appendChild(k.el);
  k.el.style.transform = `translate(${c.x * S.zoom}px, ${c.y * S.zoom}px)`;
  k.el.classList.remove('idle');
  clearTimeout(k.t); k.t = setTimeout(() => k.el.classList.add('idle'), 5000);
}
const MENT = new Set(JSON.parse(lsGet('pdfwb.mentions.sent') || '[]'));
let mentT = 0;
function mentionScan() {
  if (!S.shareSess || !S.shareSess.mention) return;
  clearTimeout(mentT);
  mentT = setTimeout(() => {
    const peers = (S.shareSess.info().peers || []).map(p => p.name).filter(Boolean);
    S.pages.forEach((p, i) => p.annots.forEach(a => {
      const t = [a.text, a.comment].filter(Boolean).join(' ');
      for (const m of t.matchAll(/@([\p{L}][\p{L}\p{N}_-]{1,30})/gu)) {
        const name = m[1], key = `${a.id}:${name.toLowerCase()}`;
        if (MENT.has(key)) continue;
        MENT.add(key);
        S.shareSess.mention({ to: name, pid: p.id, aid: a.id, page: i + 1, text: t.slice(0, 140) });
        if (!peers.some(n => n.toLowerCase().startsWith(name.toLowerCase()))) toast(`@${name} ist gerade nicht online und sieht die Erwähnung beim nächsten Öffnen in der Notiz.`);
      }
    }));
    lsSet('pdfwb.mentions.sent', JSON.stringify([...MENT].slice(-500)));
  }, 1500);
}
function onMention(m) {
  const me = ((window.WBShare && WBShare.me.name) || '').toLowerCase();
  if (!me || !me.startsWith(String(m.to).toLowerCase()) && String(m.to).toLowerCase() !== me.split(' ')[0]) return;
  pomoBeep && pomoBeep();
  try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(`${m.from} hat dich erwähnt`, { body: m.text }); } catch (e) { /* egal */ }
  pill(`${icon('note')}<span><b>${esc(m.from)}</b> hat dich auf Seite ${m.page} erwähnt: „${esc(String(m.text).slice(0, 80))}“</span><button class="btn sm" data-x="show">Anzeigen</button><button class="ibtn" data-x="no" aria-label="Schließen">✕</button>`, k => { pill(null); if (k === 'show') { scrollToPage(m.page - 1); setTimeout(() => gotoAnnot(m.aid), 300); } });
}

/* ---------- 10. Versionen: benennen und vergleichen ---------- */
function versionDiff(a, b) {
  // a = ältere Version, b = aktueller Stand (docState)
  const pa = new Map((a.pages || []).map(p => [p.id, p])), pb = new Map((b.pages || []).map(p => [p.id, p]));
  const out = { pagesAdded: 0, pagesRemoved: 0, added: 0, removed: 0, changed: 0, per: [] };
  for (const [id, p] of pb) {
    const o = pa.get(id);
    if (!o) { out.pagesAdded++; continue; }
    const om = new Map((o.annots || []).map(x => [x.id, JSON.stringify(x)])), nm = new Map((p.annots || []).map(x => [x.id, JSON.stringify(x)]));
    let ad = 0, rm = 0, ch = 0;
    for (const [k, v] of nm) { if (!om.has(k)) ad++; else if (om.get(k) !== v) ch++; }
    for (const k of om.keys()) if (!nm.has(k)) rm++;
    if (ad || rm || ch) out.per.push({ n: (b.pages || []).indexOf(p) + 1, ad, rm, ch });
    out.added += ad; out.removed += rm; out.changed += ch;
  }
  for (const id of pa.keys()) if (!pb.has(id)) out.pagesRemoved++;
  return out;
}
async function saveNamedVersion() {
  if (!S.lib) { toast('Versionen gibt es für Dokumente in der Bibliothek.'); return; }
  const name = await new Promise(res => { dialog('Version speichern', `<label class="fld"><span>Name der Version</span><input class="field" id="vName" placeholder="z. B. Vor der Abgabe" maxlength="60" style="width:100%"></label>`, 'Speichern', b => { res($('#vName', b).value.trim() || 'Gespeicherte Version'); return true; }); $('#dlgCancel').addEventListener('click', () => res(null), { once: true }); setTimeout(() => $('#vName').focus(), 30); });
  if (!name) return;
  await snapshotVersion(true, name); toast(`Version „${name}“ gespeichert`);
}

/* ---------- Einführung ---------- */
const TOUR = [
  ['#btnOpen', 'Dokument öffnen', 'PDF öffnen oder einfach ins Fenster ziehen. In der Bibliothek (Symbol links oben) liegen alle deine Dokumente.'],
  ['.toolbar', 'Werkzeuge', 'Markieren, schreiben, zeichnen, Formen, Stempel und mehr. Die Taste mit dem Fragezeichen zeigt alle Tastenkürzel.'],
  ['.find', 'Suchen', 'Strg+F sucht im Dokument, auch über Zeilenumbrüche und in deinen Notizen. Die Trefferliste zeigt jede Stelle mit Zusammenhang.'],
  ['#btnAI', 'KI-Assistent', 'Fragen zum Dokument, Zusammenfassungen, Lernkarten, Probeklausuren. Einmal mit ChatGPT-Konto oder API-Schlüssel verbinden.'],
  ['#btnRec', 'Vorlesung aufnehmen', 'Ton aufnehmen, während du mitschreibst. Später springst du von jeder Notiz an die Stelle in der Aufnahme und bekommst ein Transkript.'],
  ['.side', 'Seitenleiste', 'Seiten, Lesezeichen, Notizen, Aufgaben und Lernkarten.'],
  ['#btnMore', 'Alle Funktionen', 'Hier und unter „Alle Werkzeuge“ findest du alles Weitere: Formulare, Signatur, E-Rechnung, Umwandeln, Stapelverarbeitung … Oder Strg+K für die Befehlssuche.'],
];
function startTour(force) {
  if (!force && (lsGet('pdfwb.tour') === '1' || innerWidth < 700 || navigator.webdriver)) return;
  lsSet('pdfwb.tour', '1');
  const steps = TOUR.filter(([sel]) => { const e = $(sel); return e && e.offsetParent !== null; });
  if (!steps.length) return;
  const ov = document.createElement('div'); ov.className = 'tour';
  ov.innerHTML = '<div class="tspot"></div><div class="tbox" role="dialog" aria-live="polite"></div>';
  document.body.appendChild(ov);
  let i = 0;
  const show = () => {
    const [sel, title, text] = steps[i], el = $(sel), r = el.getBoundingClientRect(), pad = 6;
    Object.assign($('.tspot', ov).style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const box = $('.tbox', ov);
    box.innerHTML = `<small>${i + 1} von ${steps.length}</small><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row2" style="justify-content:flex-end;margin:0"><button class="btn" data-t="end">${i === steps.length - 1 ? 'Schließen' : 'Überspringen'}</button>${i < steps.length - 1 ? '<button class="btn primary" data-t="next">Weiter</button>' : ''}</div>`;
    const bw = Math.min(340, innerWidth - 24), below = r.bottom + 14 + 180 < innerHeight;
    Object.assign(box.style, { width: bw + 'px', left: clamp(r.left + r.width / 2 - bw / 2, 12, innerWidth - bw - 12) + 'px', top: (below ? r.bottom + 14 : Math.max(12, r.top - 14 - box.offsetHeight)) + 'px' });
    if (!below) requestAnimationFrame(() => { box.style.top = Math.max(12, r.top - 14 - box.offsetHeight) + 'px'; });
  };
  const end = () => { ov.remove(); removeEventListener('resize', show); document.removeEventListener('keydown', key, true); };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); } else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (i < steps.length - 1) { i++; show(); } else end(); } };
  ov.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; if (b.dataset.t === 'next') { i++; show(); } else end(); });
  addEventListener('resize', show); document.addEventListener('keydown', key, true);
  show();
}

/* ---------- Bedienelemente verbinden ---------- */
{ const sb = $('#shareBar'); if (sb) sb.addEventListener('click', () => collabDialog()); }
function bindUI() {
  $$('[data-i]').forEach(el => { el.outerHTML = icon(el.dataset.i); });
  $('#swatches').innerHTML = SWATCHES.map(c => `<button class="sw" data-c="${c}" style="background:${c}" title="${c}" aria-label="Farbe ${c}"></button>`).join('');
  $('#sigColors').innerHTML = ['#1b2a6b', '#111318', '#1f4fd8'].map((c, i) => `<button class="sw" data-c="${c}" style="background:${c}" aria-label="Stiftfarbe" aria-pressed="${i === 0}"></button>`).join('');
  fontUI(); applyToolbar(); bindGroups(); bindPenFavs(); bindAI(); bindQbar(); bindTasks(); bindLearn(); bindPlayerSeek();
  $('#btnTbCfg').onclick = toolbarDialog;
  $('#filePhotos').onchange = e => { insertPhotos([...e.target.files]); e.target.value = ''; };
  const segProp = (sel, k) => $(sel).addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; setProp(k, b.dataset.v); if (S.editing) S.editing.ta.focus(); });
  segProp('#alignSeg', 'align'); segProp('#fillSeg', 'fill'); segProp('#dashSeg', 'dash');

  $('#btnOpen').onclick = () => $('#fileOpen').click();
  $('#btnMerge').onclick = () => $('#fileMerge').click();
  $('#btnSave').onclick = () => (S.file ? saveToFile() : savePdf());
  if ($('#btnLib')) $('#btnLib').onclick = () => goLibrary();
  // beim Verlassen schnell noch sichern (Tab schließen, App wechseln)
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.lib && S.dirty && !S.renderMode) libSave(); });
  window.addEventListener('pagehide', () => { if (S.lib && S.dirty && !S.renderMode) libSave(); });
  $('#fileOpen').onchange = e => { openFiles(e.target.files, 'replace'); e.target.value = ''; };
  $('#fileMerge').onchange = e => { openFiles(e.target.files, 'append'); e.target.value = ''; };
  $('#fileImg').onchange = e => { insertImages([...e.target.files]); e.target.value = ''; };
  $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
  $('#btnZoomIn').onclick = () => zoomStep(1); $('#btnZoomOut').onclick = () => zoomStep(-1);
  $('#zoomLbl').onclick = () => setZoom(1); $('#btnFit').onclick = fitWidth;
  $$('[data-tool]').forEach(b => { b.onclick = () => setTool(b.dataset.tool); b.setAttribute('aria-label', b.title); });
  $('#btnImg').onclick = () => { commitEdit(); $('#fileImg').click(); };
  $('#btnSig').onclick = openSig;
  $('#pgRotL').onclick = () => rotatePages(-90); $('#pgRotR').onclick = () => rotatePages(90);
  $('#pgBlank').onclick = insertBlank; $('#pgExtract').onclick = extractPages; $('#pgDelete').onclick = deletePages;
  $('#delBtn').onclick = () => { if (S.csel) deleteContent(); else deleteSel(); };
  $('#cEditBtn').onclick = () => { if (S.csel && S.csel.items.length === 1) editContentText(pageById(S.csel.pid), S.csel.items[0]); };
  $('#cRotL').onclick = () => rotateContent(-1);
  $('#cRotR').onclick = () => rotateContent(1);
  const zorder = front => {
    if (S.csel && S.tool === 'objects') { zContent(front); return; }
    const a = selAnnot(); if (!a) return;
    const p = pageById(S.sel.pid), i = p.annots.indexOf(a);
    if ((front && i === p.annots.length - 1) || (!front && i === 0)) return;
    pushHist(); p.annots.splice(i, 1); if (front) p.annots.push(a); else p.annots.unshift(a);
    drawAnnots(p); markDirty(); toast(front ? 'In den Vordergrund gebracht' : 'In den Hintergrund gelegt');
  };
  $('#zFront').onclick = () => zorder(true);
  $('#zBack').onclick = () => zorder(false);
  $('#zUnder').onclick = () => {
    const a = selAnnot(); if (!a || a.t === 'note') return;
    const p = pageById(S.sel.pid);
    pushHist(); if (a.under) delete a.under; else a.under = true;
    drawAnnots(p); markDirty(); renderProps();
    toast(a.under ? 'Liegt jetzt hinter dem PDF-Inhalt (verdeckte Stellen sind nicht sichtbar)' : 'Liegt wieder über dem PDF-Inhalt');
  };
  $('#cMark').onclick = markContent;
  $('#bgSel').addEventListener('change', e => { setProp('bg', e.target.value); if (S.editing) S.editing.ta.focus(); });
  $('#dupBtn').onclick = duplicateSel;
  $('#copyBtn').onclick = () => copySelection(false);
  $('#pasteBtn').onclick = () => pasteClip();
  $('#cmtBtn').onclick = () => { const a = selAnnot(); if (!a) return; const p = pageById(S.sel.pid); if (a.t === 'note') editNote(p, a); else editComment(p, a); };
  // Einfügen aus der System-Zwischenablage: Bilder, Text oder die eigene Kopie
  window.addEventListener('blur', () => { if (S.clip) S.clip.stale = true; });
  document.addEventListener('paste', e => {
    const t = e.target, typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    if (typing || !$('#calc').hidden && $('#calc').contains(t)) return;
    const dt = e.clipboardData, files = dt ? [...dt.files].filter(f => /^image\//.test(f.type)) : [];
    const text = dt ? dt.getData('text/plain') : '';
    e.preventDefault();
    if (files.length) { insertImages(files); return; }
    if (S.clip && (!S.clip.stale || !text || text === S.clip.sysText)) { pasteClip(); return; }
    if (text) { insertTextAnnot(text); toast('Text eingefügt'); return; }
    toast('Die Zwischenablage ist leer.');
  });

  $('#btnMore').onclick = e => { e.stopPropagation(); if ($('#menu').hidden) openMenu(); else closeMenu(); };
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#menu, #btnMore')) closeMenu(); });
  const ACTS = { new: async () => { if (S.lib) { goLibrary('?new=notebook'); return; } if (S.dirty && !S.sample && !await ask('Ungespeicherte Änderungen verwerfen?', `Die Änderungen an „${S.docName}“ gehen verloren.`)) return; paperDialog('new'); },
    wm: watermarkDialog, pn: pageNumberDialog, dup: duplicatePage, png: exportPagePng, txt: exportText, meta: metaDialog,
    open: () => $('#fileOpen').click(), fit: fitWidth, merge: () => $('#fileMerge').click(), rotl: () => rotatePages(-90), rotr: () => rotatePages(90), blank: insertBlank, extract: extractPages, del: deletePages,
    tolib: toLibrary, lib: () => goLibrary(),
    read: () => setReading(true), night: () => setNight(!S.night), pencil: () => setPencilOnly(!S.pencil.only), bm: addBookmark, share: sharePdf, calc: () => window.toggleCalc(),
    saveas: () => saveToFile(true), werkbank: saveWerkbank, collab: collabDialog, toolbar: toolbarDialog, keys: shortcutsDialog, present: () => setPresent(true), speak: () => speakDoc(), dictate, table: () => tableDialog(), qr: qrDialog, versions: versionsDialog, sepia: () => setSepia(!S.sepia), stats: statsDialog, marks: exportMarks, secure: secureDialog, photos: photosDialog, libpages: libPagesDialog,
    tools: toolsHub, organize: () => organizer(true), ocr: ocrDialog, compress: compressDialog, redactsearch: redactSearchDialog, field: () => fieldDialog(), detectfields: detectFields, compare: compareDialog, cloudopen: cloudOpen, cloudsave: cloudSaveDoc,
    record: () => (REC.mr ? recStop() : recStart()), recordings: recordingsDialog, learn: () => openSide('learn'), study: () => studyOverlay('learn'), tasks: () => openSide('tasks'), searchlib: libSearchDialog, split: () => (S2.el ? splitClose() : splitDialog()), hw2text: hwToText, sign: signDialog, verifysig: verifyDialog, cert: certDialog, convert: convertDialog, template: templateNew, autotoc: autoTocDialog, headfoot: headFootDialog,
    cite: () => citeDialog(), citequote: () => citeQuote(), exam: examDialog, mindmap: mindmapOverlay, studystats: studyStatsDialog, pomodoro: () => (pomoState() ? pomoStop() : pomoStart()), formula: formulaTool, einvoice: einvoiceOpen, transcript: () => transcriptDialog(), asklib: () => askLibrary(), cardsx: cardsExchangeDialog, contract: contractDialog, ledger: () => { if (LIB) { libSave().finally(() => { location.href = 'library.html?view=ledger'; }); } else toast('Das Rechnungsbuch gibt es in der Bibliothek.'); }, savever: saveNamedVersion, tour: () => startTour(true), mailmerge: mailMergeDialog, receipts: receiptsDialog, batch: batchOpen, pdfa: pdfaDialog, a11y: a11yDialog };
  ACTS_REF = ACTS;
  $('[data-act="share"]').hidden = !canShareFiles();
  $('#mPencil').hidden = !COARSE;
  setNight(lsGet('pdfwb.night') === '1'); if (lsGet('pdfwb.sepia') === '1') setSepia(true);
  { const q = $('[data-act="qr"]'); if (q) q.hidden = !window.qrcode; const v = $('#mVersions'); if (v) v.hidden = !LIB; }
  $('#btnRead').onclick = () => setReading(true);
  $('#readExit').onclick = () => setReading(false);
  $('#readNight').onclick = () => setNight(!S.night);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && S.reading && !COARSE) setReading(false); });

  // Seitenleiste: Reiter, Lesezeichen und Kommentarliste
  $('.stabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setSideTab(b.dataset.tab); });
  $('#marksPanel').addEventListener('click', e => {
    if (e.target.closest('#bmAdd')) { addBookmark(); return; }
    const del = e.target.closest('[data-del]');
    if (del) { const f = findMark(del.dataset.del); if (f) { f.list.splice(f.list.indexOf(f.b), 1, ...f.b.kids); markDirty(); renderMarks(); } return; }
    const row = e.target.closest('[data-bid]'); if (!row || e.target.closest('input')) return;
    const f = findMark(row.dataset.bid), n = f && pageNo(f.b.pid);
    if (n) { scrollToPage(n - 1); if (innerWidth <= 760) { work.classList.remove('thumbs-open'); $('#btnThumbs').setAttribute('aria-pressed', 'false'); } }
  });
  $('#marksPanel').addEventListener('dblclick', e => { const row = e.target.closest('[data-bid]'); if (row && !e.target.closest('.x')) renameMark(row.dataset.bid); });
  $('#marksPanel').addEventListener('keydown', e => {
    const row = e.target.closest('[data-bid]'); if (!row || e.target.tagName === 'INPUT') return;
    if (e.key === 'Enter') { e.stopPropagation(); row.click(); }
    if (e.key === 'F2') { e.preventDefault(); e.stopPropagation(); renameMark(row.dataset.bid); }
  });
  $('#notesPanel').addEventListener('click', e => {
    if (e.target.closest('#noteExport')) { exportNotes(); return; }
    if (e.target.closest('#noteSettings')) { settingsDialog('cmt'); return; }
    if (e.target.closest('#noteEye')) {
      S.prefs.showMarks = !S.prefs.showMarks; savePrefs(); pagesEl.classList.toggle('hidemarks', !S.prefs.showMarks);
      setMsg(S.prefs.showMarks ? 'Markierungen werden angezeigt' : 'Markierungen ausgeblendet'); renderNotes(); return;
    }
    const b = e.target.closest('[data-aid]'); if (b) gotoAnnot(b.dataset.pid, b.dataset.aid);
  });
  $('#notesPanel').addEventListener('change', e => { if (e.target.id === 'noteFilter') { S.noteFilter = e.target.value; renderNotes(); } });
  pagesEl.classList.toggle('hidemarks', !S.prefs.showMarks);

  // Rechner
  const calcEl = $('#calc');
  const calc = window.WBCalc ? window.WBCalc.createCalculator(calcEl, {
    insertText: t => { insertTextAnnot(winAnsiSafe(t)); toast('Ergebnis auf der Seite eingefügt'); },
    insertImage: (url, w, h) => { const id = registerImage(url, 'png', w, h); placeImage(id, 300); toast('Graph auf der Seite eingefügt'); },
    insertGraph: (src, view, deg) => { toggleCalc(false); insertGraph(src, view, deg); },
    close: () => toggleCalc(false), toast,
  }) : null;
  window.toggleCalc = toggleCalc;
  function toggleCalc(on = calcEl.hidden) {
    if (!calc) { toast('Der Rechner konnte nicht geladen werden.'); return; }
    commitEdit();
    calcEl.hidden = !on;
    $('#btnCalc').setAttribute('aria-pressed', String(on));
    if (on) calc.open();
  }
  $('#btnCalc').onclick = () => toggleCalc();
  $('#calcClose').onclick = () => toggleCalc(false);
  // Rechner auf dem Desktop am Kopf verschieben
  (() => {
    const head = $('.calc-h', calcEl); let st = null;
    head.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || innerWidth <= 760) return;
      const r = calcEl.getBoundingClientRect(); st = { x: e.clientX, y: e.clientY, l: r.left, t: r.top }; head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', e => {
      if (!st) return;
      const l = clamp(st.l + e.clientX - st.x, 8, innerWidth - calcEl.offsetWidth - 8), t = clamp(st.t + e.clientY - st.y, 8, innerHeight - 60);
      Object.assign(calcEl.style, { left: l + 'px', top: t + 'px', right: 'auto', bottom: 'auto' });
    });
    const end = () => { if (st) { st = null; calc && calc.redraw(); } };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
  })();
  // ⋯-Menü als aufklappbare Gruppen (eine offen, gemerkt)
  const openGroup = g => { $$('#menu .mg').forEach(x => { const on = x.dataset.g === g && !x.classList.contains('open'); x.classList.toggle('open', on); $('.mgh', x).setAttribute('aria-expanded', String(on)); }); lsSet('pdfwb.menu.g', $('#menu .mg.open') ? g : ''); };
  { const g0 = lsGet('pdfwb.menu.g'); openGroup(g0 == null ? 'file' : g0); }
  $('#menu').addEventListener('click', e => { const h = e.target.closest('.mgh'); if (h) { e.stopPropagation(); openGroup(h.parentElement.dataset.g); } });
  if (!window.WBCloud) { $('#mCloudOpen').hidden = true; $('#mCloudSave').hidden = true; }
  if (!window.WBTools) ['ocr', 'compress'].forEach(k => { const m = $(`#menu [data-act="${k}"]`); if (m) m.hidden = true; });
  if (!window.WBCompare) { const m = $('#menu [data-act="compare"]'); if (m) m.hidden = true; }
  // 1.8: nur zeigen, was hier geht
  const hideAct = k => { const m = $(`#menu [data-act="${k}"]`); if (m) m.hidden = true; };
  if (!window.WBSign) ['sign', 'verifysig'].forEach(hideAct);
  if (!window.WBConvert) ['convert', 'autotoc'].forEach(hideAct);
  if (!window.WBTemplates) hideAct('template');
  // 1.9
  if (!window.WBCite) hideAct('cite');
  if (!window.WBStats) hideAct('studystats');
  if (!window.WBEInvoice) hideAct('einvoice');
  if (!window.WBConvert || !window.WBTools) hideAct('mailmerge');
  if (!window.WBScan) hideAct('receipts');
  if (!window.WBBatch) hideAct('batch');
  if (!window.WBPdfA) hideAct('pdfa');
  if (!AIX) ['formula', 'contract'].forEach(hideAct);
  // 2.0
  if (!window.WBLibChat || !LIB || !window.WBSearch) hideAct('asklib');
  if (!window.WBAnki) hideAct('cardsx');
  if (!window.WBLedger || !LIB) hideAct('ledger');
  if (!LIB) hideAct('savever');
  if (!S.renderMode && !new URLSearchParams(location.search).get('share')) setTimeout(() => startTour(false), 1800);
  statsBind();
  viewer.addEventListener('pointermove', e => {
    if (!S.shareSess || !S.shareSess.cursor) return;
    const pg = e.target.closest && e.target.closest('.page'); if (!pg) return;
    const el = els.get(pg.dataset.id); if (!el) return;
    const r = el.svg.getBoundingClientRect();
    S.shareSess.cursor({ pid: pg.dataset.id, x: Math.round((e.clientX - r.left) / S.zoom), y: Math.round((e.clientY - r.top) / S.zoom) });
  }, { passive: true });
  if (!recOk()) { hideAct('record'); $('#btnRec').hidden = true; }
  if (LIB && window.WBSearch) $('#mSearchLib').hidden = false;
  $('#btnRec').onclick = () => ACTS.record();
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f' && LIB && window.WBSearch) { e.preventDefault(); e.stopPropagation(); libSearchDialog(); } }, true);
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
  $('#penKind').addEventListener('click', e => {
    const b = e.target.closest('button[data-k]'); if (!b) return;
    const k = b.dataset.k, tg = propTarget();
    if (tg && tg.isAnnot && tg.type === 'pen') { setProp('kind', k); return; }
    PEN_KINDS[TP.pen.kind] = { sw: TP.pen.sw, op: TP.pen.op, color: TP.pen.color };
    Object.assign(TP.pen, PEN_KINDS[k], { kind: k });
    renderProps();
  });
  $('#shapeChk').addEventListener('change', e => { TP.pen.shapes = e.target.checked; });
  $('#eraseIn').addEventListener('input', e => { TP.eraser.size = +e.target.value; $('#eraseOut').textContent = TP.eraser.size + ' pt'; });
  $('#scaleSel').addEventListener('change', e => setProp('scale', +e.target.value));
  $('#unitSel').addEventListener('change', e => setProp('unit', e.target.value));
  $('#pencilChip').addEventListener('click', () => setPencilOnly(!S.pencil.only));
  $('#colorPick').addEventListener('input', e => setProp('color', e.target.value, true));
  $('#colorPick').addEventListener('change', () => { S.propEdit = false; });
  $('#strokeIn').addEventListener('input', e => setProp('sw', +e.target.value, true));
  $('#strokeIn').addEventListener('change', () => { S.propEdit = false; });
  $('#opIn').addEventListener('input', e => setProp('op', +e.target.value, true));
  $('#opIn').addEventListener('change', () => { S.propEdit = false; });
  $('#fontSel').addEventListener('change', e => {
    const v = e.target.value, tg = propTarget();
    setProp('font', v); if (S.editing) S.editing.ta.focus();
    ensureFont(v, tg && tg.obj.bold).then(() => { if (S.editing) styleTA(); const p = S.sel ? pageById(S.sel.pid) : S.msel ? pageById(S.msel.pid) : null; if (p) drawAnnots(p); });
  });
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
    if (e.key === 'Escape') { fi.value = ''; runFind(''); fi.blur(); closeFind(); }
    if (e.key === 'ArrowDown' && S.find && S.find.hits.length) { e.preventDefault(); goHit(S.find.i + 1); }
    if (e.key === 'ArrowUp' && S.find && S.find.hits.length) { e.preventDefault(); goHit(S.find.i - 1); }
  });
  fi.addEventListener('focus', () => { $('.find').classList.add('open'); if (S.find) findList(true); });
  $('#findToggle').onclick = () => openFind();
  $('#findClose').onclick = () => { fi.value = ''; runFind(''); closeFind(); };
  $('#findList').addEventListener('mousedown', e => e.preventDefault());
  $('#findList').addEventListener('click', e => {
    const r = e.target.closest('[data-h]'); if (r) { goHit(+r.dataset.h); if (innerWidth <= 760) closeFind(true); return; }
    if (e.target.closest('[data-fl="lib"]')) { closeFind(true); libSearchDialog(); }
  });
  $('#findList').addEventListener('change', e => { const o = e.target.closest('[data-fo]'); if (!o) return; FIND_OPT[o.dataset.fo] = o.checked; lsSet('pdfwb.findopt', JSON.stringify(FIND_OPT)); runFind(fi.value); });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.find')) closeFind(true); }, true);
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
    // nur ansehen: Blättern, Zoom, Suche und Vollbild erlaubt, alles andere nicht
    if (S.viewonly && !typing && !/^(arrow|page|home|end|escape|f$|f11|\?)/.test(k) && !(mod && /^[f+=\-0p]$/.test(k)) && !(k === ' ')) { if (k.length === 1 || /delete|backspace/.test(k)) { e.preventDefault(); return; } }
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
    if (mod && k === 's' && S.file) { e.preventDefault(); saveToFile(e.shiftKey); return; }
    if (mod && k === 's') { e.preventDefault(); if (S.lib && !e.shiftKey) { libSave().then(() => { setMsg('In der Bibliothek gesichert'); toast('In der Bibliothek gesichert · Als PDF-Datei: „Exportieren“ oder Strg+Umschalt+S'); }); } else savePdf(); return; }
    if (mod && k === 'o') { e.preventDefault(); $('#fileOpen').click(); return; }
    if (mod && k === 'f' && !e.shiftKey) { e.preventDefault(); openFind(); return; }
    if (typing) return;
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'c') { if (copySelection(false)) e.preventDefault(); return; }
    if (mod && k === 'x') { if (S.tool !== 'objects' && copySelection(true)) e.preventDefault(); return; }
    if (mod && k === 'v') return; // übernimmt das paste-Ereignis
    if (mod && k === 'd') { e.preventDefault(); duplicateSel(); return; }
    if (mod && k === 'a' && S.tool === 'select') { e.preventDefault(); const p = S.pages[S.cur]; if (p) setMulti(p.id, p.annots.map(a => a.id)); return; }
    if (mod && (k === '+' || k === '=')) { e.preventDefault(); zoomStep(1); return; }
    if (mod && k === '-') { e.preventDefault(); zoomStep(-1); return; }
    if (mod && k === '0') { e.preventDefault(); fitWidth(); return; }
    if (mod || e.altKey) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (S.csel) { e.preventDefault(); deleteContent(); }
      else if (selAnnot() || S.msel) { e.preventDefault(); deleteSel(); }
      return;
    }
    if (e.key === 'Escape' && !$('#aiPanel').hidden) { toggleAI(false); return; }
    if (e.key === 'Escape') { if (S.reading) setReading(false); else if (S.csel) setCsel(null, []); else if (S.sel || S.msel) setMulti(null, []); else setTool('select'); return; }
    if (k === 'f') { setReading(!S.reading); return; }
    if (e.key === '?') { e.preventDefault(); shortcutsDialog(); return; }
    if (k === 'y' && AIX) { e.preventDefault(); toggleAI(); return; }
    if (S.reading && (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ')) { e.preventDefault(); scrollToPage(Math.min(S.pages.length - 1, S.cur + 1)); return; }
    if (S.reading && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) { e.preventDefault(); scrollToPage(Math.max(0, S.cur - 1)); return; }
    if (e.key === 'Enter' && S.csel && S.csel.items.length === 1 && S.csel.items[0].kind === 'text') { e.preventDefault(); editContentText(pageById(S.csel.pid), S.csel.items[0]); return; }
    if (e.key.startsWith('Arrow') && S.csel && S.tool === 'objects') {
      e.preventDefault();
      const st = e.shiftKey ? 10 : 1;
      nudgeContent(e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0);
      return;
    }
    if (e.key.startsWith('Arrow') && S.msel) {
      e.preventDefault();
      const st = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, dy = e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0;
      const now = Date.now(); if (now - lastNudge > 700) pushHist(); lastNudge = now;
      const s = selectedAnnots(); s.list.forEach(a => Object.assign(a, translated(a, dx, dy))); drawAnnots(s.p); markDirty();
      return;
    }
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
    if (k === 'z') { window.toggleCalc(); return; }
    if (KEYS[k]) setTool(KEYS[k]);
  });
  window.addEventListener('beforeunload', e => { if (S.dirty && !S.sample) { e.preventDefault(); e.returnValue = ''; } });
}

/* ---------- Bibliothek (Webseite und Desktop-App) ----------
   ?doc=<id> öffnet ein Dokument aus der Bibliothek; jede Änderung wird dort automatisch gesichert. */
const LIB = window.WBStore || null;
function libState(s) {
  const el = $('#libState'); if (!el || !S.lib) return;
  el.hidden = false; el.dataset.s = s;
  el.textContent = { pending: 'Änderungen …', saving: 'Sichert …', saved: 'Gesichert', error: 'Nicht gesichert' }[s] || '';
  el.title = s === 'saved' ? 'Automatisch in der Bibliothek gesichert' : s === 'error' ? 'Konnte nicht in der Bibliothek sichern' : '';
}
async function pageThumb() {
  const p = S.pages[0]; if (!p) return null;
  try {
    const proxy = proxyOf(p), base = proxy.getViewport({ scale: 1, rotation: rotOf(p) }), vp = proxy.getViewport({ scale: 360 / base.width, rotation: rotOf(p) });
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
    return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
  } catch (e) { return null; }
}
let libSaving = null;
async function libSave() {
  clearTimeout(autoT);
  if (!S.lib || !LIB || !S.pages.length) return;
  if (libSaving) { await libSaving; if (!S.dirty) return; }
  libSaving = (async () => {
    libState('saving');
    try {
      commitEdit();
      const state = docState();
      state.dirty = false;
      const sources = [...S.sources.values()].map(x => ({ id: x.id, name: x.name, bytes: x.bytes }));
      await persistAudio();
      await LIB.saveDoc(S.lib.id, { state, sources, thumb: await pageThumb(), pages: S.pages.length });
      S.dirty = false; updateTitle(); libState('saved');
      scheduleDrive(); snapshotVersion(false);
    } catch (e) { console.error(e); libState('error'); toast('In der Bibliothek sichern fehlgeschlagen: ' + (e.message || e)); }
  })();
  try { await libSaving; } finally { libSaving = null; }
}
/* Google-Drive-Backup des offenen Dokuments: kurz nach dem Sichern die PDF erzeugen und hochladen */
let driveT = 0, driveBusy = false;
const gdWants = () => !!(window.WBDrive && window.WBDrive.enabled() && (!window.WBDrive.wants || window.WBDrive.wants('change')));
const clWants = () => !!(window.WBCloud && window.WBCloud.wants());
function scheduleDrive(ms = 10000) {
  if (!S.lib || S.renderMode) return;
  // im Modus „beim Schließen“, „täglich“ oder „manuell“ sichert die Bibliothek, nicht jede Speicherung hier
  if (!gdWants() && !clWants()) return;
  clearTimeout(driveT); driveT = setTimeout(driveBackup, ms);
}
async function driveBackup() {
  if (driveBusy) { scheduleDrive(3000); return; }
  if (!S.lib || S.dirty) { scheduleDrive(4000); return; }
  driveBusy = true;
  try {
    const id = S.lib.id, bytes = await buildPdf(S.pages), done = [];
    if (gdWants()) {
      if (await window.WBDrive.backupNow(id, bytes)) done.push('Drive');
      else if (window.WBDrive.info().status === 'auth') { const el = $('#libState'); if (el) el.title = 'Google Drive: Anmeldung abgelaufen, in der Bibliothek auf „Fortsetzen“ tippen'; }
    }
    if (clWants() && await window.WBCloud.backupNow(id, bytes)) done.push(...window.WBCloud.enabledIds().map(k => window.WBCloud.info(k).short));
    const el = $('#libState');
    if (done.length && el && el.dataset.s === 'saved') { el.textContent = 'Gesichert · ' + (done.length === 1 ? done[0] : 'Cloud'); el.title = 'In der Bibliothek und in ' + done.join(', ') + ' gesichert'; }
  } catch (e) { console.warn('Drive', e); }
  driveBusy = false;
}
async function openLibDoc(id) {
  busy(true, 'Dokument wird geöffnet …');
  try {
    const rec = await LIB.loadDoc(id);
    S.lib = { id, name: rec.item.name };
    if (rec.state) {
      await applyState(rec.state, async sid => rec.sources.find(x => x.id === sid));
      S.docName = rec.item.name + '.pdf';
    } else {
      // frisch importiert: erste Quelle öffnen, Quell-ID bleibt die der Bibliothek
      const src = rec.sources[0];
      const pages = await addSource(src.bytes, rec.item.name + '.pdf', src.id);
      S.bookmarks = await importOutline(src.id, pages);
      S.pages = pages; S.docName = rec.item.name + '.pdf'; S.sample = false; S.dirty = false; S.hist = []; S.fut = []; S.cur = 0;
      try {
        const info = (await S.sources.get(src.id).pdf.getMetadata()).info || {};
        S.meta = { title: info.Title || '', author: info.Author || '', subject: info.Subject || '', keywords: info.Keywords || '' };
      } catch (e) { /* keine Metadaten */ }
      S.zoom = initialZoom(); buildViewer(); updateTitle(); updateUndo();
    }
    S.dirty = false; updateTitle(); setTimeout(einvoiceCheck, 600);
    document.title = rec.item.name + ' · PDF Werkbank';
    const dec = rec.sources.filter(x => S.decrypted.has(x.id) && S.sources.get(x.id));
    if (dec.length && !S.renderMode) {
      for (const x of dec) await LIB.putBlob(`src:${id}:${x.id}`, { name: x.name, bytes: S.sources.get(x.id).bytes });
      await LIB.update(id, { contentDirty: true, upSrc: [] });
    }
    libState('saved'); libUI();
    busy(false); setMsg('Aus der Bibliothek geöffnet · Änderungen werden automatisch gesichert');
    ensureFontsOf(S.pages);
    if (!S.renderMode && !/[?&](page|q)=/.test(location.search)) resumePos();
    if (!S.renderMode) attachShareForLib();
    // Vorschau nachziehen, falls noch keine da ist
    if (!(await LIB.getBlob('thumb:' + id))) { const t = await pageThumb(); if (t) await LIB.putBlob('thumb:' + id, t); }
    return true;
  } catch (e) {
    console.error(e); busy(false);
    S.lib = null;
    if (S.renderMode) { parent.postMessage({ wbRender: id, error: e.message || String(e) }, location.origin === 'null' ? '*' : location.origin); return false; }
    await ask('Dokument nicht verfügbar', e.message || String(e), 'Zur Bibliothek', 'Hier bleiben', false).then(y => { if (y) location.href = 'library.html'; });
    return false;
  }
}
async function goLibrary(extra = '') {
  if (S.lib && S.dirty) await libSave();
  else if (S.lib && libSaving) await libSaving;
  location.href = 'library.html' + extra;
}
/* aktuelles (nicht gespeichertes) Dokument in die Bibliothek übernehmen */
async function toLibrary() {
  if (!LIB || S.lib || !S.pages.length) return;
  busy(true, 'Wird in die Bibliothek übernommen …');
  try {
    const first = [...S.sources.values()][0];
    const it = await LIB.importPdf(first.bytes, S.docName.replace(/\.pdf$/i, ''), null, { pages: S.pages.length });
    S.lib = { id: it.id, name: it.name };
    S.sample = false;
    history.replaceState(null, '', 'index.html?doc=' + encodeURIComponent(it.id));
    busy(false);
    await libSave();
    libUI();
    try { await idbDel('session'); } catch (e) { /* egal */ }
    toast(`„${it.name}“ ist jetzt in der Bibliothek`);
  } catch (e) { console.error(e); busy(false); toast('Übernehmen fehlgeschlagen: ' + (e.message || e)); }
}
/* Öffnen im Bibliotheksmodus: neue PDFs in die Bibliothek legen und das erste öffnen */
async function openIntoLibrary(pdfs) {
  busy(true, 'PDF wird in die Bibliothek gelegt …');
  try {
    let first = null;
    for (const f of pdfs) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const it = await LIB.importPdf(bytes, f.name, null, {});
      first = first || it;
    }
    if (S.dirty) await libSave();
    location.href = 'index.html?doc=' + encodeURIComponent(first.id);
  } catch (e) { busy(false); toast('Öffnen fehlgeschlagen: ' + (e.message || e)); }
}
function libUI() {
  const b = $('#btnLib'); if (!b) return;
  b.hidden = !LIB;
  const m = $('#mToLib'); if (m) m.hidden = !LIB || !!S.lib;
  const lp = $('#mLibPages'); if (lp) lp.hidden = !S.lib;
  const mc = $('#mCollab'); if (mc) mc.hidden = !window.WBShare || (!S.lib && !S.share);
  document.body.classList.toggle('libmode', !!S.lib);
  const sv = $('#btnSave');
  if (S.lib) { sv.title = 'Als PDF-Datei exportieren'; const l = sv.querySelector('.lbl'); if (l) l.textContent = 'Exportieren'; }
}
if (window.wbDesktop) document.documentElement.classList.add('desktop', window.wbDesktop.platform === 'darwin' ? 'mac' : 'win');
// vor einem Update offene Änderungen sichern
window.wbFlush = async () => { if (S.lib && S.dirty) await libSave(); };

/* Befehlspalette (Strg/⌘+K): Werkzeuge, Menüpunkte, Seiten */
function paletteProvider(q) {
  const out = [];
  const keyOf = t => Object.keys(KEYS).find(k => KEYS[k] === t);
  for (const [t, label] of Object.entries(TOOL_NAMES)) {
    if (!$(`[data-tool="${t}"]`)) continue;
    const k = keyOf(t);
    out.push({ group: 'Werkzeug', label, hint: k ? k.toUpperCase() : '', run: () => setTool(t) });
  }
  for (const b of $$('#menu [data-act]')) {
    const h = b.closest('[hidden]');
    if (b.hidden || (h && h.id !== 'menu')) continue;
    out.push({ group: 'Aktion', label: b.textContent.replace(/…/g, '').trim(), run: () => b.click() });
  }
  const A = (label, run, hint, keys) => out.push({ group: 'Aktion', label, run, hint, keys });
  A(S.lib ? 'Als PDF-Datei exportieren' : 'PDF speichern', savePdf, S.lib ? 'Strg+Umschalt+S' : 'Strg+S', 'download speichern export');
  if (S.lib) A('In der Bibliothek sichern', () => libSave(), 'Strg+S');
  if (LIB) A('Zur Bibliothek', () => goLibrary(), '', 'start ordner home');
  A('PDF öffnen', () => $('#fileOpen').click(), 'Strg+O');
  A('Im Dokument suchen', () => openFind(), 'Strg+F', 'finden');
  A('Präsentieren mit Laserpointer', () => { setReading(true); setTool('laser'); }, 'F, J', 'vollbild präsentation laser');
  A('Rückgängig', undo, 'Strg+Z'); A('Wiederholen', redo, 'Strg+Y');
  A('Vergrößern', () => $('#btnZoomIn').click(), 'Strg +'); A('Verkleinern', () => $('#btnZoomOut').click(), 'Strg −');
  A('Seitenbreite', fitWidth, 'Strg+0', 'zoom anpassen');
  A('Nach Updates suchen', () => { if (window.WBUpdate) window.WBUpdate.check(true); }, '', 'update version aktualisieren');
  if (AIX) {
    out.push({ group: 'KI', label: 'KI-Assistent öffnen', hint: 'Y', keys: 'chatgpt claude ai frage', run: () => toggleAI(true) });
    for (const a of AI_ACTIONS) out.push({ group: 'KI', label: 'KI: ' + a.l, keys: 'chatgpt claude ai', run: () => { toggleAI(true); $(`#aiQuick [data-q="${a.k}"]`).click(); } });
  }
  const n = parseInt(String(q || '').replace(/\D/g, ''), 10);
  if (n >= 1 && n <= S.pages.length) out.push({ group: 'Seite', label: 'Gehe zu Seite ' + n, hint: 'von ' + S.pages.length, run: () => scrollToPage(n - 1), keys: String(n) });
  for (const b of S.bookmarks || []) { const i = S.pages.findIndex(p => p.id === b.pid); if (i >= 0) out.push({ group: 'Lesezeichen', label: b.title || b.name || 'Lesezeichen', hint: 'S. ' + (i + 1), run: () => scrollToPage(i) }); }
  return out;
}
if (window.WBPalette) window.WBPalette.add(paletteProvider);

