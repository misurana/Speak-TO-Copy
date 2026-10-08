// Regression suite for the STRICT NO-REPEAT INVARIANT in speak-to-copy.html.
// Run: node test/no-repeat.mjs
import pw from '/opt/npm-tools/node_modules/playwright/index.js'; const { chromium } = pw;
import http from 'http'; import fs from 'fs'; import path from 'path';
import { FAKE } from './engines.mjs';

const root = path.dirname(new URL(import.meta.url).pathname);
const html = fs.readFileSync(path.join(root, '..', 'speak-to-copy.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, {'Content-Type':'text/html'}); r.end(html); }).listen(8895);
const b = await chromium.launch();

let fails = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : `\n   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`));
}
async function page(ua) {
  const c = await b.newContext(ua ? { userAgent: ua } : {});
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.addInitScript(FAKE);
  await p.addInitScript(`try{localStorage.clear()}catch(e){}`);
  await p.goto('http://127.0.0.1:8895/');
  p.__errs = errs; return p;
}
const fire = (p, a) => p.evaluate(x => window.__cur().fire(x), a);
const endS = (p) => p.evaluate(() => window.__cur().end());
const val  = (p) => p.inputValue('#output');
const F = t => ({ t, f: true });
const I = t => ({ t, f: false });

// The exact sentences from the reported Hindi failure. S1 is 15 words, which
// is what defeated the old 12-word overlap cap.
const S1 = 'क्या मेरा नाम मुकेश राणा है मैं पिछले साल से इस काम कर रहा हूं';
const S2 = 'दुनिया ने की कितनी बुराइयां हमारी';
const S3 = 'हम आगे चलते रहे पीछे नहीं मुड़े';

// ---- 1. the reported bug: cumulative list + mid-session trim ----
{
  const p = await page();
  await p.selectOption('#lang', 'hi-IN');
  await p.click('#micBtn'); await p.waitForTimeout(60);
  await fire(p, [F(S1)]);
  check('1a first sentence', await val(p), S1);
  await fire(p, [F(S1), F(S2)]);
  check('1b second sentence', await val(p), S1 + ' ' + S2);
  // Chrome trims the front of the list on long sessions:
  await fire(p, [F(S2)]);
  check('1c trim must not duplicate', await val(p), S1 + ' ' + S2);
  await fire(p, [F(S2), F(S3)]);
  check('1d third sentence', await val(p), S1 + ' ' + S2 + ' ' + S3);
  await endS(p); await p.waitForTimeout(250);
  check('1e survives restart', await val(p), S1 + ' ' + S2 + ' ' + S3);
  console.log('1 errors:', p.__errs.length ? p.__errs : 'none');
  await p.context().close();
}

// ---- 2. idempotence: the same event replayed N times changes nothing ----
{
  const p = await page();
  await p.click('#micBtn'); await p.waitForTimeout(60);
  for (let i = 0; i < 6; i++) await fire(p, [F(S1), F(S2)]);
  check('2 absorb is idempotent', await val(p), S1 + ' ' + S2);
  await p.context().close();
}

// ---- 3. cross-session replay of a whole phrase ----
{
  const p = await page();
  await p.click('#micBtn'); await p.waitForTimeout(60);
  await fire(p, [F(S1)]);
  await endS(p); await p.waitForTimeout(200);
  await fire(p, [F(S1), F(S2)]);     // engine replays S1 in the new session
  check('3 cross-session replay dropped', await val(p), S1 + ' ' + S2);
  await p.context().close();
}

// ---- 4. iOS: index 0 reused per utterance ----
{
  const p = await page('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
  await p.click('#micBtn'); await p.waitForTimeout(60);
  await fire(p, [I('क्या मेरा')]);
  await fire(p, [F(S1)]);
  await fire(p, [I('दुनिया ने')]);
  await fire(p, [F(S2)]);
  await fire(p, [F(S3)]);
  check('4 iOS index reuse', await val(p), S1 + ' ' + S2 + ' ' + S3);
  await p.context().close();
}

// ---- 5. a final revised in place is replaced, not appended ----
{
  const p = await page();
  await p.click('#micBtn'); await p.waitForTimeout(60);
  await fire(p, [F('hello'), F('there')]);
  await fire(p, [F('hello'), F('there friend')]);
  check('5 revision replaces', await val(p), 'hello there friend');
  await p.context().close();
}

// ---- 6. genuine repetition is NEVER eaten ----
{
  const p = await page();
  await p.click('#micBtn'); await p.waitForTimeout(60);
  await fire(p, [F('नहीं'), F('नहीं'), F('नहीं मैंने वो नहीं कहा')]);
  check('6a one-word repeats kept', await val(p), 'नहीं नहीं नहीं मैंने वो नहीं कहा');
  await p.context().close();

  const q = await page();
  await q.click('#micBtn'); await q.waitForTimeout(60);
  await fire(q, [F('very very good')]);
  await endS(q); await q.waitForTimeout(200);
  await fire(q, [F('very very good')]);   // user really said it twice
  check('6b exact multi-word repeat across sessions treated as replay',
        await val(q), 'very very good');
  await q.context().close();
}

// ---- 7. CJK joins without spaces ----
{
  const p = await page();
  await p.selectOption('#lang', 'zh-CN');
  await p.click('#micBtn'); await p.waitForTimeout(60);
  await fire(p, [F('我叫穆克什'), F('我住在诺伊达')]);
  check('7a no spaces inserted in Chinese', await val(p), '我叫穆克什我住在诺伊达');
  const wc = await p.textContent('#wordCount');
  check('7b Chinese word count is not 1', Number(wc) > 1, true);
  await p.context().close();
}

// ---- 8. RTL languages get the right direction ----
{
  const p = await page();
  await p.selectOption('#lang', 'ur-PK');
  await p.waitForTimeout(50);
  check('8a Urdu is rtl', await p.getAttribute('#output', 'dir'), 'rtl');
  check('8b Urdu uses nastaliq metrics', await p.getAttribute('#output', 'data-script'), 'nastaliq');
  await p.selectOption('#lang', 'hi-IN'); await p.waitForTimeout(50);
  check('8c Hindi is ltr', await p.getAttribute('#output', 'dir'), 'ltr');
  check('8d Hindi uses indic metrics', await p.getAttribute('#output', 'data-script'), 'indic');
  await p.context().close();
}

// ---- 9. unsupported language falls back instead of dying ----
{
  const p = await page();
  await p.selectOption('#lang', 'ml-IN');
  await p.click('#micBtn'); await p.waitForTimeout(60);
  await p.evaluate(() => window.__cur().err('language-not-supported'));
  await p.waitForTimeout(150);
  check('9a fell back to en-IN', await p.inputValue('#lang'), 'en-IN');
  const opts = await p.evaluate(() =>
    Array.from(document.getElementById('lang').options)
         .filter(o => o.textContent.includes('not available')).map(o => o.value));
  check('9b bad language marked in the list', opts, ['ml-IN']);
  check('9c still listening', (await p.getAttribute('#micBtn','class')).includes('listening'), true);
  await p.context().close();
}

// ---- 10. every language in the list is selectable and renders ----
{
  const p = await page();
  const codes = await p.evaluate(() =>
    Array.from(document.getElementById('lang').options).map(o => o.value));
  check('10a all 21 languages present', codes.length, 21);
  let bad = [];
  for (const c of codes) {
    await p.selectOption('#lang', c);
    const ok = await p.evaluate(() => {
      const o = document.getElementById('output');
      return !!o.getAttribute('dir') && !!o.getAttribute('lang');
    });
    if (!ok) bad.push(c);
  }
  check('10b every language sets dir and lang', bad, []);
  console.log('10 errors:', p.__errs.length ? p.__errs : 'none');
  await p.context().close();
}

// ---- 11. long mixed run: 40 sentences, trims, restarts, replays ----
{
  const p = await page();
  await p.click('#micBtn'); await p.waitForTimeout(60);
  const said = [];
  let list = [];
  for (let i = 1; i <= 40; i++) {
    const s = `वाक्य संख्या ${i}`;
    said.push(s); list.push(F(s));
    await fire(p, list);
    if (i % 7 === 0) list = list.slice(-2);          // engine trims the front
    if (i % 11 === 0) { await endS(p); await p.waitForTimeout(90); list = [F(s)]; } // restart + replay
  }
  check('11 40 sentences, no repeats, nothing lost', await val(p), said.join(' '));
  await p.context().close();
}

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`);
await b.close(); srv.close();
process.exit(fails ? 1 : 0);
