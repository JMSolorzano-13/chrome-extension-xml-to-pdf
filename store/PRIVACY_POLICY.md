<!--
@sdd-task: Task #3 - Chrome Web Store kit
@sdd-spec: specs/spec-006-l6n-setup-deploy-features/spec.md
@sdd-decision: ADR-011 - Public deploy kit
@sdd-why: Privacy policy for Chrome Web Store privacy fields
-->

# Privacy Policy — CFDI XML to PDF (Local)

**Effective date:** 2026-07-24  
**Developer:** Juan M. Solórzano I.  
**Contact / profile:** https://github.com/JMSolorzano-13  
**Product repository:** https://github.com/JMSolorzano-13/chrome-extension-xml-to-pdf  

## Summary

This Chrome extension converts Mexican CFDI XML invoices into PDF files **entirely on your device**. It does **not** collect, sell, or transmit your fiscal documents or personal data to the developer or to any third-party server.

## Data the extension processes

When you choose a folder, the extension may read XML files you select and write PDF files next to them using the browser File System Access API. That processing happens in your browser’s local memory and local filesystem handles.

## Data we do not collect

The extension and its developer do **not**:

- Upload CFDI XML or generated PDFs to remote servers
- Send RFCs, amounts, UUIDs, seals, or other fiscal fields to the cloud
- Use analytics, advertising, or tracking SDKs
- Require an account to convert files
- Sell or share user data with third parties

## Permissions

- **`storage`:** May be used for lightweight local preferences inside Chrome. It is not used to exfiltrate invoice contents.

## Network activity

Conversion does not require network access to external conversion APIs. The extension ships libraries locally (`pdfmake`, fonts, QR). Generated SAT verification QR codes encode a standard SAT URL pattern for the user to scan later; the extension itself does not call that URL during conversion.

## Contact

Questions about this policy: open an issue on https://github.com/JMSolorzano-13/chrome-extension-xml-to-pdf or contact the developer via https://github.com/JMSolorzano-13.

## Changes

Updates to this policy will be published in the same repository path (`store/PRIVACY_POLICY.md`) and/or the GitHub repository release notes.
