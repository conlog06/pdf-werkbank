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
  libUI();
  const qp = new URLSearchParams(location.search);
  // unsichtbar in der Bibliothek: nur die PDF für das Drive-Backup erzeugen
  if (LIB && qp.get('render') === '1' && qp.get('doc') && parent !== window) {
    S.renderMode = true;
    const id = qp.get('doc');
    if (await openLibDoc(id)) {
      try { const buf = (await buildPdf(S.pages)).slice().buffer; parent.postMessage({ wbRender: id, bytes: buf }, location.origin === 'null' ? '*' : location.origin, [buf]); }
      catch (e) { parent.postMessage({ wbRender: id, error: e.message || String(e) }, location.origin === 'null' ? '*' : location.origin); }
    }
    return;
  }
  if (LIB && window.WBSync) window.WBSync.init();
  if (LIB && qp.get('doc')) {
    if (await openLibDoc(qp.get('doc'))) {
      taskBadge();
      if (window.WBTasks) setTimeout(() => WBTasks.remind(tasksNow(), () => openSide('tasks')), 2500);
      if (qp.get('receipts') === '1') setTimeout(() => { history.replaceState(null, '', 'index.html?doc=' + encodeURIComponent(qp.get('doc'))); receiptsDialog(); }, 500);
      if (qp.get('study') === '1') setTimeout(() => { history.replaceState(null, '', 'index.html?doc=' + encodeURIComponent(qp.get('doc'))); if (cardsDue().length) studyOverlay('learn'); else openSide('learn'); }, 500);
      const pg = +qp.get('page') || 0, fq = qp.get('q');
      if (pg || fq) setTimeout(async () => {
        if (pg) scrollToPage(pg - 1);
        if (fq) {
          $('#findInput').value = fq; await runFind(fq);
          const pid = pg && S.pages[pg - 1] && S.pages[pg - 1].id, k = S.find && pid ? S.find.hits.findIndex(h => h.pid === pid) : -1;
          if (k >= 0) goHit(k);
        }
        history.replaceState(null, '', 'index.html?doc=' + encodeURIComponent(qp.get('doc')));
      }, 350);
      if (qp.get('export') === '1') { history.replaceState(null, '', 'index.html?doc=' + encodeURIComponent(qp.get('doc'))); savePdf(); } return; }
  }
  if (bindFileMode()) return;
  if (SHARE_TOKEN && await openShared(SHARE_TOKEN)) return;
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
