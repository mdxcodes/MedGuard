/**
 * Minimal Chrome DevTools Protocol screenshot helper.
 *
 * Drives the locally installed headless Chrome over CDP to capture the
 * application in both modes, so the rendered result can be inspected rather
 * than inferred from the source.
 *
 * Usage: node scripts/screenshot.mjs <baseUrl> <outDir>
 */

import { writeFileSync, mkdirSync } from 'node:fs';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173';
const outDir = process.argv[3] || '/tmp/kilo/shots';
const debugPort = 9333;

mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${debugPort}${path}`);
  return res.json();
}

async function main() {
  let version = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      version = await getJson('/json/version');
      break;
    } catch {
      await sleep(250);
    }
  }
  if (!version) throw new Error('Chrome debugging endpoint never came up');

  const targets = await getJson('/json/list');
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      console.error('PAGE ERROR:', message.params.exceptionDetails.text,
        message.params.exceptionDetails.exception?.description || '');
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      console.error('PAGE LOG:', message.params.entry.text);
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const { result } = await send('Runtime.evaluate', { expression, returnByValue: true });
    return result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  const setViewport = (width, height) =>
    send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 640,
    });

  /** Wait until the React tree has actually rendered something. */
  const waitForRender = async (timeoutMs = 20000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const mounted = await evaluate(
        "(() => { const r = document.getElementById('root'); return !!(r && r.children.length); })()",
      );
      if (mounted) {
        // Give the data fetches a moment to settle.
        await sleep(1500);
        return true;
      }
      await sleep(250);
    }
    console.error('timed out waiting for the app to render');
    return false;
  };

  const shoot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${outDir}/${name}.png`, Buffer.from(data, 'base64'));
    console.log(`wrote ${outDir}/${name}.png`);
  };

  const visit = async (path, mode) => {
    await send('Page.navigate', { url: `${baseUrl}${path}` });
    await sleep(800);
    if (mode) {
      await evaluate(`localStorage.setItem('medguard.ui.mode', '${mode}')`);
      await send('Page.reload', {});
      await sleep(800);
    }
    await waitForRender();
  };

  await setViewport(1440, 900);

  // ── Patient Mode ──────────────────────────────────────────────────────
  await visit('/');
  await evaluate("localStorage.removeItem('medguard.ui.mode')");
  await send('Page.reload', {});
  await sleep(800);
  await waitForRender();
  await shoot('01-patient-home');

  await visit('/assessment', 'patient');
  await shoot('02-patient-assessment');

  // ── Research Lab ──────────────────────────────────────────────────────
  await visit('/', 'research');
  await shoot('03-research-overview');

  await visit('/performance', 'research');
  await shoot('04-research-performance');

  // ── Narrow viewport ───────────────────────────────────────────────────
  await setViewport(390, 844);
  await visit('/', 'patient');
  await shoot('05-patient-mobile');

  await visit('/', 'research');
  await sleep(400);
  await shoot('06-research-mobile');

  await setViewport(1440, 900);
  await visit('/assessment', 'patient');
  await shoot('07-patient-assessment-wide');

  ws.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
