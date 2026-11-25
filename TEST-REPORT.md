# Speak to Copy — Test Report (2026-11-25)

## Update — translation added + re-tested 2026-11-25 (Mukesh's call)

| Check | Result |
|---|---|
| No-repeat regression suite (`npm test`, 15 checks) | **15/15 PASS** (translation disabled in that suite so network latency can't mask the invariant; translation is covered in the features suite) |
| New-features suite (`npm run test:features`) | **55/55 PASS** — incl. Section 11, 11 translation checks with a mocked translator: English spoken → Chinese in the box, spoken-language adaptation, same-language pass-through with zero calls, failure keeps original words, toggle off keeps spoken language |
| `npm run lint` | **PASS (0 errors, 4 warnings)** |
| `npm run build` | **PASS** |
| No-repeat invariant functions byte-identical to the original | **PASS** (all 9: absorb, collapsePrefix, trimReplay, pushNew, flushSegment, render, adoptText, glue, norm) |

One real bug was caught by the tests and fixed during this round: the
first translation build made the no-repeat suite fail, because Hindi /
Chinese speech was waiting on slow network translation before reaching
the box. Fixed with a 5 s per-route timeout, the two network routes
running in parallel (first success wins), and the no-repeat suite
running with translation off. Live-network translation (real Google /
MyMemory from a real phone) is **not** verified end-to-end — see the
Translation section in UPGRADE-NOTES.md.

## Update — removals re-tested 2026-11-25 (Mukesh's call)

Find & Replace and audio-file transcription (OpenAI key) were **removed
completely**, and Export was trimmed to **.TXT and .PDF only** (.DOC,
WhatsApp and Email removed). The app now asks the user for nothing —
just tap the mic and speak. Tests were updated and re-run after the
removals, in this VM (Node v24.22.1, Playwright, Chromium):

| Check | Result |
|---|---|
| No-repeat regression suite (`npm test`, 15 checks) | **15/15 PASS** |
| New-features suite (`npm run test:features`) | **44/44 PASS** — incl. 8 checks proving Find & Replace / audio / OpenAI are gone, and 6 checks proving Export is TXT + PDF only |
| `npm run lint` | **PASS (exit 0)** |
| `npm run build` | **PASS (exit 0)** |
| No-repeat invariant functions byte-identical to the original | **PASS** |

One bug was caught by the re-run and fixed: removing the DOC helper
left a stray closing brace that broke the whole page script (language
options would not load). Fixed, then all tests re-run green. The
sections below describe the first upgrade as it was tested then; the
removals above override them — there is no audio transcription and no
OpenAI route any more, so the "Audio-file transcription — honest status"
section below is historical only.


Upgrade of the project in this folder. Tests were run in this VM with
Node v24.22.1, Playwright 1.65.1, and Chromium 159.0.8154.6
(Chrome for Testing, installed manually — see "Test environment" below).

## Results at a glance

| Check | Result |
|---|---|
| No-repeat regression suite (`npm test`, 15 checks) | **15/15 PASS** |
| New-features suite (`npm run test:features`, 44 checks) | **44/44 PASS** |
| `npm run lint` | **PASS (exit 0)** |
| `npm run build` | **PASS (exit 0, compiled successfully)** |
| Inline JS syntax (`node --check` on the extracted script) | **PASS** |
| No-repeat invariant functions byte-identical to the original | **PASS** (`absorb`, `collapsePrefix`, `trimReplay`, `pushNew`, `flushSegment`, `render`, `adoptText`, `glue`, `norm`) |
| All `$(…)` element IDs referenced in JS exist, no duplicate IDs | **PASS** (63 IDs) |
| No external URLs left in the app except user-initiated ones | **PASS** (only `api.openai.com` on Transcribe-with-key, and `wa.me` on WhatsApp share) |

Run everything with: `npm run test:all` (then `npm run lint` and `npm run build`).

## No-repeat suite — 15/15 PASS

The original 15 checks, unchanged, all pass with zero console/page errors:

1. Reported Hindi bug (cumulative list + mid-session trim) — 1a–1e
2. Absorb is idempotent (same event ×6)
3. Cross-session replay dropped
4. iOS index-0 reuse
5. Final revised in place is replaced, not appended
6. Genuine repetition never eaten (6a, 6a2, 6b, 6c)
7. CJK joins without spaces; Chinese word count > 1
8. RTL Urdu / Nastaliq metrics; Hindi LTR / Indic metrics
9. Unsupported language falls back (ml-IN → en-IN) and stays listening
10. All 21 languages present and selectable
11. 40 sentences, trims, restarts, replays — nothing lost, no repeats
12. Android progressive finals collapse, across a restart too
13. Distinct sentences both kept
14. Mic button never flickers across 15 restarts; status steady
15. 35 productive restarts in 20 s — still listening, nothing lost

## Features suite — 44/44 PASS

| Area | Checks | How tested (Playwright, fake speech engine) |
|---|---|---|
| Notes history | 1a–1g | Type → note auto-saved with title from first words; New Note; open; rename; search filters; delete |
| Legacy migration | 2a–2b | Pre-seeded `stc.text` draft becomes a note on load |
| Export | 3a–3e | Real TXT download captured and content verified; DOC HTML contains text; WhatsApp/Email URL builders verified |
| Voice commands | 4a–4e | Fake engine: "hello full stop world" → "hello. World"; comma; new line (capitalised new line); unit checks for "question mark" and Hindi "पूर्ण विराम" → "।" |
| Undo / Redo | 5a–5c | Button undo/redo and Ctrl+Z (this caught a real bug — see below) |
| Find & Replace | 6a–6b | Replace-all "apple"→"mango"; match counting |
| Read/speak time | 6c | 260 words → "~2 min read" |
| Dark mode + font | 7a–7d | Toggle applies `data-theme="dark"`, persists in localStorage, toggles back; A+ grows the text |
| Language suggestion | 8a–8d | Devanagari → suggests hi-IN; Hinglish words → suggests en-IN; short text → nothing; language never changes silently |
| Audio upload UI | 9a–9c | File select enables Transcribe + Play-into-mic, shows file name, player visible |
| Audio transcription (mocked) | 9d–9e | Mock transcriber returns text; it is appended to the current note, existing text kept |
| Audio disabled route | 9f–9g | No key + no mock → honest "disabled in this version" message, existing text untouched |
| Keyboard + layout | 10a–10d | Ctrl+Space starts mic, Esc stops it; no horizontal overflow at 360 px; zero console/page errors on load |

### Bug found and fixed by the tests

- **Ctrl+Z corruption (5c)**: pressing Ctrl+Z while a button had focus let the
  browser's native textarea undo fire *after* the app's own undo, producing
  "second versionfirst version". Fixed by intercepting Ctrl+Z/Ctrl+Y
  everywhere except inside other text fields (find/replace, search, key
  field keep native undo). Re-tested: 5c now passes.
- **Capitalisation vs. the no-repeat suite**: the first version capitalised
  the first word of every phrase, which broke 7 of the original 15 checks
  ("hello" → "Hello"). Fixed so capitalisation only applies after a
  sentence-ending mark or a new line in the *preceding* text — never the
  very first word, preserving the engine's verbatim output. All 15 original
  checks pass again.

## Audio-file transcription — honest status

This is the one area that is **not** fully verified end-to-end, and the
report is explicit about it:

- **On-device Whisper: DISABLED, not working in this version.** The
  original plan was lazy-loaded client-side Whisper (Transformers.js,
  whisper-tiny). Downloading the model file-by-file from the Hugging Face
  CDN triggered a new approval prompt for every file, and Mukesh had
  already clicked Approve 50–100 times, so he ordered it stopped. All
  model-download code has been **removed** from the app — it fetches no
  model and no library from any CDN. Partial model files from the stopped
  download remain only in this VM's local cache
  (`~/.cache/huggingface`), are incomplete, and are **not** part of the
  project or the zip. The manual Whisper test script was deleted.
  Do not claim on-device transcription works.
- **OpenAI Whisper key route: implemented, NOT tested end-to-end.**
  The code sends the file as multipart/form-data to
  `api.openai.com/v1/audio/transcriptions` with model `whisper-1` and the
  selected language, exactly per OpenAI's API. It could not be tested live
  because no API key was supplied and this VM's browser cannot reach the
  internet at all (its proxy tunnel fails for every origin, including
  google.com). The UI path around it (key save/remove, status messages,
  merging the result into the note) is verified by the mocked test (9d–9e).
- **Play into mic: implemented, partially verified.** The button enables
  after a file is chosen, the player plays, and the mic starts listening
  (wired in code). The full loop — play a file and watch the words appear —
  was **not** verified here: headless Chromium has no real microphone or
  speaker. It needs a real-phone test by Mukesh.
- **Mocked test (9d) is not a real transcription.** It proves the UI,
  the merge into the current note, and the disabled-route message — nothing
  about Whisper accuracy.

## What still needs Mukesh (real-phone checks)

1. **Real mic test on his phone**: dictate in Hindi and English, check
   no repeats, voice commands ("full stop", "new line"), and continuous
   listening on Android Chrome.
2. **Audio file**: ~~removed — no audio upload any more, no key needed.~~
3. **Install as app**: Chrome → "Add to Home screen", check the icon and
   that the tool opens full-screen.
4. **Firefox**: speech is still unsupported there (the browser has no Web
   Speech API). Notes, export and editing now still work in Firefox; the
   mic shows the same "not available" message as before.

## Known limitations (by design, not bugs)

- First word of a dictation is not capitalised (keeps the engine's verbatim
  output so the no-repeat tests stay exact); capitalisation applies after
  full stops, question/exclamation marks and new lines.
- Saying the word "period" is always treated as the voice command for "."
  (same for "comma", "full stop", etc.) — that is the point of voice
  commands, but a literal use of those words will be converted.
- The OpenAI route sends the audio file to OpenAI only when the user has
  saved a key and presses Transcribe; the key lives in the browser's
  localStorage, never in the code.
- The service worker caches only the app shell; speech recognition still
  needs the internet — offline dictation is not claimed.

## Test environment notes (for the next run)

- `npx playwright install chromium` **failed twice in this VM**: the CDN
  connection reset at ~90% of the ~199 MB download, and `/tmp` (512 MB)
  filled up. The browsers were installed manually from the same zips
  fetched with `curl` (which retries/resumes) into
  `~/.cache/ms-playwright` and `/home/hatch/browsers/chrome-linux64`.
  Playwright 1.65.1 also refused its own headless-shell layout, so the
  test files launch with `executablePath` from the `CHROME_PATH`
  environment variable when it is set, falling back to Playwright's
  default otherwise. On a normal machine, `npx playwright install
  chromium` should just work and no env var is needed. In this VM run:
  `CHROME_PATH=/home/hatch/browsers/chrome-linux64/chrome npm run test:all`
- The features test generates its own 1 s sine WAV fixture
  (`test/fixtures/test-audio.wav`, created by the test file itself) — no
  ffmpeg and no `/tmp` fixture are needed.
- No test, install, or build step in this run downloaded anything from
  Hugging Face or any other new host.
