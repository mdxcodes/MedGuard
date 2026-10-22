/**
 * Minimal MCP client used to talk to the configured MCP servers.
 * Supports HTTP (remote) and stdio (local) transports.
 *
 * Usage: node scripts/mcp-call.mjs <server> <tool> [json-args]
 *        node scripts/mcp-call.mjs <server> --list
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();

function readJsonc(file) {
  const s = readFileSync(file, 'utf8');
  const out = [];
  let inStr = false, esc = false, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (inStr) {
      out.push(c);
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      i++; continue;
    }
    if (c === '"') { inStr = true; out.push(c); i++; continue; }
    if (c === '/' && s[i + 1] === '/') {
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }
    out.push(c); i++;
  }
  return JSON.parse(out.join(''));
}

const globalCfg = readJsonc(path.join(HOME, '.config/kilo/kilo.jsonc'));
const projectCfg = readJsonc(path.join(process.cwd(), '.kilo/kilo.jsonc'));
const servers = { ...(globalCfg.mcp || {}), ...(projectCfg.mcp || {}) };

const name = process.argv[2];
const server = servers[name];
if (!server) {
  console.error(`unknown server "${name}". available: ${Object.keys(servers).join(', ')}`);
  process.exit(1);
}

let seq = 0;
const pending = new Map();
let send, close;

if (server.type === 'remote') {
  const url = server.url;
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  for (const [k, v] of Object.entries(server.headers || {})) {
    headers[k] = String(v).replace(/\{env:([^}]+)\}/g, (_, n) => process.env[n] ?? '');
  }
  // The Vercel MCP shares the endpoint with the CLI's session; reuse the
  // CLI's stored token when no explicit header is configured.
  if (!headers.Authorization && name === 'vercel') {
    try {
      const auth = JSON.parse(readFileSync(
        path.join(HOME, '.local/share/com.vercel.cli/auth.json'), 'utf8'));
      headers.Authorization = `Bearer ${auth.token}`;
    } catch { /* not authenticated via the CLI */ }
  }
  let sid = null;
  send = async (method, params) => {
    const body = { jsonrpc: '2.0', id: ++seq, method, params };
    const reqHeaders = { ...headers };
    if (sid) reqHeaders['mcp-session-id'] = sid;
    const res = await fetch(url, {
      method: 'POST', headers: reqHeaders, body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
    const newSid = res.headers.get('mcp-session-id');
    if (newSid) sid = newSid;
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) return JSON.parse(line.slice(6));
    }
    return text ? JSON.parse(text) : null;
  };
  close = async () => {};
} else {
  const child = spawn(server.command[0], server.command.slice(1), {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  let buf = Buffer.alloc(0);
  child.stdout.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.subarray(0, idx).toString().trim();
      buf = buf.subarray(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      } catch { /* not a complete frame */ }
    }
  });
  send = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, resolve);
    const body = { jsonrpc: '2.0', id, method, params };
    child.stdin.write(JSON.stringify(body) + '\n');
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout ' + method)); } }, 120000);
  });
  close = () => child.kill();
}

const args = process.argv.slice(3);
const init = await send('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'kilo-audit', version: '1.0' },
});
await send('notifications/initialized', {}).catch(() => {});

if (args[0] === '--list') {
  const res = await send('tools/list', {});
  const tools = res?.result?.tools || [];
  console.log(`server=${name} tools=${tools.length}`);
  for (const t of tools) {
    const props = Object.keys(t.inputSchema?.properties || {});
    console.log(`  ${t.name}(${props.join(', ')})`);
  }
} else {
  const tool = args[0];
  const toolArgs = args[1] ? JSON.parse(args[1]) : {};
  const res = await send('tools/call', { name: tool, arguments: toolArgs });
  const text = (res?.result?.content || []).map((c) => c.text || '').join('\n');
  console.log(text || JSON.stringify(res, null, 2));
}
await close();
process.exit(0);
