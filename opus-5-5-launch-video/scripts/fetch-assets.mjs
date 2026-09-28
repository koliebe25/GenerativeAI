#!/usr/bin/env node
/* ============================================================================
 * fetch-assets.mjs — downloads the brand typefaces used by the film into fonts/.
 *
 * Anthropic Sans / Serif / Mono are Anthropic's proprietary web fonts. They are
 * NOT committed to this repository; this script fetches them from anthropic.com
 * for local rendering only. If they can't be fetched, the film falls back to
 * system serif / sans / mono faces (see FONT in src/engine.js).
 * ==========================================================================*/
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = path.join(ROOT, 'fonts');
const PAGE = 'https://www.anthropic.com/claude-opus-5-5';
const WANT = ['AnthropicSans_Roman', 'AnthropicSerif_Roman', 'AnthropicSerif_Italic', 'AnthropicMono_Roman'];

const curl = (url, out) => execFileSync('curl', ['-fsSL', '-m', '60', '-A', 'Mozilla/5.0', ...(out ? ['-o', out] : []), url], { maxBuffer: 64 << 20 });

fs.mkdirSync(FONTS, { recursive: true });
let html;
try { html = curl(PAGE).toString(); } catch (e) { console.error('could not reach', PAGE, '- the film will use fallback fonts'); process.exit(0); }
const urls = [...new Set(html.match(/\/_next\/static\/media\/Anthropic[A-Za-z]+_(?:Roman|Italic)_Web[^"')\s]*\.woff2/g) || [])];
for (const name of WANT) {
  const u = urls.find(x => x.includes(`/${name}_Web`));
  const dest = path.join(FONTS, `${name}.woff2`);
  if (!u) { console.warn('not found on page:', name); continue; }
  curl(new URL(u, PAGE).href, dest);
  console.log('fetched', path.relative(ROOT, dest), `${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
}
