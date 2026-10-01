// Local-only browser smoke test. Uses a fresh Chrome profile, never a signed-in browser.
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const base = 'http://127.0.0.1:4310';
const profile = await mkdtemp(path.join(tmpdir(), 'nullge-ui-'));
const output = path.resolve('.local/ui-check');
await mkdir(output, { recursive: true });
const chrome = spawn(
  process.env.NULLGE_CHROME_BINARY || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=0',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome start timed out')), 15_000);
    chrome.on('error', reject);
    chrome.stderr.on('data', (data) => {
      const match = data.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    const cb = pending.get(data.id);
    if (cb) {
      pending.delete(data.id);
      data.error ? cb.reject(new Error(data.error.message)) : cb.resolve(data.result);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 15_000);
      pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const cdp = (method, params) => send(method, params, sessionId);
  const evaluate = async (expression) => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error('Browser evaluation failed');
    return result.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 50; i++) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`UI condition failed: ${expression}`);
  };
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp('Page.navigate', { url: base });
  await until(
    `Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('로컬 작업공간 열기'))`,
  );
  await evaluate(
    `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('로컬 작업공간 열기')).click()`,
  );
  await until(`document.querySelectorAll('.project-card').length===5`);
  const desktop = await cdp('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(output, 'overview-desktop.png'), Buffer.from(desktop.data, 'base64'));
  await cdp('Page.navigate', { url: `${base}/projects/mellow/marketing/new` });
  await until(`!!document.querySelector('.editor-form')`);
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (await evaluate('document.documentElement.scrollWidth>window.innerWidth+1'))
    throw new Error('Mobile horizontal overflow');
  const mobile = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(path.join(output, 'editor-mobile.png'), Buffer.from(mobile.data, 'base64'));
  await evaluate(`document.querySelector('button.logout').click()`);
  await until(`!!document.querySelector('.login-card')`);
  console.log(
    'PASS: local login, five products, product editor, mobile width, logout. No drafts were created.',
  );
  console.log(`Screenshots: ${output}`);
} finally {
  socket?.close();
  chrome.kill('SIGTERM');
}
