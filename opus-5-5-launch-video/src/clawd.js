/* ============================================================================
 * clawd.js — Clawd, the 8-bit Claude Code mascot, inked by hand.
 * The pixel map is decoded at runtime from the exact block characters that
 * Claude Code prints (see assets.js). Each quadrant becomes one "pixel".
 * ==========================================================================*/
'use strict';

// quadrant bitmasks: UL=8 UR=4 LL=2 LR=1
const QMASK = {
  ' ': 0, '█': 15, '▐': 5, '▌': 10, '▀': 12, '▄': 3,
  '▛': 14, '▜': 13, '▙': 11, '▟': 7, '▘': 8, '▝': 4,
  '▖': 2, '▗': 1, '▚': 9, '▞': 6,
};

// extra poses assembled from the same official glyph vocabulary
CLAWD_POSES['wave-right'] = { r1L: ' ▐', r1E: '▛███▛█', r1R: '▄', r2L: '▝▜', r2R: '█▘' };
CLAWD_POSES['wave-left'] = { r1L: '▗▟', r1E: '▛███▛█', r1R: '', r2L: ' ▜', r2R: '█▀' };

const CLAWD_CACHE = {};
function decodeClawd(pose = 'default') {
  if (CLAWD_CACHE[pose]) return CLAWD_CACHE[pose];
  const p = CLAWD_POSES[pose] || CLAWD_POSES['default'];
  const rows = [
    { s: [...(p.r1L + p.r1E + p.r1R)], bg: [[...p.r1L].length, [...p.r1L].length + [...p.r1E].length] },
    { s: [...(p.r2L + CLAWD_MID + p.r2R)], bg: [[...p.r2L].length, [...p.r2L].length + [...CLAWD_MID].length] },
    { s: [...CLAWD_LEGS], bg: [0, 0] },
  ];
  const cells = [];
  const quads = [[0, 0, 8], [1, 0, 4], [0, 1, 2], [1, 1, 1]];
  rows.forEach((row, r) => {
    row.s.forEach((ch, c) => {
      const m = QMASK[ch] ?? 0;
      const inBg = c >= row.bg[0] && c < row.bg[1];
      for (const [qx, qy, bit] of quads) {
        const x = c * 2 + qx, y = r * 2 + qy;
        if (m & bit) cells.push({ x, y, k: y >= 4 ? 'leg' : 'body' });
        else if (inBg) cells.push({ x, y, k: 'eye' });
      }
    });
  });
  return (CLAWD_CACHE[pose] = cells);
}

const CLAWD_QH = 2;          // a terminal quadrant is ~1:2, so each pixel is 1u wide × 2u tall
const CLAWD_W = 18, CLAWD_H = 5 * CLAWD_QH;   // in units

/**
 * drawClawd(ctx, x, y, u, o)
 *  (x, y) = centre of the feet line, u = pixel unit in px.
 *  o: { pose, flip, rot, sx, sy, blink(0..1), eyes:'normal'|'happy'|'closed'|'wide'|'x',
 *       walk (phase 0..1 or null), alpha, hat, prop, propK, shadow, outline, seed, color, grid }
 */
function drawClawd(ctx, x, y, u, o = {}) {
  const cells = decodeClawd(o.pose ?? 'default');
  const qh = CLAWD_QH;
  const seed = o.seed ?? 11;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.translate(x, y);
  // ground shadow
  if (o.shadow !== false) {
    const sh = o.shadowScale ?? 1;
    ctx.save();
    ctx.fillStyle = 'rgba(20,20,19,0.13)';
    ctx.beginPath(); ctx.ellipse((o.shadowX ?? 0), 2, CLAWD_W * u * 0.42 * sh, u * 0.9 * sh, 0, 0, TAU); ctx.fill();
    ctx.restore();
    if (o.lift) ctx.translate(0, -o.lift);
  }
  ctx.rotate(o.rot ?? 0);
  ctx.scale((o.flip ? -1 : 1) * (o.sx ?? 1), o.sy ?? 1);
  ctx.translate(-CLAWD_W * u / 2, -CLAWD_H * u);

  // 8-bit "materialise": pixels switch on in a scrambled order
  if (o.reveal !== undefined && o.reveal < 1) {
    cells.forEach((c, i) => {
      const rank = (hashStr('px', c.x, c.y) % 1000) / 1000;
      if (rank > o.reveal) return;
      const pop = clamp((o.reveal - rank) * 6);
      const s = E.outBack(pop, 3);
      const cw = u, ch = qh * u;
      ctx.save(); ctx.translate(c.x * u + cw / 2, c.y * qh * u + ch / 2); ctx.scale(s, s);
      ctx.fillStyle = c.k === 'eye' ? PAL.ink : (o.color ?? PAL.clawd);
      ctx.fillRect(-cw / 2 - 0.6, -ch / 2 - 0.6, cw + 1.2, ch + 1.2);
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = Math.max(1, u * 0.14); ctx.strokeRect(-cw / 2, -ch / 2, cw, ch);
      ctx.restore();
    });
    ctx.restore();
    return;
  }

  // walking: alternate leg pairs are lifted, body bobs
  let bob = 0; const legLift = {};
  if (o.walk !== undefined && o.walk !== null) {
    const ph = ((o.walk % 1) + 1) % 1;
    const a = ph < 0.5;
    legLift[3] = a ? 1 : 0; legLift[13] = a ? 1 : 0; legLift[5] = a ? 0 : 1; legLift[15] = a ? 0 : 1;
    bob = Math.abs(Math.sin(ph * TAU)) * u * 0.6;
  }
  if (o.tuck) { legLift[3] = legLift[5] = legLift[13] = legLift[15] = 1; }

  const body = o.color ?? PAL.clawd;
  const bodyCells = cells.filter(c => c.k !== 'leg');
  const legCells = cells.filter(c => c.k === 'leg');
  const R = RNG(seed, G.boil);
  const jig = () => (R() - 0.5) * u * 0.08;

  // --- fills
  ctx.save();
  ctx.translate(0, -bob);
  ctx.fillStyle = body;
  for (const c of bodyCells) {
    ctx.fillRect(c.x * u - 0.6, c.y * qh * u - 0.6, u + 1.2, qh * u + 1.2);
  }
  ctx.restore();
  for (const c of legCells) {
    const lift = legLift[c.x] ? 0.5 : 0;
    ctx.fillStyle = body;
    ctx.fillRect(c.x * u - 0.6, c.y * qh * u - 0.6, u + 1.2, qh * u * (1 - lift) + 1.2);
  }

  ctx.save();
  ctx.translate(0, -bob);
  // marker shading: short diagonal hatch on the lower body rows
  ctx.save();
  ctx.beginPath();
  for (const c of bodyCells) if (c.k === 'body' && c.y >= 3) ctx.rect(c.x * u, c.y * qh * u, u, qh * u);
  ctx.clip();
  ctx.strokeStyle = PAL.clayDeep; ctx.lineWidth = Math.max(1.2, u * 0.16); ctx.lineCap = 'round';
  ctx.globalAlpha *= 0.55;
  ctx.beginPath();
  const hr = RNG(seed, 'hatch', G.boil);
  for (let d = -CLAWD_H * u; d < CLAWD_W * u; d += u * 0.9) {
    const j = (hr() - 0.5) * u * 0.3;
    ctx.moveTo(d + j, CLAWD_H * u); ctx.lineTo(d + j + CLAWD_H * u, 0);
  }
  ctx.stroke();
  ctx.restore();

  // faint pixel grid so it reads unmistakably as 8-bit
  if (o.grid !== false) {
    ctx.save();
    ctx.strokeStyle = 'rgba(20,20,19,0.09)'; ctx.lineWidth = Math.max(0.8, u * 0.06);
    ctx.beginPath();
    for (const c of bodyCells) if (c.k === 'body') { ctx.rect(c.x * u, c.y * qh * u, u, qh * u); }
    ctx.stroke();
    ctx.restore();
  }

  // --- eyes
  const eyes = o.eyes ?? 'normal';
  const blink = clamp(o.blink ?? 0);
  const eyeCells = cells.filter(c => c.k === 'eye');
  ctx.fillStyle = PAL.ink;
  for (const c of eyeCells) {
    const ex = c.x * u, ey = c.y * qh * u, eh = qh * u;
    if (eyes === 'happy') {
      // ^ ^
      ctx.save(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = u * 0.42; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(ex - u * 0.35, ey + eh * 0.85); ctx.lineTo(ex + u * 0.5, ey + eh * 0.2); ctx.lineTo(ex + u * 1.35, ey + eh * 0.85); ctx.stroke();
      ctx.restore();
    } else if (eyes === 'x') {
      ctx.save(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = u * 0.34; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - u * 0.2, ey + eh * 0.15); ctx.lineTo(ex + u * 1.2, ey + eh * 0.85); ctx.moveTo(ex + u * 1.2, ey + eh * 0.15); ctx.lineTo(ex - u * 0.2, ey + eh * 0.85); ctx.stroke();
      ctx.restore();
    } else if (eyes === 'closed' || blink > 0.5) {
      ctx.fillRect(ex - u * 0.15 + jig(), ey + eh * 0.62, u * 1.3, eh * 0.2);
    } else if (eyes === 'wide') {
      ctx.fillRect(ex - u * 0.2 + jig(), ey - eh * 0.2 + jig(), u * 1.4, eh * 1.25);
      ctx.fillStyle = PAL.ivory; ctx.fillRect(ex + u * 0.35, ey + eh * 0.02, u * 0.45, eh * 0.28); ctx.fillStyle = PAL.ink;
    } else {
      const k = 1 - blink * 1.6;
      ctx.fillRect(ex + jig(), ey + eh * (1 - Math.max(0.15, k)) + jig(), u, eh * Math.max(0.15, k));
    }
  }

  // --- ink outline (silhouette edges, merged, drawn with a slightly shaky pen)
  if (o.outline !== false) {
    const filled = new Set(cells.filter(c => c.k !== 'leg').map(c => c.x + ',' + c.y));
    const segs = clawdEdges(filled, u, qh);
    const ow = o.outlineW ?? Math.max(2, u * 0.34);
    let i = 0;
    for (const s of segs) {
      const r = RNG(seed, 'e', i++, G.boil);
      const ov = u * 0.18;
      const dx = s[2] - s[0], dy = s[3] - s[1], L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;
      const x1 = s[0] - ux * ov * r() + (r() - 0.5) * u * 0.1, y1 = s[1] - uy * ov * r() + (r() - 0.5) * u * 0.1;
      const x2 = s[2] + ux * ov * r() + (r() - 0.5) * u * 0.1, y2 = s[3] + uy * ov * r() + (r() - 0.5) * u * 0.1;
      const mx = (x1 + x2) / 2 + (r() - 0.5) * u * 0.12, my = (y1 + y2) / 2 + (r() - 0.5) * u * 0.12;
      inkStroke(ctx, [[x1, y1, 0], [mx, my, L / 2], [x2, y2, L]], { w: ow, taper: 0.08, seed: i, pressure: 0.2 });
    }
  }
  ctx.restore();

  // legs outline (they move independently of the bob)
  if (o.outline !== false) {
    const ow = o.outlineW ?? Math.max(2, u * 0.34);
    let i = 0;
    for (const c of legCells) {
      const lift = legLift[c.x] ? 0.5 : 0;
      const x0 = c.x * u, y0 = c.y * qh * u - bob * 0, h = qh * u * (1 - lift);
      const r = RNG(seed, 'l', i++, G.boil);
      const j = () => (r() - 0.5) * u * 0.1;
      inkStroke(ctx, [[x0 + j(), y0, 0], [x0 + j(), y0 + h + j(), h]], { w: ow, taper: 0.1, seed: i });
      inkStroke(ctx, [[x0 + u + j(), y0, 0], [x0 + u + j(), y0 + h + j(), h]], { w: ow, taper: 0.1, seed: i + 9 });
      inkStroke(ctx, [[x0 + j() - u * 0.1, y0 + h, 0], [x0 + u + j() + u * 0.1, y0 + h, u]], { w: ow, taper: 0.1, seed: i + 19 });
    }
  }

  // accessories live in Clawd's pixel space: (0,0) top-left, 18u wide, 10u tall
  ctx.translate(0, -bob);
  if (o.hat) {
    ctx.save();
    if (o.hatDrop !== undefined) { const k = clamp(o.hatDrop); ctx.translate(0, -(1 - E.outBounce(k)) * u * 34); ctx.rotate((1 - k) * 0.4); }
    drawHat(ctx, o.hat, u, o);
    ctx.restore();
  }
  if (o.glasses) drawGlasses(ctx, u);
  if (o.tie) drawTie(ctx, u);
  if (o.prop) drawProp(ctx, o.prop, u, o);
  ctx.restore();
}

function clawdEdges(filled, u, qh) {
  const has = (x, y) => filled.has(x + ',' + y);
  const H = [], V = [];
  for (const key of filled) {
    const [x, y] = key.split(',').map(Number);
    if (!has(x, y - 1)) H.push([y, x, 'top']);
    if (!has(x, y + 1)) H.push([y + 1, x, 'bot']);
    if (!has(x - 1, y)) V.push([x, y, 'l']);
    if (!has(x + 1, y)) V.push([x + 1, y, 'r']);
  }
  const segs = [];
  // merge horizontal runs
  const hk = {};
  for (const [yy, x, s] of H) (hk[yy + s] = hk[yy + s] || { y: yy, xs: [] }).xs.push(x);
  for (const k in hk) {
    const { y, xs } = hk[k]; xs.sort((a, b) => a - b);
    let s0 = xs[0], prev = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      if (i < xs.length && xs[i] === prev + 1) { prev = xs[i]; continue; }
      segs.push([s0 * u, y * qh * u, (prev + 1) * u, y * qh * u]);
      if (i < xs.length) { s0 = xs[i]; prev = xs[i]; }
    }
  }
  const vk = {};
  for (const [x, yy, s] of V) (vk[x + s] = vk[x + s] || { x, ys: [] }).ys.push(yy);
  for (const k in vk) {
    const { x, ys } = vk[k]; ys.sort((a, b) => a - b);
    let s0 = ys[0], prev = ys[0];
    for (let i = 1; i <= ys.length; i++) {
      if (i < ys.length && ys[i] === prev + 1) { prev = ys[i]; continue; }
      segs.push([x * u, s0 * qh * u, x * u, (prev + 1) * qh * u]);
      if (i < ys.length) { s0 = ys[i]; prev = ys[i]; }
    }
  }
  return segs;
}

/* --------------------------------------------------------------- hats --- */
function drawHat(ctx, hat, u, o) {
  const cx = 9 * u, top = 0;
  const sd = 900 + hashStr(hat) % 97;
  switch (hat) {
    case 'hardhat':
      sketch(ctx, [...shp.arc(cx, top + u * 0.4, u * 6.2, Math.PI, TAU, 24)], { fill: '#EDB547', w: u * 0.34, seed: sd, amp: u * 0.08, fillOffset: [u * 0.15, u * 0.2] });
      sketch(ctx, shp.rrect(cx - u * 8, top - u * 0.1, u * 16, u * 1.1, u * 0.5), { fill: '#EDB547', w: u * 0.34, seed: sd + 1, amp: u * 0.06, fillOffset: [u * 0.15, u * 0.2] });
      line(ctx, cx, top - u * 5.6, cx, top - u * 0.4, { w: u * 0.28, seed: sd + 2, amp: u * 0.05 });
      break;
    case 'chef': {
      const puffs = [[cx - u * 3.2, top - u * 4.6, u * 2.6], [cx, top - u * 5.8, u * 3], [cx + u * 3.2, top - u * 4.6, u * 2.6]];
      for (const [px, py, r] of puffs) sketch(ctx, shp.ellipse(px, py, r, r * 0.9, 30), { fill: PAL.ivory, w: u * 0.3, seed: sd + px, amp: u * 0.08, fillOffset: [0, 0] });
      sketch(ctx, shp.rect(cx - u * 4.8, top - u * 3.6, u * 9.6, u * 3.4), { fill: PAL.ivory, w: u * 0.3, seed: sd + 5, amp: u * 0.06, fillOffset: [0, 0] });
      break;
    }
    case 'grad':
      sketch(ctx, [[cx - u * 8, top - u * 3.2], [cx, top - u * 5.4], [cx + u * 8, top - u * 3.2], [cx, top - u * 1.2]], { fill: PAL.ink, w: u * 0.3, seed: sd, amp: u * 0.06, fillOffset: [0, 0] });
      sketch(ctx, shp.rect(cx - u * 4.4, top - u * 2.4, u * 8.8, u * 2.4), { fill: PAL.ink, w: u * 0.3, seed: sd + 1, amp: u * 0.06, fillOffset: [0, 0] });
      line(ctx, cx, top - u * 3.3, cx + u * 6.4, top - u * 2.2, { w: u * 0.25, stroke: PAL.clay, seed: sd + 2 });
      line(ctx, cx + u * 6.4, top - u * 2.2, cx + u * 6.6, top + u * 1.6, { w: u * 0.3, stroke: PAL.clay, seed: sd + 3 });
      break;
    case 'beret':
      sketch(ctx, shp.ellipse(cx - u * 1.2, top - u * 1.4, u * 6.6, u * 2.4, 30, 0), { fill: PAL.fig, w: u * 0.3, seed: sd, amp: u * 0.08 });
      line(ctx, cx - u * 1.2, top - u * 3.8, cx - u * 0.6, top - u * 5.1, { w: u * 0.35, seed: sd + 1 });
      break;
    case 'detective':
      sketch(ctx, shp.arc(cx, top + u * 0.2, u * 5.8, Math.PI, TAU, 22), { fill: PAL.kraft, w: u * 0.3, seed: sd, amp: u * 0.08, hatch: { gap: u * 0.9, w: u * 0.12, alpha: 0.5, angle: Math.PI / 4 } });
      sketch(ctx, shp.rrect(cx - u * 8.4, top - u * 0.5, u * 16.8, u * 1.2, u * 0.6), { fill: PAL.kraft, w: u * 0.3, seed: sd + 1, amp: u * 0.06 });
      break;
    case 'crown':
      sketch(ctx, [[cx - u * 5.5, top], [cx - u * 6, top - u * 5], [cx - u * 3, top - u * 2.6], [cx, top - u * 6], [cx + u * 3, top - u * 2.6], [cx + u * 6, top - u * 5], [cx + u * 5.5, top]], { fill: '#EDB547', w: u * 0.3, seed: sd, amp: u * 0.06 });
      break;
    case 'headset':
      sketch(ctx, shp.arc(cx, top + u * 3.4, u * 8.2, Math.PI * 1.08, Math.PI * 1.92, 24), { closed: false, fill: null, w: u * 0.55, seed: sd, amp: u * 0.06 });
      sketch(ctx, shp.rrect(-u * 0.6, top + u * 1.6, u * 2.4, u * 3.6, u * 0.8), { fill: PAL.ink, w: u * 0.3, seed: sd + 1 });
      sketch(ctx, shp.rrect(u * 16.2, top + u * 1.6, u * 2.4, u * 3.6, u * 0.8), { fill: PAL.ink, w: u * 0.3, seed: sd + 2 });
      line(ctx, u * 17, top + u * 5, u * 13, top + u * 7.5, { w: u * 0.3, seed: sd + 3 });
      sketch(ctx, shp.ellipse(u * 12.6, top + u * 7.6, u * 0.8, u * 0.8, 12), { fill: PAL.ink, w: u * 0.2, seed: sd + 4 });
      break;
    case 'tophat':
      sketch(ctx, shp.rect(cx - u * 4, top - u * 7, u * 8, u * 6.8), { fill: PAL.ink, w: u * 0.3, seed: sd, amp: u * 0.05 });
      sketch(ctx, shp.rect(cx - u * 4, top - u * 2.4, u * 8, u * 1.1), { fill: PAL.clay, w: u * 0.25, seed: sd + 1, amp: u * 0.05 });
      sketch(ctx, shp.rrect(cx - u * 7, top - u * 0.8, u * 14, u * 1.2, u * 0.5), { fill: PAL.ink, w: u * 0.3, seed: sd + 2, amp: u * 0.05 });
      break;
    case 'pilot':
      sketch(ctx, shp.arc(cx, top + u * 0.4, u * 6.4, Math.PI, TAU, 22), { fill: PAL.slateMed, w: u * 0.3, seed: sd, amp: u * 0.06 });
      sketch(ctx, shp.rect(cx - u * 7.5, top - u * 0.6, u * 15, u * 1.2), { fill: PAL.ink, w: u * 0.3, seed: sd + 1 });
      sketch(ctx, shp.star(cx, top - u * 3.2, u * 1.6, u * 0.7, 5), { fill: '#EDB547', w: u * 0.2, seed: sd + 2 });
      break;
    case 'party':
      sketch(ctx, [[cx - u * 3.6, top + u * 0.2], [cx + u * 0.4, top - u * 8], [cx + u * 3.8, top + u * 0.2]], { fill: PAL.sky, w: u * 0.3, seed: sd, hatch: { gap: u * 1.2, w: u * 0.25, color: PAL.ivory, alpha: 0.9 } });
      sketch(ctx, shp.ellipse(cx + u * 0.4, top - u * 8.4, u * 1.1, u * 1.1, 14), { fill: PAL.clay, w: u * 0.2, seed: sd + 1 });
      break;
    case 'mirror': // doctor's head mirror
      line(ctx, u * 2, top + u * 0.8, u * 16, top + u * 0.8, { w: u * 0.6, seed: sd });
      sketch(ctx, shp.ellipse(cx, top - u * 1.8, u * 2.6, u * 2.6, 24), { fill: PAL.chartCloud, w: u * 0.35, seed: sd + 1 });
      sketch(ctx, shp.ellipse(cx, top - u * 1.8, u * 0.8, u * 0.8, 12), { fill: PAL.ink, w: u * 0.1, seed: sd + 2 });
      break;
    case 'hood': // hacker hoodie hood
      sketch(ctx, [...shp.arc(cx, top + u * 4, u * 9.8, Math.PI * 1.02, Math.PI * 1.98, 26)], { closed: false, w: u * 0.5, seed: sd });
      break;
  }
}
function drawGlasses(ctx, u) {
  const y = CLAWD_QH * u * 1.5;
  sketch(ctx, shp.ellipse(u * 5.5, y, u * 1.9, u * 1.7, 18), { fill: 'rgba(250,249,245,0.35)', w: u * 0.3, seed: 71, fillOffset: [0, 0] });
  sketch(ctx, shp.ellipse(u * 13.5, y, u * 1.9, u * 1.7, 18), { fill: 'rgba(250,249,245,0.35)', w: u * 0.3, seed: 72, fillOffset: [0, 0] });
  line(ctx, u * 7.4, y - u * 0.3, u * 11.6, y - u * 0.3, { w: u * 0.3, seed: 73 });
}
function drawTie(ctx, u) {
  const cx = 9 * u, y = CLAWD_QH * u * 2.1;
  sketch(ctx, [[cx - u * 0.9, y], [cx + u * 0.9, y], [cx + u * 0.5, y + u * 0.9], [cx + u * 1.3, y + u * 4.6], [cx, y + u * 5.6], [cx - u * 1.3, y + u * 4.6], [cx - u * 0.5, y + u * 0.9]],
    { fill: PAL.sky, w: u * 0.28, seed: 74, amp: u * 0.05, fillOffset: [0, 0] });
}

/* -------------------------------------------------------------- props --- */
function drawProp(ctx, prop, u, o) {
  const k = o.propK ?? 1;
  const handR = [17.6 * u, CLAWD_QH * u * 2.5];     // right arm tip
  switch (prop) {
    case 'pencil': {
      ctx.save();
      ctx.translate(handR[0], handR[1]);
      ctx.rotate(o.propRot ?? -0.9);
      const L = u * 14 * k, w = u * 2.2;
      sketch(ctx, shp.rect(0, -w / 2, L, w), { fill: '#EDB547', w: u * 0.28, seed: 81, amp: u * 0.05, fillOffset: [0, 0] });
      sketch(ctx, shp.rect(L, -w / 2, u * 1.6, w), { fill: PAL.coral, w: u * 0.28, seed: 82, amp: u * 0.05, fillOffset: [0, 0] });
      sketch(ctx, [[0, -w / 2], [-u * 3, 0], [0, w / 2]], { fill: PAL.manilla, w: u * 0.28, seed: 83, amp: u * 0.05, fillOffset: [0, 0] });
      sketch(ctx, [[-u * 2.1, -w * 0.15], [-u * 3, 0], [-u * 2.1, w * 0.15]], { fill: PAL.ink, w: u * 0.2, seed: 84, fillOffset: [0, 0] });
      ctx.restore();
      break;
    }
    case 'flag': {
      const px = handR[0] + u * 0.5, py = handR[1];
      line(ctx, px, py + u * 2, px, py - u * 14, { w: u * 0.45, seed: 85 });
      const wave = Math.sin(G.t * 9) * u * 0.8;
      sketch(ctx, [[px, py - u * 14], [px + u * 9, py - u * 12.5 + wave], [px + u * 9, py - u * 7.5 + wave], [px, py - u * 8.4]], { fill: PAL.ivory, w: u * 0.3, seed: 86, fillOffset: [0, 0] });
      drawSparkMark(ctx, px + u * 4.5, py - u * 10.6 + wave / 2, u * 2.2, G.t * 2);
      break;
    }
    case 'magnifier': {
      ctx.save(); ctx.translate(handR[0] + u, handR[1] - u); ctx.rotate(o.propRot ?? -0.5);
      line(ctx, 0, 0, u * 5, -u * 1, { w: u * 1.1, seed: 87 });
      sketch(ctx, shp.ellipse(u * 9, -u * 1.8, u * 4.2, u * 4.2, 30), { fill: 'rgba(197,211,224,0.55)', w: u * 0.55, seed: 88, fillOffset: [0, 0] });
      ctx.restore();
      break;
    }
    case 'baton': {
      ctx.save(); ctx.translate(handR[0], handR[1]); ctx.rotate(o.propRot ?? -1.1);
      line(ctx, 0, 0, u * 10, 0, { w: u * 0.5, seed: 89 });
      ctx.restore();
      break;
    }
    case 'laptop': {
      const lx = 9 * u, ly = CLAWD_QH * u * 3.4;
      sketch(ctx, [[lx - u * 6, ly], [lx + u * 6, ly], [lx + u * 7.2, ly + u * 1.2], [lx - u * 7.2, ly + u * 1.2]], { fill: PAL.cloud, w: u * 0.28, seed: 90, fillOffset: [0, 0] });
      break;
    }
  }
}

// small spark glyph used as a mark on props / flags
function drawSparkMark(ctx, cx, cy, size, rot = 0, color = PAL.clay) {
  if (!SPARK) return;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  const s = size / 125;
  ctx.scale(s, s); ctx.translate(-SPARK.cx, -SPARK.cy);
  ctx.fillStyle = color; ctx.fill(SPARK.path);
  ctx.restore();
}
