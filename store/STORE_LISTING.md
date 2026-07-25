<!--
@sdd-task: Task #3 - Chrome Web Store kit
@sdd-spec: specs/spec-006-l6n-setup-deploy-features/spec.md
@sdd-decision: ADR-011 - Public deploy kit
@sdd-why: Copy-paste text for Chrome Web Store Developer Dashboard
-->

# Chrome Web Store Listing Copy

**Developer / Publisher:** Juan M. Solórzano I.  
**GitHub:** https://github.com/JMSolorzano-13  
**Repository:** https://github.com/JMSolorzano-13/chrome-extension-xml-to-pdf  

Use these fields when submitting the item. Do **not** list a company as publisher.

---

## Item name

CFDI XML to PDF (Local)

## Short description (≤ 132 characters)

Convert Mexican CFDI XML invoices to PDF on your device. Batch folders, local-only — no uploads.

## Detailed description

CFDI XML to PDF (Local) helps you turn Mexican electronic invoices (CFDI XML) into printable PDF representations — entirely inside your browser.

**What it does**
- Select a folder that contains CFDI XML files (including subfolders).
- Recursively finds `.xml` files and generates a matching PDF next to each source file.
- Supports common CFDI types: Ingreso, Egreso, Complemento de Pagos 2.0, and Nómina 1.2 (CFDI 3.3 / 4.0 variations).
- Builds a professional printed representation with SAT QR, fiscal seals, and catalog labels — offline.

**Privacy by design**
- 100% local processing. Your XML and PDF never leave your computer.
- No cloud conversion service. No analytics. No accounts required for conversion.
- Uses the File System Access API so PDFs are written beside the original XML paths.

**How to use**
1. Install the extension.
2. Open the popup and click **Seleccionar Carpeta**.
3. Grant folder access when Chrome asks.
4. Wait for the progress indicator; review the success/error summary when finished.

**Permissions**
- `storage` — reserved for lightweight local preferences only. Fiscal documents are not uploaded.

Author: Juan M. Solórzano I. — https://github.com/JMSolorzano-13

## Category

Productivity (or Tools)

## Language

English listing; popup UI currently in Spanish.

## Official URL (optional)

https://github.com/JMSolorzano-13/chrome-extension-xml-to-pdf

## Support URL

https://github.com/JMSolorzano-13/chrome-extension-xml-to-pdf/issues

## Permission justification (`storage`)

Used only for optional local extension preferences stored in the browser. The extension does not transmit CFDI XML, PDF output, RFCs, amounts, or other fiscal data to any remote server. Conversion runs entirely on the user’s device via the File System Access API.
