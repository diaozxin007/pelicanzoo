import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://pelicanzoo.ai',
  devToolbar: { enabled: false },
  // p/<id>.html rather than p/<id>/index.html. The directory form makes
  // /p/gpt-4o a 307 to /p/gpt-4o/, and that is the URL people paste into
  // social posts — a redirect in front of every share is a redirect some
  // crawler eventually declines to follow.
  build: { format: 'file' },
});
