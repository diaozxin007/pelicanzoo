// Who made the model, guessed from its name.
//
// This lived in zoo.js, which is where it is used most — but zoo.js compiles the
// whole permanent collection into the bundle with import.meta.glob, so importing
// it drags 217 KB of SVG along and only works inside a Vite build. feed.js needs
// nothing but this function, and the keeper's scripts need feed.js, so the
// function moved somewhere plain node can reach.
//
// Nothing here imports anything.
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
