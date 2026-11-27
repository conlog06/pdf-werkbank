/* ---------- 3. In allen Dokumenten suchen (Bibliothek) ---------- */
function libSearchDialog() {
  if (!LIB || !window.WBSearch) { toast('Die Suche über alle Dokumente gibt es in der Bibliothek.'); return; }
  dialog('In allen Dokumenten suchen', `<input class="field" id="lsQ" type="search" placeholder="Begriff in allen Skripten und Dokumenten …" autocomplete="off" style="height:36px;width:100%">
    <p class="note" id="lsInfo" style="margin:0"></p><div class="lsres" id="lsRes"></div>`, 'Schließen', () => true);
  $('#dlgCancel').hidden = true; $('#dlg .card').classList.add('wide');
  const b = $('#dlgBody'), q = $('#lsQ', b); setTimeout(() => q.focus(), 40);
  if (S.find && S.find.q) q.value = S.find.q;
  let tok = 0, t = 0;
  const run = async () => {
    const my = ++tok, v = q.value.trim();
    if (v.length < 2) { $('#lsRes', b).innerHTML = ''; $('#lsInfo', b).textContent = 'Mindestens zwei Zeichen.'; return; }
    $('#lsInfo', b).textContent = 'Sucht …';
    const items = (await LIB.all()).filter(i => i.kind === 'doc' && !i.trashed && !i.deleted);
    const res = await WBSearch.search(v, items);
    if (my !== tok) return;
    const pr = WBSearch.progress(), total = res.reduce((n, r) => n + r.total, 0);
    $('#lsInfo', b).textContent = (res.length ? `${total} Treffer in ${res.length} ${res.length === 1 ? 'Dokument' : 'Dokumenten'}` : 'Nichts gefunden.') + (pr.running && pr.total ? ` · Index wird aufgebaut (${pr.done}/${pr.total})` : '');
    $('#lsRes', b).innerHTML = res.slice(0, 30).map(r => `<div class="lsdoc"><b>${esc(r.doc.name)}${S.lib && r.doc.id === S.lib.id ? ' <span class="note">(dieses)</span>' : ''}</b>${r.hits.map(h => `<button class="lshit" data-doc="${r.doc.id}" data-page="${h.n}"><span class="pg">S. ${h.n}</span><span>${esc(h.pre)}<mark>${esc(h.hit)}</mark>${esc(h.post)}</span></button>`).join('')}</div>`).join('');
  };
  q.oninput = () => { clearTimeout(t); t = setTimeout(run, 220); };
  if (q.value) run();
  b.onclick = e => {
    const h = e.target.closest('[data-doc]'); if (!h) return;
    const id = h.dataset.doc, pg = +h.dataset.page, v = q.value.trim();
    closeDlg(); $('#dlg .card').classList.remove('wide');
    if (S.lib && id === S.lib.id) { scrollToPage(pg - 1); $('#findInput').value = v; runFind(v); return; }
    libSave().then(() => { location.href = 'index.html?doc=' + encodeURIComponent(id) + '&page=' + pg + '&q=' + encodeURIComponent(v); });
  };
  WBSearch.schedule && WBSearch.schedule(200);
}

/* ---------- 4. Zweites Dokument daneben ---------- */
const S2 = { el: null, pdf: null, name: '', scale: 1, io: null, w: 0 };
async function splitDialog() {
  const opts = [['file', 'PDF vom Gerät …'], ['self', 'Dieses Dokument (andere Stelle)']];
  if (LIB) opts.push(['lib', 'Aus der Bibliothek …']);
  if (window.WBCloud && WBCloud.anyEnabled()) opts.push(['cloud', 'Aus der Cloud …']);
  dialog('Zweites Dokument daneben', `<p class="note" style="margin:0">Öffnet ein zweites PDF rechts neben deinem Dokument, z. B. das Skript neben dem Übungsblatt. Zum Lesen, Blättern und Text kopieren.</p>
    <div class="radios">${opts.map(([k, l], i) => `<label class="chkrow"><input type="radio" name="s2" value="${k}" ${i === (LIB ? 2 : 0) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    <label class="fld" id="s2LibW"${LIB ? '' : ' hidden'}><span>Dokument</span><select class="field" id="s2Lib"></select></label>`, 'Öffnen', b => {
    const w = $('[name=s2]:checked', b).value;
    closeDlg();
    (async () => {
      if (w === 'file') { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,.pdf'; inp.onchange = async () => { const f = inp.files[0]; if (f) splitOpen(new Uint8Array(await f.arrayBuffer()), f.name); }; inp.click(); }
      else if (w === 'self') { busy(true, 'Wird vorbereitet …'); try { const by = await buildPdf(S.pages); busy(false); splitOpen(by, S.docName, S.cur); } catch (e) { busy(false); toast(e.message || String(e)); } }
      else if (w === 'cloud') { const f = await WBCloud.pick({ mode: 'open', accept: ['pdf'] }); if (f && f[0]) splitOpen(f[0].bytes, f[0].name); }
      else if (w === 'lib') {
        const id = $('#s2Lib', b).value; if (!id) return;
        busy(true, 'Dokument wird geladen …');
        try { const it = await LIB.get(id); const by = window.WBDrive && window.WBDrive.pdfOf ? await window.WBDrive.pdfOf(it) : (await LIB.loadDoc(id)).sources[0].bytes; busy(false); splitOpen(by, it.name); }
        catch (e) { busy(false); toast('Laden fehlgeschlagen: ' + (e.message || e)); }
      }
    })();
    return false;
  });
  const b = $('#dlgBody');
  if (LIB) {
    const items = (await LIB.all()).filter(i => i.kind === 'doc' && !i.trashed && !i.deleted && (!S.lib || i.id !== S.lib.id)).sort((x, y) => (y.openedAt || y.updatedAt || 0) - (x.openedAt || x.updatedAt || 0));
    $('#s2Lib', b).innerHTML = items.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('');
  }
  b.onchange = () => { const w = $('[name=s2]:checked', b).value; $('#s2LibW', b).hidden = w !== 'lib'; };
}
async function splitOpen(bytes, name, page = 0) {
  splitClose();
  let pdf;
  try { pdf = await PDFJS.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise; }
  catch (e) { toast('Die PDF lässt sich nicht öffnen' + (/password/i.test(e.name || e.message) ? ' (passwortgeschützt).' : '.')); return; }
  const el = document.createElement('aside'); el.className = 'split2';
  S2.w = +lsGet('pdfwb.split.w') || Math.round(Math.min(640, innerWidth * 0.42));
  el.style.setProperty('--s2w', S2.w + 'px');
  el.innerHTML = `<div class="s2grip" title="Breite ändern"></div><header><b title="${esc(name)}">${esc(name.replace(/\.pdf$/i, ''))}</b><span class="note s2pg"></span><span class="grow"></span>
    <button class="ibtn" data-s2="zout" title="Kleiner">${icon('zout')}</button><button class="ibtn" data-s2="zin" title="Größer">${icon('zin')}</button>
    <button class="ibtn" data-s2="copy" title="Text dieser Seite kopieren">${icon('copy')}</button><button class="ibtn" data-s2="swap" title="Als Hauptdokument öffnen">${icon('open')}</button><button class="ibtn" data-s2="close" title="Schließen">✕</button></header><div class="s2body"></div>`;
  document.body.appendChild(el);
  Object.assign(S2, { el, pdf, name, scale: 1, bytes });
  $('#app').classList.add('split2open'); document.documentElement.style.setProperty('--s2w', S2.w + 'px'); document.documentElement.style.setProperty('--s2top', Math.round($('.work').getBoundingClientRect().top) + 'px');
  await splitLayout();
  if (page) setTimeout(() => { const pg = $$('.s2p', el)[page]; if (pg) $('.s2body', el).scrollTop = pg.offsetTop - 8; }, 60);
  const body = $('.s2body', el);
  body.addEventListener('scroll', () => { const ps = $$('.s2p', el); let k = 0; for (let j = 0; j < ps.length; j++) if (ps[j].offsetTop - body.scrollTop < body.clientHeight / 3) k = j; $('.s2pg', el).textContent = `Seite ${k + 1} / ${pdf.numPages}`; S2.cur = k; }, { passive: true });
  $('.s2pg', el).textContent = `Seite 1 / ${pdf.numPages}`; S2.cur = 0;
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-s2]'); if (!b) return;
    const k = b.dataset.s2;
    if (k === 'close') splitClose();
    else if (k === 'zin' || k === 'zout') { S2.scale = clamp(S2.scale * (k === 'zin' ? 1.2 : 1 / 1.2), 0.5, 3); const keep = S2.cur || 0; await splitLayout(); const pg = $$('.s2p', el)[keep]; if (pg) body.scrollTop = pg.offsetTop - 8; }
    else if (k === 'copy') { const pg = await pdf.getPage((S2.cur || 0) + 1), tc = await pg.getTextContent(); const ok = await writeSysClip(tc.items.map(i => i.str + (i.hasEOL ? '\n' : '')).join('').replace(/[ \t]+\n/g, '\n')); toast(ok ? `Text von Seite ${(S2.cur || 0) + 1} kopiert` : 'Kopieren nicht möglich'); }
    else if (k === 'swap') { const by = S2.bytes, nm = S2.name; splitClose(); await openFiles([new File([by], nm.endsWith('.pdf') ? nm : nm + '.pdf', { type: 'application/pdf' })], 'replace'); }
  });
  // Breite ziehen
  $('.s2grip', el).addEventListener('pointerdown', e => {
    e.preventDefault(); const x0 = e.clientX, w0 = S2.w;
    const mv = ev => { S2.w = clamp(w0 + (x0 - ev.clientX), 260, innerWidth - 320); el.style.setProperty('--s2w', S2.w + 'px'); document.documentElement.style.setProperty('--s2w', S2.w + 'px'); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); lsSet('pdfwb.split.w', String(S2.w)); splitLayout(); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
}
async function splitLayout() {
  const el = S2.el; if (!el) return;
  const body = $('.s2body', el), W = Math.max(200, (body.clientWidth || S2.w) - 24) * S2.scale;
  if (S2.io) S2.io.disconnect();
  body.innerHTML = '';
  for (let i = 1; i <= S2.pdf.numPages; i++) {
    const pg = await S2.pdf.getPage(i), vp = pg.getViewport({ scale: 1 });
    const d = document.createElement('div'); d.className = 's2p'; d.dataset.n = i; d.style.width = W + 'px'; d.style.height = Math.round(W * vp.height / vp.width) + 'px';
    d.innerHTML = `<span class="pnum">${i}</span>`; body.appendChild(d);
  }
  S2.io = new IntersectionObserver(ents => ents.forEach(async en => {
    if (!en.isIntersecting || en.target.dataset.done) return;
    en.target.dataset.done = '1';
    const pg = await S2.pdf.getPage(+en.target.dataset.n), base = pg.getViewport({ scale: 1 }), dpr = Math.min(2, devicePixelRatio || 1);
    const vp = pg.getViewport({ scale: en.target.clientWidth / base.width * dpr }), c = document.createElement('canvas');
    c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.catch(() => {});
    en.target.prepend(c);
  }), { root: body, rootMargin: '500px' });
  $$('.s2p', body).forEach(x => S2.io.observe(x));
}
function splitClose() {
  if (!S2.el) return;
  if (S2.io) S2.io.disconnect();
  try { S2.pdf.destroy(); } catch (e) { /* egal */ }
  S2.el.remove(); S2.el = null; S2.pdf = null;
  $('#app').classList.remove('split2open');
}

/* ---------- 5. Handschrift in Text ---------- */
async function inkCanvas(strokes) {
  const bb = strokes.map(bbox).reduce((u, b) => ({ x0: Math.min(u.x0, b.x), y0: Math.min(u.y0, b.y), x1: Math.max(u.x1, b.x + b.w), y1: Math.max(u.y1, b.y + b.h) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const pad = 8, w = bb.x1 - bb.x0 + 2 * pad, h = bb.y1 - bb.y0 + 2 * pad, k = clamp(1400 / Math.max(w, h), 2, 6);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * k)}" height="${Math.round(h * k)}" viewBox="${bb.x0 - pad} ${bb.y0 - pad} ${w} ${h}"><rect x="${bb.x0 - pad}" y="${bb.y0 - pad}" width="${w}" height="${h}" fill="#fff"/>${strokes.map(a => annotSVG({ ...a, color: '#000000', op: 100 })).join('')}</svg>`;
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(img, 0, 0);
  return { c, bb };
}
async function hwToText() {
  commitEdit();
  const p = S.pages[S.cur];
  let pg = p, strokes = [];
  if (S.msel) { pg = pageById(S.msel.pid); strokes = pg.annots.filter(a => S.msel.ids.includes(a.id) && a.t === 'pen'); }
  else if (S.sel) { pg = pageById(S.sel.pid); const a = selAnnot(); if (a && a.t === 'pen') strokes = [a]; }
  if (!strokes.length) { pg = p; strokes = p.annots.filter(a => a.t === 'pen' && penKind(a) !== 'marker'); }
  if (!strokes.length) { toast('Keine Handschrift gefunden. Striche mit dem Auswahlwerkzeug markieren oder auf dieser Seite schreiben.'); return; }
  busy(true, 'Handschrift wird gelesen …');
  let text = '', via = '';
  try {
    const { c, bb } = await inkCanvas(strokes);
    if (AIX && AIX.info().ready) {
      via = 'KI';
      text = await AIX.ask({ instructions: 'Du transkribierst Handschrift. Gib NUR den geschriebenen Text zurück, mit Zeilenumbrüchen wie im Bild, ohne Kommentar. Formeln in normaler Schreibweise (x^2, √, ≤). Unleserliches als [?].', messages: [{ role: 'user', text: 'Was steht hier?', images: [c.toDataURL('image/jpeg', 0.9)] }], maxTokens: 1200 });
    } else if (window.WBTools) {
      via = 'Texterkennung';
      text = (await WBTools.recognizeImage(c)).text;
    } else throw new Error('Keine Erkennung verfügbar.');
    busy(false);
    text = String(text || '').replace(/^```[a-z]*\n?|```$/g, '').trim();
    const lines = Math.max(1, text.split('\n').length), size = r2(clamp((bb.y1 - bb.y0) / lines / 1.3, 7, 40));
    const col = strokes[0].color && !/^#f/i.test(strokes[0].color) ? strokes[0].color : '#1b2130';
    dialog('Handschrift in Text', `<p class="note" style="margin:0">Erkannt mit ${via}${via === 'Texterkennung' ? ' (für Handschrift ist die KI deutlich besser; Funken-Symbol oben)' : ''}. Bitte prüfen und bei Bedarf korrigieren.</p>
      <textarea class="field area" id="hwText" rows="${Math.min(10, lines + 2)}">${esc(text)}</textarea>
      <label class="chkrow"><input type="checkbox" id="hwKeep"> Handschrift behalten (Text darunter einfügen)</label>`, 'Übernehmen', b => {
      const t = $('#hwText', b).value.trim(); if (!t) return false;
      const keep = $('#hwKeep', b).checked;
      pushHist();
      const ids = new Set(strokes.map(a => a.id));
      if (!keep) pg.annots = pg.annots.filter(a => !ids.has(a.id));
      const a = { id: uid(), t: 'text', text: t, size, font: 'Helvetica', bold: false, color: col, x: r2(bb.x0), y: r2(keep ? bb.y1 + 6 : bb.y0) };
      pg.annots.push(a); S.msel = null; drawAnnots(pg); markDirty(); select(pg.id, a.id);
      toast(keep ? 'Text unter der Handschrift eingefügt' : `${strokes.length} ${strokes.length === 1 ? 'Strich' : 'Striche'} in Text umgewandelt`);
    });
  } catch (e) { busy(false); console.error(e); toast('Erkennen fehlgeschlagen: ' + (e.message || e)); }
}

/* ---------- 6. Digitale Signatur ---------- */
function signDialog() {
  if (!window.WBSign) { toast('Signieren ist hier nicht verfügbar.'); return; }
  const I = WBSign.info();
  if (!I) { certDialog(); return; }
  const fmtD = t => new Date(t).toLocaleDateString('de-DE');
  dialog('Digital signieren', `<div class="certcard">${icon('sig')}<span><b>${esc(I.name)}</b><small>${I.selfSigned ? 'Selbst erstelltes Zertifikat' : 'Ausgestellt von ' + esc(I.issuer)} · gültig bis ${fmtD(I.to)}</small></span><button type="button" class="btn" id="sgCert">Ändern</button></div>
    <div class="frow"><label class="fld"><span>Grund</span><select class="field" id="sgReason"><option>Ich bin der Verfasser dieses Dokuments</option><option>Ich stimme diesem Dokument zu</option><option>Geprüft und freigegeben</option><option value="">Ohne Angabe</option></select></label>
    <label class="fld"><span>Ort</span><input class="field" id="sgLoc" value="${esc(lsGet('pdfwb.sign.loc') || '')}" placeholder="z. B. Bielefeld"></label></div>
    <div class="frow"><label class="fld"><span>Sichtbarer Stempel</span><select class="field" id="sgVis"><option value="last">Unten rechts auf der letzten Seite</option><option value="cur">Unten rechts auf dieser Seite</option><option value="first">Unten rechts auf der ersten Seite</option><option value="none">Unsichtbar</option></select></label>
    <label class="fld"><span>Zertifikats-Passwort</span><input class="field" id="sgPw" type="password" autocomplete="current-password"></label></div>
    <p class="note" style="margin:0">Die Werkbank speichert eine signierte Kopie als PDF. Jede spätere Änderung an dieser Datei macht die Signatur ungültig.${I.selfSigned ? ' Bei selbst erstellten Zertifikaten zeigt Acrobat „Identität unbekannt“, die Unversehrtheit des Dokuments ist trotzdem prüfbar.' : ''}</p><p class="note" id="sgErr" style="color:var(--danger);margin:0"></p>`, 'Signieren und speichern', b => {
    const pw = $('#sgPw', b).value, vis = $('#sgVis', b).value;
    if (!pw) { $('#sgErr', b).textContent = 'Bitte das Passwort eingeben.'; return false; }
    const ok = $('#dlgOk'); ok.disabled = true; ok.textContent = 'Signiert …';
    (async () => {
      try {
        lsSet('pdfwb.sign.loc', $('#sgLoc', b).value.trim());
        const bytes = await buildPdf(S.pages);
        const pdf = await PL.PDFDocument.load(bytes, { updateMetadata: false }), pages = pdf.getPages();
        const pi = vis === 'first' ? 0 : vis === 'cur' ? S.cur : pages.length - 1, pgx = pages[pi], { width: W } = pgx.getSize();
        const visible = vis === 'none' ? null : { page: pi, rect: [W - 36 - 200, 34, 200, 52] };
        const r = await WBSign.sign(bytes, { password: pw, reason: $('#sgReason', b).value, location: $('#sgLoc', b).value.trim(), visible });
        closeDlg();
        await saveBytes(r.bytes, baseName() + ' (signiert).pdf');
        toast(`Signiert von ${r.meta.name} · ${r.time.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`);
      } catch (e) { ok.disabled = false; ok.textContent = 'Signieren und speichern'; $('#sgErr', b).textContent = e.message || String(e); }
    })();
    return false;
  });
  $('#sgCert').onclick = () => { closeDlg(); certDialog(); };
  setTimeout(() => { const f = $('#sgPw'); if (f && !COARSE) f.focus(); }, 50);
}
function certDialog() {
  const I = WBSign.info();
  dialog('Zertifikat für Signaturen', `${I ? `<div class="certcard">${icon('sig')}<span><b>${esc(I.name)}</b><small>${esc(I.email || '')} · ${I.selfSigned ? 'selbst erstellt' : esc(I.issuer)} · bis ${new Date(I.to).toLocaleDateString('de-DE')}<br>${esc(I.fingerprint)}</small></span></div>
      <div class="row"><button type="button" class="btn" id="ctExport">${icon('save')}Sichern (.p12)</button><button type="button" class="btn" id="ctDel">${icon('trash')}Entfernen</button></div><hr>` : ''}
    <div class="seg" role="tablist"><button type="button" data-ct="import" aria-pressed="true">Datei importieren</button><button type="button" data-ct="new" aria-pressed="false">Eigenes erstellen</button></div>
    <div id="ctImport" class="form"><p class="note" style="margin:0">Zertifikat als <b>.p12</b> oder <b>.pfx</b>, z. B. von der Hochschule, dem Arbeitgeber oder einem Anbieter (D-Trust, SwissSign …). Es bleibt nur auf diesem Gerät.</p>
      <input type="file" id="ctFile" accept=".p12,.pfx,application/x-pkcs12"><label class="fld"><span>Passwort der Datei</span><input class="field" id="ctPw" type="password"></label></div>
    <div id="ctNew" class="form" hidden><p class="note" style="margin:0">Für Angebote, Rechnungen und interne Freigaben reicht oft ein eigenes Zertifikat. Andere sehen deinen Namen und dass das Dokument unverändert ist; als „vertrauenswürdig“ gilt es erst, wenn sie es einmal bestätigen.</p>
      <div class="frow"><label class="fld"><span>Name</span><input class="field" id="ctName" value="${esc(S.prefs.author || '')}"></label><label class="fld"><span>E-Mail</span><input class="field" id="ctMail" type="email"></label></div>
      <label class="fld"><span>Firma (optional)</span><input class="field" id="ctOrg"></label>
      <div class="frow"><label class="fld"><span>Passwort (mind. 6 Zeichen)</span><input class="field" id="ctP1" type="password" autocomplete="new-password"></label><label class="fld"><span>Wiederholen</span><input class="field" id="ctP2" type="password" autocomplete="new-password"></label></div></div>
    <p class="note" id="ctErr" style="color:var(--danger);margin:0"></p>`, 'Übernehmen', b => {
    const mode = $('[data-ct][aria-pressed=true]', b).dataset.ct, err = m => { $('#ctErr', b).textContent = m; };
    const ok = $('#dlgOk'); ok.disabled = true; ok.textContent = 'Einen Moment …';
    (async () => {
      try {
        let meta;
        if (mode === 'import') {
          const f = $('#ctFile', b).files[0]; if (!f) throw new Error('Bitte eine .p12- oder .pfx-Datei wählen.');
          meta = await WBSign.importP12(new Uint8Array(await f.arrayBuffer()), $('#ctPw', b).value);
        } else {
          if ($('#ctP1', b).value !== $('#ctP2', b).value) throw new Error('Die Passwörter stimmen nicht überein.');
          meta = await WBSign.createSelfSigned({ name: $('#ctName', b).value.trim(), email: $('#ctMail', b).value.trim(), org: $('#ctOrg', b).value.trim(), password: $('#ctP1', b).value });
        }
        closeDlg(); toast(`Zertifikat von ${meta.name} eingerichtet`); signDialog();
      } catch (e) { ok.disabled = false; ok.textContent = 'Übernehmen'; err(e.message || String(e)); }
    })();
    return false;
  });
  const b = $('#dlgBody');
  b.onclick = async e => {
    const t = e.target.closest('[data-ct]');
    if (t) { $$('[data-ct]', b).forEach(x => x.setAttribute('aria-pressed', String(x === t))); $('#ctImport', b).hidden = t.dataset.ct !== 'import'; $('#ctNew', b).hidden = t.dataset.ct !== 'new'; return; }
    if (e.target.closest('#ctExport')) { await saveBytes(new Blob([WBSign.exportP12()], { type: 'application/x-pkcs12' }), `Zertifikat ${I.name}.p12`); toast('Gesichert – mit deinem Passwort geschützt. Gut aufbewahren!'); }
    if (e.target.closest('#ctDel') && await ask('Zertifikat entfernen?', 'Ohne Sicherung lässt es sich nicht wiederherstellen. Bereits signierte PDFs bleiben gültig.', 'Entfernen')) { WBSign.remove(); closeDlg(); toast('Zertifikat entfernt'); }
  };
}
async function verifyDialog() {
  if (!window.WBSign) return;
  const srcs = usedSources().map(id => S.sources.get(id)).filter(s => WBSign.hasSignatures(s.bytes));
  if (!srcs.length) { dialog('Signaturen prüfen', '<p class="note" style="margin:0">Dieses Dokument enthält keine digitale Signatur. Zum Signieren: ⋯ › Datei › <b>Digital signieren</b>.</p>', 'OK', () => true); $('#dlgCancel').hidden = true; return; }
  busy(true, 'Signaturen werden geprüft …');
  try {
    const rows = [];
    for (const s of srcs) for (const r of await WBSign.verify(s.bytes)) rows.push({ ...r, file: s.name });
    busy(false);
    const changed = S.pages.some(p => p.annots.length || hasCE(p));
    dialog('Signaturen prüfen', `<div class="siglist">${rows.map(r => {
      const good = r.valid && r.intact && r.coversAll;
      const state = r.error ? r.error : !r.valid || !r.intact ? 'Ungültig – die Signatur passt nicht zum Inhalt.' : !r.coversAll ? 'Gültig, aber das Dokument wurde nach dem Signieren ergänzt.' : 'Gültig – seit dem Signieren unverändert.';
      return `<div class="sigrow ${good ? 'ok' : 'bad'}">${icon(good ? 'check' : 'warn')}<span><b>${esc(r.name || 'Unbekannt')}</b>${r.email ? ` <small>${esc(r.email)}</small>` : ''}<br>${esc(state)}<small>${r.time ? 'Signiert am ' + new Date(r.time).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : ''}${r.reason ? ' · ' + esc(r.reason) : ''}${r.location ? ' · ' + esc(r.location) : ''}<br>${r.selfSigned ? 'Selbst ausgestelltes Zertifikat' : r.issuer ? 'Aussteller: ' + esc(r.issuer) : ''}${r.expired ? ' · Zertifikat war beim Signieren abgelaufen' : ''}</small></span></div>`;
    }).join('')}</div><p class="note" style="margin:0">Geprüft wird, ob die Datei seit dem Signieren unverändert ist und die Signatur zum Zertifikat passt. Ob der Aussteller vertrauenswürdig ist, zeigen Programme mit Vertrauensliste (z. B. Acrobat).${changed ? ' <b>Hinweis:</b> Deine Änderungen in der Werkbank sind nicht signiert; beim Speichern entsteht eine neue, unsignierte PDF.' : ''}</p>`, 'OK', () => true);
    $('#dlgCancel').hidden = true;
  } catch (e) { busy(false); toast('Prüfen fehlgeschlagen: ' + (e.message || e)); }
}

/* ---------- 7. Umwandeln: Word, Excel, Bilder, Text ---------- */
function convertDialog() {
  if (!window.WBConvert) return;
  dialog('Umwandeln', `<div class="convgrid">${[['docx', 'Word (.docx)', 'Absätze, Überschriften und Tabellen zum Weiterschreiben', 'file'], ['xlsx', 'Excel (.xlsx)', 'Ein Blatt pro Seite, Spalten und Zahlen erkannt', 'grid'], ['png', 'Bilder (PNG)', 'Jede Seite als Bild, als ZIP', 'image'], ['jpg', 'Bilder (JPG)', 'Kleiner, für Fotos und Scans', 'image'], ['txt', 'Text (.txt)', 'Nur der Text', 'text']].map(([k, l, d, ic], i) => `<label class="convopt"><input type="radio" name="cv" value="${k}" ${i ? '' : 'checked'}>${icon(ic)}<span><b>${l}</b><small>${d}</small></span></label>`).join('')}</div>
    <label class="fld" id="cvDpiW" hidden><span>Auflösung</span><select class="field" id="cvDpi"><option value="96">96 dpi (Bildschirm)</option><option value="150" selected>150 dpi</option><option value="300">300 dpi (Druck)</option></select></label>
    <p class="note" style="margin:0">Mit allen Markierungen und Änderungen. Bei Scans vorher die Texterkennung ausführen, sonst landen sie als Bild in Word.</p>`, 'Umwandeln', b => {
    const k = $('[name=cv]:checked', b).value, dpi = +$('#cvDpi', b).value; closeDlg();
    (async () => {
      busy(true, 'Wird umgewandelt …');
      try {
        const bytes = await buildPdf(S.pages), prog = (d, t) => setMsg(`Umwandeln: Seite ${Math.min(t, d + 1)} von ${t}`, true);
        let blob, ext = k;
        if (k === 'docx') blob = await WBConvert.toDocx(bytes, { title: baseName(), onProgress: prog });
        else if (k === 'xlsx') blob = await WBConvert.toXlsx(bytes, { onProgress: prog });
        else if (k === 'txt') blob = new Blob([await WBConvert.toText(bytes)], { type: 'text/plain;charset=utf-8' });
        else { blob = await WBConvert.toImages(bytes, { format: k === 'jpg' ? 'jpeg' : 'png', dpi, name: baseName(), onProgress: prog }); ext = 'zip'; }
        busy(false);
        await saveBytes(blob, baseName() + (ext === 'zip' ? ` (${k.toUpperCase()})` : '') + '.' + ext);
      } catch (e) { busy(false); console.error(e); toast('Umwandeln fehlgeschlagen: ' + (e.message || e)); }
    })();
    return false;
  });
  const b = $('#dlgBody');
  b.onchange = () => { const k = $('[name=cv]:checked', b).value; $('#cvDpiW', b).hidden = !(k === 'png' || k === 'jpg'); };
}

/* ---------- 8. Neu aus Vorlage ---------- */
async function templateNew() {
  if (!window.WBTemplates) return;
  if (!S.lib && S.dirty && !S.sample && !await ask('Ungespeicherte Änderungen verwerfen?', `Die Änderungen an „${S.docName}“ gehen verloren.`)) return;
  const r = await WBTemplates.pick(); if (!r) return;
  if (S.lib && LIB) {
    busy(true, 'Wird angelegt …');
    try { await libSave(); const doc = await LIB.importPdf(r.bytes, r.name, S.lib.folder || null, {}); busy(false); location.href = 'index.html?doc=' + encodeURIComponent(doc.id); }
    catch (e) { busy(false); toast(e.message || String(e)); }
    return;
  }
  await openFiles([new File([r.bytes], r.name + '.pdf', { type: 'application/pdf' })], 'replace', true);
}

/* ---------- 9. Inhaltsverzeichnis und Kopf-/Fußzeilen ---------- */
async function findHeadings() {
  const lines = [];
  for (let i = 0; i < S.pages.length; i++) {
    const p = S.pages[i];
    try { const r = await WBConvert._linesOf(proxyOf(p)); for (const l of r.lines) lines.push({ i, pid: p.id, size: Math.round(l.size * 2) / 2, text: l.text.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim(), y: l.y, bold: l.bold }); } catch (e) { /* Seite ohne Text */ }
  }
  if (!lines.length) return [];
  const sizes = lines.map(l => l.size).sort((a, b) => a - b), body = sizes[Math.floor(sizes.length / 2)];
  // wiederkehrende Kopfzeilen weglassen
  const freq = new Map(); lines.forEach(l => freq.set(l.text, (freq.get(l.text) || 0) + 1));
  const many = Math.max(3, S.pages.length * 0.3);
  const num = /^((\d{1,2}(\.\d{1,2}){0,3})\.?|[IVX]{1,5}\.|Kapitel\s+\d+|Teil\s+\d+)\s+\S/;
  const cand = lines.filter(l => l.text.length >= 3 && l.text.length <= 90 && !/^[\d\s.,/–-]+$/.test(l.text) && (freq.get(l.text) || 0) < many && ((l.size >= body * 1.18) || (num.test(l.text) && (l.bold || l.size > body * 1.05))));
  const big = [...new Set(cand.map(l => l.size))].sort((a, b) => b - a).slice(0, 3);
  return cand.map(l => {
    const m = num.exec(l.text), lvl = m && /^\d/.test(m[1]) ? Math.min(3, m[1].replace(/\.$/, '').split('.').length) : Math.max(1, big.indexOf(l.size) + 1 || 3);
    return { ...l, lvl };
  }).filter((l, k, arr) => !(k && arr[k - 1].i === l.i && arr[k - 1].lvl === l.lvl && Math.abs(arr[k - 1].y - l.y) < l.size * 1.6 && (arr[k - 1].text += ' ' + l.text)));
}
async function autoTocDialog() {
  commitEdit();
  if (!window.WBConvert) return;
  busy(true, 'Überschriften werden gesucht …');
  const hs = await findHeadings(); busy(false);
  if (!hs.length) { toast('Keine Überschriften erkannt (bei Scans zuerst die Texterkennung ausführen).'); return; }
  dialog('Inhaltsverzeichnis erstellen', `<p class="note" style="margin:0">${hs.length} Überschriften gefunden. Sie werden als Lesezeichen angelegt (in jedem PDF-Programm in der Seitenleiste sichtbar).</p>
    <div class="tocprev">${hs.slice(0, 60).map(h => `<div style="padding-left:${(h.lvl - 1) * 16}px"><span>${esc(h.text)}</span><span class="pg">${h.i + 1}</span></div>`).join('')}${hs.length > 60 ? `<div class="note">… und ${hs.length - 60} weitere</div>` : ''}</div>
    <label class="chkrow"><input type="checkbox" id="tocPage" checked> Zusätzlich eine Seite „Inhalt“ vorne einfügen</label>
    ${S.bookmarks.length ? '<label class="chkrow"><input type="checkbox" id="tocReplace" checked> Vorhandene Lesezeichen ersetzen</label>' : ''}`, 'Erstellen', b => {
    const page = $('#tocPage', b).checked, replace = !$('#tocReplace', b) || $('#tocReplace', b).checked;
    closeDlg(); makeToc(hs, page, replace); return false;
  });
}
async function makeToc(hs, withPage, replace) {
  pushHist();
  const tree = [], stack = [];
  for (const h of hs) {
    const b = { id: uid('b'), title: h.text.length > 120 ? h.text.slice(0, 118) + '…' : h.text, pid: h.pid, kids: [] };
    while (stack.length && stack[stack.length - 1].lvl >= h.lvl) stack.pop();
    (stack.length ? stack[stack.length - 1].b.kids : tree).push(b);
    stack.push({ lvl: h.lvl, b });
  }
  S.bookmarks = replace ? tree : [...S.bookmarks, ...tree];
  if (withPage) {
    const { PDFDocument, StandardFonts, rgb } = PL;
    const d = await PDFDocument.create(), f = await d.embedFont(StandardFonts.Helvetica), fb = await d.embedFont(StandardFonts.HelveticaBold);
    const [W, H] = dims(S.pages[0]).map(Number), per = Math.floor((H - 150) / 20), nPages = Math.ceil(hs.length / per);
    const safe = s => Array.from(s).map(ch => { try { f.encodeText(ch); return ch; } catch (e) { return '?'; } }).join('');
    for (let k = 0; k < nPages; k++) {
      const pg = d.addPage([W, H]); let y = H - 72;
      if (!k) { pg.drawText('Inhalt', { x: 60, y, size: 22, font: fb, color: rgb(0.11, 0.13, 0.19) }); y -= 40; }
      for (const h of hs.slice(k * per, (k + 1) * per)) {
        const font = h.lvl === 1 ? fb : f, size = h.lvl === 1 ? 11 : 10, x = 60 + (h.lvl - 1) * 16, num = String(h.i + 1 + nPages);
        let t = safe(h.text); while (t.length > 3 && font.widthOfTextAtSize(t, size) > W - x - 110) t = t.slice(0, -2) + '…';
        pg.drawText(t, { x, y, size, font, color: rgb(0.11, 0.13, 0.19) });
        const tw = font.widthOfTextAtSize(t, size), nw = f.widthOfTextAtSize(num, size);
        for (let dx = x + tw + 6; dx < W - 60 - nw - 6; dx += 4) pg.drawText('.', { x: dx, y, size: 9, font: f, color: rgb(0.6, 0.62, 0.68) });
        pg.drawText(num, { x: W - 60 - nw, y, size, font: f, color: rgb(0.11, 0.13, 0.19) });
        y -= 20;
      }
    }
    const before = new Set(S.sources.keys());
    await addSource(await d.save(), 'Inhalt.pdf');
    const id = [...S.sources.keys()].find(k => !before.has(k));
    const pages = Array.from({ length: nPages }, (_, i) => { const vp = S.proxies.get(id + ':' + i).getViewport({ scale: 1 }); return { id: uid('p'), src: id, idx: i, baseRot: 0, rot: 0, w0: vp.width, h0: vp.height, annots: [] }; });
    S.pages.unshift(...pages);
    buildViewer(); scrollToPage(0);
  }
  markDirty(); openSide('marks');
  toast(`Inhaltsverzeichnis mit ${hs.length} Einträgen erstellt`);
}
function headFootDialog() {
  const prev = lsGet('pdfwb.hf') ? JSON.parse(lsGet('pdfwb.hf')) : { tl: '{titel}', tc: '', tr: '{datum}', bl: '{autor}', bc: '', br: 'Seite {seite} von {seiten}', size: 9, line: true, skip: false };
  const inp = (k, ph) => `<input class="field" data-hf="${k}" value="${esc(prev[k] || '')}" placeholder="${ph}">`;
  dialog('Kopf- und Fußzeilen', `<div class="hfgrid"><span class="note">Oben</span>${inp('tl', 'links')}${inp('tc', 'mittig')}${inp('tr', 'rechts')}<span class="note">Unten</span>${inp('bl', 'links')}${inp('bc', 'mittig')}${inp('br', 'rechts')}</div>
    <p class="note" style="margin:0">Platzhalter: <code>{seite}</code> <code>{seiten}</code> <code>{datum}</code> <code>{titel}</code> <code>{autor}</code> <code>{datei}</code></p>
    <div class="frow"><label class="fld"><span>Größe (pt)</span><input class="field num" type="number" id="hfSize" value="${prev.size}" min="6" max="16"></label><label class="fld"><span>Farbe</span><input type="color" id="hfColor" value="${prev.color || '#5a6374'}"></label></div>
    <label class="chkrow"><input type="checkbox" id="hfLine" ${prev.line ? 'checked' : ''}> Trennlinie</label><label class="chkrow"><input type="checkbox" id="hfSkip" ${prev.skip ? 'checked' : ''}> Erste Seite auslassen (Deckblatt)</label>
    <p class="note" style="margin:0">Vorhandene Kopf- und Fußzeilen werden ersetzt. Leere Felder entfernen sie.</p>`, 'Übernehmen', b => {
    const o = { size: clamp(+$('#hfSize', b).value || 9, 6, 16), color: $('#hfColor', b).value, line: $('#hfLine', b).checked, skip: $('#hfSkip', b).checked };
    $$('[data-hf]', b).forEach(i => { o[i.dataset.hf] = i.value; });
    lsSet('pdfwb.hf', JSON.stringify(o));
    pushHist();
    const n = S.pages.length - (o.skip ? 1 : 0), date = new Date().toLocaleDateString('de-DE'), title = S.meta.title || baseName(), author = S.meta.author || S.prefs.author || '';
    S.pages.forEach((p, i) => {
      p.annots = p.annots.filter(a => !a.hf);
      if (!(o.skip && i === 0)) {
        const [W, H] = dims(p), m = 32, no = i + 1 - (o.skip ? 1 : 0);
        const fill = s => s.replace(/\{seite\}/g, no).replace(/\{seiten\}/g, n).replace(/\{datum\}/g, date).replace(/\{titel\}/g, title).replace(/\{autor\}/g, author).replace(/\{datei\}/g, S.docName);
        let topUsed = false, botUsed = false;
        for (const k of ['tl', 'tc', 'tr', 'bl', 'bc', 'br']) {
          const text = fill(o[k] || '').trim(); if (!text) continue;
          const a = { id: uid(), t: 'text', text, size: o.size, font: 'Helvetica', bold: false, color: o.color, hf: true };
          const w = measure(text, a);
          a.x = r2(k[1] === 'l' ? m : k[1] === 'c' ? (W - w) / 2 : W - m - w);
          a.y = r2(k[0] === 't' ? m * 0.62 : H - m * 0.62 - LH * o.size);
          p.annots.push(a); if (k[0] === 't') topUsed = true; else botUsed = true;
        }
        if (o.line && topUsed) p.annots.push({ id: uid(), t: 'line', x1: m, y1: r2(m * 0.62 + LH * o.size + 3), x2: W - m, y2: r2(m * 0.62 + LH * o.size + 3), color: o.color, sw: 0.5, hf: true });
        if (o.line && botUsed) p.annots.push({ id: uid(), t: 'line', x1: m, y1: r2(H - m * 0.62 - LH * o.size - 3), x2: W - m, y2: r2(H - m * 0.62 - LH * o.size - 3), color: o.color, sw: 0.5, hf: true });
      }
      drawAnnots(p);
    });
    markDirty(); toast('Kopf- und Fußzeilen eingefügt');
  });
}

/* ---------- 10. Aufgaben aus Kommentaren ---------- */
const tasksNow = () => window.WBTasks ? WBTasks.fromState({ pages: S.pages }) : [];
function renderTasks() {
  const el = $('#tasksPanel'); if (!el || !window.WBTasks) return;
  const all = tasksNow(), open = all.filter(t => !t.done), done = all.filter(t => t.done);
  const grp = { late: [], today: [], soon: [], later: [], none: [] };
  open.sort((a, b) => (a.due == null) - (b.due == null) || (a.due || 0) - (b.due || 0)).forEach(t => grp[WBTasks.urgency(t.due)].push(t));
  const row = t => `<div class="trow${t.done ? ' done' : ''}" data-aid="${t.aid}" data-line="${t.line}"><input type="checkbox" ${t.done ? 'checked' : ''} aria-label="Erledigt"><button class="tx" data-go="${t.aid}">${esc(t.text)}<small class="u-${WBTasks.urgency(t.due)}">${t.due != null ? WBTasks.fmtDue(t.due) : ''}</small></button><span class="pg">${t.page}</span></div>`;
  const sec = (k, l) => grp[k].length ? `<div class="tsec">${l}</div>` + grp[k].map(row).join('') : '';
  el.innerHTML = `<div class="sphead"><span>Aufgaben</span><span>${open.length ? open.length + ' offen' : ''}</span></div>
    <div class="lacts"><button class="btn primary" data-t="add">${icon('add')}Aufgabe</button><button class="ibtn" data-t="ics" title="Fristen in den Kalender (.ics)" ${all.some(t => t.due != null && !t.done) ? '' : 'disabled'}>${icon('calendar')}</button><button class="ibtn" data-t="bell" title="Erinnerungen einschalten" aria-pressed="${'Notification' in window && Notification.permission === 'granted'}">${icon('bell')}</button></div>` +
    (all.length ? sec('late', 'Überfällig') + sec('today', 'Heute') + sec('soon', 'Bald') + sec('later', 'Später') + sec('none', 'Ohne Frist') + (done.length ? `<details class="tdone"><summary>Erledigt (${done.length})</summary>${done.map(row).join('')}</details>` : '')
      : `<p class="sempty">Aufgaben entstehen aus Kommentaren und Notizen: <code>[ ] Folien wiederholen bis Freitag</code>, <code>TODO: …</code> oder einfach „Abgabe bis 24.11.“. Fristen wie „morgen“, „bis Freitag“ oder „in 3 Tagen“ werden erkannt.</p>`);
}
function bindTasks() {
  const el = $('#tasksPanel'); if (!el) return;
  el.addEventListener('change', e => {
    const r = e.target.closest('.trow'); if (!r || e.target.type !== 'checkbox') return;
    const f = findAnnot(r.dataset.aid); if (!f) return;
    pushHist(); WBTasks.toggle(f.a, +r.dataset.line, e.target.checked); drawAnnots(f.p); markDirty(); renderTasks();
  });
  el.addEventListener('click', async e => {
    const g = e.target.closest('[data-go]'); if (g) { gotoAnnot(g.dataset.go); if (innerWidth <= 760) work.classList.remove('thumbs-open'); return; }
    const b = e.target.closest('[data-t]'); if (!b) return;
    const k = b.dataset.t;
    if (k === 'add') {
      const p = S.pages[S.cur], [W] = dims(p), [, cy] = viewCenter(p);
      const a = { id: uid(), t: 'note', x: r2(W - 40), y: r2(clamp(cy - 60, 20, dims(p)[1] - 40)), text: '[ ] ', color: '#ffd84d', ts: Date.now() };
      editNote(p, a, true); setTimeout(() => { const ta = $('#noteText'); if (ta) ta.setSelectionRange(ta.value.length, ta.value.length); }, 60);
    } else if (k === 'ics') { await saveBytes(WBTasks.ics(tasksNow().filter(t => !t.done).map(t => ({ ...t, doc: baseName() })), baseName()), baseName() + ' – Aufgaben.ics'); toast('Kalenderdatei gespeichert – öffnen, um die Fristen zu übernehmen'); }
    else if (k === 'bell') {
      if (!('Notification' in window)) { toast('Dieser Browser kann keine Erinnerungen anzeigen.'); return; }
      const r = await Notification.requestPermission();
      toast(r === 'granted' ? 'Erinnerungen an: Fällige Aufgaben werden einmal am Tag gemeldet, solange die Werkbank offen ist.' : 'Erinnerungen wurden nicht erlaubt.');
      renderTasks(); if (r === 'granted') { try { localStorage.removeItem('pdfwb.tasks.reminded'); } catch (er) { /* egal */ } WBTasks.remind(tasksNow(), () => openSide('tasks')); }
    }
  });
}
function bindLearn() {
  const el = $('#learnPanel'); if (!el) return;
  el.addEventListener('click', e => {
    const c = e.target.closest('[data-card]');
    if (c) { const card = (S.cards || []).find(x => x.id === c.dataset.card); if (card) cardDialog(card); return; }
    const b = e.target.closest('[data-l]'); if (!b || b.disabled) return;
    const k = b.dataset.l;
    if (k === 'x') { cardsExchangeDialog(); return; }
    if (k === 'study') studyOverlay('learn'); else if (k === 'quiz') studyOverlay('quiz'); else if (k === 'marks') cardsFromMarks(); else if (k === 'ai') cardsWithAI(); else if (k === 'add') cardDialog();
  });
}
function taskBadge() {
  const b = $('#taskBadge'); if (!b || !window.WBTasks) return;
  const n = tasksNow().filter(t => !t.done && t.due != null && WBTasks.urgency(t.due) !== 'later' && WBTasks.urgency(t.due) !== 'soon').length;
  b.hidden = !n; b.textContent = n;
  const c = $('#learnBadge'); if (c) { const k = cardsDue().length; c.hidden = !k; c.textContent = k; }
}
/* beim Abspielen: auf eine verknüpfte Notiz tippen = an diese Stelle springen */
function bindPlayerSeek() {
  pagesEl.addEventListener('pointerdown', e => {
    if (!S.player || S.tool !== 'select') return;
    const w = e.target.closest('.page'); if (!w) return;
    const p = pageById(w.dataset.id), el = els.get(p.id); if (!p || !el) return;
    const pt = ptIn(e, el);
    for (let i = p.annots.length - 1; i >= 0; i--) {
      const a = p.annots[i];
      if (a.rec !== S.player.rid || a.rt == null) continue;
      if (hitTest(p, pt) === a || (() => { const b = bbox(a); return pt[0] >= b.x - 4 && pt[0] <= b.x + b.w + 4 && pt[1] >= b.y - 4 && pt[1] <= b.y + b.h + 4; })()) {
        S.player.au.currentTime = Math.max(0, a.rt / 1000 - 2); S.player.au.play().catch(() => {});
        toast('Aufnahme springt zu ' + fmtDur(a.rt)); return;
      }
    }
  }, true);
}

