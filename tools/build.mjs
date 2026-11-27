// Baut js/app.js aus den Quelldateien in src/app (in Dateinamen-Reihenfolge, einfach hintereinander).
// node tools/build.mjs          → js/app.js schreiben
// node tools/build.mjs --check  → nur prüfen, ob js/app.js aktuell ist (für die CI)
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src/app'), OUT = path.join(ROOT, 'js/app.js');
const files = fs.readdirSync(SRC).filter(f => /^\d+-.*\.js$/.test(f)).sort();
const out = files.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
if (process.argv.includes('--check')) {
  const cur = fs.readFileSync(OUT, 'utf8');
  if (cur !== out) { console.error('js/app.js ist nicht aus src/app gebaut. Bitte „node tools/build.mjs“ ausführen.'); process.exit(1); }
  console.log(`js/app.js ist aktuell (${files.length} Quelldateien).`);
} else {
  fs.writeFileSync(OUT, out);
  console.log(`js/app.js gebaut aus ${files.length} Dateien (${Math.round(out.length / 1024)} KB).`);
}
