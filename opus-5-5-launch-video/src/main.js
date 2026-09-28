/* ============================================================================
 * main.js — boot, timeline playback, and the frame API used by the renderer.
 *   window.renderFrame(i) → PNG data URL of frame i (deterministic)
 *   open src/index.html?play in a browser for a live preview (space = pause)
 * ==========================================================================*/
'use strict';

const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H;
if (FORMAT === 'portrait') { canvas.style.width = 'min(100vw, 56.25vh)'; canvas.style.height = 'min(177.78vw, 100vh)'; }
const ctx = canvas.getContext('2d', { alpha: false });

async function boot() {
  const faces = [
    '300 64px "Anthropic Serif"', '400 64px "Anthropic Serif"', '500 64px "Anthropic Serif"', 'italic 400 64px "Anthropic Serif"',
    '400 64px "Anthropic Sans"', '500 64px "Anthropic Sans"', '600 64px "Anthropic Sans"', '700 64px "Anthropic Sans"',
    '400 64px "Anthropic Mono"', '500 64px "Anthropic Mono"',
  ];
  await Promise.all(faces.map(f => document.fonts.load(f).catch(() => null)));
  if (SUBS_LANG === 'ko') await Promise.all(['500 60px', '700 60px', '800 60px'].map(f => document.fonts.load(`${f} "Pretendard Variable"`, '가나다라 Claude 5.5').catch(() => null)));
  await document.fonts.ready;
  initBrand();
  buildPaper();
  if (typeof initScenes === 'function') initScenes();
  const src = await loadSource();
  if (src && typeof setSource === 'function') setSource(src);
  window.__READY__ = true;
}

async function loadSource() {
  // the film shows its own source code in shot 13
  if (window.__SOURCE__) return window.__SOURCE__;
  try {
    const files = ['assets.js', 'engine.js', 'brand.js', 'clawd.js', 'scenes.js', 'scenes-portrait.js', 'subtitles.js', 'main.js'];
    const txt = await Promise.all(files.map(f => fetch(f).then(r => (r.ok ? r.text() : ''))));
    return txt.join('\n');
  } catch (e) { return null; }
}

window.renderAt = function (t) { setTime(t); drawFilm(ctx, t); };
window.renderFrame = function (i) { window.renderAt(i / FPS); return canvas.toDataURL('image/png'); };
window.VIDEO = () => ({ fps: FPS, duration: FILM_DURATION, frames: Math.round(FILM_DURATION * FPS), width: W, height: H, format: FORMAT, subs: SUBS_LANG });
window.SRT = () => (typeof subtitlesToSrt === 'function' ? subtitlesToSrt() : '');

boot().then(() => {
  const q = new URLSearchParams(location.search);
  if (q.has('t')) { window.renderAt(parseFloat(q.get('t'))); return; }
  if (!q.has('play')) { window.renderAt(0); return; }
  // live preview
  let t0 = performance.now(), paused = false, pausedAt = 0;
  const hud = document.getElementById('hud');
  addEventListener('keydown', e => {
    if (e.code === 'Space') { paused = !paused; if (paused) pausedAt = (performance.now() - t0) / 1000; else t0 = performance.now() - pausedAt * 1000; }
    if (e.code === 'ArrowRight') t0 -= 1000;
    if (e.code === 'ArrowLeft') t0 += 1000;
  });
  const loop = () => {
    let t = paused ? pausedAt : (performance.now() - t0) / 1000;
    if (t > FILM_DURATION) { t0 = performance.now(); t = 0; }
    window.renderAt(t);
    hud.textContent = `${t.toFixed(2)}s / ${FILM_DURATION}s   [space] pause  [←/→] seek`;
    requestAnimationFrame(loop);
  };
  loop();
});
