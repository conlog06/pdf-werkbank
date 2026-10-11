# PDF Werkbank

Eigener PDF-Editor, der komplett im Browser läuft. Keine Installation, kein Server: Die PDF wird lokal bearbeitet und nirgendwo hochgeladen.

## Starten

- **Lokal:** Repository klonen oder als ZIP laden und `index.html` im Browser öffnen.
- **Online:** Unter *Settings → Pages* den Branch `main` als Quelle wählen. Danach läuft der Editor unter `https://<benutzer>.github.io/pdf-werkbank/`.

Beim ersten Start wird ein Beispieldokument geladen. Eigene Dateien öffnest du über **Öffnen** oder per Drag & Drop ins Fenster.

## Funktionen

**Inhalte der PDF direkt bearbeiten**
- **Inhalte (M):** Texte, Flächen, Bilder und Icons der PDF anklicken oder mit einem Rahmen auswählen und mit `Entf` wirklich aus der Datei entfernen. Der Hintergrund bleibt erhalten, es entsteht kein weißer Kasten.
- **Text ändern (E):** Vorhandenen Text anklicken und direkt umschreiben. Sind alle Zeichen in der eingebetteten Schrift vorhanden, wird der Text in der Originalschrift geschrieben. Sonst wird die Zeile entfernt und in Helvetica neu gesetzt. Leer lassen entfernt die Zeile.

**Ergänzen und kommentieren**
- Neuer Text mit Schriftart, Größe, Fett und Farbe
- Stift, Markieren, Rechteck, Ellipse, Linie, Pfeil
- Haken und Kreuze für Formulare, Weiß abdecken
- Bilder einfügen, Unterschrift zeichnen oder tippen

**Seiten**
- Drehen, löschen, per Drag & Drop umsortieren, leere Seite einfügen
- Einzelne oder mehrere Seiten als eigene PDF speichern
- Weitere PDFs anhängen und alles gemeinsam speichern

**Allgemein**
- Suche im Dokument, Zoom (auch `Strg` + Mausrad)
- Rückgängig und Wiederholen für alle Schritte
- Heller und dunkler Modus

## Tastenkürzel

| Taste | Funktion | Taste | Funktion |
|---|---|---|---|
| `V` | Auswählen | `P` | Stift |
| `M` | PDF-Inhalte | `H` | Markieren |
| `E` | Text ändern | `R` / `O` | Rechteck / Ellipse |
| `T` | Neuer Text | `L` / `A` | Linie / Pfeil |
| `W` | Abdecken | `K` / `X` | Haken / Kreuz |
| `I` | Bild | `U` | Unterschrift |
| `Entf` | Löschen | `Strg+Z` / `Strg+Y` | Rückgängig / Wiederholen |
| `Strg+S` | Speichern | `Strg+F` | Suchen |

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Oberfläche und Gestaltung |
| `js/app.js` | Editor: Ansicht, Werkzeuge, Seitenverwaltung, Speichern |
| `js/content-engine.js` | Liest den Inhaltsstrom einer PDF-Seite, ermittelt jedes gezeichnete Objekt mit Position und schreibt den Strom mit gelöschten oder geänderten Objekten neu |

Verwendete Bibliotheken (per CDN geladen): [pdf.js](https://github.com/mozilla/pdf.js) 3.11 zum Anzeigen und [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17 zum Schreiben.

### So funktioniert das echte Entfernen

1. `content-engine.js` zerlegt den Inhaltsstrom der Seite in Operatoren und spielt den Grafikzustand nach (Matrizen, Textposition, Schriftbreiten).
2. Jeder Text-, Flächen- und Bild-Operator bekommt eine Box in Seitenkoordinaten. Textstücke auf derselben Grundlinie werden zu Zeilen zusammengefasst.
3. Beim Entfernen wird der Operator im Strom ersetzt: Flächen enden ohne Zeichnen (`n`), Bilder fallen weg, und Text wird durch einen gleich langen Leerschritt ersetzt, damit nachfolgender Text an seiner Stelle bleibt.
4. Geänderter Text wird mit den Zeichencodes der eingebetteten Schrift neu geschrieben.

## Grenzen

- Passwortgeschützte oder verschlüsselte PDFs lassen sich nicht öffnen bzw. nicht inhaltlich bearbeiten.
- Inhalte innerhalb eingebetteter Formular-XObjects werden als ein Element behandelt.
- Neuer Text in der Originalschrift ist nur mit Zeichen möglich, die in der PDF schon vorkommen (Schriften sind meist nur teilweise eingebettet).
- Interaktive Formularfelder werden angezeigt, aber nicht als Felder ausgefüllt.
- Für den Start braucht der Browser eine Internetverbindung, weil die Bibliotheken per CDN geladen werden.
