# Speak to Copy — Voice to Text

Tap the mic and speak. Your words are captured continuously and kept safe —
nothing is overwritten. Works in Chrome and Edge (Windows, macOS, Android)
and Safari (macOS, iOS 14.5+). Firefox has no speech recognition.

## What it is

A single-file voice-to-text app (`public/speak-to-copy.html`, vanilla JS, no
backend, no account, no tracking) inside a thin Next.js shell that serves it
at `/speak-to-copy.html`.

- **21 languages**, including Hindi, Bengali, Tamil, Telugu, Marathi,
  Gujarati, Kannada, Malayalam, Punjabi and Urdu, with RTL and Indic-script
  rendering.
- **No-repeat dictation**: the browser's speech engine re-sends sentences;
  a strict no-repeat system (`absorb()` / `collapsePrefix()` /
  `trimReplay()` — see the invariant comment in the HTML) stops text like
  "S1 S1 S2" from ever reaching the screen. See `test/no-repeat.mjs`.
- **My notes**: multiple saved notes in localStorage, with search, rename
  and delete. Your old single draft (`stc.text`) is migrated into a note
  automatically on first load.
- **Export**: download as .TXT or .PDF (Print → Save as PDF) only,
  plus Copy / Share / Clear with Undo.
- **No audio-file transcription, no API key needed**: the app asks the
  user for nothing. Just tap the mic and speak — live dictation only.
- **Translate to the selected language**: pick a language (e.g. Chinese),
  speak any language (e.g. English), and the box shows only the picked
  language. On by default (Settings → "Translate speech into the selected
  language"). No key needed — it tries your browser's built-in translator,
  then Google Translate, then MyMemory. If translation fails, your original
  words are kept, never lost. The mic listens in the language you actually
  speak and adapts automatically when it detects another one.
- **Voice commands**: say "full stop", "comma", "question mark",
  "new line", "new paragraph" (and Hindi equivalents) while dictating.
- **Editor**: real Undo/Redo (Ctrl+Z / Ctrl+Shift+Z), reading/speaking
  time, font-size controls, manual dark mode, Ctrl/Cmd+Space to
  start/stop the mic, Esc to stop.
- **PWA**: installable from Chrome ("Add to Home screen"). The app shell
  works offline; speech recognition itself still needs the internet.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000  (redirects to /speak-to-copy.html)
```

Or serve the `public/` folder with any static server — the app is one HTML
file plus `manifest.webmanifest`, `sw.js` and `icons/`.

## Test

```bash
npm test            # 15 no-repeat regression checks (Playwright)
npm run test:features  # history, export, voice commands, undo/redo, removed-feature checks, etc.
npm run test:all
npm run lint
npm run build
```

See `TEST-REPORT.md` for the latest results and honest limitations, and
`UPGRADE-NOTES.md` for what changed file by file.

## Deploy

Deploy the repo to Vercel (or any static host serving `public/`). Do not
deploy `node_modules/` or `.next/`. No environment variables are needed.
No Google indexing / SEO / ads work is included in this version — that is
a separate, later step.
