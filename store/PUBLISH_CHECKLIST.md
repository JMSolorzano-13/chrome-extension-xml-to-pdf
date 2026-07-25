<!--
@sdd-task: Task #3 - Chrome Web Store kit
@sdd-spec: specs/spec-006-l6n-setup-deploy-features/spec.md
@sdd-decision: ADR-011 - Public deploy kit
@sdd-why: Human-only Chrome Web Store dashboard steps cannot be fully automated
-->

# Chrome Web Store — Human Publish Checklist

**Publisher account name:** Juan M. Solórzano I.  
**GitHub:** https://github.com/JMSolorzano-13  

These steps require your Google account in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). They cannot be completed by CI without your credentials.

## Before you start

- [ ] Pay the one-time Chrome Web Store developer registration fee (if not already registered).
- [ ] Build the upload ZIP locally:

```bash
npm run package
# → dist/cfdi-xml-to-pdf-v1.0.0.zip
```

- [ ] Confirm ZIP contains `manifest.json` and `icons/128.png`, and does **not** contain `node_modules/`, `.git/`, or `.sdd-skill/`.

## Store assets to prepare

- [ ] **Icons:** already in `icons/` (16 / 48 / 128). Dashboard may also ask for a 128×128 promotional icon (you can reuse `icons/128.png`).
- [ ] **Screenshots** (required): capture the popup UI at **1280×800** or **640×400**.
  - Suggested shots: folder picker prompt, progress “N de M”, success summary, error list (optional).
- [ ] **Small promo tile** (optional): 440×280.
- [ ] **Marquee** (optional): 1400×560.

## Dashboard fields

- [ ] Paste listing copy from `store/STORE_LISTING.md` (name, short, detailed).
- [ ] Set developer / contact identity to **Juan M. Solórzano I.** only (no company publisher name).
- [ ] Privacy policy URL: host `store/PRIVACY_POLICY.md` (e.g. raw GitHub URL or GitHub Pages) and paste that URL into the privacy field.
  - Example raw URL pattern after push:  
    `https://raw.githubusercontent.com/JMSolorzano-13/chrome-extension-xml-to-pdf/main/store/PRIVACY_POLICY.md`
- [ ] Justify `storage` using the permission text in `STORE_LISTING.md`.
- [ ] Single purpose description: local CFDI XML → PDF conversion.
- [ ] Upload `dist/cfdi-xml-to-pdf-v*.zip`.
- [ ] Submit for review.

## After submission

- [ ] Monitor the developer dashboard email for review questions.
- [ ] If Google asks about remote code / data use: restate that processing is 100% local and libraries are bundled under `/libs`.

## Out of scope for automation

- Logging into Google
- Paying the developer fee
- Capturing live screenshots of your machine’s Chrome/Brave UI
- Clicking **Submit for review**
