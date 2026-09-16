// Draws a fed pelican's share card at the edge and files it in R2.
//
// Every other page on this site is rendered per request out of the row. A share
// card cannot be, because it is a PNG: rasterising 1200x630 is a hundred
// milliseconds of CPU and a Worker on the free plan gets ten. So the card is
// made once, by Cloudflare's own headless Chrome — which runs on their hardware
// and costs this Worker nothing but the wait, exactly like the critic's model —
// and what comes back is stored.
//
// Until this existed, a fed pelican's card was rendered by the Chrome on the
// keeper's desk and only reached the site on the next deploy. That was the last
// thing about feeding a pelican that still needed a person.
import puppeteer from '@cloudflare/puppeteer';
import { cardHtml, CARD_W, CARD_H } from './og-card.js';

// Cards live in KV rather than R2, which is the obvious home for a bucket of
// PNGs, because R2 is not enabled on this account and enabling it wants a
// payment method for a thing we would never be billed for. KV holds 25 MB per
// value against a 70 KB card, and the free plan's thousand writes a day is a
// thousand more pelicans than arrive. What it gives up is strong consistency —
// a card can take up to a minute to reach every colo — and the fallback below
// covers exactly that minute.
export const cardKey = (id) => `${id}.png`;

/** Draw it and file it. Returns the bytes on success and null on any failure.
 *
 *  Failure is a real possibility rather than a bug: the free plan allows ten
 *  minutes of browser a day and one new instance every twenty seconds, so a busy
 *  afternoon can legitimately run out. Nothing here throws, because the caller
 *  is either a background task nobody is waiting on or a crawler that would
 *  rather have the zoo's generic card than a 500.
 */
export async function renderCard(env, specimen) {
  if (!env?.BROWSER || !env?.CARDS) return null;

  let browser;
  try {
    // Sanitised on the way into the book by POST /api/feed, so these are the
    // same bytes the site serves — and this page is built from a string we
    // wrote, loaded over setContent, never navigated to a URL. There is nothing
    // for a drawing to reach out to even if it tried.
    const html = cardHtml(specimen, specimen.svg);

    // Launched and closed rather than kept warm. A parked browser keeps burning
    // the daily ten minutes while it idles, and at this zoo's traffic two
    // pelicans will not arrive inside the twenty seconds that a fresh instance
    // costs. Budget is the scarcer of the two.
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: CARD_W, height: CARD_H });
    await page.setContent(html, { waitUntil: 'load' });
    const png = await page.screenshot({ type: 'png' });

    await env.CARDS.put(cardKey(specimen.id), png);
    return png;
  } catch (err) {
    // Logged and swallowed. A pelican without a card previews as the zoo, which
    // is worse than previewing as itself and far better than not previewing.
    console.error(`card ${specimen?.id}: ${err?.message || err}`);
    return null;
  } finally {
    // close(), not disconnect(): see above. Its own failure is not interesting.
    if (browser) await browser.close().catch(() => {});
  }
}
