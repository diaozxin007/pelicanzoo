#!/usr/bin/env node
/**
 * Gate on incoming pull requests. The site sanitises before it builds the file,
 * so a submission that still contains a script or an event handler was written
 * by hand — which is exactly the case a human should look at.
 */
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeSvg } from '../src/lib/sanitize-svg.js';
import { SIZE_LIMIT } from '../src/lib/config.js';

const dir = path.resolve(import.meta.dirname, '../submissions');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.svg')) : [];
const problems = [];

for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const fail = (why) => problems.push(`${file}: ${why}`);

  if (raw.length > SIZE_LIMIT) fail(`${(raw.length / 1024).toFixed(0)}KB, over the ${SIZE_LIMIT / 1024}KB cap`);
  if (!/<!--\s*pelicanzoo[\s\S]*?model\s*:\s*\S/i.test(raw)) fail('no "model:" in the pelicanzoo header comment');

  const clean = sanitizeSvg(raw);
  if (!clean.ok) fail(clean.error);
  else if (clean.removed.length) fail(`contains ${clean.removed.join(', ')} — send the model's output unedited`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s) in submissions/:\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('');
  process.exit(1);
}
console.log(`submissions/: ${files.length} file(s), all clean`);
