// Feature suite for the Speak to Copy upgrade (Phase 1 + Phase 2).
// Run: npm run test:features   (or: node test/features.mjs)
// Serves public/ over plain http (like a static host) so manifest/sw/icons
// resolve, and uses the same fake SpeechRecognition engine as no-repeat.mjs.
// NOTE (2026-11-25): Find & Replace and audio-file transcription (OpenAI key)
// were removed from the app at Mukesh's request — the app must not ask the
// user for anything. Section 9 below now proves those panels are gone.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { FAKE } from './engines.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(root, '..', 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const srv = http.createServer((q, r) => {
  var p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/speak-to-copy.html';
  var f = path.join(pub, p);
  if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end('nf'); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
await new Promise((res) => srv.listen(8896, res));
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;
const b = await chromium.launch(launchOpts);

let fails = 0, passes = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passes++; else fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : `\n   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`));
}
async function page(ua, viewport) {
  const c = await b.newContext(ua ? { userAgent: ua } : {});
  const p = await c.newPage();
  if (viewport) await p.setViewportSize(viewport);
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript(FAKE);
  await p.addInitScript(`try{localStorage.clear()}catch(e){}`);
  await p.goto('http://127.0.0.1:8896/speak-to-copy.html');
  await p.waitForTimeout(150);
  p.__errs = errs; return p;
}
const val = (p) => p.inputValue('#output');
const F = t => ({ t, f: true });
const fire = (p, a) => p.evaluate(x => window.__cur().fire(x), a);

// ---- 1. notes history: type, save, list, new, open, rename, delete, search ----
{
  const p = await page();
  await p.fill('#output', 'hello world this is my first note');
  await p.waitForTimeout(900);
  check('1a note saved to history', await p.evaluate(() => window.__stc.getNotes().length), 1);
  check('1b note title from first words', await p.evaluate(() => window.__stc.getNotes()[0].title), 'hello world this is my first');
  await p.click('#newNoteBtn');
  await p.fill('#output', 'second note about shopping');
  await p.waitForTimeout(900);
  check('1c two notes', await p.evaluate(() => window.__stc.getNotes().length), 2);
  const firstId = await p.evaluate(() => window.__stc.getNotes().find(n => n.text.includes('first note')).id);
  await p.evaluate((id) => window.__stc.openNote(id), firstId);
  check('1d open first note', await val(p), 'hello world this is my first note');
  await p.evaluate((id) => window.__stc.renameNote(id, 'My Title'), firstId);
  check('1e rename', await p.evaluate(() => window.__stc.getNotes().find(n => n.id === window.__stc.getCurrentNoteId()).title), 'My Title');
  await p.fill('#noteSearch', 'shopping');
  await p.waitForTimeout(200);
  check('1f search filters list', await p.locator('.note-item').count(), 1);
  await p.fill('#noteSearch', '');
  const secondId = await p.evaluate(() => window.__stc.getNotes().find(n => n.text.includes('shopping')).id);
  await p.evaluate((id) => window.__stc.deleteNote(id), secondId);
  check('1g delete leaves one note', await p.evaluate(() => window.__stc.getNotes().length), 1);
  console.log('1 errors:', p.__errs.length ? p.__errs : 'none');
  await p.context().close();
}

// ---- 2. legacy single-draft migration ----
{
  const c = await b.newContext();
  const p = await c.newPage();
  await p.addInitScript(FAKE);
  await p.addInitScript(`try{localStorage.clear(); localStorage.setItem('stc.text','legacy draft text here')}catch(e){}`);
  await p.goto('http://127.0.0.1:8896/speak-to-copy.html');
  await p.waitForTimeout(200);
  check('2a legacy draft migrated to a note', await val(p), 'legacy draft text here');
  check('2b legacy draft in history', await p.evaluate(() => window.__stc.getNotes().length), 1);
  await c.close();
}

// ---- 3. export: TXT download only + PDF button (DOC/WhatsApp/Email removed 2026-11-25) ----
{
  const p = await page();
  await p.fill('#output', 'export me please');
  await p.waitForTimeout(800);
  const dl = p.waitForEvent('download');
  await p.click('#dlTxtBtn');
  const d = await dl;
  check('3a TXT filename', d.suggestedFilename().endsWith('.txt'), true);
  const tmp = '/tmp/stc-test-download.txt';
  await d.saveAs(tmp);
  check('3b TXT content', fs.readFileSync(tmp, 'utf8'), 'export me please');
  check('3c PDF button present', await p.locator('#dlPdfBtn').count(), 1);
  check('3d no .DOC button', await p.locator('#dlDocBtn').count(), 0);
  check('3e no WhatsApp button', await p.locator('#waBtn').count(), 0);
  check('3f no Email button', await p.locator('#emailBtn').count(), 0);
  await p.context().close();
}

// ---- 4. voice commands + capitalisation (via fake engine) ----
{
  const p = await page();
  await p.click('#micBtn'); await p.waitForTimeout(60);
  await fire(p, [F('hello full stop world')]);
  check('4a full stop + capitalise after stop', await val(p), 'hello. World');
  await fire(p, [F('hello full stop world'), F('this is a test comma please')]);
  check('4b comma', await val(p), 'hello. World this is a test, please');
  await fire(p, [F('first line new line second line')]);
  check('4c new line (capitalised new line)', (await val(p)).includes('first line\nSecond line'), true);
  check('4d unit: question mark', await p.evaluate(() => window.__stc.applyVoiceCommands('is this working question mark')), 'is this working?');
  check('4e unit: Hindi full stop', await p.evaluate(() => window.__stc.applyVoiceCommands('namaste पूर्ण विराम')), 'namaste।');
  await p.context().close();
}

// ---- 5. undo / redo ----
{
  const p = await page();
  await p.fill('#output', 'first version');
  await p.waitForTimeout(800);
  await p.fill('#output', 'second version');
  await p.waitForTimeout(800);
  await p.click('#undoBtn');
  check('5a undo', await val(p), 'first version');
  await p.click('#redoBtn');
  check('5b redo', await val(p), 'second version');
  await p.keyboard.press('Control+z');
  check('5c Ctrl+Z undo', await val(p), 'first version');
  await p.context().close();
}

// ---- 6. read/speak time (find & replace was removed 2026-11-25) ----
{
  const p = await page();
  const words = Array(260).fill('word').join(' ');
  await p.fill('#output', words);
  await p.waitForTimeout(300);
  check('6a read time ~2 min', await p.textContent('#readTime'), '~2 min read');
  await p.context().close();
}

// ---- 7. dark toggle persists + font size ----
{
  const p = await page();
  await p.click('#themeBtn');
  check('7a dark theme applied', await p.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
  check('7b dark theme persisted', await p.evaluate(() => localStorage.getItem('stc.theme')), 'dark');
  await p.click('#themeBtn');
  check('7c back to light', await p.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
  const before = await p.evaluate(() => document.getElementById('output').style.fontSize);
  await p.click('#fontUpBtn');
  const after = await p.evaluate(() => document.getElementById('output').style.fontSize);
  check('7d font size grows', parseInt(after) > parseInt(before || '17'), true);
  await p.context().close();
}

// ---- 8. language suggestion (pure heuristic, no auto-switch) ----
{
  const p = await page();
  check('8a Devanagari suggests hi-IN', await p.evaluate(() => window.__stc.detectLangSuggestionFor('क्या मेरा नाम मुकेश है', 'en-IN')), 'hi-IN');
  check('8b Hinglish suggests en-IN', await p.evaluate(() => window.__stc.detectLangSuggestionFor('mera naam mukesh hai kya', 'hi-IN')), 'en-IN');
  check('8c short text suggests nothing', await p.evaluate(() => window.__stc.detectLangSuggestionFor('hi', 'en-IN')), null);
  const langBefore = await p.inputValue('#lang');
  await p.evaluate(() => window.__stc.detectLangSuggestionFor('क्या मेरा नाम मुकेश है', 'en-IN'));
  check('8d no silent switch', await p.inputValue('#lang'), langBefore);
  await p.context().close();
}

// ---- 9. removed features are gone (2026-11-25, Mukesh's call) ----
// Find & Replace and audio-file transcription (which needed an OpenAI key)
// were removed so the app asks the user for nothing.
{
  const p = await page();
  check('9a no Find & Replace panel', await p.locator('#findPanel').count(), 0);
  check('9b no Find button', await p.locator('#findBtn').count(), 0);
  check('9c no audio panel', await p.locator('#audioPanel').count(), 0);
  check('9d no audio file input', await p.locator('#audioFile').count(), 0);
  check('9e no OpenAI key field', await p.locator('#openaiKey').count(), 0);
  check('9f no Transcribe button', await p.locator('#transcribeBtn').count(), 0);
  check('9g no OpenAI / transcribe text on page', await p.evaluate(() => !/openai|transcribe/i.test(document.body.innerText)), true);
  check('9h no OpenAI URL in page source', await p.evaluate(async () => { const t = await (await fetch('/speak-to-copy.html')).text(); return !/api\.openai\.com|openai/i.test(t); }), true);
  console.log('9 errors:', p.__errs.length ? p.__errs : 'none');
  await p.context().close();
}

// ---- 10. keyboard mic toggle + 360px layout + no console errors ----
{
  const p = await page(null, { width: 360, height: 800 });
  await p.keyboard.press('Control+Space');
  await p.waitForTimeout(120);
  check('10a Ctrl+Space starts mic', await p.evaluate(() => document.getElementById('micBtn').classList.contains('listening')), true);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  check('10b Esc stops mic', await p.evaluate(() => !document.getElementById('micBtn').classList.contains('listening')), true);
  check('10c no horizontal overflow at 360px', await p.evaluate(() => document.documentElement.scrollWidth <= 361), true);
  check('10d no console/page errors on load', p.__errs, []);
  await p.context().close();
}

// ---- 11. translate to selected language (2026-11-25) ----
// Speak any language; the box shows only the language picked in #lang.
// Mock translator stands in for the network (Google/MyMemory/on-device).
{
  const p = await page();
  check('11a translate toggle present + on by default', await p.evaluate(() => { const c = document.getElementById('translateChk'); return c && c.checked; }), true);
  await p.evaluate(() => { window.__mockTranslator = (phrase, target) => ({ text: '你好世界', detected: 'en' }); });
  await p.selectOption('#lang', 'zh-CN');
  await p.click('#micBtn'); await p.waitForTimeout(60);
  await fire(p, [F('hello world')]);
  await p.waitForTimeout(600);
  check('11b English spoken, Chinese in the box', await val(p), '你好世界');
  check('11c spoken language adapted from detected English', await p.evaluate(() => window.__stc.getSpokenLang()), 'en-IN');
  check('11d status says translated from English', await p.evaluate(() => document.getElementById('transStatus').textContent.includes('English')), true);
  await p.context().close();
}
{
  // Same language = no translation call at all.
  const p = await page();
  await p.evaluate(() => { window.__mockCalls = 0; window.__mockTranslator = (phrase, target) => { window.__mockCalls++; return { text: 'TRANSLATED', detected: 'en' }; }; });
  const r1 = await p.evaluate(() => window.__stc.translateFinals(['hello'], 'en-IN'));
  check('11e same-language passes through', r1.list, ['hello']);
  check('11f same-language makes no translator call', await p.evaluate(() => window.__mockCalls), 0);
  const r2 = await p.evaluate(() => window.__stc.translateFinals(['hello'], 'zh-CN'));
  check('11g other language calls translator', r2.list, ['TRANSLATED']);
  check('11h translator called once', await p.evaluate(() => window.__mockCalls), 1);
  await p.context().close();
}
{
  // Translation failure = original words kept, never lost.
  const p = await page();
  await p.evaluate(() => { window.__mockTranslator = () => Promise.reject(new Error('network down')); });
  await p.selectOption('#lang', 'zh-CN');
  await p.click('#micBtn'); await p.waitForTimeout(60);
  await fire(p, [F('hello world')]);
  await p.waitForTimeout(600);
  check('11i failure keeps original words', await val(p), 'hello world');
  check('11j failure status shown', await p.evaluate(() => document.getElementById('transStatus').textContent.includes('unavailable')), true);
  await p.context().close();
}
{
  // Translation switched off = no translation, English stays English.
  const p = await page();
  await p.evaluate(() => { window.__mockTranslator = () => ({ text: '你好世界', detected: 'en' }); });
  await p.selectOption('#lang', 'zh-CN');
  await p.evaluate(() => { const c = document.getElementById('translateChk'); c.checked = false; c.dispatchEvent(new Event('change')); });
  await p.click('#micBtn'); await p.waitForTimeout(60);
  await fire(p, [F('hello world')]);
  await p.waitForTimeout(400);
  check('11k toggle off keeps spoken language', await val(p), 'hello world');
  await p.context().close();
}

console.log(`\nFEATURES: ${passes} passed, ${fails} failed`);
await b.close(); srv.close();
process.exit(fails ? 1 : 0);
