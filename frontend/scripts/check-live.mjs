const baseUrl = process.argv[2];
const route = process.argv[3] || '/';
const port = Number(process.env.CDP_PORT || 9333);
const res = await fetch(`http://127.0.0.1:${port}/json/list`);
const page = (await res.json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 1; const pending = new Map(); const errors = []; const failed = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description||'').slice(0,200));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map(a=>a.value||a.description||'').join(' ').slice(0,200));
  if (m.method === 'Network.loadingFailed') failed.push(m.params.errorText);
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) failed.push(`${m.params.response.status} ${m.params.response.url}`);
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const send = (method, params={}) => new Promise((r) => { const i=id++; pending.set(i,r); ws.send(JSON.stringify({id:i,method,params})); });
const ev = async (x) => (await send('Runtime.evaluate', {expression:x, returnByValue:true}))?.result?.value;

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable');
await send('Page.navigate', { url: baseUrl + route });
await new Promise((r) => setTimeout(r, 12000));
console.log('=== TEXT ===');
console.log(await ev("document.body.innerText.slice(0,500)"));
console.log('\n=== root children:', await ev("document.querySelector('#root')?.children.length"));
console.log('=== API calls attempted:', await ev("performance.getEntriesByType('resource').filter(r=>r.name.includes('onrender')).map(r=>r.name.slice(0,60))"));
console.log('\n=== JS errors ==='); console.log(errors.slice(0,6).join('\n') || 'none');
console.log('\n=== failed requests ==='); console.log(failed.slice(0,8).join('\n') || 'none');
ws.close();
