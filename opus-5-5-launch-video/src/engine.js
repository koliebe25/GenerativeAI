/* ============================================================================
 * engine.js — a tiny hand-drawn canvas engine.
 * Everything is a pure function of time t, so any frame can be rendered in any
 * order (the renderer uses several headless Chromium workers in parallel).
 * ==========================================================================*/
'use strict';

const W = 1920, H = 1080, FPS = 30;
const BOIL_FPS = 10;              // line "boil": drawings are re-inked 10x per second

// Anthropic brand swatches (pulled from anthropic.com CSS variables)
const PAL = {
  ivory: '#FAF9F5', paper: '#F0EEE6', ivoryDark: '#E8E6DC', slate250: '#DEDCD1',
  ink: '#141413', slateMed: '#3D3D3A', slateLight: '#5E5D59', cloudDark: '#87867F',
  cloud: '#B0AEA5', cloudLight: '#D1CFC5',
  clay: '#D97757', clayDeep: '#C8674A', clawd: '#D77757',   // rgb(215,119,87) = Claude Code's clawd_body
  oat: '#E3DACC', kraft: '#D4A27F', manilla: '#EBDBBC', coral: '#EBCECE', fig: '#C46686',
  heather: '#CBCADB', olive: '#788C5D', cactus: '#BCD1CA', sky: '#6A9BCC', chartCloud: '#C5D3E0',
};

const FONT = {
  serif: '"Anthropic Serif", "Tiempos Headline", Georgia, serif',
  sans: '"Anthropic Sans", "Styrene B", "Helvetica Neue", Arial, sans-serif',
  mono: '"Anthropic Mono", "JetBrains Mono", Menlo, monospace',
};

/* ---------------------------------------------------------------- math --- */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));           // 0..1 ramp on [a,b]
const TAU = Math.PI * 2;
const E = {
  lin: t => t,
  inQ: t => t * t,
  outQ: t => 1 - (1 - t) * (1 - t),
  inC: t => t * t * t,
  outC: t => 1 - Math.pow(1 - t, 3),
  inOutC: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  outBounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};
// ramp with easing: ease(t, a, b, fn)
const ez = (t, a, b, fn = E.outC) => fn(prog(t, a, b));

/* ----------------------------------------------------------- randomness --- */
function hashStr(...args) {
  let h = 2166136261 >>> 0;
  for (const a of args) {
    const s = String(a);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 0x9e3779b9; h = Math.imul(h, 2246822507) >>> 0;
  }
  return h >>> 0;
}
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RNG = (...k) => mulberry(hashStr(...k));
function hashf(seed, i) {                       // deterministic [-1,1]
  let h = Math.imul((seed ^ Math.imul(i | 0, 374761393)) >>> 0, 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 1274126177) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
  return (h / 4294967296) * 2 - 1;
}
function vnoise(seed, x) {                      // smooth 1D value noise in [-1,1]
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hashf(seed, i), hashf(seed, i + 1), u);
}

/* --------------------------------------------------------- frame state --- */
const G = { t: 0, frame: 0, boil: 0, seedCounter: 0, ctx: null };
function setTime(t) {
  G.t = t; G.frame = Math.round(t * FPS); G.boil = Math.floor(t * BOIL_FPS + 1e-6);
}
function nextSeed() { return (G.seedCounter++) * 7919 + 17; }
function resetSeeds(base = 0) { G.seedCounter = base; }

/* ----------------------------------------------------------- polylines --- */
function resample(pts, spacing, closed = false) {
  const src = closed ? pts.concat([pts[0]]) : pts;
  const out = [];
  if (src.length < 2) return src.slice();
  let carry = 0;
  out.push([src[0][0], src[0][1], 0]);
  let L = 0;
  for (let i = 1; i < src.length; i++) {
    const [x0, y0] = src[i - 1], [x1, y1] = src[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (seg === 0) continue;
    let d = spacing - carry;
    while (d <= seg) {
      const k = d / seg;
      out.push([x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, L + d]);
      d += spacing;
    }
    carry = seg - (d - spacing);
    L += seg;
  }
  const last = src[src.length - 1];
  if (!closed) out.push([last[0], last[1], L]);
  out.totalLength = L;
  return out;
}
function polyLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }

// displace points along their normals with smooth noise → hand-drawn wobble
function wobble(pts, amp, wavelength, seed, closed = false) {
  const n = pts.length, out = new Array(n);
  const L = pts.totalLength || polyLength(pts) || 1;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const s = p[2] !== undefined ? p[2] : i;
    let o = vnoise(seed, s / wavelength) + 0.35 * vnoise(seed + 99, s / (wavelength * 0.37));
    if (closed) {                                  // blend end into start so the loop closes
      const k = s / L;
      if (k > 0.85) o = lerp(o, vnoise(seed, (s - L) / wavelength), (k - 0.85) / 0.15);
    }
    out[i] = [p[0] - ty * o * amp, p[1] + tx * o * amp, s];
  }
  out.totalLength = L;
  return out;
}

// smooth path through points (quadratic midpoints)
function tracePath(ctx, pts, closed = false) {
  const n = pts.length;
  if (n < 2) return;
  if (n === 2) { ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); return; }
  if (closed) {
    const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}

// cut an open polyline to a fraction of its length (draw-on animation)
function partial(pts, t0, t1 = null) {
  if (t1 === null) { t1 = t0; t0 = 0; }
  if (t1 >= 1 && t0 <= 0) return pts;
  const L = pts.totalLength || polyLength(pts);
  const a = t0 * L, b = t1 * L;
  const out = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const s = pts[i][2] !== undefined ? pts[i][2] : acc;
    if (i > 0 && pts[i][2] === undefined) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (s >= a && s <= b) out.push(pts[i]);
  }
  out.totalLength = b - a;
  return out;
}

/* --------------------------------------------------------- ink strokes --- */
/**
 * Variable-width ink stroke built as a filled polygon (tapered ends, pressure noise).
 * o: { w, color, taper, alpha, closed, seed, pressure }
 */
function inkStroke(ctx, pts, o = {}) {
  if (pts.length < 2) return;
  if (pts.length < 8 && !o.closed) {             // subdivide short strokes so the taper has room
    const L0 = pts.totalLength || polyLength(pts);
    const sub = [];
    for (let i = 0; i < pts.length - 1; i++) {
      for (let k = 0; k < 6; k++) {
        const f = k / 6;
        sub.push([lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]);
      }
    }
    sub.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
    let acc = 0;
    for (let i = 0; i < sub.length; i++) { if (i) acc += Math.hypot(sub[i][0] - sub[i - 1][0], sub[i][1] - sub[i - 1][1]); sub[i][2] = acc; }
    sub.totalLength = acc || L0;
    pts = sub;
  }
  const n = pts.length;
  const w = o.w ?? 5, taper = o.taper ?? 0.18, seed = o.seed ?? 1, pr = o.pressure ?? 0.28;
  const L = pts.totalLength || polyLength(pts) || 1;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const s = (p[2] !== undefined ? p[2] : (i / (n - 1)) * L) / L;
    let k = 1;
    if (!o.closed && taper > 0) {
      const e0 = clamp(s / taper), e1 = clamp((1 - s) / taper);
      k = Math.sin(Math.min(e0, e1) * Math.PI / 2) * 0.82 + 0.18;
    }
    k *= 1 + pr * vnoise(seed + 5, s * 7);
    const hw = (w * k) / 2;
    left.push([p[0] - ty * hw, p[1] + tx * hw]);
    right.push([p[0] + ty * hw, p[1] - tx * hw]);
  }
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.fillStyle = o.color ?? PAL.ink;
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
  if (o.closed) {
    ctx.closePath();
    ctx.moveTo(right[n - 1][0], right[n - 1][1]);
    for (let i = n - 2; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill('nonzero');
  } else {
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * sketch(): the workhorse. Draws a shape given raw points like a hand inker:
 *  - optional flat fill (slightly mis-registered, like a riso print)
 *  - optional hatching
 *  - wobbly variable-width ink outline, optional second "sketch" pass
 * o: { fill, fillOffset:[dx,dy], stroke, w, closed, rough, wave, seed, progress, hatch, double, alpha, taper }
 */
function sketch(ctx, pts, o = {}) {
  const closed = o.closed ?? true;
  const seed = (o.seed ?? nextSeed()) + G.boil * 131;
  const rough = o.rough ?? 1;
  const spacing = o.spacing ?? 7;
  const rs = resample(pts, spacing, closed);
  const amp = (o.amp ?? 1.6) * rough;
  const wave = o.wave ?? 60;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  if (o.fill) {
    const [dx, dy] = o.fillOffset ?? [4, 5];
    const fp = wobble(rs, amp * 1.2, wave * 1.3, seed + 3, closed);
    ctx.save();
    ctx.translate(dx * rough, dy * rough);
    ctx.fillStyle = o.fill;
    ctx.beginPath(); tracePath(ctx, fp, true); ctx.fill();
    ctx.restore();
  }
  if (o.hatch) hatchFill(ctx, rs, { seed, ...o.hatch });
  if (o.stroke !== null && o.stroke !== false) {
    let sp = wobble(rs, amp, wave, seed, closed);
    if (o.progress !== undefined && o.progress < 1) {
      if (o.progress <= 0) { ctx.restore(); return; }
      sp = partial(sp, o.progress);
      inkStroke(ctx, sp, { w: o.w ?? 5, color: o.stroke ?? PAL.ink, taper: o.taper ?? 0.12, seed, closed: false });
    } else {
      if (closed) {
        // overshoot the closing point a little, like a real pen
        const over = Math.min(sp.length - 1, 3);
        const open = sp.concat(sp.slice(0, over + 1));
        open.totalLength = (sp.totalLength || polyLength(sp)) * (1 + over / sp.length);
        inkStroke(ctx, open, { w: o.w ?? 5, color: o.stroke ?? PAL.ink, taper: o.taper ?? 0.06, seed, closed: false });
      } else {
        inkStroke(ctx, sp, { w: o.w ?? 5, color: o.stroke ?? PAL.ink, taper: o.taper ?? 0.2, seed, closed: false });
      }
    }
    if (o.double) {
      const sp2 = wobble(rs, amp * 1.8, wave * 0.8, seed + 77, closed);
      inkStroke(ctx, closed ? sp2.concat([sp2[0]]) : sp2, { w: (o.w ?? 5) * 0.45, color: o.stroke ?? PAL.ink, alpha: 0.55, taper: 0.3, seed: seed + 1 });
    }
  }
  ctx.restore();
}

function hatchFill(ctx, pts, o = {}) {
  const angle = o.angle ?? -Math.PI / 4, gap = o.gap ?? 12, w = o.w ?? 2, color = o.color ?? PAL.ink;
  const seed = o.seed ?? 1;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 4;
  ctx.save();
  ctx.beginPath(); tracePath(ctx, pts, true); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.globalAlpha *= o.alpha ?? 0.9;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const r = RNG(seed, 'h');
  ctx.beginPath();
  for (let d = -R; d <= R; d += gap) {
    const j = (r() - 0.5) * gap * 0.35;
    const ox = cx - sa * (d + j), oy = cy + ca * (d + j);
    const bow = (r() - 0.5) * 6;
    ctx.moveTo(ox - ca * R + (r() - 0.5) * 8, oy - sa * R);
    ctx.quadraticCurveTo(ox - sa * bow, oy + ca * bow, ox + ca * R, oy + sa * R + (r() - 0.5) * 8);
  }
  ctx.stroke();
  ctx.restore();
}

/* -------------------------------------------------------- shape helpers --- */
const shp = {
  rect: (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
  rrect: (x, y, w, h, r) => {
    const pts = [], seg = 5;
    const corners = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
    for (const [cx, cy, a0] of corners) for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return pts;
  },
  ellipse: (cx, cy, rx, ry = rx, n = 48, a0 = 0) => {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return pts;
  },
  arc: (cx, cy, r, a0, a1, n = 40) => {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return pts;
  },
  line: (x1, y1, x2, y2) => [[x1, y1], [x2, y2]],
  star: (cx, cy, r1, r2, n = 5, a0 = -Math.PI / 2) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) { const a = a0 + (i / (n * 2)) * TAU; const r = i % 2 ? r2 : r1; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return pts;
  },
};
function line(ctx, x1, y1, x2, y2, o = {}) { sketch(ctx, shp.line(x1, y1, x2, y2), { closed: false, ...o }); }

/* ---------------------------------------------------------------- text --- */
function setFont(ctx, family, size, weight = 400, italic = false) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
}
/**
 * Hand-set type. Glyph positions come from measureText on prefixes (kerning is kept),
 * then each glyph gets a tiny boil jitter and optional per-glyph entrance animation.
 * o: { family, size, weight, italic, color, align, baseline, jitter, reveal(0..1), mode:'type'|'drop'|'pop'|'fade', tracking, stagger, alpha, shadow }
 */
function text(ctx, str, x, y, o = {}) {
  const fam = o.family ?? FONT.serif, size = o.size ?? 64, weight = o.weight ?? 400;
  setFont(ctx, fam, size, weight, o.italic);
  ctx.save();
  ctx.letterSpacing = (o.tracking ?? 0) + 'px';
  const total = ctx.measureText(str).width;
  let sx = x;
  if ((o.align ?? 'left') === 'center') sx = x - total / 2;
  else if (o.align === 'right') sx = x - total;
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = o.color ?? PAL.ink;
  ctx.globalAlpha *= o.alpha ?? 1;
  const jit = o.jitter ?? 0.6;
  const reveal = o.reveal ?? 1;
  const mode = o.mode ?? 'type';
  const chars = [...str];
  const n = chars.length;
  const stagger = o.stagger ?? 0.6;               // fraction of reveal spent staggering
  const seedBase = hashStr(str, o.seed ?? 0);
  let prefix = '';
  for (let i = 0; i < n; i++) {
    const ch = chars[i];
    const px = sx + ctx.measureText(prefix).width;
    prefix += ch;
    if (ch === ' ') continue;
    // per-glyph local progress
    let k;
    if (mode === 'type') k = reveal * n - i >= 1 ? 1 : 0;
    else k = clamp((reveal - (i / Math.max(1, n - 1)) * stagger) / (1 - stagger));
    if (k <= 0) continue;
    const r = RNG(seedBase, i, G.boil);
    const jx = (r() - 0.5) * 2 * jit, jy = (r() - 0.5) * 2 * jit, jr = (r() - 0.5) * 0.012 * jit;
    ctx.save();
    const cw = ctx.measureText(ch).width;
    ctx.translate(px + cw / 2 + jx, y + jy);
    ctx.rotate(jr);
    if (mode === 'drop') {
      const e = E.outBack(k, 2.2);
      ctx.translate(0, (1 - e) * -size * 0.9);
      ctx.globalAlpha *= clamp(k * 3);
    } else if (mode === 'pop') {
      const e = E.outBack(k, 3);
      ctx.scale(e, e);
      ctx.globalAlpha *= clamp(k * 4);
    } else if (mode === 'fade') {
      ctx.globalAlpha *= k;
      ctx.translate(0, (1 - E.outC(k)) * size * 0.25);
    }
    if (o.shadow) {                                // offset "print" shadow in a second color
      ctx.save(); ctx.fillStyle = o.shadow; ctx.fillText(ch, -cw / 2 + (o.shadowOffset ?? 5), o.shadowOffset ?? 5); ctx.restore();
    }
    ctx.fillText(ch, -cw / 2, 0);
    ctx.restore();
  }
  ctx.restore();
  return total;
}
function measure(ctx, str, family, size, weight = 400, tracking = 0, italic = false) {
  setFont(ctx, family, size, weight, italic);
  ctx.save(); ctx.letterSpacing = tracking + 'px';
  const w = ctx.measureText(str).width; ctx.restore();
  return w;
}

/* --------------------------------------------------------------- paper --- */
let PAPER_TEX = null;
function buildPaper() {
  // soft, low-frequency fibre texture (static in screen space → compresses well)
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const small = document.createElement('canvas'); small.width = 240; small.height = 135;
  const sg = small.getContext('2d');
  const img = sg.createImageData(240, 135);
  const r = RNG('paper');
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r();
    img.data[i] = 120; img.data[i + 1] = 100; img.data[i + 2] = 80; img.data[i + 3] = Math.floor(v * 18);
  }
  sg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, W, H);
  // a few long fibres
  g.strokeStyle = 'rgba(120,100,80,0.035)'; g.lineWidth = 1.1;
  for (let i = 0; i < 160; i++) {
    const x = r() * W, y = r() * H, a = r() * TAU, l = 10 + r() * 40;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // vignette
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  vg.addColorStop(0, 'rgba(60,40,20,0)'); vg.addColorStop(1, 'rgba(60,40,20,0.10)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  PAPER_TEX = c;
}
function paper(ctx, color = PAL.paper) {
  // fills the current frame (identity at top level, or a storyboard panel when nested)
  ctx.save();
  ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
function paperGrain(ctx, alpha = 1) {
  if (!PAPER_TEX) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha; ctx.drawImage(PAPER_TEX, 0, 0); ctx.restore();
}
// faint dot grid, like a designer's notebook (world space)
function dotGrid(ctx, x0, y0, x1, y1, gap = 48, color = 'rgba(20,20,19,0.10)', r = 2) {
  ctx.save(); ctx.fillStyle = color;
  for (let x = Math.ceil(x0 / gap) * gap; x <= x1; x += gap)
    for (let y = Math.ceil(y0 / gap) * gap; y <= y1; y += gap) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* -------------------------------------------------------------- camera --- */
function camera(ctx, cam) {
  // cam: { x, y, zoom, rot } — world point (x,y) is placed at screen centre
  const z = cam.zoom ?? 1;
  ctx.translate(W / 2 + (cam.sx ?? 0), H / 2 + (cam.sy ?? 0));
  ctx.rotate(cam.rot ?? 0);
  ctx.scale(z, z);
  ctx.translate(-(cam.x ?? W / 2), -(cam.y ?? H / 2));
}
function shake(t, amp, freq = 18, seed = 3) {
  return [vnoise(seed, t * freq) * amp, vnoise(seed + 50, t * freq) * amp];
}

/* ---------------------------------------------------------- flourishes --- */
// radial speed lines around a point (hand drawn)
function speedLines(ctx, cx, cy, o = {}) {
  const n = o.n ?? 28, r0 = o.r0 ?? 300, r1 = o.r1 ?? 1400, seed = (o.seed ?? 9) + G.boil * 7;
  const r = RNG(seed, 'sl');
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (r() - 0.5) * 0.2;
    const a0 = r0 * (0.8 + r() * 0.5), a1 = r1 * (0.7 + r() * 0.4);
    inkStroke(ctx, [[cx + Math.cos(a) * a0, cy + Math.sin(a) * a0, 0], [cx + Math.cos(a) * a1, cy + Math.sin(a) * a1, a1 - a0]],
      { w: (o.w ?? 6) * (0.5 + r()), color: o.color ?? PAL.ink, alpha: o.alpha ?? 0.9, taper: 0.5, seed: i });
  }
}
// horizontal motion streaks
function streaks(ctx, x, y, w, h, o = {}) {
  const n = o.n ?? 10, r = RNG(o.seed ?? 4, G.boil);
  for (let i = 0; i < n; i++) {
    const yy = y + r() * h, len = w * (0.3 + r() * 0.7), xx = x + r() * (w - len);
    inkStroke(ctx, [[xx, yy, 0], [xx + len, yy, len]], { w: (o.w ?? 5) * (0.4 + r()), color: o.color ?? PAL.ink, alpha: o.alpha ?? 0.8, taper: 0.5, seed: i });
  }
}
// little burst of hand-drawn ticks ("!" marks) around a point
function burst(ctx, cx, cy, k, o = {}) {
  if (k <= 0 || k >= 1) return;
  const n = o.n ?? 10, R0 = o.r0 ?? 60, R1 = o.r1 ?? 160;
  const e = E.outC(k);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (o.rot ?? 0);
    const aa = lerp(R0, R1, e);
    const len = (1 - e) * (R1 - R0) * 0.5 + 6;
    inkStroke(ctx, [[cx + Math.cos(a) * aa, cy + Math.sin(a) * aa, 0], [cx + Math.cos(a) * (aa + len), cy + Math.sin(a) * (aa + len), len]],
      { w: o.w ?? 6, color: o.color ?? PAL.ink, taper: 0.3, seed: i });
  }
}
// hand-drawn orange underline swoosh
function swoosh(ctx, x0, y0, x1, y1, k, o = {}) {
  if (k <= 0) return;
  const pts = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([lerp(x0, x1, t), lerp(y0, y1, t) + Math.sin(t * Math.PI) * (o.bow ?? 10)]);
  }
  const rs = resample(pts, 6);
  const wp = wobble(rs, 2, 80, hashStr('sw', x0, y0) + G.boil * 11);
  inkStroke(ctx, partial(wp, E.outC(clamp(k))), { w: o.w ?? 14, color: o.color ?? PAL.clay, taper: 0.35, seed: 2, pressure: 0.4 });
}
