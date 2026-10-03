// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { parse } from 'smol-toml';

/** @type {import('vite').PluginOption} */
const tailwind = tailwindcss();

// The site URL lives in oss.config.toml so templates only edit one file.
function siteUrl() {
  try {
    const raw = readFileSync(new URL('./oss.config.toml', import.meta.url), 'utf-8');
    const parsed = /** @type {{ site?: { url?: string } }} */ (parse(raw));
    return parsed.site?.url ?? 'http://localhost:4321';
  } catch {
    return 'http://localhost:4321';
  }
}

// Static pages + one on-demand endpoint (`/api/stats`, prerender = false).
export default defineConfig({
  site: siteUrl(),
  output: 'static',
  adapter: cloudflare(),
  vite: {
    // @ts-expect-error -- @tailwindcss/vite bundles its own vite types
    plugins: [tailwind],
    build: {
      cssMinify: 'lightningcss',
      // Cloudflare's Vite plugin targets es2024, which this Vite release cannot
      // translate to lightningcss targets. Pin the CSS target explicitly.
      cssTarget: ['chrome107', 'edge107', 'firefox104', 'safari16'],
    },
  },
});
