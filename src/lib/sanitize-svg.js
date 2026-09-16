/**
 * Model-generated SVG pasted in by strangers is untrusted markup.
 *
 * This runs in three places — the static build, the browser preview box, and
 * the CI check on incoming pull requests — so it lives on its own, and it
 * reports what it removed instead of only handing back a cleaned string. The
 * site strips before it builds a pull request, so a submission that still
 * arrives dirty was hand-crafted, and CI should stop it for a human to read.
 */

// Anything here is executable, phones home, or escapes the SVG sandbox.
const DANGEROUS = [
  ['script', /<script\b[\s\S]*?(?:<\/script\s*>|$)/gi],
  ['foreignObject', /<foreignObject\b[\s\S]*?(?:<\/foreignObject\s*>|$)/gi],
  ['iframe/object/embed', /<(iframe|object|embed)\b[\s\S]*?(?:<\/\1\s*>|$)/gi],
  ['event handler', /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*[^\s>\/])/gi],
  ['javascript: url', /javascript\s*:/gi],
  // Remote refs leak the visitor's IP to whoever hosts them, and can swap the
  // picture out from under us later. Data URIs are fine and stay.
  ['remote reference', /\s(?:xlink:href|href|src)\s*=\s*(?:"(?:https?:)?\/\/[^"]*"|'(?:https?:)?\/\/[^']*')/gi],
  ['css @import', /@import[^;]*;?/gi],
  ['remote css url', /url\(\s*['"]?(?:https?:)?\/\/[^)]*\)/gi],
];

/** Percentages need something to be a percentage of; without a viewBox an SVG
 *  whose width/height we strip will stretch to fill whatever box it lands in. */
function addViewBox(tag) {
  if (/viewBox/i.test(tag)) return tag;
  const w = tag.match(/\bwidth\s*=\s*"?([\d.]+)/i);
  const h = tag.match(/\bheight\s*=\s*"?([\d.]+)/i);
  if (!w || !h) return tag;
  return `${tag.slice(0, 4)} viewBox="0 0 ${w[1]} ${h[1]}"${tag.slice(4)}`;
}

/**
 * @returns {{ ok: boolean, svg: string|null, removed: string[], error: string|null }}
 */
export function sanitizeSvg(input) {
  const removed = [];
  let s = String(input || '');

  // Normalisation, never a reason to reject anything.
  s = s.replace(/<\?xml[\s\S]*?\?>/gi, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '');

  for (const [label, re] of DANGEROUS) {
    re.lastIndex = 0;
    if (re.test(s)) {
      removed.push(label);
      re.lastIndex = 0;
      s = s.replace(re, '');
    }
  }

  const start = s.search(/<svg[\s>]/i);
  const end = s.toLowerCase().lastIndexOf('</svg>');
  if (start === -1 || end === -1) {
    return { ok: false, svg: null, removed, error: 'no <svg> element found' };
  }
  s = s.slice(start, end + 6);

  s = s.replace(/<svg[^>]*>/i, (tag) => addViewBox(tag));
  // One pass only reaches the first attribute it meets: the scan resumes past
  // the replacement and can no longer match <svg. Keep going until none are left.
  while (/<svg[^>]*\s(?:width|height)\s*=/i.test(s)) {
    s = s.replace(/<svg([^>]*?)\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '<svg$1');
  }

  if (!/viewBox/i.test(s)) {
    return { ok: false, svg: null, removed, error: 'no viewBox and no width/height to derive one from' };
  }
  return { ok: true, svg: s.trim(), removed, error: null };
}
