# CFDI XML to PDF (Local)

Chrome extension (Manifest V3) that converts Mexican **CFDI XML** invoices into professional **PDF** printed representations — **100% on your device**.

**Author:** [Juan M. Solórzano I.](https://github.com/JMSolorzano-13)  
**Repository:** https://github.com/JMSolorzano-13/chrome-extension-xml-to-pdf

---

## Overview

Select a folder that contains CFDI XML files (including nested subfolders). The extension finds each `.xml`, parses the fiscal document locally, generates a PDF with SAT QR and seals, and writes the PDF **next to the source XML** (same folder, same base name).

There is **no cloud conversion service**. XML and PDF contents are not uploaded to remote servers.

---

## Features

- **Local-first / zero cloud** — processing stays in browser memory and your filesystem handles
- **Batch conversion** — recursive folder scan with progress (`N of M`), success summary, and per-file error log
- **CFDI layouts** — Ingreso, Egreso, Complemento de Pagos 2.0, Nómina 1.2 (CFDI 3.3 / 4.0 tolerant parsing)
- **Offline libraries** — `pdfmake`, fonts, and QR code generation bundled under `/libs` (MV3 CSP compliant)
- **Sibling PDF output** — preserves directory structure relative to the folder you grant
- **Store-ready icons** — branded from `logo.svg` (`icons/16.png` … `icons/128.png`)

---

## Privacy

| Question | Answer |
|----------|--------|
| Are XML/PDF uploaded? | **No** |
| Is an account required? | **No** |
| Analytics / ads? | **No** |
| Where do files go? | PDF written beside each XML via the File System Access API |

Full policy text for the Chrome Web Store: [`store/PRIVACY_POLICY.md`](store/PRIVACY_POLICY.md).

---

## Install (unpacked — development)

1. Clone the repository:

```bash
git clone https://github.com/JMSolorzano-13/chrome-extension-xml-to-pdf.git
cd chrome-extension-xml-to-pdf
```

2. Open Chrome (or Brave) → `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select this project folder (the one that contains `manifest.json`)
5. Pin the extension and open the popup

> The popup UI labels are currently in Spanish; this README and the store listing are in English.

---

## Usage

1. Click **Seleccionar Carpeta**
2. Choose a directory that contains CFDI `.xml` files
3. Grant access when the browser prompts you
4. Watch progress; when finished, review the summary and any errors listed
5. Open the generated `.pdf` files next to each source XML

---

## Supported CFDI types

| Type | Notes |
|------|--------|
| Ingreso / Egreso | CFDI 3.3 and 4.0 structural variations |
| Complemento de Pagos 2.0 | Related documents, payment box |
| Nómina 1.2 | Perceptions / deductions layout |

Parsing is resilient to common namespace / PAC differences. Invalid or non-CFDI XML files are skipped with an error entry; the batch continues.

---

## Project structure

```
manifest.json          # MV3 manifest (icons, popup, permissions)
popup.html|css|js      # Extension UI (ES module entry)
logo.svg               # Brand source
icons/                 # 16 / 32 / 48 / 128 PNG (generated)
modules/               # traversal, parser, PDF, batch runner, catalogs
libs/                  # pdfmake, vfs_fonts, qrcode (local only)
scripts/               # generate-icons.sh, package-extension.sh
store/                 # Web Store listing, privacy, publish checklist
tests/                 # Node test harnesses
dist/                  # Generated ZIP (gitignored)
```

---

## Tests

Requires Node.js and the local `devDependency` `@xmldom/xmldom`:

```bash
npm install
npm test
```

This runs the parser, PDF generator, batch-runner, and deploy-kit checks.

---

## Packaging for the Chrome Web Store

Regenerate icons (if you change `logo.svg`):

```bash
./scripts/generate-icons.sh
# needs: brew install librsvg
```

Build the upload ZIP (allowlist only — no `node_modules`, `.git`, or IDE folders):

```bash
npm run package
# → dist/cfdi-xml-to-pdf-v1.0.0.zip
```

Human steps (developer account, screenshots, dashboard submit): see [`store/PUBLISH_CHECKLIST.md`](store/PUBLISH_CHECKLIST.md).  
Listing copy: [`store/STORE_LISTING.md`](store/STORE_LISTING.md).

---

## Permissions

| Permission | Why |
|------------|-----|
| `storage` | Optional local preferences only — not used to exfiltrate invoices |

Folder access is granted interactively through the File System Access API (`showDirectoryPicker`), not via a broad `file://` host permission.

---

## License & disclaimer

MIT License — see [`LICENSE`](LICENSE). Copyright (c) 2026 Juan M. Solórzano I.

This tool produces a **printed representation** of a CFDI for convenience. It is not affiliated with the Mexican SAT. Always keep the original XML as the legal electronic document. Verify critical invoices with official SAT tools when required.

---

## Author

**Juan M. Solórzano I.**  
GitHub: https://github.com/JMSolorzano-13
