/* ============================================================================
 * brand.js — the real Claude spark + wordmark, with hand-drawn behaviours:
 * trace-on, marker fill, spin, and "shatter into rays".
 * ==========================================================================*/
'use strict';

let SPARK = null, WORDMARK = null;

function initBrand() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  const p = document.createElementNS(svgNS, 'path');
  p.setAttribute('d', CLAUDE_SPARK_PATH);
  svg.appendChild(p); document.body.appendChild(svg);
  const L = p.getTotalLength();
  const N = 1400, pts = [];
  for (let i = 0; i < N; i++) { const q = p.getPointAtLength((i / N) * L); pts.push([q.x, q.y, (i / N) * L]); }
  pts.totalLength = L;
  svg.remove();
  // area centroid
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < N; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % N];
    const c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
  }
  A /= 2; cx /= 6 * A; cy /= 6 * A;
  // find ray tips (local maxima of radius) and valleys → one wedge per ray
  const rad = pts.map(q => Math.hypot(q[0] - cx, q[1] - cy));
  const win = 28, tips = [];
  for (let i = 0; i < N; i++) {
    let isMax = true;
    for (let k = -win; k <= win; k++) if (rad[(i + k + N) % N] > rad[i]) { isMax = false; break; }
    if (isMax && rad[i] > 30) tips.push(i);
  }
  const ang = i => Math.atan2(pts[i][1] - cy, pts[i][0] - cx);
  const tipAngles = tips.map(ang).sort((a, b) => a - b);
  const valleys = [];
  for (let k = 0; k < tipAngles.length; k++) {
    const a0 = tipAngles[k], a1 = k + 1 < tipAngles.length ? tipAngles[k + 1] : tipAngles[0] + TAU;
    valleys.push((a0 + a1) / 2);
  }
  SPARK = { path: new Path2D(CLAUDE_SPARK_PATH), pts, cx, cy, L, tips: tipAngles, valleys, maxR: Math.max(...rad) };
  WORDMARK = new Path2D(CLAUDE_WORDMARK_PATH);
}

/**
 * drawSpark(ctx, x, y, size, o)
 *  size = rendered diameter-ish (the 125-unit box)
 *  o: { rot, trace(0..1), fill(0..1), outline, color, ink, shatter(0..1), shatterDist, hatch, scale }
 */
function drawSpark(ctx, x, y, size, o = {}) {
  if (!SPARK) return;
  const s = size / 125;
  const fillK = o.fill ?? 1, trace = o.trace ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.rot ?? 0);
  ctx.scale(s, s);
  ctx.translate(-SPARK.cx, -SPARK.cy);
  const color = o.color ?? PAL.clay;
  const shat = o.shatter ?? 0;

  const paintFill = () => {
    if (fillK <= 0) return;
    ctx.save();
    if (fillK < 1) {
      // marker scribble reveal: clip to a growing zig-zag band
      ctx.beginPath();
      const band = lerp(-10, 140, E.inOutC(fillK));
      ctx.moveTo(-20, -20); ctx.lineTo(band + 30, -20);
      for (let yy = -20; yy <= 150; yy += 12) ctx.lineTo(band + ((yy / 12) % 2 ? 10 : -10) - yy * 0.25, yy);
      ctx.lineTo(-20, 150); ctx.closePath(); ctx.clip();
    }
    ctx.fillStyle = color;
    ctx.save(); ctx.translate((o.offset ?? 1.6), (o.offset ?? 1.6) * 1.2); ctx.fill(SPARK.path); ctx.restore();
    if (o.hatch !== false) {
      ctx.save(); ctx.clip(SPARK.path);
      ctx.strokeStyle = PAL.clayDeep; ctx.lineWidth = 1.4; ctx.globalAlpha *= 0.5; ctx.lineCap = 'round';
      const r = RNG('sparkhatch', G.boil);
      ctx.beginPath();
      for (let d = -140; d < 260; d += 7) { const j = (r() - 0.5) * 3; ctx.moveTo(d + j, 140); ctx.lineTo(d + j + 70, 70); }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };

  const paintOutline = () => {
    if (o.outline === false || trace <= 0) return;
    const wob = wobble(SPARK.pts, o.amp ?? 0.9, 26, 5 + G.boil * 17, true);
    const seq = trace < 1 ? partial(wob, E.inOutC(trace)) : wob.concat([wob[0], wob[1]]);
    if (trace >= 1) seq.totalLength = SPARK.L;
    inkStroke(ctx, seq, { w: (o.ink ?? 3.2), color: o.inkColor ?? PAL.ink, taper: trace < 1 ? 0.04 : 0.02, seed: 8, pressure: 0.35 });
  };

  if (shat > 0) {
    // one wedge per ray, flung outward
    const V = SPARK.valleys, n = V.length;
    for (let k = 0; k < n; k++) {
      const a0 = V[k], a1 = k + 1 < n ? V[k + 1] : V[0] + TAU;
      const mid = (a0 + a1) / 2;
      const dist = (o.shatterDist ?? 90) * E.outC(shat) * (0.8 + 0.4 * ((k * 37) % 7) / 7);
      ctx.save();
      ctx.translate(SPARK.cx + Math.cos(mid) * dist, SPARK.cy + Math.sin(mid) * dist);
      ctx.rotate(shat * ((k % 2) ? 1.2 : -1.2) * (0.5 + (k % 3) * 0.3));
      ctx.translate(-SPARK.cx, -SPARK.cy);
      ctx.beginPath(); ctx.moveTo(SPARK.cx, SPARK.cy);
      for (let i = 0; i <= 12; i++) { const a = lerp(a0, a1, i / 12); ctx.lineTo(SPARK.cx + Math.cos(a) * 200, SPARK.cy + Math.sin(a) * 200); }
      ctx.closePath(); ctx.clip();
      ctx.globalAlpha *= 1 - E.inQ(clamp((shat - 0.55) / 0.45));
      paintFill(); paintOutline();
      ctx.restore();
    }
  } else {
    paintFill(); paintOutline();
  }
  ctx.restore();
}

/** Official lockup: spark + "Claude" wordmark. (x,y) = top-left, h = height in px. */
function drawLockup(ctx, x, y, h, o = {}) {
  const s = h / 125;
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const wipe = o.wipe ?? 1;
  // spark (can spin around its own centroid)
  ctx.save();
  ctx.translate(SPARK.cx, SPARK.cy); ctx.rotate(o.sparkRot ?? 0); ctx.scale(o.sparkScale ?? 1, o.sparkScale ?? 1); ctx.translate(-SPARK.cx, -SPARK.cy);
  ctx.fillStyle = PAL.clay; ctx.fill(SPARK.path);
  ctx.restore();
  // wordmark with a left→right ink wipe
  ctx.save();
  ctx.beginPath(); ctx.rect(140, -20, lerp(0, 450, wipe), 170); ctx.clip();
  ctx.fillStyle = o.color ?? PAL.ink; ctx.fill(WORDMARK);
  ctx.restore();
  ctx.restore();
}
const LOCKUP_ASPECT = 573 / 125;
