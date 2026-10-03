// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { parse } from 'smol-toml';

/** @type {import('vite').PluginOption} */
const tailwind = tailwindcss();

// The site URL lives in oss.config.toml so templates only edit one file.
function siteUrl() {
  try {
    const raw = readFileSync(new URL('./oss.config.toml', import.meta.url), 'utf-8');
    return parse(raw).site?.url ?? 'http://localhost:4321';
  } catch {
    return 'http://localhost:4321';
  }
}

// Static pages + one on-demand endpoint (`/api/stats`, prerender = false).
export default defineConfig({
  site: siteUrl(),
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  vite: {
    // @ts-expect-error -- @tailwindcss/vite bundles its own vite types
    plugins: [tailwind],
    build: {
      cssMinify: 'lightningcss',
    },
  },
});
