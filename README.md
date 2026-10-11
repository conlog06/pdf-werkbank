# PDF Werkbank

Eigener PDF-Editor, der komplett im Browser läuft, am Computer und auf dem Handy. Keine Installation, kein Server: Die PDF wird lokal bearbeitet und nirgendwo hochgeladen.

## Starten

- **Online:** Unter *Settings → Pages* als Quelle **GitHub Actions** wählen (oder den Branch `main`). Danach läuft der Editor unter `https://<benutzer>.github.io/pdf-werkbank/`.
- **Lokal:** Repository klonen oder als ZIP laden und `index.html` im Browser öffnen.

Beim ersten Start wird ein Beispieldokument geladen. Eigene Dateien öffnest du über **Öffnen** oder per Drag & Drop ins Fenster.

## Auf dem Handy

- Die Werkzeugleiste sitzt unten, in Reichweite des Daumens. Seitenfunktionen, Wasserzeichen, Export usw. stehen im **⋯**-Menü.
- **Zwei Finger** zoomen und verschieben die Seite, auch während ein Zeichenwerkzeug aktiv ist. **Ein Finger** zeichnet, wählt aus oder verschiebt das berührte Element.
- **Als App installieren:** Die Online-Version im Browser öffnen und *Zum Startbildschirm hinzufügen* wählen. Danach startet sie wie eine App und funktioniert auch offline.
- In der installierten App öffnet Speichern das Teilen-Menü, damit du die PDF direkt in *Dateien*, per Mail oder Messenger weitergeben kannst.

## Funktionen

**Inhalte der PDF direkt bearbeiten**
- **Inhalte (M):** Texte, Flächen, Bilder und Icons der PDF antippen oder mit einem Rahmen auswählen und mit `Entf` wirklich aus der Datei entfernen. Der Hintergrund bleibt erhalten, es entsteht kein weißer Kasten.
- **Text ändern (E):** Vorhandenen Text antippen und direkt umschreiben. Sind alle Zeichen in der eingebetteten Schrift vorhanden, bleibt die Originalschrift. Sonst wird die Zeile in Helvetica neu gesetzt. Leer lassen entfernt die Zeile.

**Kommentieren**
- **Markieren, Unterstreichen, Durchstreichen:** Eine Textzeile antippen, die Markierung rastet genau auf den Text ein. Alternativ frei aufziehen.
- **Notizen:** Als echter PDF-Kommentar gespeichert, sichtbar in Acrobat, Vorschau und Browsern.
- **Stempel:** Genehmigt, Erledigt, Bezahlt, Entwurf, Kopie, Vertraulich, Abgelehnt, Dringend und das heutige Datum.
- Stift, Rechteck, Ellipse, Linie, Pfeil, Haken und Kreuz, Weiß abdecken.
- Neuer Text mit Schriftart, Größe, Fett und Farbe.
- Bilder einfügen, Unterschrift zeichnen oder tippen.

**Dokument und Seiten**
- Wasserzeichen auf allen oder einzelnen Seiten
- Seitenzahlen in verschiedenen Formaten und Positionen, Deckblatt auf Wunsch ohne Nummer
- Seiten drehen, löschen, duplizieren, per Drag & Drop umsortieren, leere Seite einfügen
- Einzelne oder mehrere Seiten als eigene PDF speichern
- Weitere PDFs anhängen und alles gemeinsam speichern
- Neues leeres Dokument anlegen
- Dokumenteigenschaften (Titel, Autor, Betreff, Stichwörter)

**Export**
- PDF mit allen Änderungen
- Aktuelle Seite als Bild (PNG)
- Gesamten Text als TXT-Datei

**Allgemein**
- Automatisches Zwischenspeichern: Nach dem Schließen oder einem Absturz lässt sich die letzte Sitzung mit allen Änderungen fortsetzen
- Suche im Dokument, Zoom (auch `Strg` + Mausrad)
- Rückgängig und Wiederholen für alle Schritte
- Heller und dunkler Modus

## Tastenkürzel

| Taste | Funktion | Taste | Funktion |
|---|---|---|---|
| `V` | Auswählen | `P` | Stift |
| `M` | PDF-Inhalte | `H` | Markieren |
| `E` | Text ändern | `N` / `D` | Unterstreichen / Durchstreichen |
| `T` | Neuer Text | `R` / `O` | Rechteck / Ellipse |
| `W` | Abdecken | `L` / `A` | Linie / Pfeil |
| `S` | Stempel | `K` / `X` | Haken / Kreuz |
| `C` | Notiz | `I` / `U` | Bild / Unterschrift |
| `Entf` | Löschen | `Strg+Z` / `Strg+Y` | Rückgängig / Wiederholen |
| `Strg+S` | Speichern | `Strg+F` | Suchen |
| `Strg+C` / `Strg+V` | Kopieren / Einfügen | `Strg+D` | Duplizieren |

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Oberfläche und Gestaltung |
| `js/app.js` | Editor: Ansicht, Werkzeuge, Touch-Gesten, Seitenverwaltung, Export, Zwischenspeicher |
| `js/content-engine.js` | Liest den Inhaltsstrom einer PDF-Seite, ermittelt jedes gezeichnete Objekt mit Position und schreibt den Strom mit gelöschten oder geänderten Objekten neu |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installierbare App und Offline-Betrieb |
| `.github/workflows/pages.yml` | Veröffentlichung auf GitHub Pages |

Verwendete Bibliotheken (per CDN geladen, offline aus dem Cache): [pdf.js](https://github.com/mozilla/pdf.js) 3.11 zum Anzeigen und [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17 zum Schreiben.

### So funktioniert das echte Entfernen

1. `content-engine.js` zerlegt den Inhaltsstrom der Seite in Operatoren und spielt den Grafikzustand nach (Matrizen, Textposition, Schriftbreiten, auch für die 14 PDF-Standardschriften).
2. Jeder Text-, Flächen- und Bild-Operator bekommt eine Box in Seitenkoordinaten. Textstücke auf derselben Grundlinie werden zu Zeilen zusammengefasst.
3. Beim Entfernen wird der Operator im Strom ersetzt: Flächen enden ohne Zeichnen (`n`), Bilder fallen weg, und Text wird durch einen gleich langen Leerschritt ersetzt, damit nachfolgender Text an seiner Stelle bleibt.
4. Geänderter Text wird mit den Zeichencodes der eingebetteten Schrift neu geschrieben.

## Grenzen

- Passwortgeschützte oder verschlüsselte PDFs lassen sich nicht öffnen bzw. nicht inhaltlich bearbeiten.
- Inhalte innerhalb eingebetteter Formular-XObjects werden als ein Element behandelt.
- Neuer Text in der Originalschrift ist nur mit Zeichen möglich, die in der PDF schon vorkommen (Schriften sind meist nur teilweise eingebettet).
- Interaktive Formularfelder werden angezeigt, aber nicht als Felder ausgefüllt.
- Beim allerersten Start braucht der Browser eine Internetverbindung, um die Bibliotheken zu laden.
