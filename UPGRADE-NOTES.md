## Translation — added 2026-11-25 (Mukesh's call, same day)

Pick a language, speak any language, the box shows **only the picked
language** — e.g. pick Chinese, speak English, the box shows Chinese.
On by default; switch off in Settings → "Translate speech into the
selected language" (saved in the browser).

- **How it works**: the mic listens in the language you actually speak
  (starts from your phone's language, then adapts when the translation
  service reports a different spoken language — e.g. it hears English,
  so it keeps listening in English). Only *final* phrases are translated,
  in order, through a queue, and only then handed to `absorb()` — the
  no-repeat functions are untouched and byte-identical to the original.
- **No key, nothing asked**: the chain is 1) Chrome's on-device
  Translator API if the browser has it, 2) Google Translate (no key),
  3) MyMemory (no key). The two network routes run in parallel, first
  success wins, 5 s timeout each — a dead route never makes you wait
  for both. If the target is already the spoken language, no call is
  made at all.
- **Never loses speech**: if every route fails, the original words go
  into the box and the status line says "Translation unavailable —
  showing what you said." Changing the language mid-session translates
  what you say next; old text stays as it was.
- **Honest limits**: translation needs internet, and the free services
  can be slow or blocked on some networks — on this VM Google's endpoint
  returns a block page and MyMemory's shared free quota was exhausted,
  so live-network translation could not be verified end-to-end here. It
  is fully verified with a mocked translator (features suite, Section
  11: 11 checks). Please test it on your phone: pick Chinese, speak
  English, and check the box shows Chinese.

## Removal — 2026-11-25 (Mukesh's call, after the first upgrade)

Two features from the first upgrade were **removed completely**, because
the app's whole point is that it asks the user for nothing:

- **Find & Replace removed** — panel, button, `countMatches()`/`escRe()`
  logic and its tests are gone. Reading/speaking time stays.
- **Audio-file transcription removed** — the whole "Transcribe an audio
  file" panel is gone: file picker, player, Transcribe / Play-into-mic
  buttons, the OpenAI Whisper key field, `transcribeWithOpenAI()`,
  `transcribeWithTransformers()`, `mergeTranscript()` and the mocked
  transcriber hook. No API key is asked for anywhere now, and no audio
  file is sent to any service. Live mic dictation is the only input.
- **Export trimmed to .TXT and .PDF only** — the .DOC download, WhatsApp
  share and Email share buttons are gone, with their `docContent()`,
  `whatsappUrl()` and `emailUrl()` helpers. Export & share now has
  exactly two buttons: ⬇ .TXT and ⬇ .PDF / Print.

The sections below describe the first upgrade as it was built; the
removals above override them. Tests were updated and re-run after the
removals: no-repeat 15/15, features 44/44, lint and build pass.

# Speak to Copy — Upgrade Notes (2026-11-25)

Upgrade of the project in this folder, from the user's zip
(`Speak-TO-Copy-master_5_iaar.zip`, live at https://speak-to-copy.vercel.app/).
**Not deployed.** No indexing / SEO / AdSense / ads work was done — that is
explicitly left for later, and no robots.txt, sitemap, analytics, OG or
JSON-LD was added.

## What changed, file by file

### `public/speak-to-copy.html` — the app (only source of truth now)
- **Notes history**: multiple notes in localStorage (`stc.notes`), list with
  title (first words), date and word count, open / rename / delete / search,
  New Note button, auto-save per note. The old single draft (`stc.text`) is
  migrated into a note on first load.
- **Export/share**: Download .TXT and .PDF via `window.print()` with
  print CSS only (~~.DOC, WhatsApp and Email were removed 2026-11-25~~),
  plus the existing Copy / Share / Clear-with-Undo.
- **Audio file transcription**: ~~added in the first upgrade, then
  REMOVED 2026-11-25 — see the Removal note at the top.~~ No audio-file
  transcription, no OpenAI key, no file sent anywhere.
- **Voice commands + smart text**: spoken "full stop / period", "comma",
  "question mark", "exclamation mark", "colon", "semicolon", "new line",
  "new paragraph" (plus Hindi पूर्ण विराम / अल्पविराम / प्रश्न चिह्न /
  नई पंक्ति) are converted to punctuation, then sentence starts are
  auto-capitalised. Applied to final phrases **before** `absorb()`, so the
  no-repeat invariant is untouched. Toggleable ("Voice commands" checkbox
  and "Auto-capitalise" in Settings). A visible Voice commands help list
  was added, with keyboard shortcuts.
- **Hinglish / language suggestion**: `detectLangSuggestionFor()` uses a
  Devanagari/Latin heuristic plus common Hinglish words to suggest hi-IN
  or en-IN in a one-tap bar. It never switches language silently.
- **Editor**: real Undo/Redo stack (buttons + Ctrl+Z / Ctrl+Shift+Z /
  Ctrl+Y), ~~Find & Replace — removed 2026-11-25~~,
  reading time (~130 wpm) and speaking time (~150 wpm), font-size A−/A+
  (14–24 px, persisted), manual dark-mode toggle (persisted, overrides
  `prefers-color-scheme`), Ctrl/Cmd+Space to start/stop the mic, Esc to stop.
- **PWA**: `<link rel="manifest">` + `public/manifest.webmanifest`,
  `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`,
  install button driven by `beforeinstallprompt`, and `public/sw.js`
  (shell-only cache). The UI says plainly that speech recognition still
  needs the internet — offline dictation is not claimed.
- **Privacy + trust**: visible note — "audio is processed by your
  browser's speech service — never recorded or stored on our server. No
  account, no tracking." A red "● Mic on — listening" indicator shows
  while listening. No analytics, no external tracking.
- **Blocker behaviour improved**: Firefox / `file:` / insecure origins
  used to `return` out of the whole script, so notes and export did not
  work there either. Now the mic is disabled with the same message, but
  notes, export and editing still work.
- **Preserved verbatim**: `absorb()`, `collapsePrefix()`, `trimReplay()`,
  `pushNew()`, `flushSegment()`, `render()`, `adoptText()`, `glue()`,
  `norm()` and the whole STRICT NO-REPEAT INVARIANT comment block are
  byte-identical to the original (verified by script). Continuous restart,
  watchdog, runaway guard, language fallback, RTL/Indic/Nastaliq and CJK
  glue are unchanged.

### `speak-to-copy.html` (root) — DELETED
Duplicate of `public/speak-to-copy.html`. Single source of truth is now
`public/speak-to-copy.html` only.

### `src/app/layout.tsx`
Title/description changed from "Create Next App" / "Generated by create
next app" to "Speak to Copy — Voice to Text" (branding only).

### `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*`
New PWA files (see above). Icons are generated PNGs (indigo rounded
square, white mic).

### `package.json`
Added `playwright` (^1.55.0) as a devDependency and scripts:
`test` (no-repeat), `test:features`, `test:all`. No other dependency
changes.

### `test/no-repeat.mjs`
Fixed the broken import (`/opt/npm-tools/...` → `playwright` package) and
the HTML path (root → `public/speak-to-copy.html`). The 15 checks
themselves are unchanged.

### `test/features.mjs` — NEW
Automated checks for history, legacy migration, TXT download, voice
commands, undo/redo, read time, dark-mode persistence, font size,
language suggestion, keyboard mic toggle, 360 px layout and zero console
errors — plus checks proving Find & Replace, audio transcription and
DOC/WhatsApp/Email are gone (see TEST-REPORT.md).

### `README.md`
Rewritten for this app (was the default create-next-app text).

### `TEST-REPORT.md` — NEW
Full test results, how each feature was tested, and honest limitations.

## How to run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # no-repeat suite
npm run test:features
npm run lint
npm run build
```

## How to deploy

Deploy this repo to Vercel (or serve `public/` from any static host).
Exclude `node_modules/` and `.next/`. No env vars needed.

## Deliberately NOT done (later, on Mukesh's say-so)

Google indexing, robots.txt, sitemap.xml, Search Console, SEO meta/OG/
JSON-LD, content pages, AdSense, ads.txt, Google Ads, custom domain,
Privacy/About/Contact pages, analytics.
