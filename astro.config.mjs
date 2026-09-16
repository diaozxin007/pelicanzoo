import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://pelicanzoo.ai',
  devToolbar: { enabled: false },
  // p/<id>.html rather than p/<id>/index.html. The directory form makes
  // /p/gpt-4o a 307 to /p/gpt-4o/, and that is the URL people paste into
  // social posts — a redirect in front of every share is a redirect some
  // crawler eventually declines to follow.
  build: { format: 'file' },

  // Every page is rendered when it is asked for, out of the data, rather than
  // baked at build time. The zoo used to be 107 files produced on one laptop,
  // which meant a pelican somebody fed was not on the site until that laptop
  // ran a build — the database was doing nothing that a directory of files
  // wasn't already doing badly.
  //
  // Server-rendered rather than fetched-and-drawn in the browser, because the
  // point of a specimen page is that it gets shared: preview crawlers do not
  // run JavaScript, so a client-rendered page shares as a blank card.
  output: 'server',
  adapter: cloudflare({
    // Astro's own image service wants sharp, which is not going to run in
    // workerd. Nothing on this site is a processed image — the pelicans are
    // SVG or already-sized PNGs — so the passthrough service is honest.
    imageService: 'passthrough',
  }),
});
