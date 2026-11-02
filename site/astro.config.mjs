// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// On GitHub Pages the site lives at https://<owner>.github.io/<repo>/, so the workflow sets
// SITE_URL and BASE_PATH. Locally both are unset and the site is served from the root.
// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH,
  integrations: [react(), mdx()]
});