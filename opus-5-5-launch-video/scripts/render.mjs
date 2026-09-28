#!/usr/bin/env node
/* ============================================================================
 * render.mjs — deterministic frame renderer.
 *   node scripts/render.mjs                 → full film: frames → MP4 (+ soundtrack if present)
 *   node scripts/render.mjs --stills 0.5,3  → PNG stills at given seconds (out/stills)
 *   node scripts/render.mjs --sheet 0:30:1  → contact sheet, one frame per second (out/sheet.png)
 *   node scripts/render.mjs --cues          → out/cues.json (sound cues for scripts/soundtrack.py)
 * Options: --workers N  --crf N  --out file.mp4  --keep (keep PNG frames)
 * ==========================================================================*/
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] ?? true) : d; };
const has = k => args.includes('--' + k);

const CHROME = process.env.CHROME_PATH || [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].find(p => fs.existsSync(p));

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execFileSync('python3', ['-c', 'import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())']).toString().trim(); } catch { }
  return 'ffmpeg';
}
const FFMPEG = findFfmpeg();

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/src/index.html`);
  await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 60000 });
  return page;
}

async function grab(page, frameIndex) {
  const url = await page.evaluate(i => window.renderFrame(i), frameIndex);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  const probe = await openPage(browser, port);
  const V = await probe.evaluate(() => window.VIDEO());

  if (has('cues')) {                       // timeline + sound cues for scripts/soundtrack.py
    const data = await probe.evaluate(() => ({ video: window.VIDEO(), cues: window.CUES, timeline: window.TIMELINE }));
    fs.writeFileSync(path.join(OUT, 'cues.json'), JSON.stringify(data, null, 1));
    console.log('wrote out/cues.json', data.cues.length, 'cues');
    await browser.close(); srv.close(); return;
  }

  if (has('stills')) {
    const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
    const times = String(opt('stills')).split(',').map(Number);
    for (const t of times) {
      const f = Math.round(t * V.fps);
      const buf = await grab(probe, f);
      const name = path.join(dir, `t_${t.toFixed(2).padStart(6, '0')}.png`);
      fs.writeFileSync(name, buf); console.log('wrote', path.relative(ROOT, name));
    }
    await browser.close(); srv.close(); return;
  }

  let frames = [...Array(V.frames).keys()];
  if (has('sheet')) {
    frames = [];
    if (has('times')) {                       // explicit list: --sheet --times 2.4,2.45,...
      for (const t of String(opt('times')).split(',').map(Number)) frames.push(Math.round(t * V.fps));
    } else {
      const [a, b, step] = String(opt('sheet')).split(':').map(Number);
      for (let t = a; t < Math.min(b, V.duration) - 1e-6; t += step) frames.push(Math.round(t * V.fps));
    }
  }
  const dir = path.join(OUT, has('sheet') ? 'sheetframes' : 'frames');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });

  const workers = Math.max(1, Number(opt('workers', Math.min(4, os.cpus().length))));
  const pages = [probe];
  for (let i = 1; i < workers; i++) pages.push(await openPage(browser, port));
  let next = 0, done = 0; const t0 = Date.now();
  await Promise.all(pages.map(async page => {
    while (next < frames.length) {
      const idx = next++;
      const buf = await grab(page, frames[idx]);
      fs.writeFileSync(path.join(dir, `${String(idx).padStart(5, '0')}.png`), buf);
      done++;
      if (done % 30 === 0 || done === frames.length) {
        const el = (Date.now() - t0) / 1000;
        process.stdout.write(`\r  ${done}/${frames.length} frames  ${(done / el).toFixed(1)} fps  ${el.toFixed(0)}s   `);
      }
    }
  }));
  process.stdout.write('\n');
  await browser.close(); srv.close();

  if (has('sheet')) {
    const cols = Number(opt('cols', 5));
    const rows = Math.ceil(frames.length / cols);
    const outPng = path.join(OUT, opt('name', 'sheet') + '.png');
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(dir, '%05d.png'),
      '-vf', `scale=384:216:flags=lanczos,tile=${cols}x${rows}:padding=4:color=0x141413`,
      '-frames:v', '1', outPng]);
    console.log('wrote', path.relative(ROOT, outPng), `(${frames.length} frames)`);
    return;
  }

  // ---- encode
  const outFile = path.resolve(ROOT, opt('out', 'out/opus-5-5-launch.mp4'));
  const wav = path.join(OUT, 'soundtrack.wav');
  const crf = String(opt('crf', 28));             // CRF 28 + veryslow + tune animation ≈ 7 MB for 30 s
  const ff = ['-y', '-loglevel', 'error', '-stats', '-framerate', String(V.fps), '-i', path.join(dir, '%05d.png')];
  if (fs.existsSync(wav)) ff.push('-i', wav);
  ff.push('-map', '0:v');
  if (fs.existsSync(wav)) ff.push('-map', '1:a', '-c:a', 'aac', '-b:a', String(opt('abr', '128k')), '-ac', '2');
  ff.push('-c:v', 'libx264', '-preset', String(opt('preset', 'veryslow')), '-tune', 'animation', '-crf', crf,
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1', '-x264-params', 'keyint=60:min-keyint=15:aq-mode=3',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', '-shortest', '-metadata', 'title=Introducing Claude Opus 5.5 (hand-drawn, made in code)', outFile);
  console.log('encoding →', path.relative(ROOT, outFile));
  await new Promise((res, rej) => { const p = spawn(FFMPEG, ff, { stdio: 'inherit' }); p.on('exit', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))); });
  const mb = fs.statSync(outFile).size / 1e6;
  console.log(`done: ${path.relative(ROOT, outFile)}  ${mb.toFixed(2)} MB`);
  if (!has('keep')) fs.rmSync(dir, { recursive: true, force: true });
}

main().catch(e => { console.error(e); process.exit(1); });
