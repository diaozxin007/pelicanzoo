// Turns a pelican's papers into a photograph of an enamel pin.
//
// The badge at /badge/<id>.svg is a drawing of a badge. This is the same badge
// as an object: brass bezel, glossy enamel panels, the score embossed in gold.
// It is made by handing the SVG's own pixels to an image model and asking for
// the physical version of what it is looking at.
//
// Two things about the prompt are counter-intuitive enough to be worth writing
// down, because both were arrived at by getting them wrong first:
//
//   - The placeholders are NOT substituted. A prompt that spells out the score
//     and quotes the review is a set of instructions a model can follow without
//     ever looking at the reference — so it doesn't, and it invents its own
//     bird. Left as `[SCORE]` and `[QUOTE_TEXT]`, the only place those values
//     exist is the picture, so it has to read them off it, and having started
//     reading it also copies the drawing.
//   - The left panel asks for cloisonné, not for "raised metal line art". Line
//     art is an instruction to draw in one colour, and wan2.7 obeys it — it
//     came back with the fed bird as a brass outline, no blue sky, no red
//     frame, no grass. Cloisonné is the same manufacturing process and it is
//     the one that has a palette: every colour area of the original kept, each
//     filled with its own enamel, divided by brass wire.
//
// Model choice is a deadline, not a preference. qwen-image-3.0-pro keeps the
// artwork almost perfectly and takes three and a half minutes; Cloudflare kills
// a subrequest at about a hundred seconds, and this account's key is not
// entitled to DashScope's async mode (403, immediately). wan2.7-image-pro
// finishes in well under a minute, which is the only reason any of this can
// happen at the edge at all. What it costs is the sun in the corner of the
// reference and a couple of recoloured details.
//
// This is the first secret on the edge. Every other binding in wrangler.jsonc —
// DB, AI, BROWSER, CARDS — is a binding, which is Cloudflare handing the Worker
// a capability rather than a credential. DASHSCOPE_API_KEY is a credential. It
// is set with `wrangler secret put` and never appears in this repository; with
// it unset every function here returns null and the site behaves as it did
// before this file existed.
import puppeteer from '@cloudflare/puppeteer';
import { BADGE_W, BADGE_H } from './badge.js';

export const pinKey = (id) => `${id}.pin.png`;

// The reference is rendered at 4x, which is 3040x840. That is the exact size the
// prompt was tuned against, and the size matters: at half of it the model stops
// being able to read the ninety-character quote off the plate and starts
// inventing words. DashScope caps a side at 3072, so this is also near the
// ceiling.
const REF_SCALE = 4;

// The trial workspace's host. Keys and endpoints at DashScope are region-bound —
// a Beijing key against the Singapore host fails authentication rather than
// saying anything useful — so this is a var rather than a constant, and it takes
// whatever base URL the console handed over. The `/compatible-mode/v1` tail that
// console URLs carry is the OpenAI-compatible face of the same workspace; image
// generation is not on that path, so it is trimmed.
const DEFAULT_HOST = 'https://token-plan.cn-beijing.maas.aliyuncs.com';
const DEFAULT_MODEL = 'wan2.7-image-pro';

const PROMPT =
  'photorealistic product photo, a long horizontal rectangular hard enamel metal badge, ' +
  'brass metal raised wire borders separating each panel, multi-section divided layout. ' +
  'Left panel: light sky blue glossy enamel background, reproduce the reference drawing of ' +
  '[IMAGE_SUBJECT] exactly — same pose, same shapes, same colours, keeping every element of ' +
  'it, rendered as cloisonné enamel: each colour area of the original filled with its own ' +
  'glossy coloured hard enamel and separated by thin raised brass wire, nothing recoloured, ' +
  'nothing left out. Middle panel: deep forest green glossy translucent hard enamel, large ' +
  'raised polished brass gold embossed number "[SCORE] /100", 3D raised metal text with ' +
  'subtle highlight. Right panel: brushed silver grey metal plate, recessed etched serif text ' +
  'quote: "[QUOTE_TEXT]", below quote: "[MODEL_NAME]", "[AUTHOR_INFO]", text is carved into ' +
  'silver metal, matte etched finish. Bottom long strip divided into three small metal panels: ' +
  'left embossed brass text "PelicanZoo.ai", middle etched text "[ART_TITLE]", right etched text ' +
  '"CRITIC: [CRITIC_NAME]". The whole badge has thick double-layer brass metal outer bezel, ' +
  'subtle metal grain, enamel has smooth glassy surface with soft specular highlight, slight ' +
  'tiny speckles in enamel, top-down flat front view, orthographic, no perspective, soft studio ' +
  'lighting, clean white background, sharp focus, macro product shot, ultra-detailed, 8k, ' +
  'professional badge photography. Negative prompt: cropped, deformed, warped, tilted ' +
  'perspective, 3d scene depth, shadow under badge, blurry, painting, illustration, watercolor, ' +
  'paper texture, cartoon, extra text, wrong spelling, messy letters, overlapping elements, ' +
  'plastic, resin, uneven borders, hand drawn, sketch, 3d render cartoon, human, people';

/** btoa cannot be handed 165 KB of arguments — apply() runs out of stack long
 *  before that — so the bytes go through it in slices. */
function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return btoa(bin);
}

/** The badge SVG as pixels, drawn by Cloudflare's headless Chrome.
 *
 *  setContent rather than a navigation: the SVG is a string this Worker just
 *  rendered, and loading it as a document would mean the browser fetching a URL
 *  from the site it is a part of.
 */
async function rasterizeBadge(env, svg) {
  let browser;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: BADGE_W, height: BADGE_H, deviceScaleFactor: REF_SCALE });
    await page.setContent(
      `<!doctype html><meta charset="utf-8">` +
        `<style>html,body{margin:0;padding:0;background:#fff}svg{display:block}</style>` +
        svg,
      { waitUntil: 'load' },
    );
    return await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: BADGE_W, height: BADGE_H },
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/** Draw the pin and file it. Bytes on success, null on any failure.
 *
 *  Failure is ordinary here rather than exceptional: no key set, the day's ten
 *  minutes of browser spent, the week's image quota spent, the model taking
 *  longer than the edge will hold a subrequest open. Every one of those is a
 *  pelican that keeps its vector badge, which is the badge this site shipped
 *  with and is still the one on the page.
 */
export async function renderPin(env, specimen, svg) {
  const key = env?.DASHSCOPE_API_KEY;
  if (!key || !env?.BROWSER || !env?.CARDS) return null;

  const host = (env.DASHSCOPE_HOST || DEFAULT_HOST)
    .replace(/\/compatible-mode\/v\d+\/?$/, '')
    .replace(/\/+$/, '');

  try {
    const ref = await rasterizeBadge(env, svg);
    const res = await fetch(`${host}/api/v1/services/aigc/multimodal-generation/generation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: env.DASHSCOPE_MODEL || DEFAULT_MODEL,
        input: {
          messages: [
            {
              role: 'user',
              content: [{ image: `data:image/png;base64,${toBase64(ref)}` }, { text: PROMPT }],
            },
          ],
        },
        // prompt_extend is the console's 智能改写 toggle, and it is the lever
        // that makes the model describe the reference to itself before drawing.
        // watermark:false genuinely works on this path — the 「AI生成」 box on
        // console output is imposed by the console, not by the API.
        parameters: { prompt_extend: true, watermark: false },
      }),
    });

    const j = await res.json().catch(() => null);
    if (!res.ok || !j || j.code) {
      console.error(`pin ${specimen?.id}: HTTP ${res.status} ${JSON.stringify(j)?.slice(0, 300)}`);
      return null;
    }

    // What comes back is a link into OSS that expires in 24 hours, not bytes.
    const url = j.output?.choices?.[0]?.message?.content?.find((c) => c.image)?.image;
    if (!url) {
      console.error(`pin ${specimen?.id}: no image in response`);
      return null;
    }

    const img = await fetch(url);
    if (!img.ok) {
      console.error(`pin ${specimen?.id}: fetching the result gave ${img.status}`);
      return null;
    }
    const png = await img.arrayBuffer();

    // Filed permanently. A pin costs about two per cent of a week's quota, so
    // the second request for one that already exists must never reach DashScope
    // — the KV lookup in front of this is not an optimisation, it is the budget.
    await env.CARDS.put(pinKey(specimen.id), png);
    return png;
  } catch (err) {
    console.error(`pin ${specimen?.id}: ${err?.message || err}`);
    return null;
  }
}
