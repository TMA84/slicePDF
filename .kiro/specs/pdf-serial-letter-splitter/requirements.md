# Anforderungsdokument: slicePDF

## Einleitung

Eine Web-Applikation zum Aufteilen großer PDF-Serienbriefe in einzelne Zieldokumente. Die Applikation extrahiert automatisch Vor- und Nachnamen aus der jeweils ersten Seite jedes Teildokuments, um die Dateien korrekt zu benennen. Falls die automatische Namenserkennung fehlschlägt, können die Namen alternativ über eine XLSX-Datei bereitgestellt werden. Vor dem endgültigen Download wird eine Vorschau der aufgeteilten Dokumente mit den erkannten Namen angezeigt. Der Dateiname kann über ein flexibles Variablen-Template konfiguriert werden.

## Glossar

- **slicePDF**: Die Web-Applikation zum Aufteilen von PDF-Serienbriefen
- **Quell_PDF**: Die hochgeladene, große PDF-Datei, die mehrere Serienbriefe enthält
- **Zieldokument**: Ein einzelnes PDF-Dokument, das nach dem Aufteilen entsteht
- **Seitenanzahl_pro_Dokument**: Die vom Benutzer angegebene Anzahl an Seiten, die jedes Zieldokument umfassen soll
- **Namensextraktion**: Der Prozess des automatischen Auslesens von Vor- und Nachname aus der ersten Seite eines Zieldokuments
- **XLSX_Namensdatei**: Eine Excel-Datei mit Vor- und Nachnamen als Fallback für die Namensextraktion
- **Dateinamen_Template**: Ein konfigurierbares Muster mit Variablen (z.B. `{nachname}`, `{vorname}`) zur Erzeugung des Zieldateinamens
- **Vorschau**: Die Ansicht aller Zieldokumente mit erkannten Namen vor dem endgültigen Download
- **Benutzer**: Die Person, die die Web-Applikation bedient

## Anforderungen

### Anforderung 1: PDF-Upload

**User Story:** Als Benutzer möchte ich eine große PDF-Datei hochladen können, damit diese in einzelne Dokumente aufgeteilt werden kann.

#### Akzeptanzkriterien

1. slicePDF SHALL eine Upload-Oberfläche für PDF-Dateien bereitstellen
2. WHEN der Benutzer eine PDF-Datei hochlädt, slicePDF SHALL die Datei entgegennehmen und zur Verarbeitung bereithalten
3. IF der Benutzer eine Datei hochlädt, die kein gültiges PDF ist, THEN slicePDF SHALL eine Fehlermeldung anzeigen, die das erwartete Dateiformat nennt
4. WHEN eine PDF-Datei erfolgreich hochgeladen wurde, slicePDF SHALL die Gesamtanzahl der Seiten in der Quell_PDF anzeigen

### Anforderung 2: Seitenanzahl pro Zieldokument konfigurieren

**User Story:** Als Benutzer möchte ich die Anzahl der Seiten pro Zieldokument angeben können, damit die Aufteilung meinen Anforderungen entspricht.

#### Akzeptanzkriterien

1. slicePDF SHALL ein Eingabefeld für die Seitenanzahl_pro_Dokument bereitstellen
2. WHEN der Benutzer eine Seitenanzahl_pro_Dokument eingibt, slicePDF SHALL die Anzahl der resultierenden Zieldokumente berechnen und anzeigen
3. IF der Benutzer eine Seitenanzahl_pro_Dokument eingibt, die kleiner als 1 ist, THEN slicePDF SHALL eine Fehlermeldung anzeigen
4. IF die Gesamtseitenzahl der Quell_PDF nicht gleichmäßig durch die Seitenanzahl_pro_Dokument teilbar ist, THEN slicePDF SHALL den Benutzer darauf hinweisen und die verbleibenden Seiten als letztes Zieldokument behandeln

### Anforderung 3: Automatische Namensextraktion

**User Story:** Als Benutzer möchte ich, dass Vor- und Nachname automatisch aus der ersten Seite jedes Zieldokuments extrahiert werden, damit die Dateien korrekt benannt werden.

#### Akzeptanzkriterien

1. WHEN die Quell_PDF aufgeteilt wird, slicePDF SHALL den Textinhalt der ersten Seite jedes Zieldokuments analysieren
2. WHEN die Namensextraktion erfolgreich ist, slicePDF SHALL den erkannten Vornamen und Nachnamen dem jeweiligen Zieldokument zuordnen
3. IF die Namensextraktion für ein Zieldokument fehlschlägt, THEN slicePDF SHALL das betroffene Zieldokument in der Vorschau als "Name nicht erkannt" markieren
4. slicePDF SHALL die extrahierten Namen in der Vorschau zur manuellen Korrektur durch den Benutzer bereitstellen

### Anforderung 4: XLSX-Fallback für Namenszuordnung

**User Story:** Als Benutzer möchte ich eine XLSX-Datei mit Namen hochladen können, falls die automatische Erkennung nicht funktioniert, damit alle Dokumente korrekt benannt werden.

#### Akzeptanzkriterien

1. slicePDF SHALL eine Upload-Möglichkeit für eine XLSX_Namensdatei bereitstellen
2. WHEN der Benutzer eine XLSX_Namensdatei hochlädt, slicePDF SHALL alle verfügbaren Spaltenüberschriften aus der Datei auslesen und dem Benutzer anzeigen
3. slicePDF SHALL dem Benutzer ermöglichen, aus den verfügbaren Spalten jeweils eine Spalte für Vorname und eine Spalte für Nachname auszuwählen
4. WHEN der Benutzer die Spaltenzuordnung bestätigt hat, slicePDF SHALL die Namen aus den ausgewählten Spalten den Zieldokumenten in der Reihenfolge zuordnen
5. IF die Anzahl der Zeilen in der XLSX_Namensdatei nicht mit der Anzahl der Zieldokumente übereinstimmt, THEN slicePDF SHALL den Benutzer auf die Abweichung hinweisen
6. IF der Benutzer eine Datei hochlädt, die kein gültiges XLSX-Format hat, THEN slicePDF SHALL eine Fehlermeldung anzeigen

### Anforderung 5: Variablen-basiertes Dateinamen-Template

**User Story:** Als Benutzer möchte ich den Dateinamen über ein frei konfigurierbares Template mit Variablen und beliebigen Trennzeichen gestalten können, damit die Benennung exakt meinen Konventionen entspricht (z.B. `[Nachname], [Vorname]_[Dokument] - [Datum].pdf`).

#### Akzeptanzkriterien

1. slicePDF SHALL ein Eingabefeld für das Dateinamen_Template bereitstellen, in dem Variablen und beliebige Trennzeichen (Komma, Unterstrich, Bindestrich, Leerzeichen, Punkt etc.) frei kombiniert werden können
2. slicePDF SHALL mindestens die folgenden Variablen im Dateinamen_Template unterstützen:
   - `[Nachname]` – Nachname des Empfängers
   - `[Vorname]` – Vorname des Empfängers
   - `[Dokument]` – Dokumententyp bzw. Bezeichnung des Dokuments
   - `[Datum]` – Datum (konfigurierbares Format)
   - `[Nummer]` – Laufende Nummer des Zieldokuments
3. slicePDF SHALL eine Übersicht aller verfügbaren Variablen in der Weboberfläche anzeigen, sodass der Benutzer diese per Klick in das Dateinamen_Template einfügen kann
4. slicePDF SHALL dem Benutzer ermöglichen, eigene benutzerdefinierte Variablen über die Weboberfläche hinzuzufügen, zu bearbeiten und zu entfernen
5. WHEN der Benutzer eine XLSX_Namensdatei hochlädt, slicePDF SHALL die Spaltenüberschriften der XLSX-Datei automatisch als zusätzliche verfügbare Variablen im Dateinamen_Template bereitstellen
6. slicePDF SHALL dem Benutzer ermöglichen, das Datumsformat für die Variable `[Datum]` zu konfigurieren (z.B. `DD.MM.YYYY`, `YYYY-MM-DD`, `DDMMYYYY`)
7. WHEN der Benutzer ein Dateinamen_Template eingibt, slicePDF SHALL eine Live-Vorschau eines Beispiel-Dateinamens anzeigen
8. IF das Dateinamen_Template keine der verfügbaren Variablen enthält, THEN slicePDF SHALL den Benutzer darauf hinweisen, dass der Dateiname für alle Dokumente identisch wäre
9. slicePDF SHALL ein Standard-Dateinamen_Template von `[Nachname], [Vorname]_[Dokument] - [Datum]` vorgeben
10. slicePDF SHALL die Dateiendung `.pdf` automatisch an den generierten Dateinamen anhängen

### Anforderung 6: Vorschau der Zieldokumente

**User Story:** Als Benutzer möchte ich eine Vorschau aller aufgeteilten Dokumente mit den zugeordneten Namen sehen, bevor ich sie herunterlade, damit ich Fehler korrigieren kann.

#### Akzeptanzkriterien

1. WHEN die Aufteilung und Namensextraktion abgeschlossen sind, slicePDF SHALL eine Vorschau-Liste aller Zieldokumente anzeigen
2. slicePDF SHALL in der Vorschau für jedes Zieldokument den generierten Dateinamen, den erkannten Vornamen, den erkannten Nachnamen und eine Miniaturansicht der ersten Seite anzeigen
3. WHEN der Benutzer einen Namen in der Vorschau bearbeitet, slicePDF SHALL den generierten Dateinamen sofort aktualisieren
4. slicePDF SHALL in der Vorschau Zieldokumente mit fehlgeschlagener Namensextraktion visuell hervorheben

### Anforderung 7: Download der Zieldokumente

**User Story:** Als Benutzer möchte ich die aufgeteilten Dokumente herunterladen können, nachdem ich die Vorschau geprüft habe.

#### Akzeptanzkriterien

1. WHEN der Benutzer den Download bestätigt, slicePDF SHALL alle Zieldokumente als ZIP-Archiv zum Download bereitstellen
2. slicePDF SHALL jedes Zieldokument im ZIP-Archiv mit dem im Dateinamen_Template konfigurierten Namen benennen
3. WHEN der Download abgeschlossen ist, slicePDF SHALL eine Bestätigungsmeldung anzeigen
4. slicePDF SHALL dem Benutzer die Möglichkeit bieten, einzelne Zieldokumente separat herunterzuladen

### Anforderung 8: PDF-Aufteilung

**User Story:** Als Benutzer möchte ich, dass die PDF-Datei korrekt in gleich große Teile aufgeteilt wird, damit jedes Zieldokument die richtige Seitenanzahl enthält.

#### Akzeptanzkriterien

1. WHEN der Benutzer die Verarbeitung startet, slicePDF SHALL die Quell_PDF in Zieldokumente mit der angegebenen Seitenanzahl_pro_Dokument aufteilen
2. slicePDF SHALL die Seitenreihenfolge der Quell_PDF in jedem Zieldokument beibehalten
3. slicePDF SHALL die Formatierung, Schriftarten und Bilder der Quell_PDF in jedem Zieldokument originalgetreu erhalten
4. FOR ALL gültige Quell_PDFs, das Aufteilen und anschließende Zusammenfügen aller Zieldokumente SHALL ein Dokument ergeben, das seitenweise identisch mit der Quell_PDF ist (Round-Trip-Eigenschaft)

### Anforderung 9: Datenschutz und Datenbereinigung

**User Story:** Als Benutzer möchte ich sicherstellen, dass nach der Verarbeitung keine Daten in der Applikation gespeichert bleiben, damit der Datenschutz gewährleistet ist.

#### Akzeptanzkriterien

1. WHEN der Benutzer den Download abgeschlossen hat oder die Sitzung beendet, slicePDF SHALL alle hochgeladenen PDF-Dateien, XLSX-Dateien und erzeugten Zieldokumente vollständig aus dem Speicher und temporären Verzeichnissen entfernen
2. slicePDF SHALL keine personenbezogenen Daten (Namen, Dokumenteninhalte) über die aktuelle Sitzung hinaus speichern
3. slicePDF SHALL keine serverseitige Datenbank oder persistenten Speicher für Benutzerdaten verwenden
4. WHEN der Benutzer die Seite neu lädt oder schließt, slicePDF SHALL alle temporären Daten der vorherigen Sitzung bereinigen
