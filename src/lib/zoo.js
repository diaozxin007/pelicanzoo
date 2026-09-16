import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeSvg } from './sanitize-svg.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let cache = null;

export function loadZoo() {
  if (cache) return cache;

  const specimens = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data/specimens.json'), 'utf8')
  );

  const enriched = specimens
    .filter((s) => s.model)
    .map((s) => {
      let svg = null;
      if (s.alive) {
        const f = path.join(ROOT, 'public/live', `${s.id}.svg`);
        if (fs.existsSync(f)) svg = sanitizeSvg(fs.readFileSync(f, 'utf8')).svg;
      }
      return {
        ...s,
        svg,
        // Every note is worth showing: even his flat descriptions are funny,
        // because he keeps calling the pelicans ducks.
        verdict: s.keeper_note && s.keeper_note.length > 15 ? s.keeper_note : null,
        year: s.observed.slice(0, 4),
        vendor: vendorOf(s.model),
        origin: 'wild',
      };
    });

  cache = {
    all: enriched,
    live: enriched.filter((s) => s.svg),
    models: [...new Set(enriched.map((s) => s.model))].sort(),
  };
  return cache;
}

const VENDORS = [
  [/^(claude|opus|sonnet|haiku|fable)/i, 'Anthropic'],
  [/^(gpt|o1|o3|o4|codex|muse|astra)/i, 'OpenAI'],
  [/^(gemini|gemma)/i, 'Google'],
  [/^llama/i, 'Meta'],
  [/^(qwen|qwq)/i, 'Alibaba'],
  [/^deepseek/i, 'DeepSeek'],
  [/^glm/i, 'Zhipu'],
  [/^kimi/i, 'Moonshot'],
  [/^(mistral|mixtral|magistral|devstral|codestral|pixtral)/i, 'Mistral'],
  [/^phi/i, 'Microsoft'],
  [/^nova/i, 'Amazon'],
  [/^olmo/i, 'AI2'],
];

export function vendorOf(model) {
  for (const [re, name] of VENDORS) if (re.test(model)) return name;
  return 'Other';
}
