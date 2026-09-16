import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeSvg } from './sanitize-svg.js';
import { vendorOf } from './zoo.js';
import { loadScores } from './scores.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HEADER = /<!--\s*pelicanzoo\s*([\s\S]*?)-->/i;

/** Metadata rides inside the file as a comment, so one submission is one file
 *  and two people submitting at once never collide in a shared index. */
function parseHeader(text) {
  const m = text.match(HEADER);
  if (!m) return {};
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([a-z-]+)\s*:\s*(.*?)\s*$/i);
    if (kv) fields[kv[1].toLowerCase()] = kv[2];
  }
  return fields;
}

export function loadFeed() {
  const dir = path.join(ROOT, 'submissions');
  if (!fs.existsSync(dir)) return [];

  const scores = loadScores();
  const out = [];
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.svg')) continue;
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const meta = parseHeader(raw);
    const clean = sanitizeSvg(raw);
    // A bad file is a bug in the check that let it merge, not something to
    // paper over at build time. Skip it and say so.
    if (!clean.ok) {
      console.warn(`[feed] skipping ${file}: ${clean.error}`);
      continue;
    }
    if (clean.removed.length) console.warn(`[feed] ${file}: stripped ${clean.removed.join(', ')}`);
    if (!meta.model) {
      console.warn(`[feed] skipping ${file}: no model in the header`);
      continue;
    }
    const id = file.replace(/\.svg$/, '');
    // `verdict` is what the person who sent it in said about it; `assessment`
    // is what the critic said. Two different opinions of the same bird, and
    // only one of them is the zoo's.
    const assessment = scores[id] || null;
    out.push({
      id,
      model: meta.model,
      vendor: vendorOf(meta.model),
      svg: clean.svg,
      by: meta.by || null,
      verdict: meta.note || null,
      observed: meta.date || '',
      year: (meta.date || '').slice(0, 4),
      origin: 'feed',
      assessment,
    });
  }
  return out;
}
