/* ============================================================================
 * scenes.js — the film. 14 shots, 13 transitions, one timeline.
 * All figures: anthropic.com/claude-opus-5-5 (published Sept 22, 2026).
 * ==========================================================================*/
'use strict';

const FILM_DURATION = 30.0;
const SHOTS = [], TRANS = [], CUES = [];
const shot = (id, start, end, draw) => SHOTS.push({ id, start, end, dur: end - start, draw });
const trans = (at, dur, type, o = {}) => TRANS.push({ at, dur, type, ...o });
const cue = (t, sfx, o = {}) => CUES.push({ t: +t.toFixed(3), sfx, ...o });

let SOURCE_TEXT = null, SOURCE_LINES = 0;

/* ------------------------------------------------------------ helpers --- */
function kicker(ctx, str, x, y, o = {}) {
  text(ctx, str.toUpperCase(), x, y, { family: FONT.mono, size: o.size ?? 34, weight: 500, color: o.color ?? PAL.clayDeep, tracking: 3, jitter: 0.2, reveal: o.reveal ?? 1, mode: 'type', align: o.align });
}
function label(ctx, str, x, y, o = {}) {
  text(ctx, str, x, y, { family: FONT.sans, size: o.size ?? 48, weight: o.weight ?? 500, color: o.color ?? PAL.slateMed, jitter: 0.3, reveal: o.reveal ?? 1, mode: o.mode ?? 'fade', stagger: 0.5, align: o.align });
}
function note(ctx, str, x, y, o = {}) {
  text(ctx, str, x, y, { family: FONT.mono, size: o.size ?? 30, color: o.color ?? PAL.cloudDark, reveal: o.reveal ?? 1, mode: 'type', align: o.align, jitter: 0.15 });
}
// big numbers with tabular digit slots (no width jitter while counting)
function stat(ctx, str, x, y, size, o = {}) {
  setFont(ctx, FONT.serif, size, o.weight ?? 400);
  const dw = Math.max(...'0123456789'.split('').map(d => ctx.measureText(d).width));
  const chars = [...str];
  const widths = chars.map(c => (/[0-9]/.test(c) ? dw : ctx.measureText(c).width));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  const reveal = o.reveal ?? 1;
  ctx.save();
  ctx.fillStyle = o.color ?? PAL.ink; ctx.textBaseline = 'alphabetic';
  chars.forEach((c, i) => {
    const k = clamp((reveal - (i / chars.length) * 0.5) / 0.5);
    if (k > 0) {
      const r = RNG('stat', str.length, i, G.boil);
      ctx.save();
      ctx.translate(cx + widths[i] / 2 + (r() - 0.5) * 1.2, y + (r() - 0.5) * 1.2);
      const e = E.outBack(k, 2.4);
      ctx.scale(lerp(0.6, 1, e), e);
      ctx.globalAlpha *= clamp(k * 3);
      ctx.fillText(c, -ctx.measureText(c).width / 2, 0);
      ctx.restore();
    }
    cx += widths[i];
  });
  ctx.restore();
  return total;
}
const fmt = n => Math.round(n).toLocaleString('en-US');

function chip(ctx, str, x, y, o = {}) {
  const size = o.size ?? 28;
  const w = measure(ctx, str, FONT.mono, size, 500) + size * 1.2, h = size * 1.9;
  const k = o.k ?? 1; if (k <= 0) return w;
  ctx.save();
  ctx.translate(x + w / 2, y);
  const e = E.outBack(clamp(k), 2.5); ctx.scale(e, e);
  sketch(ctx, shp.rrect(-w / 2, -h / 2, w, h, h / 2), { fill: o.fill ?? PAL.ivory, w: 3, seed: hashStr(str) % 999, amp: 1, fillOffset: [3, 4] });
  text(ctx, str, 0, size * 0.36, { family: FONT.mono, size, weight: 500, color: o.color ?? PAL.ink, align: 'center', jitter: 0.2 });
  ctx.restore();
  return w;
}
function chipWidth(ctx, str, size) { return measure(ctx, str, FONT.mono, size, 500) + size * 1.2; }
function check(ctx, x, y, s, k, color = PAL.olive, w = 7) {
  if (k <= 0) return;
  const pts = resample([[x - s * 0.5, y], [x - s * 0.12, y + s * 0.38], [x + s * 0.55, y - s * 0.45]], 4);
  inkStroke(ctx, partial(wobble(pts, 1.2, 30, 3 + G.boil), E.outC(clamp(k))), { w, color, taper: 0.2 });
}
function cross(ctx, x, y, s, k, color = PAL.cloudDark, w = 6) {
  if (k <= 0) return;
  const a = clamp(k * 2), b = clamp(k * 2 - 1);
  inkStroke(ctx, partial(resample([[x - s / 2, y - s / 2], [x + s / 2, y + s / 2]], 4), a), { w, color });
  if (b > 0) inkStroke(ctx, partial(resample([[x + s / 2, y - s / 2], [x - s / 2, y + s / 2]], 4), b), { w, color });
}
function drawPencil(ctx, x, y, ang, len = 300, wd = 42) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const tip = wd * 1.3;
  sketch(ctx, [[0, 0], [tip, -wd / 2], [tip, wd / 2]], { fill: PAL.manilla, w: 4, seed: 301, fillOffset: [0, 0] });
  sketch(ctx, [[0, 0], [tip * 0.38, -wd * 0.19], [tip * 0.38, wd * 0.19]], { fill: PAL.ink, w: 2, seed: 302, fillOffset: [0, 0] });
  sketch(ctx, shp.rect(tip, -wd / 2, len, wd), { fill: '#EDB547', w: 4, seed: 303, fillOffset: [3, 3] });
  line(ctx, tip + 6, -wd / 6, tip + len - 6, -wd / 6, { w: 2, seed: 304, alpha: 0.5 });
  line(ctx, tip + 6, wd / 6, tip + len - 6, wd / 6, { w: 2, seed: 305, alpha: 0.5 });
  sketch(ctx, shp.rect(tip + len, -wd / 2, wd * 0.5, wd), { fill: PAL.cloud, w: 4, seed: 306, fillOffset: [0, 0] });
  sketch(ctx, shp.rrect(tip + len + wd * 0.5, -wd / 2, wd * 0.8, wd, wd * 0.3), { fill: PAL.coral, w: 4, seed: 307, fillOffset: [2, 2] });
  ctx.restore();
}
function sparkles(ctx, pts, t, o = {}) {           // tiny twinkling brand sparks
  pts.forEach(([x, y, s, ph]) => {
    if (s <= 0) return;
    const k = 0.5 + 0.5 * Math.sin(t * (o.speed ?? 6) + ph);
    drawSparkMark(ctx, x, y, s * (0.55 + 0.45 * k), ph + t * 0.8, o.color ?? PAL.clay);
  });
}
function puff(ctx, x, y, k, o = {}) {              // landing dust
  if (k <= 0 || k >= 1) return;
  const n = o.n ?? 6, spread = o.spread ?? 150;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, j = Math.floor(i / 2);
    const px = x + side * (40 + E.outC(k) * spread * (0.6 + j * 0.25)), py = y - E.outC(k) * (20 + j * 18);
    const r = (1 - k) * (22 + j * 6);
    sketch(ctx, shp.ellipse(px, py, r, r * 0.8, 14), { fill: PAL.ivory, w: 3, seed: 3000 + i, fillOffset: [0, 0], alpha: 1 - k * 0.6 });
  }
}
function darkCard(ctx) { ctx.save(); ctx.fillStyle = PAL.ink; ctx.fillRect(0, 0, W, H); ctx.restore(); }

/* -------------------------------------------------------- doodle icons --- */
const ICONS = [
  (c, s) => { sketch(c, [[-s, s * .5], [s, s * .5]], { closed: false, w: 3, seed: 1 }); line(c, 0, -s * .7, 0, s * .5, { w: 3, seed: 2 }); line(c, -s * .8, -s * .45, s * .8, -s * .45, { w: 3, seed: 3 }); sketch(c, shp.arc(-s * .6, -s * .1, s * .3, 0, Math.PI, 8), { closed: false, w: 3, seed: 4 }); sketch(c, shp.arc(s * .6, -s * .1, s * .3, 0, Math.PI, 8), { closed: false, w: 3, seed: 5 }); },   // law
  (c, s) => { sketch(c, [[0, s * .7], [-s * .8, -s * .05], [-s * .45, -s * .6], [0, -s * .25], [s * .45, -s * .6], [s * .8, -s * .05]], { fill: PAL.fig, w: 3, seed: 6, fillOffset: [2, 2] }); },               // medicine
  (c, s) => { [[-.6, .5, .5], [-.1, .5, .9], [.4, .5, 1.3]].forEach(([x, y, h], i) => sketch(c, shp.rect(x * s, (y - h) * s, s * .35, h * s), { fill: i === 2 ? PAL.clay : PAL.oat, w: 2.5, seed: 7 + i, fillOffset: [1, 1] })); },   // finance
  (c, s) => { line(c, -s * .6, s * .6, s * .3, -s * .3, { w: s * .28, seed: 10 }); sketch(c, shp.ellipse(s * .42, -s * .42, s * .34, s * .34, 12), { fill: PAL.cloud, w: 3, seed: 11, fillOffset: [0, 0] }); },   // engineering
  (c, s) => { sketch(c, shp.ellipse(0, 0, s * .8, s * .6, 20), { fill: PAL.manilla, w: 3, seed: 12 }); [[-.4, -.2, PAL.clay], [0, -.35, PAL.sky], [.4, -.15, PAL.olive]].forEach(([x, y, col], i) => sketch(c, shp.ellipse(x * s, y * s, s * .13, s * .13, 8), { fill: col, w: 1.5, seed: 13 + i, fillOffset: [0, 0] })); },  // design
  (c, s) => { sketch(c, [[-s * .2, -s * .7], [s * .2, -s * .7], [s * .2, -s * .2], [s * .65, s * .6], [-s * .65, s * .6], [-s * .2, -s * .2]], { fill: PAL.cactus, w: 3, seed: 16 }); },   // science
  (c, s) => { sketch(c, shp.rect(-s * .7, -s * .5, s * .7, s * 1.05), { fill: PAL.sky, w: 3, seed: 17 }); sketch(c, shp.rect(0, -s * .5, s * .7, s * 1.05), { fill: PAL.ivory, w: 3, seed: 18 }); },   // education
  (c, s) => { sketch(c, [[-s * .6, 0], [0, -s * .65], [s * .6, 0], [s * .6, s * .6], [-s * .6, s * .6]], { fill: PAL.kraft, w: 3, seed: 19 }); sketch(c, shp.rect(-s * .15, s * .2, s * .3, s * .4), { fill: PAL.ink, w: 1.5, seed: 20, fillOffset: [0, 0] }); },  // real estate
  (c, s) => { sketch(c, [[-s * .6, -s * .2], [s * .5, -s * .7], [s * .5, s * .7], [-s * .6, s * .2]], { fill: PAL.coral, w: 3, seed: 21 }); },   // marketing
  (c, s) => { sketch(c, shp.rrect(-s * .75, -s * .35, s * 1.5, s * .95, s * .12), { fill: PAL.kraft, w: 3, seed: 22 }); sketch(c, shp.rect(-s * .25, -s * .6, s * .5, s * .25), { fill: null, w: 3, seed: 23 }); },  // consulting
  (c, s) => { sketch(c, shp.rrect(-s * .55, -s * .75, s * 1.1, s * 1.5, s * .12), { fill: PAL.heather, w: 3, seed: 24 }); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) sketch(c, shp.rect(-s * .35 + j * s * .4, -s * .2 + i * s * .3, s * .28, s * .18), { fill: PAL.ivory, w: 1.5, seed: 25 + i * 3 + j, fillOffset: [0, 0] }); },  // accounting
  (c, s) => { sketch(c, [[-s * .8, -s * .1], [s * .8, -s * .6], [s * .5, s * .5], [-s * .5, s * .6]], { fill: PAL.chartCloud, w: 3, seed: 32 }); },  // logistics
];

/* =========================================================== SHOT 1 ===== */
// The real Claude spark is sketched in pencil, inked, filled — and hatches Clawd.
shot('spark', 0.0, 2.5, (ctx, t) => {
  paper(ctx);
  const hit = prog(t, 1.9, 2.35);
  const [sx, sy] = shake(t, hit > 0 && hit < 1 ? 16 * (1 - hit) : 0);
  const zoom = lerp(1.0, 1.14, ez(t, 0, 1.85, E.inOutC)) + 0.12 * Math.sin(Math.PI * hit);
  ctx.save();
  camera(ctx, { x: 960, y: 530, zoom, sx, sy });
  dotGrid(ctx, -300, -300, 2300, 1400, 48);
  const S = 560, cx = 960, cy = 500;
  // pencil construction lines (light graphite), fade as the ink goes down
  const guide = ez(t, 0.0, 0.3), gFade = 1 - ez(t, 1.1, 1.6);
  if (gFade > 0) {
    sketch(ctx, shp.ellipse(cx, cy, 250, 250, 60), { fill: null, stroke: PAL.cloud, w: 2.4, progress: guide, seed: 11, alpha: 0.9 * gFade, closed: false, amp: 2.4 });
    line(ctx, cx - 300, cy, cx + 300, cy, { stroke: PAL.cloud, w: 2, progress: guide, seed: 12, alpha: 0.8 * gFade });
    line(ctx, cx, cy - 300, cx, cy + 300, { stroke: PAL.cloud, w: 2, progress: guide, seed: 13, alpha: 0.8 * gFade });
  }
  const trace = prog(t, 0.2, 1.12), fill = prog(t, 0.98, 1.4);
  const spin = t < 1.35 ? 0 : Math.pow(t - 1.35, 2.2) * 10;
  const pulse = 1 + 0.07 * Math.sin(prog(t, 1.35, 1.9) * Math.PI * 4) * prog(t, 1.35, 1.6);
  drawSpark(ctx, cx, cy, S * pulse, { trace, fill, rot: spin, shatter: prog(t, 1.9, 2.5), shatterDist: 190, ink: 3.6 });
  // the pencil rides the line it is drawing
  if (t < 1.28) {
    const k = E.inOutC(trace);
    const p = SPARK.pts[Math.min(SPARK.pts.length - 1, Math.floor(k * SPARK.pts.length))];
    const s = S / 125;
    let px = cx + (p[0] - SPARK.cx) * s, py = cy + (p[1] - SPARK.cy) * s;
    if (t < 0.2) { const g = ez(t, 0, 0.2, E.inOutC); px = lerp(cx + 250, px, g); py = lerp(cy, py, g); }
    const outK = ez(t, 1.08, 1.28, E.inC);
    drawPencil(ctx, px + outK * 520, py + outK * 420, -2.35 + Math.sin(t * 20) * 0.05, 330, 44);
  }
  // Clawd hatches from the centre, materialising pixel by pixel
  if (t >= 1.9) {
    burst(ctx, cx, cy, prog(t, 1.9, 2.3), { n: 16, r0: 90, r1: 360, w: 9, color: PAL.ink });
    const up = ez(t, 1.9, 2.12, E.outC), down = ez(t, 2.12, 2.36, E.inQ);
    const y = lerp(lerp(560, 390, up), 740, down);
    const land = prog(t, 2.36, 2.5);
    const sq = land > 0 ? 1 - 0.24 * Math.sin(Math.PI * land) : 1 + 0.14 * Math.sin(Math.PI * up) * (1 - down);
    const rev = prog(t, 1.9, 2.06);
    drawClawd(ctx, cx, y, 20, { pose: 'arms-up', sy: sq, sx: 2 - sq, eyes: land > 0 ? 'happy' : 'wide', reveal: rev < 1 ? rev : undefined, shadowScale: down > 0.6 ? 1 : 0.2 });
    puff(ctx, cx, 745, prog(t, 2.36, 2.8));
  }
  ctx.restore();
  // terminal prompt, screen space
  const typed = prog(t, 0.08, 0.75);
  const cmd = '> claude --model claude-opus-5-5';
  text(ctx, cmd, 72, 1012, { family: FONT.mono, size: 34, color: PAL.slateLight, reveal: typed, mode: 'type', jitter: 0.2 });
  if (typed < 1 || Math.floor(t * 3) % 2 === 0) {
    const w = measure(ctx, cmd.slice(0, Math.floor(typed * cmd.length)), FONT.mono, 34);
    ctx.fillStyle = PAL.clay; ctx.fillRect(76 + w, 984, 17, 34);
  }
});
cue(0.08, 'type', { dur: 0.67 }); cue(0.2, 'pencil', { dur: 0.92 }); cue(0.98, 'scribble', { dur: 0.42 });
cue(1.35, 'riser', { dur: 0.55 }); cue(1.9, 'pop'); cue(1.9, 'bits', { dur: 0.16 }); cue(2.36, 'land');

/* =========================================================== SHOT 2 ===== */
shot('title', 2.5, 5.0, (ctx, t) => {
  paper(ctx);
  const land = prog(t, 1.02, 1.3);
  const [sx, sy] = shake(t, land > 0 && land < 1 ? 12 * (1 - land) : 0);
  ctx.save();
  camera(ctx, { x: 960, y: 540, zoom: lerp(1.1, 1.0, ez(t, 0, 1.2)), sx, sy });
  const size = 216, base = 628;
  const full = 'Claude Opus 5.5';
  const tw = measure(ctx, full, FONT.serif, size, 400, -2);
  const x0 = 960 - tw / 2;
  text(ctx, 'Introducing', x0 + 8, 400, { family: FONT.serif, size: 86, italic: true, color: PAL.clayDeep, reveal: prog(t, 0.0, 0.35), mode: 'fade', jitter: 0.4 });
  text(ctx, full, x0, base, { family: FONT.serif, size, weight: 400, tracking: -2, reveal: prog(t, 0.12, 0.85), mode: 'drop', stagger: 0.75, jitter: 0.5 });
  const x55 = x0 + measure(ctx, 'Claude Opus ', FONT.serif, size, 400, -2);
  const w55 = measure(ctx, '5.5', FONT.serif, size, 400, -2);
  const xo = x0 + measure(ctx, 'Claude ', FONT.serif, size, 400, -2);
  swoosh(ctx, xo, base + 46, x55 + w55 + 12, base + 40, prog(t, 1.15, 1.55), { w: 18, bow: 12 });
  // Clawd drops onto the "5.5"
  const topY = base - size * 0.69;
  if (t > 0.72) {
    const fall = ez(t, 0.72, 1.02, E.inQ);
    const y = lerp(-220, topY, fall);
    const sq = land > 0 ? 1 - 0.28 * Math.sin(Math.PI * land) * (1 - land * 0.5) : 1.14;
    const hop = t > 1.6 ? Math.abs(Math.sin((t - 1.6) * 6.5)) * 40 * prog(t, 1.6, 1.7) : 0;
    drawClawd(ctx, x55 + w55 / 2, y - hop, 12, { pose: t > 1.3 ? 'arms-up' : 'default', sy: sq, sx: 2 - sq, eyes: t > 1.3 ? 'happy' : 'wide', shadowScale: 0.7 });
    burst(ctx, x55 + w55 / 2, topY - 60, prog(t, 1.02, 1.35), { n: 10, r0: 120, r1: 220, w: 7, rot: -0.3 });
  }
  label(ctx, 'The first model in the new Claude 5.5 family', 960, 776, { size: 46, align: 'center', color: PAL.slateLight, reveal: prog(t, 1.45, 1.9) });
  sparkles(ctx, [[x0 - 70, 480, 48, 0], [x0 + tw + 60, 410, 40, 2], [x0 + tw * 0.33, 280, 32, 4], [x0 + tw + 20, 700, 28, 1]].map(p => [p[0], p[1], p[2] * ez(t, 1.2, 1.6), p[3]]), t);
  ctx.restore();
});
cue(2.5, 'whoosh'); cue(2.62, 'drops', { n: 13, dur: 0.6 }); cue(3.52, 'boing'); cue(3.65, 'swish'); cue(4.1, 'twinkle');

/* =========================================================== SHOT 3 ===== */
function speedo(ctx, x, y, r, k) {
  sketch(ctx, shp.arc(x, y, r, Math.PI, TAU, 36).concat([[x + r, y], [x - r, y]]), { fill: PAL.ivory, w: 6, seed: 401, fillOffset: [7, 7] });
  sketch(ctx, shp.arc(x, y, r * 0.84, Math.PI * 1.6, Math.PI * 1.98, 14), { closed: false, stroke: PAL.clay, w: 14, seed: 402 });
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    line(ctx, x + Math.cos(a) * r * 0.74, y + Math.sin(a) * r * 0.74, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, { w: 5, seed: 410 + i });
  }
  const ga = Math.PI + 0.6 * Math.PI;              // Opus 5 ghost needle
  line(ctx, x, y, x + Math.cos(ga) * r * 0.7, y + Math.sin(ga) * r * 0.7, { w: 7, stroke: PAL.cloud, seed: 420 });
  const a = Math.PI + lerp(0.02, 0.8, E.outElastic(clamp(k))) * Math.PI;
  line(ctx, x, y, x + Math.cos(a) * r * 0.84, y + Math.sin(a) * r * 0.84, { w: 11, stroke: PAL.clayDeep, seed: 421 });
  sketch(ctx, shp.ellipse(x, y, 16, 16, 12), { fill: PAL.ink, w: 3, seed: 422, fillOffset: [0, 0] });
}
function priceTag(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  sketch(ctx, [[-s, 0], [-s * 0.62, -s * 0.52], [s, -s * 0.52], [s, s * 0.52], [-s * 0.62, s * 0.52]], { fill: PAL.manilla, w: 6, seed: 430, fillOffset: [8, 9] });
  sketch(ctx, shp.ellipse(-s * 0.66, 0, s * 0.08, s * 0.08, 12), { fill: PAL.paper, w: 4, seed: 431, fillOffset: [0, 0] });
  sketch(ctx, [[-s * 0.66, 0], [-s * 1.05, -s * 0.35], [-s * 1.2, -s * 0.2]], { closed: false, w: 4, seed: 432 });
  ctx.restore();
}
shot('value', 5.0, 7.0, (ctx, t) => {
  paper(ctx);
  const stampHit = prog(t, 0.55, 0.8);
  const [sx, sy] = shake(t, stampHit > 0 && stampHit < 1 ? 9 * (1 - stampHit) : 0);
  ctx.save();
  camera(ctx, { x: 960, y: 540, zoom: lerp(1.06, 1.0, ez(t, 0, 1.2)), sx, sy });
  text(ctx, 'Fable 5.1-level work.', 960, 205, { family: FONT.serif, size: 124, align: 'center', reveal: prog(t, 0.0, 0.5), mode: 'drop', stagger: 0.7 });
  label(ctx, 'On most work, Opus 5.5 performs at the level of Claude Fable 5.1.', 960, 285, { size: 38, align: 'center', color: PAL.slateLight, reveal: prog(t, 0.3, 0.7) });
  // 40% less to run
  const k1 = prog(t, 0.35, 0.7);
  if (k1 > 0) {
    const e = E.outBack(k1, 2);
    priceTag(ctx, 560, 560, 300 * e, -0.07 + Math.sin(t * 5) * 0.035 * (1 - prog(t, 0.8, 1.6)));
    const sk = prog(t, 0.55, 0.72);                  // the stamp lands
    if (sk > 0) {
      ctx.save(); ctx.translate(615, 560); ctx.rotate(-0.07); const ss = lerp(1.8, 1, E.outC(sk)); ctx.scale(ss, ss); ctx.globalAlpha *= clamp(sk * 2);
      stat(ctx, '−40%', 0, 62, 168, { align: 'center', color: PAL.clayDeep });
      ctx.restore();
    }
    label(ctx, 'less to run than Opus 5', 560, 876, { size: 48, align: 'center', reveal: prog(t, 0.65, 0.95) });
  }
  // 30%+ faster
  const k2 = prog(t, 0.72, 1.35);
  if (k2 > 0) {
    ctx.save(); ctx.translate(1380, 600); const e = E.outBack(prog(t, 0.72, 0.95), 2); ctx.scale(e, e);
    speedo(ctx, 0, 60, 250, k2);
    ctx.restore();
    stat(ctx, '30%+', 1380, 806, 130, { reveal: prog(t, 0.9, 1.15), align: 'center' });
    label(ctx, 'faster output than Opus 5', 1380, 876, { size: 48, align: 'center', reveal: prog(t, 1.0, 1.25) });
  }
  // Clawd dashes across the bottom
  if (t > 1.05) {
    const k = ez(t, 1.05, 1.8, E.inOutC);
    const x = lerp(-300, 2250, k);
    streaks(ctx, x - 1000, 920, 860, 110, { n: 8, w: 7, seed: 5 });
    drawClawd(ctx, x, 1040, 10, { walk: t * 8, rot: 0.14, eyes: 'happy', pose: 'default', shadowScale: 0.8 });
  }
  ctx.restore();
});
cue(5.0, 'zoom'); cue(5.55, 'stamp'); cue(5.72, 'needle'); cue(6.1, 'dash');

/* =========================================================== SHOT 4 ===== */
function chapterCard(ctx, t, num, word, sub, clawdOpts) {
  darkCard(ctx);
  ctx.save();
  camera(ctx, { x: 960, y: 540, zoom: lerp(1.0, 1.07, ez(t, 0, 0.75, E.outC)) });
  kicker(ctx, num, 250, 370, { size: 40, reveal: prog(t, 0, 0.2), color: PAL.clay });
  text(ctx, word, 240, 640, { family: FONT.serif, size: 310, color: PAL.ivory, reveal: prog(t, 0.0, 0.3), mode: 'pop', stagger: 0.6, jitter: 0.8 });
  label(ctx, sub, 252, 750, { size: 46, color: PAL.cloud, reveal: prog(t, 0.15, 0.4) });
  const hk = prog(t, 0.1, 0.4);
  drawClawd(ctx, 1500, 720, 17, { ...clawdOpts, sy: 1 - 0.15 * Math.sin(Math.PI * prog(t, 0.36, 0.55)), shadow: false, hatDrop: hk });
  ctx.restore();
}
shot('ch-builds', 7.0, 7.75, (ctx, t) => chapterCard(ctx, t, '01', 'Builds.', 'agentic coding', { pose: 'arms-up', hat: 'hardhat', eyes: t > 0.42 ? 'happy' : 'wide' }));
cue(7.0, 'hit'); cue(7.35, 'clonk');

/* =========================================================== SHOT 5 ===== */
function box(ctx, x, y, w, h, lbl, fill, seed) {
  sketch(ctx, shp.rect(x, y, w, h), { fill, w: 5, seed, fillOffset: [7, 8] });
  sketch(ctx, [[x, y], [x - 34, y - 56], [x + w * 0.45, y - 56], [x + w * 0.5, y]], { fill, w: 4, seed: seed + 1, fillOffset: [4, 4] });
  sketch(ctx, [[x + w, y], [x + w + 34, y - 56], [x + w * 0.55, y - 56], [x + w * 0.5, y]], { fill, w: 4, seed: seed + 2, fillOffset: [4, 4] });
  text(ctx, lbl, x + w / 2, y + h / 2 + 14, { family: FONT.mono, size: 40, weight: 500, align: 'center', color: PAL.ink });
}
const SYNTAX = [PAL.ink, PAL.clay, PAL.olive, PAL.sky, PAL.fig, PAL.cloudDark, PAL.ink, PAL.clayDeep];
shot('migrate', 7.75, 9.75, (ctx, t) => {
  paper(ctx);
  ctx.save();
  camera(ctx, { x: 960, y: 560, zoom: lerp(1.07, 1.0, ez(t, 0, 0.8)) });
  const v = 680000 * ez(t, 0.15, 1.45, E.outC);
  stat(ctx, fmt(v), 960, 280, 200, { align: 'center' });
  label(ctx, 'lines of code migrated — in under a day', 960, 366, { align: 'center', size: 50, reveal: prog(t, 0.2, 0.6) });
  box(ctx, 130, 780, 360, 240, 'legacy/', PAL.kraft, 510);
  box(ctx, 1430, 780, 360, 240, 'new/', PAL.cactus, 520);
  const pile = Math.round(lerp(10, 2, prog(t, 0.2, 1.8)));
  for (let i = 0; i < pile; i++) line(ctx, 160 + (i % 2) * 22, 762 - i * 17, 440 - (i * 37 % 90), 762 - i * 17, { w: 10, stroke: SYNTAX[i % SYNTAX.length], seed: 530 + i });
  const stack = Math.round(lerp(1, 11, prog(t, 0.3, 1.9)));
  for (let i = 0; i < stack; i++) line(ctx, 1462, 762 - i * 17, 1660 + (i * 53 % 90), 762 - i * 17, { w: 10, stroke: SYNTAX[(i + 3) % SYNTAX.length], seed: 560 + i });
  // three lanes of code: legacy → Clawd's hands → new
  const hands = [960, 800];
  const lanes = [[170, 1.7], [250, 1.45], [330, 1.2]];
  let n = 0;
  lanes.forEach(([hgt, rate], li) => {
    const N = 20;
    for (let i = 0; i < N; i++, n++) {
      const s = ((t * rate + i / N + li * 0.17) % 1 + 1) % 1;
      if (t < 0.3 && s > t * 3.3) continue;
      const first = s < 0.5, q = first ? s * 2 : s * 2 - 1;
      const [ax, ay] = first ? [430, 740] : hands, [bx, by] = first ? hands : [1520, 740];
      const x = lerp(ax, bx, q), y = lerp(ay, by, q) - 4 * hgt * q * (1 - q);
      const a = Math.atan2((by - ay) - 4 * hgt * (1 - 2 * q), bx - ax);
      const len = 50 + (n * 29 % 64);
      inkStroke(ctx, [[x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2], [x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2]], { w: 12, color: SYNTAX[n % SYNTAX.length], taper: 0.15, seed: n });
    }
  });
  const juggle = Math.floor(t * 10) % 3;
  drawClawd(ctx, 960, 960, 17, { pose: ['arms-up', 'wave-left', 'wave-right'][juggle], hat: 'hardhat', eyes: 'normal', sy: 1 - 0.05 * (juggle === 0) });
  ctx.restore();
});
cue(7.75, 'flip'); cue(7.9, 'counter', { dur: 1.3 }); cue(7.85, 'stream', { dur: 1.85 });

/* =========================================================== SHOT 6 ===== */
const TB = [['Opus 5.5', 66.4, PAL.clay], ['GPT-6 Astra', 57.9, PAL.cloudLight], ['Fable 5.1', 55.8, PAL.oat], ['Opus 5', 52.3, PAL.oat]];
shot('terminal', 9.75, 11.75, (ctx, t) => {
  paper(ctx);
  ctx.save();
  const riseK = ez(t, 0.1, 0.95, E.outBack);
  camera(ctx, { x: 960, y: lerp(600, 480, ez(t, 0.2, 1.1, E.inOutC)), zoom: lerp(1.0, 1.04, ez(t, 0, 1.1)) });
  kicker(ctx, 'Terminal-Bench 4.0', 120, 320, { reveal: prog(t, 0, 0.3) });
  stat(ctx, (66.4 * ez(t, 0.1, 1.0, E.outC)).toFixed(1) + '%', 110, 540, 220);
  label(ctx, 'agentic coding in the terminal', 120, 626, { size: 48, reveal: prog(t, 0.35, 0.7) });
  note(ctx, 'highest on Anthropic’s launch chart', 122, 690, { reveal: prog(t, 0.6, 1.0) });
  const baseY = 960, x0 = 900, bw = 170, gap = 56, scale = 8.2;
  line(ctx, x0 - 40, baseY, x0 + 4 * (bw + gap) + 10, baseY, { w: 6, seed: 601 });
  TB.forEach(([name, val, col], i) => {
    const k = i === 0 ? riseK : ez(t, 0.05 + i * 0.07, 0.85 + i * 0.07, E.outBack);
    const h = Math.max(4, val * scale * k), x = x0 + i * (bw + gap);
    sketch(ctx, shp.rect(x, baseY - h, bw, h), { fill: col, w: 5, seed: 610 + i, fillOffset: [7, 7], hatch: i === 0 ? { gap: 16, w: 3, color: PAL.clayDeep, alpha: 0.6 } : null });
    if (i > 0) text(ctx, val.toFixed(1) + '%', x + bw / 2, baseY - h - 24, { family: FONT.mono, size: 34, weight: 500, align: 'center', alpha: clamp(k * 2), color: PAL.slateLight });
    text(ctx, name, x + bw / 2, baseY + 54, { family: FONT.sans, size: 34, weight: i === 0 ? 700 : 500, align: 'center', color: i === 0 ? PAL.ink : PAL.slateLight });
  });
  // Clawd rides the Opus 5.5 bar up like an elevator, then plants the flag
  const top = baseY - 66.4 * scale * riseK;
  const planted = t > 1.05;
  drawClawd(ctx, x0 + bw / 2, top, 9, { pose: planted ? 'arms-up' : 'default', eyes: planted ? 'happy' : 'wide', prop: planted ? 'flag' : null, shadowScale: 0.55, sy: 1 - 0.2 * Math.sin(Math.PI * prog(t, 0.92, 1.12)) });
  burst(ctx, x0 + bw / 2, top - 70, prog(t, 1.05, 1.4), { n: 10, r0: 100, r1: 200, w: 6 });
  ctx.restore();
});
cue(9.75, 'whooshUp'); cue(9.85, 'grow', { dur: 0.85 }); cue(10.8, 'flag');

/* =========================================================== SHOT 7 ===== */
shot('orchestra', 11.75, 13.75, (ctx, t) => {
  paper(ctx);
  ctx.save();
  camera(ctx, { x: 960, y: 540, zoom: lerp(1.12, 1.0, ez(t, 0, 1.0, E.inOutC)) });
  const checked = Math.min(40, Math.max(0, Math.floor((t - 0.62) / 0.026)));
  stat(ctx, `${checked}/40`, 110, 410, 210);
  label(ctx, 'stacked PRs — all passed CI', 120, 494, { size: 50, reveal: prog(t, 0.2, 0.5) });
  label(ctx, 'one Opus 5.5 session directing a dozen more', 120, 560, { size: 38, color: PAL.slateLight, reveal: prog(t, 0.4, 0.8) });
  const gx = 880, gy = 120, cw = 112, chh = 64;
  for (let i = 0; i < 40; i++) {
    const r = Math.floor(i / 8), c = i % 8;
    const k = prog(t, 0.1 + i * 0.012, 0.3 + i * 0.012);
    if (k <= 0) continue;
    const x = gx + c * cw, y = gy + r * (chh + 16);
    const done = i < checked;
    ctx.save(); ctx.translate(x + cw / 2 - 6, y + chh / 2); const e = E.outBack(k, 2); ctx.scale(e, e);
    sketch(ctx, shp.rrect(-cw / 2 + 6, -chh / 2, cw - 12, chh, 10), { fill: done ? PAL.cactus : PAL.ivoryDark, w: 3, seed: 700 + i, fillOffset: [3, 3] });
    text(ctx, '#' + (i + 1), -26, 9, { family: FONT.mono, size: 22, weight: 500, color: PAL.slateLight, align: 'center', jitter: 0.1 });
    check(ctx, 24, 2, 30, done ? prog(t - 0.62 - i * 0.026, 0, 0.12) : 0, PAL.olive, 6);
    ctx.restore();
  }
  // the conductor and a dozen sub-agents
  const lead = [1340, 1020];
  for (let i = 0; i < 12; i++) {
    const a = Math.PI + 0.1 + (i / 11) * (Math.PI - 0.2);
    const px = lead[0] + Math.cos(a) * 450, py = lead[1] + Math.sin(a) * 330;
    const k = prog(t, 0.15 + i * 0.045, 0.4 + i * 0.045);
    if (k <= 0) continue;
    line(ctx, lead[0], lead[1] - 130, px, py - 50, { w: 2.5, stroke: PAL.cloud, seed: 760 + i, alpha: 0.9 * k });
    drawClawd(ctx, px, py, 5.2 * E.outBack(k, 2.5), { pose: Math.floor(t * 6 + i) % 2 ? 'default' : 'arms-up', shadowScale: 0.6, eyes: 'normal', seed: 40 + i });
  }
  const beat = Math.sin(t * 14) * 0.5;
  drawClawd(ctx, lead[0], lead[1], 12, { pose: 'wave-right', prop: 'baton', propRot: -1.3 + beat, eyes: 'happy' });
  ctx.restore();
});
cue(11.75, 'zoom'); cue(11.9, 'spawn', { n: 12, dur: 0.55 }); cue(12.37, 'checks', { n: 40, dur: 1.04 });

/* =========================================================== SHOT 8 ===== */
shot('ch-works', 13.75, 14.5, (ctx, t) => chapterCard(ctx, t, '02', 'Works.', 'knowledge work', { pose: 'default', tie: t > 0.2, glasses: t > 0.3, eyes: 'normal' }));
cue(13.75, 'hit'); cue(14.0, 'clonk');

/* =========================================================== SHOT 9 ===== */
const HATS = ['hardhat', 'chef', 'grad', 'beret', 'detective', 'pilot', 'mirror', 'headset', 'tophat', 'party', 'crown'];
shot('occupations', 14.5, 16.5, (ctx, t) => {
  paper(ctx);
  ctx.save();
  camera(ctx, { x: 960, y: 540, zoom: lerp(1.05, 1.0, ez(t, 0, 0.9)), rot: lerp(-0.015, 0.0, ez(t, 0, 0.9)) });
  kicker(ctx, 'GDPval-AA v2.1', 120, 300, { reveal: prog(t, 0, 0.3) });
  const v = 1846 * ez(t, 0.1, 1.0, E.outC);
  const w = stat(ctx, String(Math.round(v)), 110, 520, 230);
  text(ctx, 'Elo', 130 + w, 520, { family: FONT.serif, size: 96, color: PAL.slateLight, reveal: prog(t, 0.5, 0.8), mode: 'fade' });
  label(ctx, 'real work across 44 occupations', 120, 606, { size: 50, reveal: prog(t, 0.25, 0.6) });
  note(ctx, 'Fable 5.1: 1735 · Opus 5: 1708', 122, 670, { reveal: prog(t, 0.5, 0.9) });
  const cx = 1390, cy = 560;
  for (let i = 0; i < 44; i++) {
    const ring = i < 18 ? 0 : 1, j = ring ? i - 18 : i, n = ring ? 26 : 18;
    const a = -Math.PI / 2 + (j / n) * TAU + ring * 0.12;
    const R = ring ? 440 : 310, Ry = ring ? 410 : 290;
    const k = prog(t, 0.08 + i * 0.022, 0.3 + i * 0.022);
    if (k <= 0) continue;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * Ry;
    ctx.save(); ctx.translate(x, y); const e = E.outBack(k, 3); ctx.scale(e, e);
    sketch(ctx, shp.ellipse(0, 0, 42, 42, 20), { fill: [PAL.ivory, PAL.oat, PAL.ivoryDark][i % 3], w: 3.5, seed: 800 + i, fillOffset: [3, 3] });
    ICONS[i % ICONS.length](ctx, 22);
    ctx.restore();
  }
  const hi = Math.floor(t / 0.17) % HATS.length;
  const pop = (t / 0.17) % 1;
  drawClawd(ctx, cx, cy + 120, 13, { pose: pop < 0.3 ? 'arms-up' : 'default', hat: HATS[hi], eyes: 'happy', sy: 1 - 0.08 * Math.sin(Math.PI * clamp(pop * 3)) });
  burst(ctx, cx, cy - 40, pop < 0.5 ? pop * 2 : 0, { n: 7, r0: 170, r1: 230, w: 5, color: PAL.clay });
  ctx.restore();
});
cue(14.5, 'flip'); cue(14.6, 'pops', { n: 44, dur: 1.0 }); cue(14.5, 'hats', { every: 0.17, dur: 1.95 });

/* ========================================================== SHOT 10 ===== */
function stopwatch(ctx, x, y, r, k) {
  sketch(ctx, shp.ellipse(x, y, r, r, 40), { fill: PAL.ivory, w: 5, seed: 901, fillOffset: [6, 6] });
  sketch(ctx, shp.rect(x - 16, y - r - 30, 32, 26), { fill: PAL.ink, w: 3, seed: 902, fillOffset: [0, 0] });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; line(ctx, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92, { w: 3, seed: 903 + i }); }
  const ag = -Math.PI / 2 + (93 / 100) * TAU;
  line(ctx, x, y, x + Math.cos(ag) * r * 0.72, y + Math.sin(ag) * r * 0.72, { w: 6, stroke: PAL.cloud, seed: 920 });
  const a = -Math.PI / 2 + (63 / 100) * TAU * E.outC(clamp(k));
  line(ctx, x, y, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, { w: 8, stroke: PAL.clayDeep, seed: 921 });
  sketch(ctx, shp.ellipse(x, y, 10, 10, 10), { fill: PAL.ink, w: 2, seed: 922, fillOffset: [0, 0] });
}
shot('deck', 16.5, 18.5, (ctx, t) => {
  paper(ctx);
  ctx.save();
  camera(ctx, { x: 960, y: 540, zoom: lerp(1.05, 1.0, ez(t, 0, 0.8)) });
  kicker(ctx, 'Excel model → exec deck', 120, 300, { reveal: prog(t, 0, 0.3) });
  stat(ctx, `${Math.round(63 * ez(t, 0.1, 1.0, E.outC))} min`, 110, 510, 220);
  label(ctx, 'a merger analysis, start to finish', 120, 596, { size: 50, reveal: prog(t, 0.2, 0.5) });
  note(ctx, 'Opus 5: 93 min · Opus 5.5 at half the cost', 122, 660, { reveal: prog(t, 0.45, 0.85) });
  stopwatch(ctx, 360, 860, 125, prog(t, 0.1, 1.0));
  const fold = ez(t, 0.95, 1.35, E.inOutC);
  const sx = 960, sy = 170, cw = 110, chh = 52, cols = 7, rows = 11;
  if (fold < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - fold;
    ctx.translate(sx + cols * cw / 2, sy + rows * chh / 2); ctx.scale(1 - fold * 0.4, 1 - fold * 0.4); ctx.rotate(fold * -0.1); ctx.translate(-(sx + cols * cw / 2), -(sy + rows * chh / 2));
    sketch(ctx, shp.rect(sx, sy, cols * cw, rows * chh), { fill: PAL.ivory, w: 5, seed: 930, fillOffset: [9, 9] });
    sketch(ctx, shp.rect(sx, sy, cols * cw, chh), { fill: PAL.cactus, w: 3, seed: 931, fillOffset: [0, 0] });
    text(ctx, 'fx  =NPV(r, synergies) − price', sx + 16, sy + 36, { family: FONT.mono, size: 26, weight: 500, color: PAL.ink, reveal: prog(t, 0.05, 0.5), mode: 'type' });
    for (let c = 1; c < cols; c++) line(ctx, sx + c * cw, sy + chh, sx + c * cw, sy + rows * chh, { w: 2, seed: 932 + c, alpha: 0.5 });
    for (let r = 2; r < rows; r++) line(ctx, sx, sy + r * chh, sx + cols * cw, sy + r * chh, { w: 2, seed: 940 + r, alpha: 0.5 });
    for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = prog(t, 0.1 + (r + c) * 0.035, 0.2 + (r + c) * 0.035);
      if (k <= 0) continue;
      const val = c === 0 ? ['Rev', 'COGS', 'Opex', 'EBITDA', 'Synergy', 'Debt', 'EPS', 'IRR', 'NPV', 'Price'][r - 1] : ((r * 37 + c * 91) % 900 / 10 + 10).toFixed(1);
      text(ctx, val, sx + c * cw + (c === 0 ? 12 : cw - 12), sy + (r + 0.72) * chh, { family: FONT.mono, size: 23, color: c === 0 ? PAL.slateMed : (r === 9 ? PAL.clayDeep : PAL.ink), align: c === 0 ? 'left' : 'right', alpha: k, jitter: 0.2 });
    }
    ctx.restore();
  }
  if (fold > 0) {
    const slides = [[-0.14, -90, PAL.oat], [0.07, 60, PAL.cactus], [-0.02, 0, PAL.ivory]];
    slides.forEach(([rot, dx, col], i) => {
      const e = E.outBack(clamp(fold * 1.2 - i * 0.1), 1.6);
      ctx.save(); ctx.translate(1330 + dx * e, 470 + i * 8); ctx.rotate(rot * e); ctx.scale(lerp(0.5, 1, e), lerp(0.5, 1, e));
      sketch(ctx, shp.rect(-340, -200, 680, 400), { fill: col, w: 5, seed: 950 + i, fillOffset: [9, 9] });
      if (i === 2) {
        text(ctx, 'Should we do the deal?', -300, -118, { family: FONT.serif, size: 48, color: PAL.ink });
        [0.5, 0.8, 0.65, 1.0].forEach((hh, j) => sketch(ctx, shp.rect(-290 + j * 92, 160 - hh * 200, 62, hh * 200), { fill: j === 3 ? PAL.clay : PAL.oat, w: 3, seed: 960 + j, fillOffset: [3, 3] }));
        text(ctx, '✓ synergies', 90, 10, { family: FONT.sans, size: 32, weight: 600, color: PAL.olive });
        text(ctx, '✓ price', 90, 62, { family: FONT.sans, size: 32, weight: 600, color: PAL.olive });
        text(ctx, '~ risks', 90, 114, { family: FONT.sans, size: 32, weight: 600, color: PAL.clayDeep });
      }
      ctx.restore();
    });
  }
  if (fold <= 0.5) {
    const hopX = lerp(1010, 1650, ez(t, 0.1, 0.9, E.inOutC));
    drawClawd(ctx, hopX, sy - 4 - Math.abs(Math.sin(t * 11)) * 44, 7, { walk: t * 6, eyes: 'normal', glasses: true, tie: true, shadowScale: 0.6 });
  } else {
    drawClawd(ctx, 1760, 960, 11, { pose: 'wave-left', eyes: 'happy', glasses: true, tie: true, prop: 'baton', flip: true, propRot: -2.4 });
  }
  ctx.restore();
});
cue(16.5, 'whoosh'); cue(16.6, 'keys', { dur: 0.8 }); cue(17.45, 'fold'); cue(17.62, 'ding');

/* ========================================================== SHOT 11 ===== */
function doc(ctx, x, y, w, h, seed) {
  sketch(ctx, [[x, y], [x + w * 0.72, y], [x + w, y + h * 0.2], [x + w, y + h], [x, y + h]], { fill: PAL.ivory, w: 3.5, seed, fillOffset: [4, 4] });
  for (let i = 0; i < 5; i++) line(ctx, x + w * 0.14, y + h * (0.3 + i * 0.13), x + w * (0.86 - (i % 2) * 0.2), y + h * (0.3 + i * 0.13), { w: 2.5, seed: seed + 3 + i, alpha: 0.45 });
}
shot('research', 18.5, 20.5, (ctx, t) => {
  paper(ctx);
  ctx.save();
  camera(ctx, { x: 960, y: 540, zoom: lerp(1.04, 1.0, ez(t, 0, 0.8)) });
  const FAIL = new Set([6, 13]);
  const gx = 930, gy = 170, dw = 130, dh = 170, gapx = 26, gapy = 60;
  const scanned = t < 0.25 ? -1 : Math.floor((t - 0.25) / 0.06);
  let passed = 0;
  for (let i = 0; i < 18; i++) {
    const r = Math.floor(i / 6), c = i % 6;
    const x = gx + c * (dw + gapx), y = gy + r * (dh + gapy);
    const k = prog(t, i * 0.012, 0.15 + i * 0.012);
    if (k <= 0) continue;
    ctx.save(); ctx.translate(x + dw / 2, y + dh / 2); ctx.scale(E.outBack(k), E.outBack(k)); ctx.translate(-(x + dw / 2), -(y + dh / 2));
    doc(ctx, x, y, dw, dh, 1100 + i * 10);
    const sk = scanned >= i ? prog(t - 0.25 - i * 0.06, 0, 0.1) : 0;
    if (sk > 0) {
      if (FAIL.has(i)) cross(ctx, x + dw / 2, y + dh / 2, 60, sk);
      else { sketch(ctx, shp.ellipse(x + dw / 2, y + dh / 2, 48 * E.outBack(sk, 3), 48 * E.outBack(sk, 3), 20), { fill: 'rgba(188,209,202,0.9)', stroke: PAL.olive, w: 4, seed: 1300 + i, fillOffset: [0, 0] }); check(ctx, x + dw / 2, y + dh / 2 + 4, 46, sk, PAL.olive, 7); passed++; }
    }
    ctx.restore();
  }
  kicker(ctx, 'Fact-checked research', 120, 290, { reveal: prog(t, 0, 0.3) });
  stat(ctx, `${passed}/18`, 110, 500, 220);
  label(ctx, 'reports with zero invented figures', 120, 586, { size: 50, reveal: prog(t, 0.2, 0.5) });
  note(ctx, 'Fable 5.1 & Opus 5: none passed', 122, 650, { reveal: prog(t, 1.05, 1.45), color: PAL.clayDeep });
  // detective Clawd sweeps the grid
  const si = clamp((t - 0.25) / (18 * 0.06)) * 17.99;
  const row = Math.floor(si / 6), colf = si % 6;
  const dx = gx + colf * (dw + gapx) + dw / 2, dy = gy + row * (dh + gapy) + dh + 52;
  drawClawd(ctx, t < 0.25 ? 900 : dx - 70, t < 0.25 ? 950 : dy, 5.8, { hat: 'detective', prop: 'magnifier', propRot: -0.9, eyes: 'normal', walk: t * 5, shadowScale: 0.7 });
  ctx.restore();
});
cue(18.5, 'wipe'); cue(18.77, 'stamps', { n: 18, every: 0.06, fail: [6, 13] });

/* ========================================================== SHOT 12 ===== */
function cursorArrow(ctx, x, y, s, seed = 1400) {
  sketch(ctx, [[x, y], [x, y + s], [x + s * 0.28, y + s * 0.74], [x + s * 0.5, y + s * 1.15], [x + s * 0.64, y + s * 1.08], [x + s * 0.44, y + s * 0.68], [x + s * 0.75, y + s * 0.68]], { fill: PAL.ivory, w: 5, seed, fillOffset: [5, 6] });
}
shot('computer', 20.5, 22.25, (ctx, t) => {
  paper(ctx);
  ctx.save();
  camera(ctx, { x: 960, y: 540, zoom: lerp(1.08, 1.0, ez(t, 0, 1.2)) });
  kicker(ctx, 'OSWorld 2.0 · computer use', 120, 300, { reveal: prog(t, 0, 0.3) });
  stat(ctx, (81.8 * ez(t, 0.1, 0.9, E.outC)).toFixed(1) + '%', 110, 510, 220);
  label(ctx, 'operates a computer like you do', 120, 596, { size: 50, reveal: prog(t, 0.2, 0.5) });
  note(ctx, 'partial-credit score · Fable 5.1: 80.7%', 122, 660, { reveal: prog(t, 0.45, 0.85), size: 28 });
  const mx = 900, my = 160, mw = 920, mh = 580;
  sketch(ctx, shp.rrect(mx, my, mw, mh, 26), { fill: PAL.ink, w: 5, seed: 1401, fillOffset: [9, 9] });
  sketch(ctx, shp.rect(mx + 26, my + 26, mw - 52, mh - 52), { fill: PAL.chartCloud, w: 3, seed: 1402, fillOffset: [0, 0] });
  sketch(ctx, [[mx + mw / 2 - 60, my + mh], [mx + mw / 2 + 60, my + mh], [mx + mw / 2 + 110, my + mh + 110], [mx + mw / 2 - 110, my + mh + 110]], { fill: PAL.cloud, w: 4, seed: 1403 });
  sketch(ctx, shp.rect(mx + 26, my + mh - 70, mw - 52, 44), { fill: PAL.ivoryDark, w: 2, seed: 1404, fillOffset: [0, 0] });
  const stops = [[1090, 300], [1540, 350], [1260, 560], [1620, 610]];
  const wins = [[950, 210, 370, 240, PAL.ivory], [1340, 240, 410, 260, PAL.oat], [1040, 430, 390, 210, PAL.cactus], [1450, 460, 310, 190, PAL.ivory]];
  const seg = 0.28, t0 = 0.3;
  wins.forEach(([x, y, w, h, col], i) => {
    const k = prog(t, t0 + (i + 1) * seg - 0.05, t0 + (i + 1) * seg + 0.1);
    if (k <= 0) return;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(E.outBack(k), E.outBack(k)); ctx.translate(-(x + w / 2), -(y + h / 2));
    sketch(ctx, shp.rect(x, y, w, h), { fill: col, w: 3.5, seed: 1410 + i, fillOffset: [4, 4] });
    sketch(ctx, shp.rect(x, y, w, 32), { fill: PAL.ivoryDark, w: 3, seed: 1420 + i, fillOffset: [0, 0] });
    for (let j = 0; j < 3; j++) sketch(ctx, shp.ellipse(x + 18 + j * 20, y + 16, 6, 6, 8), { fill: [PAL.clay, PAL.manilla, PAL.olive][j], w: 1.5, seed: 1430 + j, fillOffset: [0, 0] });
    for (let j = 0; j < 3; j++) line(ctx, x + 24, y + 74 + j * 40, x + w - 40 - (j % 2) * 60, y + 74 + j * 40, { w: 3, seed: 1440 + i * 5 + j, alpha: 0.4 });
    ctx.restore();
  });
  let p = [mx + 150, my + 420];
  for (let i = 0; i < stops.length; i++) {
    const k = ez(t, t0 + i * seg, t0 + (i + 1) * seg - 0.06, E.inOutC);
    const prev = i === 0 ? [mx + 150, my + 420] : stops[i - 1];
    if (t >= t0 + i * seg) p = [lerp(prev[0], stops[i][0], k), lerp(prev[1], stops[i][1], k) - Math.sin(Math.PI * k) * 70];
  }
  for (let i = 0; i < stops.length; i++) {
    const ck = prog(t, t0 + (i + 1) * seg - 0.06, t0 + (i + 1) * seg + 0.18);
    if (ck > 0 && ck < 1) sketch(ctx, shp.ellipse(stops[i][0], stops[i][1], 20 + 56 * ck, 20 + 56 * ck, 20), { fill: null, stroke: PAL.clay, w: 7 * (1 - ck) + 1, seed: 1450 + i, closed: true });
  }
  cursorArrow(ctx, p[0], p[1], 118);
  drawClawd(ctx, p[0] + 34, p[1] + 8, 6, { pose: 'arms-up', eyes: 'happy', shadow: false, rot: -0.2 + Math.sin(t * 12) * 0.08 });
  ctx.restore();
});
cue(20.5, 'zoom'); cue(20.5, 'clicks', { times: [0.52, 0.8, 1.08, 1.36] });

/* ========================================================== SHOT 13 ===== */
// "Draws." — the film zooms out into its own storyboard, then into its own source code.
const BOARD = [['spark', 2.25], ['title', 2.35], ['value', 1.75], ['ch-builds', 0.7], ['migrate', 1.9], ['terminal', 1.9], ['orchestra', 1.95], ['ch-works', 0.7], ['occupations', 1.9], ['deck', 1.95], ['research', 1.95], ['computer', 1.7]];
shot('draws', 22.25, 26.25, (ctx, t) => {
  if (t < 0.75) {
    chapterCard(ctx, t, '03', 'Draws.', 'this film', { pose: 'wave-right', prop: 'pencil', propRot: -0.6, eyes: 'happy' });
    return;
  }
  const u = t - 0.75;
  paper(ctx);
  const cols = 4, pw = 400, ph = 225, gap = 34;
  const gw = cols * pw + (cols - 1) * gap, gh = 3 * ph + 2 * gap;
  const codeK = ez(u, 1.45, 2.05, E.inOutC);
  const zk = ez(u, 0, 1.0, E.inOutExpo);
  ctx.save();
  camera(ctx, { x: lerp(960 + gw / 2 - pw / 2, 960, zk), y: lerp(560 + gh / 2 - ph / 2, 560, zk), zoom: lerp(4.2, 1.0, zk) });
  ctx.translate(960 + lerp(0, 380, codeK), 560 + lerp(0, 40, codeK)); ctx.scale(lerp(1, 0.56, codeK), lerp(1, 0.56, codeK)); ctx.translate(-960, -560);
  const bx = 960 - gw / 2, by = 560 - gh / 2;
  BOARD.forEach(([id, hero], i) => {
    const s = SHOTS.find(x => x.id === id);
    const r = Math.floor(i / cols), c = i % cols;
    const x = bx + c * (pw + gap), y = by + r * (ph + gap);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(((i * 7) % 5 - 2) * 0.006);
    ctx.beginPath(); ctx.rect(0, 0, pw, ph); ctx.clip();
    ctx.scale(pw / W, ph / H);
    const saved = G.seedCounter;
    resetSeeds(SHOTS.indexOf(s) * 10000);
    s.draw(ctx, Math.min(hero, hero - 0.5 + u * 0.4), s);
    G.seedCounter = saved;
    ctx.restore();
    sketch(ctx, shp.rect(x, y, pw, ph), { fill: null, w: 4, seed: 1500 + i, closed: true });
    text(ctx, String(i + 1).padStart(2, '0'), x + 6, y - 12, { family: FONT.mono, size: 22, color: PAL.slateLight });
  });
  ctx.restore();
  text(ctx, 'Every frame you just watched…', 960, 118, { family: FONT.serif, size: 80, align: 'center', reveal: prog(u, 0.5, 1.0), mode: 'fade', alpha: 1 - prog(u, 1.35, 1.5) });
  if (codeK > 0) {
    const ex = lerp(-900, 70, codeK), ey = 180, ew = 800, eh = 700;
    sketch(ctx, shp.rrect(ex, ey, ew, eh, 18), { fill: PAL.ink, w: 5, seed: 1600, fillOffset: [10, 10] });
    for (let j = 0; j < 3; j++) sketch(ctx, shp.ellipse(ex + 32 + j * 26, ey + 28, 8, 8, 10), { fill: [PAL.clay, PAL.manilla, PAL.olive][j], w: 1.5, seed: 1610 + j, fillOffset: [0, 0] });
    text(ctx, 'src/ · the code that drew this film', ex + 120, ey + 38, { family: FONT.mono, size: 22, color: PAL.cloud });
    ctx.save(); ctx.beginPath(); ctx.rect(ex + 20, ey + 60, ew - 40, eh - 80); ctx.clip();
    const lines = SOURCE_TEXT || [];
    const scroll = Math.max(0, (u - 2.35) * 16);
    const first = Math.floor(scroll);
    for (let j = 0; j < 24; j++) {
      const li = (first + j) % Math.max(1, lines.length);
      const ln = (lines[li] || '').slice(0, 58);
      const yy = ey + 96 + (j - (scroll - first)) * 27;
      text(ctx, String(li + 1).padStart(4, ' '), ex + 20, yy, { family: FONT.mono, size: 20, color: PAL.slateLight, jitter: 0 });
      codeLine(ctx, ln, ex + 96, yy);
    }
    ctx.restore();
    text(ctx, '…is code, written by Claude Opus 5.5.', 960, 118, { family: FONT.serif, size: 76, align: 'center', reveal: prog(u, 1.55, 2.0), mode: 'fade' });
    const chips = ['1 prompt', '0 video models', '0 stock footage', `${SOURCE_LINES.toLocaleString('en-US')} lines of JS`];
    const cs = 28, cg = 30;
    const total = chips.reduce((a, c) => a + chipWidth(ctx, c, cs), 0) + cg * (chips.length - 1);
    let cxp = 960 - total / 2;
    chips.forEach((c, i) => { cxp += chip(ctx, c, cxp, 1000, { size: cs, k: prog(u, 2.1 + i * 0.12, 2.4 + i * 0.12), fill: i === 3 ? PAL.manilla : PAL.ivory }) + cg; });
  }
  drawClawd(ctx, lerp(1740, 1830, codeK), lerp(1045, 900, codeK), lerp(7, 8, codeK), { pose: 'wave-right', prop: 'pencil', propRot: -0.4 + Math.sin(t * 16) * 0.25, eyes: 'normal', shadowScale: 0.6 });
});
const KW = /^(const|let|function|return|if|for|else|new|of|in)$/;
function codeLine(ctx, ln, x, y) {
  // cheap syntax colouring: comments, strings, keywords, numbers
  setFont(ctx, FONT.mono, 20, 400);
  const parts = ln.split(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`[^`]*`|\/\/.*$|\/\*.*$|\b(?:const|let|function|return|if|for|else|new|of|in)\b|\d+(?:\.\d+)?)/);
  let cx = x;
  for (const p of parts) {
    if (!p) continue;
    let col = PAL.ivoryDark;
    if (/^(\/\/|\/\*|\s*\*)/.test(p)) col = PAL.cloudDark;
    else if (/^['"`]/.test(p)) col = '#A9C08B';
    else if (KW.test(p)) col = PAL.clay;
    else if (/^\d/.test(p)) col = PAL.manilla;
    ctx.fillStyle = col; ctx.fillText(p, cx, y);
    cx += ctx.measureText(p).width;
  }
}
cue(22.25, 'hit'); cue(22.55, 'clonk'); cue(23.0, 'zoomOut', { dur: 1.0 }); cue(24.45, 'slide'); cue(24.65, 'type', { dur: 1.3 }); cue(24.85, 'chips', { n: 4, every: 0.12 });

/* ========================================================== SHOT 14 ===== */
shot('end', 26.25, 30.0, (ctx, t) => {
  paper(ctx, PAL.ivory);
  ctx.save();
  camera(ctx, { x: 960, y: 540, zoom: lerp(1.04, 1.0, ez(t, 0, 1.4, E.outC)) });
  const LH = 150, LW = LH * LOCKUP_ASPECT;
  const sparkK = E.outBack(prog(t, 0.0, 0.5), 2.2);
  drawLockup(ctx, 960 - LW / 2, 190, LH, { wipe: ez(t, 0.2, 0.75), sparkScale: sparkK, sparkRot: (1 - ez(t, 0, 0.8)) * -2.5 + (t > 3.1 ? ez(t, 3.1, 3.7, E.inOutC) * TAU / 3 : 0) });
  const size = 260;
  text(ctx, 'Opus 5.5', 960, 636, { family: FONT.serif, size, align: 'center', tracking: -3, reveal: prog(t, 0.35, 0.9), mode: 'drop', stagger: 0.6 });
  const ow = measure(ctx, 'Opus 5.5', FONT.serif, size, 400, -3);
  label(ctx, 'Available now on all platforms', 960, 752, { size: 50, align: 'center', reveal: prog(t, 0.8, 1.2), color: PAL.slateMed });
  const cw = chipWidth(ctx, 'claude-opus-5-5', 32);
  chip(ctx, 'claude-opus-5-5', 960 - cw / 2, 846, { size: 32, k: prog(t, 1.0, 1.3) });
  const hopK = ez(t, 0.9, 1.35, E.outC);
  const hx = lerp(2150, 960 + ow / 2 + 190, hopK);
  const hy = 636 - Math.abs(Math.sin(hopK * Math.PI * 3)) * 80 * (1 - hopK);
  const wave = Math.floor(t * 4) % 2;
  drawClawd(ctx, hx, hy, 13, { pose: t > 1.35 ? (wave ? 'wave-right' : 'default') : 'default', walk: t < 1.35 ? t * 8 : null, eyes: t > 1.35 ? 'happy' : 'normal', blink: t > 2.6 && t < 2.72 ? 1 : 0 });
  const r = RNG('confetti');
  for (let i = 0; i < 28; i++) {
    const x0 = r() * 1920, spd = 300 + r() * 380, ph = r() * TAU, s = 18 + r() * 28;
    const y = -60 + (t - 0.25) * spd - (r() * 300);
    if (t < 0.25 || y > 1150) continue;
    drawSparkMark(ctx, x0 + Math.sin(t * 3 + ph) * 40, y, s, t * 4 + ph, [PAL.clay, PAL.kraft, PAL.fig, PAL.sky][i % 4]);
  }
  ctx.restore();
  text(ctx, 'Unofficial fan film, drawn entirely in code by Claude Opus 5.5 · Figures: anthropic.com/claude-opus-5-5 (Sept 22, 2026)', 960, 1040, { family: FONT.sans, size: 24, align: 'center', color: PAL.cloudDark, reveal: prog(t, 1.4, 1.9), mode: 'fade', stagger: 0.2, jitter: 0 });
});
cue(26.25, 'wipe'); cue(26.3, 'final'); cue(27.15, 'hop', { dur: 0.45 }); cue(29.35, 'twinkle');

/* ======================================================== TRANSITIONS ==== */
trans(2.5, 0.34, 'whip', { dir: 1 });
trans(5.0, 0.32, 'zoom', { px: 960, py: 520 });
trans(7.0, 0, 'cut');
trans(7.75, 0.42, 'flip');
trans(9.75, 0.34, 'whipv', { dir: 1 });
trans(11.75, 0.32, 'zoom', { px: 985, py: 300 });
trans(13.75, 0, 'cut');
trans(14.5, 0.42, 'flip');
trans(16.5, 0.34, 'whip', { dir: -1 });
trans(18.5, 0.44, 'wipe');
trans(20.5, 0.32, 'zoom', { px: 1230, py: 480 });
trans(22.25, 0, 'cut');
trans(26.25, 0.5, 'wipe');

/* ========================================================== COMPOSITOR ==== */
let BUF_A, BUF_B;
function initScenes() {
  BUF_A = document.createElement('canvas'); BUF_A.width = W; BUF_A.height = H;
  BUF_B = document.createElement('canvas'); BUF_B.width = W; BUF_B.height = H;
  SHOTS.sort((a, b) => a.start - b.start);
  window.CUES = CUES.sort((a, b) => a.t - b.t);
  window.TIMELINE = { shots: SHOTS.map(s => ({ id: s.id, start: s.start, end: s.end })), transitions: TRANS };
}
function setSource(txt) {
  const lines = txt.split('\n');
  SOURCE_LINES = lines.length;
  // open on the most photogenic part: Clawd's pose table, decoded from Claude Code's glyphs
  const at = Math.max(0, lines.findIndex(l => l.includes('const CLAWD_POSES')) - 3);
  SOURCE_TEXT = lines.slice(at).concat(lines.slice(0, at))
    .map(l => l.replace(/\t/g, '  ').replace(/\\u(25[89][0-9A-F])/g, (m, h) => String.fromCharCode(parseInt(h, 16))));
}
function shotAt(T) {
  for (let i = SHOTS.length - 1; i >= 0; i--) if (T >= SHOTS[i].start) return SHOTS[i];
  return SHOTS[0];
}
function renderShot(ctx, s, T) {
  ctx.save();
  resetSeeds(SHOTS.indexOf(s) * 10000);
  s.draw(ctx, T - s.start, s);
  ctx.restore();
}
function renderTo(buf, s, T) {
  const c = buf.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  renderShot(c, s, T);
}
const TRANSITION_FX = {
  whip(ctx, A, B, p, tr) {
    const d = tr.dir ?? 1, e = E.inOutC(p);
    ctx.drawImage(A, -d * e * W * 1.05, 0);
    ctx.drawImage(B, d * (1 - e) * W * 1.05, 0);
    const k = Math.sin(Math.PI * p);
    if (k > 0.05) streaks(ctx, 0, 0, W, H, { n: Math.round(26 * k), w: 10 * k + 2, alpha: 0.85, seed: 77 });
  },
  whipv(ctx, A, B, p, tr) {
    const d = tr.dir ?? 1, e = E.inOutC(p);
    ctx.drawImage(A, 0, -d * e * H * 1.05);
    ctx.drawImage(B, 0, d * (1 - e) * H * 1.05);
    const k = Math.sin(Math.PI * p);
    const r = RNG('wv', G.boil);
    for (let i = 0; i < 22 * k; i++) {
      const x = r() * W, len = H * (0.3 + r() * 0.6), y = r() * (H - len);
      inkStroke(ctx, [[x, y, 0], [x, y + len, len]], { w: 3 + 8 * k * r(), alpha: 0.8, taper: 0.5, seed: i });
    }
  },
  zoom(ctx, A, B, p, tr) {
    // punch in on a point of A, hard-cut on the beat, B settles back from an overshoot
    const px = tr.px ?? W / 2, py = tr.py ?? H / 2;
    ctx.save();
    if (p < 0.5) {
      const a = E.inExpo(p / 0.5);
      ctx.translate(px, py); const za = lerp(1, 6, a); ctx.scale(za, za); ctx.rotate(a * 0.08); ctx.translate(-px, -py);
      ctx.drawImage(A, 0, 0);
    } else {
      const b = E.outExpo((p - 0.5) / 0.5);
      ctx.translate(W / 2, H / 2); const zb = lerp(1.6, 1, b); ctx.scale(zb, zb); ctx.rotate((1 - b) * -0.06); ctx.translate(-W / 2, -H / 2);
      ctx.drawImage(B, 0, 0);
    }
    ctx.restore();
    const k = Math.sin(Math.PI * p);
    if (k > 0.15) speedLines(ctx, W / 2, H / 2, { n: 36, r0: 380 * (1.5 - k), r1: 1300, w: 8 * k, alpha: 0.9 * k, seed: 12 });
  },
  flip(ctx, A, B, p) {
    // a notepad page flipping up over the binding
    const e = E.inOutC(p);
    const fold = H * (1 - e);                      // fold line moves up the page
    const lifted = H - fold;
    const back = Math.min(lifted * 0.45, 260);     // foreshortened underside
    ctx.drawImage(B, 0, 0);
    const sh = ctx.createLinearGradient(0, fold, 0, fold + 90);
    sh.addColorStop(0, `rgba(20,20,19,${0.32 * (1 - e * 0.6)})`); sh.addColorStop(1, 'rgba(20,20,19,0)');
    ctx.fillStyle = sh; ctx.fillRect(0, fold, W, 90);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, fold); ctx.clip(); ctx.drawImage(A, 0, 0); ctx.restore();
    if (back > 2) {
      const g = ctx.createLinearGradient(0, fold - back, 0, fold);
      g.addColorStop(0, '#E8E6DC'); g.addColorStop(0.7, '#D1CFC5'); g.addColorStop(1, '#B0AEA5');
      ctx.fillStyle = g; ctx.fillRect(0, fold - back, W, back);
      const top = resample([[-20, fold - back + 6], [W / 2, fold - back - 8], [W + 20, fold - back + 6]], 30);
      inkStroke(ctx, top, { w: 5, taper: 0.05, seed: 3 });
      inkStroke(ctx, resample([[-20, fold], [W + 20, fold]], 30), { w: 3, alpha: 0.5, taper: 0.05, seed: 4 });
    }
  },
  wipe(ctx, A, B, p) {
    // a giant clay brush stroke paints over A, then B appears beneath as it clears
    const on = clamp(p / 0.5), off = clamp((p - 0.5) / 0.5);
    ctx.drawImage(p < 0.5 ? A : B, 0, 0);
    const path = [];
    for (let i = 0; i <= 7; i++) { const y = -120 + i * 205; path.push(i % 2 ? [W + 200, y] : [-200, y]); }
    const rs = resample(path, 24);
    const seg = p < 0.5 ? partial(rs, 0, E.inOutC(on)) : partial(rs, E.inOutC(off), 1);
    if (seg.length > 1) inkStroke(ctx, seg, { w: 450, color: PAL.clay, taper: 0.02, seed: 21, pressure: 0.12 });
    if (Math.abs(p - 0.5) < 0.04) { ctx.fillStyle = PAL.clay; ctx.fillRect(0, 0, W, H); }
  },
};
function drawFilm(ctx, T) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  T = clamp(T, 0, FILM_DURATION - 1e-6);
  const tr = TRANS.find(x => x.dur > 0 && T >= x.at - x.dur / 2 && T < x.at + x.dur / 2);
  if (tr) {
    const A = shotAt(tr.at - 1e-4), B = shotAt(tr.at + 1e-4);
    renderTo(BUF_A, A, T); renderTo(BUF_B, B, T);
    const p = (T - (tr.at - tr.dur / 2)) / tr.dur;
    ctx.save(); TRANSITION_FX[tr.type](ctx, BUF_A, BUF_B, p, tr); ctx.restore();
  } else {
    renderShot(ctx, shotAt(T), T);
  }
  paperGrain(ctx, 1);
}
