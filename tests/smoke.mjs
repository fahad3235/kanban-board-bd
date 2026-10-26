// Kanban Board BD — headless-Chrome smoke test via raw CDP. Run: node tests/smoke.mjs
// Requires /opt/meta-chromium/chrome. Exits non-zero on any failed check.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const INDEX = 'file://' + path.resolve(DIR, '..', 'index.html');
const PORT = 9337;
const chrome = spawn('/opt/meta-chromium/chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--user-data-dir=/tmp/kanban-smoke-' + process.pid,
  '--remote-debugging-port=' + PORT, 'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const consoleErrors = [];
function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.result?.subtype === 'error' || r.exceptionDetails) {
    throw new Error('evaluate failed: ' + expr + ' -> ' + JSON.stringify(r.exceptionDetails || r.result));
  }
  return r.result.value;
}
let checks = 0;
function check(name, cond) {
  checks++;
  if (!cond) throw new Error('CHECK FAILED: ' + name);
  console.log('ok - ' + name);
}
const cleanup = () => { try { chrome.kill(); } catch {} };
process.on('exit', cleanup);

try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json(); break; }
    catch { await sleep(200); }
  }
  if (!targets) throw new Error('chrome debugging endpoint never came up');
  ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((res) => { ws.onopen = res; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
      consoleErrors.push(JSON.stringify(d.params.args));
    }
    if (d.method === 'Runtime.exceptionThrown') consoleErrors.push('exception');
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: INDEX });
  for (let i = 0; i < 50; i++) {
    const ready = await ev(`document.querySelector('#count-todo')?.textContent !== '' && document.querySelector('#count-todo')?.textContent !== undefined ? 'yes' : 'no'`);
    if (ready === 'yes') break;
    await sleep(200);
  }
  check('page renders with title + 3 columns', await ev(
    `document.querySelector('h1').textContent === 'Kanban Board BD' && ` +
    `document.querySelectorAll('.column').length === 3`));

  // Add a task into To Do
  await ev(`document.querySelector('#form-title').value = 'Buy rice'; document.querySelector('#form-tag').value = 'bazar'; document.querySelector('#form-submit').click();`);
  check('added task appears in To Do', await ev(
    `document.querySelector('#col-todo .card h3')?.textContent === 'Buy rice'`));
  check('stats show 1 todo', await ev(`document.querySelector('#stat-todo').textContent === '1'`));

  // Move right into Doing via the move button
  await ev(`document.querySelector('#col-todo .card [data-act="move"]').click();`);
  check('move button shifts card to Doing', await ev(
    `document.querySelector('#col-doing .card h3')?.textContent === 'Buy rice'`));

  // WIP: set limit to 1 (Doing already holds 1) then try adding straight into Doing
  await ev(`document.querySelector('#wip-input').value = '1'; document.querySelector('#wip-input').dispatchEvent(new Event('change'));`);
  await ev(`document.querySelector('#form-title').value = 'Second task'; document.querySelector('#form-col').value = 'doing'; document.querySelector('#form-submit').click();`);
  check('WIP limit blocks a second Doing card', await ev(
    `document.querySelectorAll('#col-doing .card').length === 1 && document.querySelector('#msg').style.display === 'block'`));

  // Search filter hides non-matching card
  await ev(`document.querySelector('#f-search').value = 'zzz'; document.querySelector('#f-search').dispatchEvent(new Event('input'));`);
  check('search filter empties Doing column', await ev(
    `document.querySelector('#col-doing .empty') !== null`));
  await ev(`document.querySelector('#f-search').value = ''; document.querySelector('#f-search').dispatchEvent(new Event('input'));`);
  check('clearing search restores the card', await ev(
    `document.querySelector('#col-doing .card h3')?.textContent === 'Buy rice'`));

  // Persistence across reload
  await send('Page.reload');
  for (let i = 0; i < 50; i++) {
    const ready = await ev(`document.querySelector('#col-doing .card h3') ? 'yes' : 'no'`);
    if (ready === 'yes') break;
    await sleep(200);
  }
  check('card persists after reload', await ev(
    `document.querySelector('#col-doing .card h3')?.textContent === 'Buy rice'`));

  // Language toggle to Bengali
  await ev(`document.querySelector('#lang-btn').click();`);
  check('Bengali toggle renders Bengali title + Bengali digits', await ev(
    `document.querySelector('h1').textContent === 'কানবান বোর্ড বিডি' && document.querySelector('#stat-doing').textContent === '১'`));

  // 390px mobile: no horizontal overflow
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(300);
  check('390px mobile: no horizontal overflow', await ev(
    `document.documentElement.scrollWidth <= 390`));
  await send('Emulation.clearDeviceMetricsOverride');

  check('zero console errors / page exceptions', consoleErrors.length === 0);
  console.log(checks + '/' + checks + ' smoke checks passed');
  cleanup();
  process.exit(0);
} catch (e) {
  console.error('SMOKE FAILED: ' + (e && e.message ? e.message : e));
  console.error('consoleErrors: ' + JSON.stringify(consoleErrors));
  cleanup();
  process.exit(1);
}
