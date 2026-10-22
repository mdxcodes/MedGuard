/**
 * Click a "View" button on the error analysis page and report whether the
 * detail modal opened, so the interaction is verified rather than assumed.
 *
 * Usage: node scripts/check-view-button.mjs <baseUrl> [route]
 */
const baseUrl = process.argv[2] || 'http://localhost:5175';
const route = process.argv[3] || '/errors';
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

const evaluate = async (expression) => {
  const { result } = await send('Runtime.evaluate', { expression, returnByValue: true });
  return result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: `${baseUrl}${route}` });
await new Promise((r) => setTimeout(r, 6000));

const before = await evaluate(`(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'View');
  if (!btn) return { found: false };
  btn.click();
  return { found: true };
})()`);

await new Promise((r) => setTimeout(r, 800));

const after = await evaluate(`(() => {
  const text = document.body.innerText;
  return {
    modalOpen: text.includes('Error case detail'),
    hasClose: text.includes('Close'),
    hasTrue: /True:\\s*ESI/.test(text),
    excerpt: text.includes('Error case detail')
      ? text.split('Error case detail')[1].split('Close')[0].trim().slice(0, 200)
      : null,
  };
})()`);

console.log('View button found:', before.found);
console.log('Modal opened:      ', after.modalOpen);
console.log('Modal content:    ', after.excerpt);
ws.close();
