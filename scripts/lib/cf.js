// Cloudflare credentials and a D1 client, for the keeper's scripts only.
//
// The account token never goes to the edge. The Worker reaches D1 through a
// binding, which is not a secret; everything in here runs on one machine and
// reads the token `wrangler login` already dropped on it. That is the same
// arrangement score-pen.mjs and the flux probes use.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const API = 'https://api.cloudflare.com/client/v4';

let cached = null;

export async function credentials() {
  if (cached) return cached;

  let token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  if (!token) {
    // wrangler login writes an OAuth token here and it works as a bearer token
    // against the same REST endpoints an API token would. On macOS wrangler
    // keeps it under Library/Preferences, elsewhere under the home directory.
    const homes = [
      path.join(os.homedir(), 'Library', 'Preferences', '.wrangler', 'config', 'default.toml'),
      path.join(os.homedir(), '.wrangler', 'config', 'default.toml'),
    ];
    for (const cfg of homes) {
      const text = await fs.readFile(cfg, 'utf8').catch(() => '');
      token = text.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
      if (!token) continue;
      // It lasts an hour. Wrangler renews it from the refresh token whenever
      // wrangler itself runs, but nothing here is wrangler, so a script left
      // alone for an afternoon would otherwise fail with Cloudflare's
      // "Invalid access token" — which reads like the login is gone.
      const expiry = text.match(/^expiration_time\s*=\s*"([^"]+)"/m)?.[1];
      if (expiry && Date.parse(expiry) < Date.now()) {
        throw new Error(
          `the wrangler token expired at ${expiry}. Any wrangler command renews it — ` +
            'e.g. `npx wrangler whoami` — then run this again.',
        );
      }
      break;
    }
  }
  if (!token) throw new Error('no credentials: run `npx wrangler login`, or set CLOUDFLARE_API_TOKEN');

  let account = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  if (!account) {
    const r = await fetch(`${API}/accounts`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!j.success) throw new Error(`listing accounts: ${JSON.stringify(j.errors)}`);
    if (j.result.length !== 1) {
      console.error('accounts:', j.result.map((a) => `${a.id} ${a.name}`).join('\n          '));
    }
    account = j.result[0]?.id;
    if (!account) throw new Error('token sees no accounts');
  }

  cached = { token, account };
  return cached;
}

/** The database the Worker is bound to, read out of wrangler.jsonc so the
 *  scripts and the edge can never end up pointed at two different books.
 *  Matched rather than parsed because the file is JSONC and every JSON parser
 *  in node chokes on the comments. */
export async function databaseId() {
  const text = await fs.readFile(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
  const id = text.match(/"database_id"\s*:\s*"([0-9a-f-]{36})"/)?.[1];
  if (!id) throw new Error('no d1 database_id in wrangler.jsonc');
  return id;
}

/** One statement against the live D1, parameters bound.
 *
 *  Bound, not interpolated, and not only for the usual reason: a D1 statement
 *  is capped at 100 KB and an SVG can be bigger than that, so a pasted-in svg
 *  would fail on size long before it failed on quoting.
 *
 *  Returns the rows. Writes come back with an empty array, which is fine —
 *  nothing here reads a result it did not ask for.
 */
export async function d1(sql, params = []) {
  const { token, account } = await credentials();
  const uuid = await databaseId();
  const res = await fetch(`${API}/accounts/${account}/d1/database/${uuid}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.success) {
    const why = j.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(`d1: ${why}`);
  }
  return j.result?.[0]?.results || [];
}
