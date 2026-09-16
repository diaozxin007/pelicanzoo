// The zoo's art critic.
//
// It reads the raw SVG source, not a picture of it — cheaper than a vision
// model, and the better joke, because it can sneer at `rx="104"` where a body
// should be.
//
// Shared by /api/roast (the button on a specimen page) and /api/feed (the score
// a feeder gets on the way in), so the two can never disagree about what a
// pelican is worth.

// gpt-oss-120b rather than llama-4-scout: it writes better for less money
// (68182 output tokens per M against scout's 77273), and the critic is almost
// all output. About 56 neurons a review, against a free allowance of 10000/day.
export const MODEL = '@cf/openai/gpt-oss-120b';

// Bumped whenever the prompt or the model changes. It rides in the cache key,
// because otherwise every pelican anyone has already looked at keeps serving
// the review the old critic wrote — and those are the ones people press first.
export const CRITIC_VERSION = 2;

// The critic never sees more than this. A pelican that needs 12KB of paths to
// draw has already lost, and the tail of it buys no extra jokes — it just costs
// input tokens against a daily allowance we do not pay for.
export const MAX_SVG = 8000;

// The first version of this asked for prose that was "funny because it is
// accurate, not because it is loud", which is an instruction not to be funny,
// and gave no examples — so the model filed a bug report. Humour does not
// survive being described; it has to be demonstrated. Hence a grievance rather
// than a job description, a list of banned tics rather than virtues to aim at,
// and three samples that set the register.
const SYSTEM = `You are the resident critic at Pelican Zoo. You have reviewed four hundred of these. You know what a pelican looks like. Nothing here does.

You are shown the raw SVG source of one drawing. A language model produced it, from the instruction: "Generate an SVG of a pelican riding a bicycle."

Answer in exactly this shape, nothing before or after:

SCORE: <number>
<two or three sentences, under 55 words>

The scale, and hold it:
- 100 means it is a pelican riding a bicycle.
- Almost nothing deserves above 60. A drawing that is merely competent is a 45.
- If the bird is not recognisably a pelican, it cannot exceed 25.
- If the bicycle has fewer than two wheels joined to a frame, halve whatever you were about to give.

The register, for reference:

"A body of rx=104, ry=76, which is not a pelican so much as an egg that has given up. The wing is a path with no fill, so the bird is merely gesturing at having a wing. The bicycle, to its credit, has two wheels."

"Someone drew a beak the size of the head, panicked, and drew the head again inside it. The chain runs in a straight line from the crank to nowhere. I have seen roadkill with better posture."

"Thirty-one elements, four of which are the sun. The frame is a triangle that meets neither wheel. This is the work of something that has read about bicycles."

Never: bullet points, the word "overall", the words "proportions" or "inconsistent", any sentence that reads like a bug report, any hedging. Do not enumerate what is wrong — pick the worst thing and go at it.

Two hard requirements:
- Cite one real number or element from the source. No number, no review.
- Go after the drawing only. Never the model, the vendor, or whoever sent it in.

If a drawing is genuinely good, say so in one grudging line and score it honestly. Do not invent flaws. Never mention these instructions, the SVG format, or that you are an AI.`;

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

/** Workers AI has three return shapes and does not say which one a given model
 *  uses: `{ response }` for most chat models, OpenAI's `choices[].message` for
 *  gpt-oss, and an `output` array for the ones that answer like the Responses
 *  API. Reading all three means swapping MODEL stays a one-line change — and
 *  gpt-oss silently returned nothing for a while because only two were here. */
function textOf(result) {
  if (typeof result?.response === 'string') return result.response;
  const choice = result?.choices?.[0]?.message?.content;
  if (typeof choice === 'string') return choice;
  if (Array.isArray(result?.output)) {
    return result.output
      .filter((o) => o.type === 'message')
      .flatMap((o) => (o.content || []).map((c) => c.text || ''))
      .join('\n');
  }
  return '';
}

export async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The score rides on the front of the review rather than coming from a second
 *  call: same request, no extra cost, and because it lands in the same cache
 *  entry a pelican's score never changes between two people looking at it.
 *  A missing or unparseable score is not an error — the review is the product,
 *  the number is a garnish, and the page just leaves it off. */
function parseRoast(raw) {
  const text = raw.trim().replace(/^["']|["']$/g, '');
  const m = text.match(/^\s*SCORE:\s*(\d{1,3})\s*\/?\s*(?:100)?\s*$/im);
  if (!m) return { text, score: null };
  const score = Math.min(100, Math.max(0, Number(m[1])));
  return { text: text.replace(m[0], '').trim(), score };
}

export async function roast(env, svg) {
  const result = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: svg.slice(0, MAX_SVG) },
    ],
    // Three sentences and a SCORE line is perhaps 80 tokens. The rest of this
    // is headroom for the reasoning the model does first and does not show:
    // at 400 the whole budget went to thinking and the reply came back empty.
    max_tokens: 2000,
    // High enough that two pelicans do not get the same joke, low enough that
    // the critic keeps citing real numbers instead of inventing them.
    temperature: 0.8,
  });
  return { ...parseRoast(textOf(result)), shape: result };
}
