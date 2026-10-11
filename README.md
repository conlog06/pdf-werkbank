# PDF Werkbank

Eigener PDF-Editor, der komplett im Browser läuft: am Computer, auf dem iPad mit Apple Pencil und auf dem Handy. Keine Installation, kein Server: Die PDF wird lokal bearbeitet und nirgendwo hochgeladen.

## Starten

- **Online:** Unter *Settings → Pages* als Quelle **GitHub Actions** wählen (oder den Branch `main`). Danach läuft der Editor unter `https://<benutzer>.github.io/pdf-werkbank/`.
- **Lokal:** Repository klonen oder als ZIP laden und `index.html` im Browser öffnen.

Beim ersten Start wird ein Beispieldokument geladen. Eigene Dateien öffnest du über **Öffnen** oder per Drag & Drop ins Fenster.

## iPad und Apple Pencil

- **Pencil-Erkennung:** Sobald der Pencil das erste Mal die Seite berührt, schaltet die Werkbank auf **„Nur Pencil zeichnet“**. Dann zeichnet nur der Pencil, Finger scrollen und zoomen, und der aufgelegte Handballen hinterlässt keine Striche. Der Schalter „Nur Pencil“ in der Eigenschaftsleiste (oder im **⋯**-Menü) stellt um, die Einstellung bleibt gespeichert.
- **Druckstärke:** Der Füller wird dicker, je fester du drückst. Alle Zwischenpunkte des Pencil (bis 240 Hz) fließen ein, die Linien bleiben dadurch glatt.
- **Hover-Vorschau:** Auf iPads mit Hover-Unterstützung zeigt ein Kreis vor dem Aufsetzen, wo und wie breit Stift oder Radierer treffen.
- **Gesten:** zwei Finger tippen = rückgängig, drei Finger tippen = wiederholen, zwei Finger ziehen = zoomen und verschieben.
- **Layout:** Im Hoch- und Querformat bleiben die Werkzeuge erreichbar. Seitenfunktionen wandern ins **⋯**-Menü.
- **Teilen:** Im **⋯**-Menü sendet „Teilen …“ die fertige PDF an *Dateien*, Mail, AirDrop oder andere Apps.

Als App installieren: die Online-Version in Safari öffnen, *Teilen → Zum Home-Bildschirm*. Danach startet sie im Vollbild und funktioniert auch offline.

## Auf dem Handy

- Die Werkzeugleiste sitzt unten, in Reichweite des Daumens. Seitenfunktionen, Wasserzeichen, Export usw. stehen im **⋯**-Menü.
- **Zwei Finger** zoomen und verschieben die Seite, auch während ein Zeichenwerkzeug aktiv ist. **Ein Finger** zeichnet, wählt aus oder verschiebt das berührte Element.

## Funktionen

**Inhalte der PDF direkt bearbeiten**
- **Inhalte (M):** Texte, Flächen, Bilder und Icons der PDF antippen oder mit einem Rahmen auswählen. Dann:
  - **verschieben:** in die Auswahl tippen und ziehen, oder mit den Pfeiltasten (`Umschalt` = 10 pt)
  - **skalieren:** am Eckgriff ziehen
  - **drehen:** mit den Dreh-Knöpfen in der Leiste um 90°
  - **entfernen:** mit `Entf`. Der Hintergrund bleibt erhalten, es entsteht kein weißer Kasten.
- **Hilfslinien:** Beim Verschieben rasten Elemente an Seitenrand, Seitenmitte und an Kanten anderer Elemente ein. `Alt` gedrückt halten schaltet das Einrasten ab.
- **Text ändern (E):** Vorhandenen Text antippen und direkt umschreiben. Sind alle Zeichen in der eingebetteten Schrift vorhanden, bleibt die Originalschrift. Sonst wird die Zeile in Helvetica neu gesetzt. Leer lassen entfernt die Zeile.
- **Schwärzen (B):** Bereich aufziehen. Ein schwarzer Balken deckt ihn ab, und der Text darunter wird **zeichengenau aus der Datei gelöscht**, sodass er weder kopiert noch gesucht werden kann. Der Rest der Zeile bleibt an seinem Platz. Flächen und Bilder, die zu mindestens 90 % im Bereich liegen, werden ebenfalls entfernt.

**Schreiben und Zeichnen**
- **Stiftarten (P):** Füller (Strich folgt dem Druck), Kugelschreiber (gleichmäßig) und Textmarker (breit, durchscheinend). Jede Art merkt sich eigene Farbe und Stärke.
- **Formerkennung:** Am Ende eines Strichs kurz halten. Die Werkbank macht daraus eine gerade Linie, ein Rechteck oder eine Ellipse. Eine erkannte Linie folgt danach noch dem Stift.
- **Radierer (G):** Über eigene Striche und Elemente wischen, um sie zu löschen. Die Größe ist einstellbar. Stifte mit Radiertaste radieren automatisch.
- **Messen (Q):** Strecke ziehen, die Länge erscheint in mm. Mit Maßstab (1:1 bis 1:1000) für Zeichnungen und Pläne.
- Rechteck, Ellipse, Linie, Pfeil, Haken und Kreuz, Weiß abdecken.
- Neuer Text mit Schriftart, Größe, Fett, Farbe und farbigem Hintergrund.
- Bilder einfügen, Unterschrift zeichnen oder tippen.

**Kommentieren**
- **Markieren, Unterstreichen, Durchstreichen:** Eine Textzeile antippen, die Markierung rastet genau auf den Text ein.
- **Notizen:** Als echter PDF-Kommentar gespeichert, sichtbar in Acrobat, Vorschau und Browsern.
- **Stempel:** Genehmigt, Erledigt, Bezahlt, Entwurf, Kopie, Vertraulich, Abgelehnt, Dringend und das heutige Datum.
- **Kommentarliste:** In der Seitenleiste stehen alle Notizen, Markierungen, Stempel und Zeichnungen nach Seiten geordnet. Antippen springt hin.
- Eigene Elemente in den Vorder- oder Hintergrund legen.

**Formulare**
- **Formularfelder ausfüllen:** Textfelder, Kontrollkästchen, Optionsfelder und Auswahllisten in PDF-Formularen sind direkt bearbeitbar (Werkzeug „Auswählen“). Beim Speichern werden die Werte fest in die Seite eingebettet. Seite 2 des Beispiels hat echte Formularfelder zum Ausprobieren.

**Dokument und Seiten**
- **Lesezeichen:** Vorhandene Inhaltsverzeichnisse werden übernommen. Eigene Lesezeichen setzen, umbenennen (Doppelklick) und löschen. Sie werden beim Speichern als Gliederung in die PDF geschrieben.
- **Notizpapier:** Neue Seiten leer, liniert, kariert oder punktiert einfügen, in A4, A5 oder Letter. Auch als neues Notizdokument.
- Wasserzeichen auf allen oder einzelnen Seiten
- Seitenzahlen in verschiedenen Formaten und Positionen, Deckblatt auf Wunsch ohne Nummer
- Seiten drehen, löschen, duplizieren, per Drag & Drop umsortieren
- Einzelne oder mehrere Seiten als eigene PDF speichern
- Weitere PDFs anhängen und alles gemeinsam speichern
- Dokumenteigenschaften (Titel, Autor, Betreff, Stichwörter)

**Lesen**
- **Lesemodus (F):** Blendet alle Leisten aus, öffnet den Vollbildmodus und passt die Seiten an die Breite an. Pfeiltasten und Leertaste blättern.
- **Nachtmodus:** Stellt die Seiten dunkel dar, zum Lesen am Abend. Die gespeicherte PDF bleibt unverändert.

**Export**
- PDF mit allen Änderungen
- Aktuelle Seite als Bild (PNG)
- Gesamten Text als TXT-Datei

**Allgemein**
- Automatisches Zwischenspeichern: Nach dem Schließen oder einem Absturz lässt sich die letzte Sitzung mit allen Änderungen fortsetzen
- Suche im Dokument, Zoom (auch `Strg` + Mausrad oder zwei Finger)
- Rückgängig und Wiederholen für alle Schritte
- Heller und dunkler Modus

## Tastenkürzel

| Taste | Funktion | Taste | Funktion |
|---|---|---|---|
| `V` | Auswählen | `P` | Stift |
| `M` | PDF-Inhalte | `G` | Radierer |
| `E` | Text ändern | `H` | Markieren |
| `T` | Neuer Text | `N` / `D` | Unterstreichen / Durchstreichen |
| `W` | Abdecken | `R` / `O` | Rechteck / Ellipse |
| `B` | Schwärzen | `L` / `A` | Linie / Pfeil |
| `Q` | Messen | `K` / `X` | Haken / Kreuz |
| `S` | Stempel | `I` / `U` | Bild / Unterschrift |
| `C` | Notiz | `F` | Lesemodus |
| `Entf` | Löschen | `Strg+Z` / `Strg+Y` | Rückgängig / Wiederholen |
| `Strg+S` | Speichern | `Strg+F` | Suchen |
| `Strg+C` / `Strg+V` | Kopieren / Einfügen | `Strg+D` | Duplizieren |

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Oberfläche und Gestaltung |
| `js/app.js` | Editor: Ansicht, Werkzeuge, Pencil und Touch-Gesten, Formulare, Lesezeichen, Seitenverwaltung, Export, Zwischenspeicher |
| `js/content-engine.js` | Liest den Inhaltsstrom einer PDF-Seite, ermittelt jedes gezeichnete Objekt mit Position und schreibt den Strom mit gelöschten, geänderten, verschobenen oder geschwärzten Objekten neu |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installierbare App und Offline-Betrieb |
| `.github/workflows/pages.yml` | Veröffentlichung auf GitHub Pages |

Verwendete Bibliotheken (per CDN geladen, offline aus dem Cache): [pdf.js](https://github.com/mozilla/pdf.js) 3.11 zum Anzeigen und [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17 zum Schreiben.

### So funktioniert das echte Entfernen

1. `content-engine.js` zerlegt den Inhaltsstrom der Seite in Operatoren und spielt den Grafikzustand nach (Matrizen, Textposition, Schriftbreiten, auch für die 14 PDF-Standardschriften).
2. Jeder Text-, Flächen- und Bild-Operator bekommt eine Box in Seitenkoordinaten, jedes Zeichen zusätzlich seine eigene Position. Textstücke auf derselben Grundlinie werden zu Zeilen zusammengefasst.
3. Beim Entfernen wird der Operator im Strom ersetzt: Flächen enden ohne Zeichnen (`n`), Bilder fallen weg, und Text wird durch einen gleich langen Leerschritt ersetzt, damit nachfolgender Text an seiner Stelle bleibt.
4. Beim Schwärzen geschieht dasselbe pro Zeichen: Zeichen im Bereich werden aus dem `TJ`-Operator gestrichen und durch ihre Breite als Abstand ersetzt.
5. Geänderter Text wird mit den Zeichencodes der eingebetteten Schrift neu geschrieben.
6. Verschobene, skalierte oder gedrehte Objekte werden an der alten Stelle entfernt und am Ende der Seite als Kopie neu gezeichnet, mit der Matrix `CTM × A`, ihrem Farb- und Linienzustand und eng anliegenden Beschneidungspfaden.

## Grenzen

- Passwortgeschützte oder verschlüsselte PDFs lassen sich nicht öffnen bzw. nicht inhaltlich bearbeiten.
- Inhalte innerhalb eingebetteter Formular-XObjects werden als ein Element behandelt.
- Neuer Text in der Originalschrift ist nur mit Zeichen möglich, die in der PDF schon vorkommen (Schriften sind meist nur teilweise eingebettet).
- Ausgefüllte Formulare werden beim Speichern eingebettet und sind danach keine bearbeitbaren Felder mehr.
- Beim Schwärzen werden Bilder nur entfernt, wenn sie fast ganz im Bereich liegen. Teile größerer Bilder (z. B. ein eingescannter Hintergrund) bleiben unter dem Balken in der Datei.
- Der Vollbild-Lesemodus hängt vom Browser ab. Safari auf dem iPhone blendet die Leisten aus, öffnet aber kein echtes Vollbild.
- Beim allerersten Start braucht der Browser eine Internetverbindung, um die Bibliotheken zu laden.
