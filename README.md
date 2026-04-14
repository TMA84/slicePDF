# slicePDF

Web-Applikation zum Aufteilen großer PDF-Serienbriefe in einzelne Zieldokumente mit automatischer Namenserkennung.

## Features

- PDF-Upload und automatische Aufteilung nach konfigurierbarer Seitenanzahl
- Automatische Vor-/Nachname-Erkennung aus dem PDF-Text (Adressblock, Anrede, Vertragsformat)
- XLSX-Fallback für Namenszuordnung
- Flexibles Dateinamen-Template mit Variablen (`[Nachname]`, `[Vorname]`, `[Dokument]`, `[Datum]`, `[Nummer]`)
- Live-Vorschau der generierten Dateinamen
- Thumbnail-Vorschau der Zieldokumente
- ZIP-Download aller Dokumente oder Einzeldownload
- Automatische Datenbereinigung nach Download / Session-Timeout

## Schnellstart

```bash
npm install
npm run build
npm start
```

Die App läuft auf `http://localhost:8080`.

## Entwicklung

```bash
npm install
npm run dev
```

Startet Client (Vite, Port 5173) und Server (Express, Port 3001) parallel.

## Docker

```bash
docker build -t slicepdf .
docker run -p 8080:8080 slicepdf
```

Oder direkt vom GitHub Container Registry:

```bash
docker run -p 8080:8080 ghcr.io/tma84/slicepdf:latest
```

## Tests

```bash
npm run test:client   # 27 Tests (Unit + Property-Based)
npm run test:server   # 48 Tests (Unit + Property-Based + Integration)
```

## Technologie-Stack

| Komponente | Technologie |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express 5, TypeScript |
| PDF-Verarbeitung | pdf-lib (Split), pdfjs-dist (Text/Thumbnails) |
| XLSX-Parsing | ExcelJS (clientseitig) |
| Testing | Vitest, fast-check (Property-Based Testing) |

## Releases

Releases werden automatisch erstellt wenn ein Git-Tag mit `v`-Prefix gepusht wird:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Dies löst die GitHub Action aus, die:
1. Tests ausführt
2. Ein GitHub Release mit automatischen Release Notes erstellt
3. Ein Docker-Image baut und nach `ghcr.io/tma84/slicepdf` pusht

## Lizenz

MIT — siehe [LICENSE](LICENSE)
