// GET /api/feed/<token> — the feeder's own row.
//
// The token is 128 bits of randomness and is the only key; there is no account
// to make and nothing to log in to. The receipt page polls this while the critic
// is still reading.
import { json } from '../../../lib/critic.js';
import { receipt } from '../../../lib/intake.js';

export async function GET({ params, locals }) {
  const env = locals.runtime?.env;
  const token = params.token;
  if (!/^[0-9a-f]{32}$/.test(token)) return json({ error: 'not a receipt' }, 404);
  const row = await env.DB.prepare('select * from feed where token = ?').bind(token).first();
  if (!row) return json({ error: 'no such receipt' }, 404);
  return json({ ...receipt(row), token: row.token });
}

export async function POST() {
  return json({ error: 'get a receipt' }, 405);
}
