/**
 * Read-only Vercel REST API helper.
 * Usage: node scripts/vercel-api.mjs <method> <path> [json-body]
 */
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const auth = JSON.parse(readFileSync(
  path.join(os.homedir(), '.local/share/com.vercel.cli/auth.json'), 'utf8'));
const TOKEN = auth.token;

const [method, apiPath, body] = process.argv.slice(2);
const res = await fetch(`https://api.vercel.com${apiPath}`, {
  method,
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  },
  body: body ?? undefined,
});
const text = await res.text();
let data;
try { data = JSON.parse(text); } catch { data = text; }
console.log(JSON.stringify({ status: res.status, body: data }, null, 1));
