/* ============================================================================
 * scenes-portrait.js — the same film re-composed for 9:16 (Shorts / Reels).
 * Identical timeline and animation beats as scenes.js (so the soundtrack and
 * SFX cues line up), but every shot is re-laid-out for a 1080×1920 frame:
 * key text sits between y≈250 and y≈1150, the Korean subtitle band at
 * y≈1180–1340, and only non-critical art dips into the platform-UI zone.
 * ==========================================================================*/
'use strict';

const PORT = 'portrait';
const CX = 540;
const PY = 880;          // camera centre: content sits ~80 px low of centre, clear of the top bar

/* ----------------------------------------------------------- P1 spark --- */
shot('spark', 0.0, 2.5, (ctx, t) => {
  paper(ctx);
  const hit = prog(t, 1.9, 2.35);
  const [sx, sy] = shake(t, hit > 0 && hit < 1 ? 16 * (1 - hit) : 0);
  const zoom = lerp(1.0, 1.12, ez(t, 0, 1.85, E.inOutC)) + 0.12 * Math.sin(Math.PI * hit);
  ctx.save();
  camera(ctx, { x: CX, y: 930, zoom, sx, sy });
  dotGrid(ctx, -400, -200, 1500, 2400, 48);
  const S = 600, cx = CX, cy = 760;
  const guide = ez(t, 0.0, 0.3), gFade = 1 - ez(t, 1.1, 1.6);
  if (gFade > 0) {
    sketch(ctx, shp.ellipse(cx, cy, 268, 268, 60), { fill: null, stroke: PAL.cloud, w: 2.4, progress: guide, seed: 11, alpha: 0.9 * gFade, closed: false, amp: 2.4 });
    line(ctx, cx - 320, cy, cx + 320, cy, { stroke: PAL.cloud, w: 2, progress: guide, seed: 12, alpha: 0.8 * gFade });
    line(ctx, cx, cy - 320, cx, cy + 320, { stroke: PAL.cloud, w: 2, progress: guide, seed: 13, alpha: 0.8 * gFade });
  }
  const trace = prog(t, 0.2, 1.12), fill = prog(t, 0.98, 1.4);
  const spin = t < 1.35 ? 0 : Math.pow(t - 1.35, 2.2) * 10;
  const pulse = 1 + 0.07 * Math.sin(prog(t, 1.35, 1.9) * Math.PI * 4) * prog(t, 1.35, 1.6);
  drawSpark(ctx, cx, cy, S * pulse, { trace, fill, rot: spin, shatter: prog(t, 1.9, 2.5), shatterDist: 200, ink: 3.6 });
  if (t < 1.28) {
    const k = E.inOutC(trace);
    const p = SPARK.pts[Math.min(SPARK.pts.length - 1, Math.floor(k * SPARK.pts.length))];
    const s = S / 125;
    let px = cx + (p[0] - SPARK.cx) * s, py = cy + (p[1] - SPARK.cy) * s;
    if (t < 0.2) { const g = ez(t, 0, 0.2, E.inOutC); px = lerp(cx + 268, px, g); py = lerp(cy, py, g); }
    const outK = ez(t, 1.08, 1.28, E.inC);
    drawPencil(ctx, px + outK * 520, py + outK * 560, -2.35 + Math.sin(t * 20) * 0.05, 330, 44);
  }
  if (t >= 1.9) {
    burst(ctx, cx, cy, prog(t, 1.9, 2.3), { n: 16, r0: 90, r1: 380, w: 9, color: PAL.ink });
    const up = ez(t, 1.9, 2.12, E.outC), down = ez(t, 2.12, 2.36, E.inQ);
    const y = lerp(lerp(820, 640, up), 1090, down);
    const land = prog(t, 2.36, 2.5);
    const sq = land > 0 ? 1 - 0.24 * Math.sin(Math.PI * land) : 1 + 0.14 * Math.sin(Math.PI * up) * (1 - down);
    const rev = prog(t, 1.9, 2.06);
    drawClawd(ctx, cx, y, 20, { pose: 'arms-up', sy: sq, sx: 2 - sq, eyes: land > 0 ? 'happy' : 'wide', reveal: rev < 1 ? rev : undefined, shadowScale: down > 0.6 ? 1 : 0.2 });
    puff(ctx, cx, 1095, prog(t, 2.36, 2.8));
  }
  ctx.restore();
  const typed = prog(t, 0.08, 0.75);
  const cmd = '> claude --model claude-opus-5-5';
  text(ctx, cmd, 70, 300, { family: FONT.mono, size: 34, color: PAL.slateLight, reveal: typed, mode: 'type', jitter: 0.2 });
  if (typed < 1 || Math.floor(t * 3) % 2 === 0) {
    const w = measure(ctx, cmd.slice(0, Math.floor(typed * cmd.length)), FONT.mono, 34);
    ctx.fillStyle = PAL.clay; ctx.fillRect(74 + w, 272, 17, 34);
  }
}, PORT);

/* ----------------------------------------------------------- P2 title --- */
shot('title', 2.5, 5.0, (ctx, t) => {
  paper(ctx);
  const land = prog(t, 1.02, 1.3);
  const [sx, sy] = shake(t, land > 0 && land < 1 ? 12 * (1 - land) : 0);
  ctx.save();
  camera(ctx, { x: CX, y: PY, zoom: lerp(1.1, 1.0, ez(t, 0, 1.2)), sx, sy });
  const size = 226, b1 = 755, b2 = 1030;
  const w1 = measure(ctx, 'Claude', FONT.serif, size, 400, -2), w2 = measure(ctx, 'Opus 5.5', FONT.serif, size, 400, -2);
  const x0 = CX - Math.max(w1, w2) / 2;
  text(ctx, 'Introducing', x0 + 8, 515, { family: FONT.serif, size: 86, italic: true, color: PAL.clayDeep, reveal: prog(t, 0.0, 0.35), mode: 'fade', jitter: 0.4 });
  text(ctx, 'Claude', x0, b1, { family: FONT.serif, size, tracking: -2, reveal: prog(t, 0.12, 0.55), mode: 'drop', stagger: 0.7, jitter: 0.5 });
  text(ctx, 'Opus 5.5', x0, b2, { family: FONT.serif, size, tracking: -2, reveal: prog(t, 0.34, 0.85), mode: 'drop', stagger: 0.7, jitter: 0.5 });
  const x55 = x0 + measure(ctx, 'Opus ', FONT.serif, size, 400, -2);
  const w55 = measure(ctx, '5.5', FONT.serif, size, 400, -2);
  swoosh(ctx, x0, b2 + 48, x0 + w2 + 12, b2 + 42, prog(t, 1.15, 1.55), { w: 18, bow: 12 });
  const topY = b2 - size * 0.69;
  if (t > 0.72) {
    const fall = ez(t, 0.72, 1.02, E.inQ);
    const y = lerp(-220, topY, fall);
    const sq = land > 0 ? 1 - 0.28 * Math.sin(Math.PI * land) * (1 - land * 0.5) : 1.14;
    const hop = t > 1.6 ? Math.abs(Math.sin((t - 1.6) * 6.5)) * 40 * prog(t, 1.6, 1.7) : 0;
    drawClawd(ctx, x55 + w55 / 2, y - hop, 11, { pose: t > 1.3 ? 'arms-up' : 'default', sy: sq, sx: 2 - sq, eyes: t > 1.3 ? 'happy' : 'wide', shadowScale: 0.7 });
    burst(ctx, x55 + w55 / 2, topY - 60, prog(t, 1.02, 1.35), { n: 10, r0: 120, r1: 220, w: 7, rot: -0.3 });
  }
  sparkles(ctx, [[x0 - 20, 380, 46, 0], [x0 + w2 - 20, 430, 36, 2], [x0 + w1 + 70, 600, 30, 4], [x0 + 40, 1150, 28, 1]].map(p => [p[0], p[1], p[2] * ez(t, 1.2, 1.6), p[3]]), t);
  ctx.restore();
}, PORT);

/* ----------------------------------------------------------- P3 value --- */
shot('value', 5.0, 7.0, (ctx, t) => {
  paper(ctx);
  const stampHit = prog(t, 0.55, 0.8);
  const [sx, sy] = shake(t, stampHit > 0 && stampHit < 1 ? 9 * (1 - stampHit) : 0);
  ctx.save();
  camera(ctx, { x: CX, y: PY, zoom: lerp(1.06, 1.0, ez(t, 0, 1.2)), sx, sy });
  text(ctx, 'Fable 5.1-level', CX, 360, { family: FONT.serif, size: 104, align: 'center', reveal: prog(t, 0.0, 0.4), mode: 'drop', stagger: 0.7 });
  text(ctx, 'work.', CX, 468, { family: FONT.serif, size: 104, align: 'center', reveal: prog(t, 0.12, 0.5), mode: 'drop', stagger: 0.7 });
  const k1 = prog(t, 0.35, 0.7);
  if (k1 > 0) {
    priceTag(ctx, 520, 660, 235 * E.outBack(k1, 2), -0.07 + Math.sin(t * 5) * 0.035 * (1 - prog(t, 0.8, 1.6)));
    const sk = prog(t, 0.55, 0.72);
    if (sk > 0) {
      ctx.save(); ctx.translate(560, 660); ctx.rotate(-0.07); const ss = lerp(1.8, 1, E.outC(sk)); ctx.scale(ss, ss); ctx.globalAlpha *= clamp(sk * 2);
      stat(ctx, '−40%', 0, 52, 140, { align: 'center', color: PAL.clayDeep });
      ctx.restore();
    }
  }
  const k2 = prog(t, 0.72, 1.35);
  if (k2 > 0) {
    ctx.save(); ctx.translate(CX, 960); const e = E.outBack(prog(t, 0.72, 0.95), 2); ctx.scale(e, e);
    speedo(ctx, 0, 40, 200, k2);
    ctx.restore();
    stat(ctx, '30%+', CX, 1120, 100, { reveal: prog(t, 0.9, 1.15), align: 'center' });
  }
  if (t > 1.05) {                                   // Clawd dashes across under the subtitles
    const k = ez(t, 1.05, 1.8, E.inOutC);
    const x = lerp(-300, 1400, k);
    streaks(ctx, x - 900, 1400, 760, 100, { n: 7, w: 7, seed: 5 });
    drawClawd(ctx, x, 1520, 10, { walk: t * 8, rot: 0.14, eyes: 'happy', shadowScale: 0.8 });
  }
  ctx.restore();
}, PORT);

/* ------------------------------------------------------- chapter cards --- */
function chapterCardP(ctx, t, num, word, sub, clawdOpts) {
  darkCard(ctx);
  ctx.save();
  camera(ctx, { x: CX, y: PY, zoom: lerp(1.0, 1.07, ez(t, 0, 0.75, E.outC)) });
  kicker(ctx, num, CX, 560, { size: 42, reveal: prog(t, 0, 0.2), color: PAL.clay, align: 'center' });
  text(ctx, word, CX, 810, { family: FONT.serif, size: 250, color: PAL.ivory, reveal: prog(t, 0.0, 0.3), mode: 'pop', stagger: 0.6, jitter: 0.8, align: 'center' });
  label(ctx, sub, CX, 910, { size: 46, color: PAL.cloud, reveal: prog(t, 0.15, 0.4), align: 'center' });
  drawClawd(ctx, CX, 1130, 14, { ...clawdOpts, sy: 1 - 0.15 * Math.sin(Math.PI * prog(t, 0.36, 0.55)), shadow: false, hatDrop: prog(t, 0.1, 0.4) });
  ctx.restore();
}
shot('ch-builds', 7.0, 7.75, (ctx, t) => chapterCardP(ctx, t, '01', 'Builds.', 'agentic coding', { pose: 'arms-up', hat: 'hardhat', eyes: t > 0.42 ? 'happy' : 'wide' }), PORT);
shot('ch-works', 13.75, 14.5, (ctx, t) => chapterCardP(ctx, t, '02', 'Works.', 'knowledge work', { pose: 'default', tie: t > 0.2, glasses: t > 0.3, eyes: 'normal' }), PORT);

/* --------------------------------------------------------- P5 migrate --- */
shot('migrate', 7.75, 9.75, (ctx, t) => {
  paper(ctx);
  ctx.save();
  camera(ctx, { x: CX, y: PY, zoom: lerp(1.07, 1.0, ez(t, 0, 0.8)) });
  stat(ctx, fmt(680000 * ez(t, 0.15, 1.45, E.outC)), CX, 470, 188, { align: 'center' });
  note(ctx, 'lines of code, migrated', CX, 540, { align: 'center', size: 30, reveal: prog(t, 0.2, 0.6), color: PAL.slateLight });
  box(ctx, 60, 900, 290, 190, 'legacy/', PAL.kraft, 510);
  box(ctx, 730, 900, 290, 190, 'new/', PAL.cactus, 520);
  const pile = Math.round(lerp(9, 2, prog(t, 0.2, 1.8)));
  for (let i = 0; i < pile; i++) line(ctx, 88 + (i % 2) * 18, 884 - i * 15, 300 - (i * 37 % 70), 884 - i * 15, { w: 9, stroke: SYNTAX[i % SYNTAX.length], seed: 530 + i });
  const stack = Math.round(lerp(1, 10, prog(t, 0.3, 1.9)));
  for (let i = 0; i < stack; i++) line(ctx, 758, 884 - i * 15, 930 + (i * 53 % 60), 884 - i * 15, { w: 9, stroke: SYNTAX[(i + 3) % SYNTAX.length], seed: 560 + i });
  const hands = [CX, 1000];
  let n = 0;
  [[130, 1.7], [200, 1.45], [270, 1.2]].forEach(([hgt, rate], li) => {
    for (let i = 0; i < 18; i++, n++) {
      const s = ((t * rate + i / 18 + li * 0.17) % 1 + 1) % 1;
      if (t < 0.3 && s > t * 3.3) continue;
      const first = s < 0.5, q = first ? s * 2 : s * 2 - 1;
      const [ax, ay] = first ? [290, 880] : hands, [bx, by] = first ? hands : [790, 880];
      const x = lerp(ax, bx, q), y = lerp(ay, by, q) - 4 * hgt * q * (1 - q);
      const a = Math.atan2((by - ay) - 4 * hgt * (1 - 2 * q), bx - ax);
      const len = 42 + (n * 29 % 50);
      inkStroke(ctx, [[x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2], [x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2]], { w: 11, color: SYNTAX[n % SYNTAX.length], taper: 0.15, seed: n });
    }
  });
  const juggle = Math.floor(t * 10) % 3;
  drawClawd(ctx, CX, 1100, 14, { pose: ['arms-up', 'wave-left', 'wave-right'][juggle], hat: 'hardhat', eyes: 'normal', sy: 1 - 0.05 * (juggle === 0) });
  ctx.restore();
}, PORT);

/* -------------------------------------------------------- P6 terminal --- */
shot('terminal', 9.75, 11.75, (ctx, t) => {
  paper(ctx);
  ctx.save();
  const riseK = ez(t, 0.1, 0.95, E.outBack);
  camera(ctx, { x: CX, y: lerp(PY + 80, PY, ez(t, 0.2, 1.1, E.inOutC)), zoom: lerp(1.0, 1.04, ez(t, 0, 1.1)) });
  kicker(ctx, 'Terminal-Bench 4.0', CX, 300, { reveal: prog(t, 0, 0.3), align: 'center' });
  stat(ctx, (66.4 * ez(t, 0.1, 1.0, E.outC)).toFixed(1) + '%', CX, 470, 200, { align: 'center' });
  note(ctx, 'highest on Anthropic’s launch chart', CX, 532, { reveal: prog(t, 0.6, 1.0), align: 'center', size: 26 });
  const baseY = 1110, bw = 160, gap = 50, x0 = CX - (4 * bw + 3 * gap) / 2, scale = 5.8;
  line(ctx, x0 - 30, baseY, x0 + 4 * bw + 3 * gap + 30, baseY, { w: 6, seed: 601 });
  TB.forEach(([name, val, col], i) => {
    const k = i === 0 ? riseK : ez(t, 0.05 + i * 0.07, 0.85 + i * 0.07, E.outBack);
    const h = Math.max(4, val * scale * k), x = x0 + i * (bw + gap);
    sketch(ctx, shp.rect(x, baseY - h, bw, h), { fill: col, w: 5, seed: 610 + i, fillOffset: [7, 7], hatch: i === 0 ? { gap: 16, w: 3, color: PAL.clayDeep, alpha: 0.6 } : null });
    if (i > 0) text(ctx, val.toFixed(1) + '%', x + bw / 2, baseY - h - 20, { family: FONT.mono, size: 30, weight: 500, align: 'center', alpha: clamp(k * 2), color: PAL.slateLight });
    text(ctx, name, x + bw / 2, baseY + 44, { family: FONT.sans, size: 28, weight: i === 0 ? 700 : 500, align: 'center', color: i === 0 ? PAL.ink : PAL.slateLight });
  });
  const top = baseY - 66.4 * scale * riseK;
  const planted = t > 1.05;
  drawClawd(ctx, x0 + bw / 2, top, 8, { pose: planted ? 'arms-up' : 'default', eyes: planted ? 'happy' : 'wide', prop: planted ? 'flag' : null, shadowScale: 0.55, sy: 1 - 0.2 * Math.sin(Math.PI * prog(t, 0.92, 1.12)) });
  burst(ctx, x0 + bw / 2, top - 60, prog(t, 1.05, 1.4), { n: 10, r0: 90, r1: 180, w: 6 });
  ctx.restore();
}, PORT);

/* ------------------------------------------------------- P7 orchestra --- */
shot('orchestra', 11.75, 13.75, (ctx, t) => {
  paper(ctx);
  ctx.save();
  camera(ctx, { x: CX, y: PY, zoom: lerp(1.12, 1.0, ez(t, 0, 1.0, E.inOutC)) });
  const checked = Math.min(40, Math.max(0, Math.floor((t - 0.62) / 0.026)));
  stat(ctx, `${checked}/40`, CX, 445, 196, { align: 'center' });
  const cw = 112, chh = 50, gx = CX - (8 * cw) / 2, gy = 500;
  for (let i = 0; i < 40; i++) {
    const r = Math.floor(i / 8), c = i % 8;
    const k = prog(t, 0.1 + i * 0.012, 0.3 + i * 0.012);
    if (k <= 0) continue;
    const x = gx + c * cw, y = gy + r * (chh + 12);
    const done = i < checked;
    ctx.save(); ctx.translate(x + cw / 2, y + chh / 2); const e = E.outBack(k, 2); ctx.scale(e, e);
    sketch(ctx, shp.rrect(-cw / 2 + 5, -chh / 2, cw - 10, chh, 9), { fill: done ? PAL.cactus : PAL.ivoryDark, w: 3, seed: 700 + i, fillOffset: [3, 3] });
    text(ctx, '#' + (i + 1), -22, 7, { family: FONT.mono, size: 19, weight: 500, color: PAL.slateLight, align: 'center', jitter: 0.1 });
    check(ctx, 24, 1, 26, done ? prog(t - 0.62 - i * 0.026, 0, 0.12) : 0, PAL.olive, 5.5);
    ctx.restore();
  }
  const lead = [CX, 1140];
  for (let i = 0; i < 12; i++) {
    const a = Math.PI + 0.12 + (i / 11) * (Math.PI - 0.24);
    const px = lead[0] + Math.cos(a) * 410, py = lead[1] + Math.sin(a) * 250;
    const k = prog(t, 0.15 + i * 0.045, 0.4 + i * 0.045);
    if (k <= 0) continue;
    line(ctx, lead[0], lead[1] - 110, px, py - 42, { w: 2.5, stroke: PAL.cloud, seed: 760 + i, alpha: 0.9 * k });
    drawClawd(ctx, px, py, 4.4 * E.outBack(k, 2.5), { pose: Math.floor(t * 6 + i) % 2 ? 'default' : 'arms-up', shadowScale: 0.6, eyes: 'normal', seed: 40 + i });
  }
  drawClawd(ctx, lead[0], lead[1], 10, { pose: 'wave-right', prop: 'baton', propRot: -1.3 + Math.sin(t * 14) * 0.5, eyes: 'happy' });
  ctx.restore();
}, PORT);

/* ----------------------------------------------------- P9 occupations --- */
shot('occupations', 14.5, 16.5, (ctx, t) => {
  paper(ctx);
  ctx.save();
  camera(ctx, { x: CX, y: PY, zoom: lerp(1.05, 1.0, ez(t, 0, 0.9)), rot: lerp(-0.015, 0.0, ez(t, 0, 0.9)) });
  kicker(ctx, 'GDPval-AA v2.1', CX, 290, { reveal: prog(t, 0, 0.3), align: 'center' });
  const num = String(Math.round(1846 * ez(t, 0.1, 1.0, E.outC)));
  setFont(ctx, FONT.serif, 200, 400);
  const dw = Math.max(...'0123456789'.split('').map(d => ctx.measureText(d).width)) * 4;
  const ew = measure(ctx, 'Elo', FONT.serif, 80, 400);
  const nx = CX - (dw + 16 + ew) / 2;
  stat(ctx, num, nx, 460, 200);
  text(ctx, 'Elo', nx + dw + 16, 460, { family: FONT.serif, size: 80, color: PAL.slateLight, reveal: prog(t, 0.5, 0.8), mode: 'fade' });
  const cx = CX, cy = 850;
  for (let i = 0; i < 44; i++) {
    const ring = i < 18 ? 0 : 1, j = ring ? i - 18 : i, n = ring ? 26 : 18;
    const a = -Math.PI / 2 + (j / n) * TAU + ring * 0.12;
    const R = ring ? 350 : 225, Ry = ring ? 280 : 180;
    const k = prog(t, 0.08 + i * 0.022, 0.3 + i * 0.022);
    if (k <= 0) continue;
    ctx.save(); ctx.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * Ry); const e = E.outBack(k, 3); ctx.scale(e, e);
    sketch(ctx, shp.ellipse(0, 0, 32, 32, 18), { fill: [PAL.ivory, PAL.oat, PAL.ivoryDark][i % 3], w: 3, seed: 800 + i, fillOffset: [3, 3] });
    ICONS[i % ICONS.length](ctx, 17);
    ctx.restore();
  }
  const hi = Math.floor(t / 0.17) % HATS.length, pop = (t / 0.17) % 1;
  drawClawd(ctx, cx, cy + 95, 10, { pose: pop < 0.3 ? 'arms-up' : 'default', hat: HATS[(hi + HATS.length) % HATS.length], eyes: 'happy', sy: 1 - 0.08 * Math.sin(Math.PI * clamp(pop * 3)) });
  burst(ctx, cx, cy - 35, pop < 0.5 ? pop * 2 : 0, { n: 7, r0: 130, r1: 180, w: 4, color: PAL.clay });
  ctx.restore();
}, PORT);

/* ------------------------------------------------------------ P10 deck --- */
shot('deck', 16.5, 18.5, (ctx, t) => {
  paper(ctx);
  ctx.save();
  camera(ctx, { x: CX, y: PY, zoom: lerp(1.05, 1.0, ez(t, 0, 0.8)) });
  kicker(ctx, 'Excel model → exec deck', CX, 290, { reveal: prog(t, 0, 0.3), align: 'center' });
  stat(ctx, `${Math.round(63 * ez(t, 0.1, 1.0, E.outC))} min`, 92, 460, 192);
  stopwatch(ctx, 870, 405, 84, prog(t, 0.1, 1.0));
  const fold = ez(t, 0.95, 1.35, E.inOutC);
  const sx = 92, sy = 540, cw = 128, chh = 50, cols = 7, rows = 11;
  if (fold < 1) {
    ctx.save(); ctx.globalAlpha *= 1 - fold;
    ctx.translate(sx + cols * cw / 2, sy + rows * chh / 2); ctx.scale(1 - fold * 0.4, 1 - fold * 0.4); ctx.rotate(fold * -0.1); ctx.translate(-(sx + cols * cw / 2), -(sy + rows * chh / 2));
    sketch(ctx, shp.rect(sx, sy, cols * cw, rows * chh), { fill: PAL.ivory, w: 5, seed: 930, fillOffset: [9, 9] });
    sketch(ctx, shp.rect(sx, sy, cols * cw, chh), { fill: PAL.cactus, w: 3, seed: 931, fillOffset: [0, 0] });
    text(ctx, 'fx  =NPV(r, synergies) − price', sx + 16, sy + 35, { family: FONT.mono, size: 25, weight: 500, color: PAL.ink, reveal: prog(t, 0.05, 0.5), mode: 'type' });
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
    [[-0.14, -70, PAL.oat], [0.07, 50, PAL.cactus], [-0.02, 0, PAL.ivory]].forEach(([rot, dx, col], i) => {
      const e = E.outBack(clamp(fold * 1.2 - i * 0.1), 1.6);
      ctx.save(); ctx.translate(CX + dx * e, 800 + i * 8); ctx.rotate(rot * e); const sc = lerp(0.5, 1, e) * 0.9; ctx.scale(sc, sc);
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
    drawClawd(ctx, lerp(150, 900, ez(t, 0.1, 0.9, E.inOutC)), sy - 4 - Math.abs(Math.sin(t * 11)) * 40, 6, { walk: t * 6, eyes: 'normal', glasses: true, tie: true, shadowScale: 0.6 });
  } else {
    drawClawd(ctx, 880, 1150, 9, { pose: 'wave-left', eyes: 'happy', glasses: true, tie: true, prop: 'baton', flip: true, propRot: -2.4 });
  }
  ctx.restore();
}, PORT);

/* -------------------------------------------------------- P11 research --- */
shot('research', 18.5, 20.5, (ctx, t) => {
  paper(ctx);
  ctx.save();
  camera(ctx, { x: CX, y: PY, zoom: lerp(1.04, 1.0, ez(t, 0, 0.8)) });
  const FAIL = new Set([6, 13]);
  const dw = 118, dh = 140, gapx = 24, gapy = 46, gx = CX - (6 * dw + 5 * gapx) / 2, gy = 572;
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
      if (FAIL.has(i)) cross(ctx, x + dw / 2, y + dh / 2, 54, sk);
      else { sketch(ctx, shp.ellipse(x + dw / 2, y + dh / 2, 42 * E.outBack(sk, 3), 42 * E.outBack(sk, 3), 20), { fill: 'rgba(188,209,202,0.9)', stroke: PAL.olive, w: 4, seed: 1300 + i, fillOffset: [0, 0] }); check(ctx, x + dw / 2, y + dh / 2 + 4, 42, sk, PAL.olive, 7); passed++; }
    }
    ctx.restore();
  }
  kicker(ctx, 'Fact-checked research', CX, 290, { reveal: prog(t, 0, 0.3), align: 'center' });
  stat(ctx, `${passed}/18`, CX, 452, 192, { align: 'center' });
  note(ctx, 'Fable 5.1 & Opus 5: none passed', CX, 520, { reveal: prog(t, 1.05, 1.45), color: PAL.clayDeep, align: 'center', size: 28 });
  const si = clamp((t - 0.25) / (18 * 0.06)) * 17.99;
  const row = Math.floor(si / 6), colf = si % 6;
  const px = gx + colf * (dw + gapx) + dw / 2, py = gy + row * (dh + gapy) + dh + 40;
  drawClawd(ctx, t < 0.25 ? 120 : px - 60, t < 0.25 ? 1140 : py, 5, { hat: 'detective', prop: 'magnifier', propRot: -0.9, eyes: 'normal', walk: t * 5, shadowScale: 0.7 });
  ctx.restore();
}, PORT);

/* -------------------------------------------------------- P12 computer --- */
shot('computer', 20.5, 22.25, (ctx, t) => {
  paper(ctx);
  ctx.save();
  camera(ctx, { x: CX, y: PY, zoom: lerp(1.08, 1.0, ez(t, 0, 1.2)) });
  kicker(ctx, 'OSWorld 2.0 · computer use', CX, 290, { reveal: prog(t, 0, 0.3), align: 'center' });
  stat(ctx, (81.8 * ez(t, 0.1, 0.9, E.outC)).toFixed(1) + '%', CX, 452, 192, { align: 'center' });
  note(ctx, 'partial-credit score · Fable 5.1: 80.7%', CX, 518, { reveal: prog(t, 0.45, 0.85), size: 26, align: 'center' });
  const mx = 90, my = 566, mw = 900, mh = 500;
  const M = (x, y) => [mx + (x - 900) * (mw / 920), my + (y - 160) * (mh / 580)];   // map the 16:9 desktop layout into this monitor
  sketch(ctx, shp.rrect(mx, my, mw, mh, 26), { fill: PAL.ink, w: 5, seed: 1401, fillOffset: [9, 9] });
  sketch(ctx, shp.rect(mx + 24, my + 24, mw - 48, mh - 48), { fill: PAL.chartCloud, w: 3, seed: 1402, fillOffset: [0, 0] });
  sketch(ctx, [[CX - 60, my + mh], [CX + 60, my + mh], [CX + 110, my + mh + 100], [CX - 110, my + mh + 100]], { fill: PAL.cloud, w: 4, seed: 1403 });
  sketch(ctx, shp.rect(mx + 24, my + mh - 64, mw - 48, 40), { fill: PAL.ivoryDark, w: 2, seed: 1404, fillOffset: [0, 0] });
  const stops = [[1090, 300], [1540, 350], [1260, 560], [1620, 610]].map(p => M(...p));
  const wins = [[950, 210, 370, 240, PAL.ivory], [1340, 240, 410, 260, PAL.oat], [1040, 430, 390, 210, PAL.cactus], [1450, 460, 310, 190, PAL.ivory]];
  const seg = 0.28, t0 = 0.3;
  wins.forEach(([wx, wy, ww, wh, col], i) => {
    const k = prog(t, t0 + (i + 1) * seg - 0.05, t0 + (i + 1) * seg + 0.1);
    if (k <= 0) return;
    const [x, y] = M(wx, wy), w = ww * (mw / 920), h = wh * (mh / 580);
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(E.outBack(k), E.outBack(k)); ctx.translate(-(x + w / 2), -(y + h / 2));
    sketch(ctx, shp.rect(x, y, w, h), { fill: col, w: 3.5, seed: 1410 + i, fillOffset: [4, 4] });
    sketch(ctx, shp.rect(x, y, w, 30), { fill: PAL.ivoryDark, w: 3, seed: 1420 + i, fillOffset: [0, 0] });
    for (let j = 0; j < 3; j++) sketch(ctx, shp.ellipse(x + 17 + j * 19, y + 15, 5.5, 5.5, 8), { fill: [PAL.clay, PAL.manilla, PAL.olive][j], w: 1.5, seed: 1430 + j, fillOffset: [0, 0] });
    for (let j = 0; j < 3; j++) line(ctx, x + 22, y + 66 + j * 34, x + w - 36 - (j % 2) * 50, y + 66 + j * 34, { w: 3, seed: 1440 + i * 5 + j, alpha: 0.4 });
    ctx.restore();
  });
  const start = M(1050, 580);
  let p = start;
  for (let i = 0; i < stops.length; i++) {
    const k = ez(t, t0 + i * seg, t0 + (i + 1) * seg - 0.06, E.inOutC);
    const prev = i === 0 ? start : stops[i - 1];
    if (t >= t0 + i * seg) p = [lerp(prev[0], stops[i][0], k), lerp(prev[1], stops[i][1], k) - Math.sin(Math.PI * k) * 60];
  }
  for (let i = 0; i < stops.length; i++) {
    const ck = prog(t, t0 + (i + 1) * seg - 0.06, t0 + (i + 1) * seg + 0.18);
    if (ck > 0 && ck < 1) sketch(ctx, shp.ellipse(stops[i][0], stops[i][1], 18 + 50 * ck, 18 + 50 * ck, 20), { fill: null, stroke: PAL.clay, w: 7 * (1 - ck) + 1, seed: 1450 + i, closed: true });
  }
  cursorArrow(ctx, p[0], p[1], 104);
  drawClawd(ctx, p[0] + 30, p[1] + 7, 5.4, { pose: 'arms-up', eyes: 'happy', shadow: false, rot: -0.2 + Math.sin(t * 12) * 0.08 });
  ctx.restore();
}, PORT);

/* ----------------------------------------------------------- P13 draws --- */
// the film zooms out into its own 9:16 storyboard, then into its own source code
const BOARD_P = [['spark', 2.25], ['title', 2.35], ['value', 1.75], ['ch-builds', 0.7], ['migrate', 1.9], ['terminal', 1.9], ['orchestra', 1.95], ['ch-works', 0.7], ['occupations', 1.9], ['deck', 1.95], ['research', 1.95], ['computer', 1.7]];
shot('draws', 22.25, 26.25, (ctx, t) => {
  if (t < 0.75) {
    chapterCardP(ctx, t, '03', 'Draws.', 'this film', { pose: 'wave-right', prop: 'pencil', propRot: -0.6, eyes: 'happy' });
    return;
  }
  const u = t - 0.75;
  paper(ctx);
  const cols = 4, pw = 200, ph = 356, gap = 22;
  const gw = cols * pw + (cols - 1) * gap, gh = 3 * ph + 2 * gap;
  const codeK = ez(u, 1.45, 2.05, E.inOutC);
  const zk = ez(u, 0, 1.0, E.inOutExpo);
  const gcy = 760;
  ctx.save();
  camera(ctx, { x: lerp(CX + gw / 2 - pw / 2, CX, zk), y: lerp(gcy + gh / 2 - ph / 2, PY, zk), zoom: lerp(4.4, 1.0, zk) });
  ctx.translate(CX, lerp(gcy, 575, codeK)); ctx.scale(lerp(1, 0.4, codeK), lerp(1, 0.4, codeK)); ctx.translate(-CX, -gcy);
  const bx = CX - gw / 2, by = gcy - gh / 2;
  BOARD_P.forEach(([id, hero], i) => {
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
    text(ctx, String(i + 1).padStart(2, '0'), x + 4, y - 10, { family: FONT.mono, size: 20, color: PAL.slateLight });
  });
  ctx.restore();
  text(ctx, 'Every frame you just watched…', CX, 300, { family: FONT.serif, size: 60, align: 'center', reveal: prog(u, 0.5, 1.0), mode: 'fade', alpha: 1 - prog(u, 1.35, 1.5) });
  if (codeK > 0) {
    text(ctx, '…is code, written by', CX, 300, { family: FONT.serif, size: 62, align: 'center', reveal: prog(u, 1.55, 1.9), mode: 'fade' });
    text(ctx, 'Claude Opus 5.5.', CX, 380, { family: FONT.serif, size: 62, align: 'center', reveal: prog(u, 1.7, 2.05), mode: 'fade' });
    const ex = 70, ey = lerp(1960, 900, codeK), ew = 940, eh = 330;
    sketch(ctx, shp.rrect(ex, ey, ew, eh, 18), { fill: PAL.ink, w: 5, seed: 1600, fillOffset: [10, 10] });
    for (let j = 0; j < 3; j++) sketch(ctx, shp.ellipse(ex + 30 + j * 24, ey + 26, 7, 7, 10), { fill: [PAL.clay, PAL.manilla, PAL.olive][j], w: 1.5, seed: 1610 + j, fillOffset: [0, 0] });
    text(ctx, 'src/ · the code that drew this film', ex + 110, ey + 34, { family: FONT.mono, size: 20, color: PAL.cloud });
    ctx.save(); ctx.beginPath(); ctx.rect(ex + 16, ey + 52, ew - 32, eh - 62); ctx.clip();
    const lines = SOURCE_TEXT || [];
    const scroll = Math.max(0, (u - 2.35) * 16);
    const first = Math.floor(scroll);
    for (let j = 0; j < 11; j++) {
      const li = (first + j) % Math.max(1, lines.length);
      const yy = ey + 82 + (j - (scroll - first)) * 26;
      text(ctx, String(li + 1).padStart(4, ' '), ex + 14, yy, { family: FONT.mono, size: 19, color: PAL.slateLight, jitter: 0 });
      codeLine(ctx, (lines[li] || '').slice(0, 62), ex + 86, yy);
    }
    ctx.restore();
    const chips = [['1 prompt', '0 video models'], ['0 stock footage', `${SOURCE_LINES.toLocaleString('en-US')} lines of JS`]];
    const cs = 26, cg = 22;
    chips.forEach((row, ri) => {
      const total = row.reduce((a, c) => a + chipWidth(ctx, c, cs), 0) + cg * (row.length - 1);
      let cxp = CX - total / 2;
      row.forEach((c, i) => { const n = ri * 2 + i; cxp += chip(ctx, c, cxp, 1520 + ri * 72, { size: cs, k: prog(u, 2.1 + n * 0.12, 2.4 + n * 0.12), fill: n === 3 ? PAL.manilla : PAL.ivory }) + cg; });
    });
  }
  drawClawd(ctx, 930, 1720, 7, { pose: 'wave-right', prop: 'pencil', propRot: -0.4 + Math.sin(t * 16) * 0.25, eyes: 'normal', shadowScale: 0.6 });
}, PORT);

/* ------------------------------------------------------------- P14 end --- */
shot('end', 26.25, 30.0, (ctx, t) => {
  paper(ctx, PAL.ivory);
  ctx.save();
  camera(ctx, { x: CX, y: PY, zoom: lerp(1.04, 1.0, ez(t, 0, 1.4, E.outC)) });
  const LH = 120, LW = LH * LOCKUP_ASPECT;
  drawLockup(ctx, CX - LW / 2, 470, LH, { wipe: ez(t, 0.2, 0.75), sparkScale: E.outBack(prog(t, 0.0, 0.5), 2.2), sparkRot: (1 - ez(t, 0, 0.8)) * -2.5 + (t > 3.1 ? ez(t, 3.1, 3.7, E.inOutC) * TAU / 3 : 0) });
  const size = 226, base = 880;
  text(ctx, 'Opus 5.5', CX, base, { family: FONT.serif, size, align: 'center', tracking: -3, reveal: prog(t, 0.35, 0.9), mode: 'drop', stagger: 0.6 });
  const ow = measure(ctx, 'Opus 5.5', FONT.serif, size, 400, -3);
  const x55 = CX - ow / 2 + measure(ctx, 'Opus ', FONT.serif, size, 400, -3), w55 = measure(ctx, '5.5', FONT.serif, size, 400, -3);
  label(ctx, 'Available now on all platforms', CX, 980, { size: 42, align: 'center', reveal: prog(t, 0.8, 1.2), color: PAL.slateMed });
  const cw = chipWidth(ctx, 'claude-opus-5-5', 30);
  chip(ctx, 'claude-opus-5-5', CX - cw / 2, 1070, { size: 30, k: prog(t, 1.0, 1.3) });
  // Clawd hops back onto the "5.5" — a callback to the title
  const hopK = ez(t, 0.9, 1.35, E.outC);
  const topY = base - size * 0.69;
  const hx = lerp(1250, x55 + w55 / 2, hopK);
  const hy = topY - Math.abs(Math.sin(hopK * Math.PI * 3)) * 80 * (1 - hopK);
  const wave = Math.floor(t * 4) % 2;
  drawClawd(ctx, hx, hy, 11, { pose: t > 1.35 ? (wave ? 'wave-right' : 'default') : 'default', walk: t < 1.35 ? t * 8 : null, eyes: t > 1.35 ? 'happy' : 'normal', blink: t > 2.6 && t < 2.72 ? 1 : 0, shadowScale: 0.7 });
  const r = RNG('confetti');
  for (let i = 0; i < 26; i++) {
    const x0 = r() * 1080, spd = 380 + r() * 460, ph = r() * TAU, s = 18 + r() * 28;
    const y = -60 + (t - 0.25) * spd - (r() * 400);
    if (t < 0.25 || y > 1990) continue;
    drawSparkMark(ctx, x0 + Math.sin(t * 3 + ph) * 36, y, s, t * 4 + ph, [PAL.clay, PAL.kraft, PAL.fig, PAL.sky][i % 4]);
  }
  ctx.restore();
  text(ctx, 'Unofficial fan film, drawn entirely in code by Claude Opus 5.5', CX, 1508, { family: FONT.sans, size: 24, align: 'center', color: PAL.cloudDark, reveal: prog(t, 1.4, 1.9), mode: 'fade', stagger: 0.2, jitter: 0 });
  text(ctx, 'Figures: anthropic.com/claude-opus-5-5 (Sept 22, 2026)', CX, 1544, { family: FONT.sans, size: 24, align: 'center', color: PAL.cloudDark, reveal: prog(t, 1.5, 2.0), mode: 'fade', stagger: 0.2, jitter: 0 });
}, PORT);

/* ------------------------------------------------ transitions (9:16) --- */
trans(2.5, 0.34, 'whip', { dir: 1 }, PORT);
trans(5.0, 0.32, 'zoom', { px: 540, py: 1000 }, PORT);
trans(7.0, 0, 'cut', {}, PORT);
trans(7.75, 0.42, 'flip', {}, PORT);
trans(9.75, 0.34, 'whipv', { dir: 1 }, PORT);
trans(11.75, 0.32, 'zoom', { px: 215, py: 670 }, PORT);
trans(13.75, 0, 'cut', {}, PORT);
trans(14.5, 0.42, 'flip', {}, PORT);
trans(16.5, 0.34, 'whip', { dir: -1 }, PORT);
trans(18.5, 0.44, 'wipe', {}, PORT);
trans(20.5, 0.32, 'zoom', { px: 540, py: 880 }, PORT);
trans(22.25, 0, 'cut', {}, PORT);
trans(26.25, 0.5, 'wipe', {}, PORT);
