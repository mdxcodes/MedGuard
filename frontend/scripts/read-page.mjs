/**
 * Extract the visible text of a route from the running app, so the rendered
 * result can be checked directly rather than inferred from pixels.
 *
 * Usage: node scripts/read-page.mjs <baseUrl> <route> [label]
 */
const baseUrl = process.argv[2] || 'http://localhost:5175';
const route = process.argv[3] || '/';
const label = process.argv[4] || route;
const port = 9333;

const res = await fetch(`http://127.0.0.1:${port}/json/list`);
const page = (await res.json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message.result);
    pending.delete(message.id);
  }
});
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));

const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: `${baseUrl}${route}` });
await new Promise((r) => setTimeout(r, 6000));

const { result } = await send('Runtime.evaluate', {
  expression: 'document.body.innerText',
  returnByValue: true,
});

console.log(`===== ${label} (${route}) =====`);
console.log(result.value);
ws.close();
