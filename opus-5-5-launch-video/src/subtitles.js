/* ============================================================================
 * subtitles.js — burned-in Korean subtitles (?subs=ko) + SRT export.
 * Pretendard (SIL OFL 1.1) for Hangul. Each line is a hand-inked paper sticker
 * that pops in on the cut; *asterisks* mark words inked in clay.
 * Timings follow the shot list, so they fit both the 16:9 and the 9:16 cut.
 * ==========================================================================*/
'use strict';

const SUBS = {
  ko: [
    { t0: 0.10, t1: 2.45, lines: ['Claude가 코드만으로 그린', '*자기소개* 영상'] },
    { t0: 2.55, t1: 4.95, lines: ['*Claude Opus 5.5* 출시', 'Claude 5.5 패밀리의 첫 모델'] },
    { t0: 5.05, t1: 6.95, lines: ['대부분 작업에서 *Fable 5.1급* 성능', 'Opus 5보다 *40% 저렴 · 30%+ 빠름*'] },
    { t0: 7.05, t1: 7.72, lines: ['*01* 만든다 · 에이전트 코딩'] },
    { t0: 7.80, t1: 9.70, lines: ['코드 *68만 줄* 마이그레이션', '*하루*도 안 걸렸어요'] },
    { t0: 9.80, t1: 11.70, lines: ['터미널 코딩 벤치마크 *66.4%*', '발표 차트 *최고 점수*'] },
    { t0: 11.80, t1: 13.70, lines: ['세션 하나가 *12개 세션*을 지휘', 'PR *40개 전부* CI 통과'] },
    { t0: 13.80, t1: 14.47, lines: ['*02* 일한다 · 지식 노동'] },
    { t0: 14.55, t1: 16.45, lines: ['*44개 직업* 실무 평가', '*1846 Elo* · Fable 5.1·Opus 5 앞섬'] },
    { t0: 16.55, t1: 18.45, lines: ['엑셀 재무 모델 → 임원 보고서', '*63분* 완성 (Opus 5는 93분)'] },
    { t0: 18.55, t1: 20.45, lines: ['리서치 보고서 18건 중 *16건*', '지어낸 수치 *0개*로 통과'] },
    { t0: 20.55, t1: 22.20, lines: ['컴퓨터를 직접 조작하는 능력', 'OSWorld 2.0 *81.8%*'] },
    { t0: 22.30, t1: 22.97, lines: ['*03* 그린다 · 바로 이 영상'] },
    { t0: 23.05, t1: 24.40, lines: ['방금 본 *모든 장면*은…'] },
    { t0: 24.45, t1: 26.20, lines: ['*Opus 5.5가 짠 코드*입니다', '영상 AI · 스톡 영상 없이'] },
    { t0: 26.35, t1: 29.90, lines: ['*Claude Opus 5.5*', '지금 모든 플랫폼에서 사용 가능'] },
  ],
};

const subSegments = line => line.split('*').map((s, i) => ({ s, hl: i % 2 === 1 })).filter(g => g.s);

function drawSubtitles(ctx, T) {
  const list = SUBS[SUBS_LANG];
  if (!list) return;
  const cur = list.find(c => T >= c.t0 && T < c.t1);
  if (!cur) return;
  const portrait = FORMAT === 'portrait';
  // 9:16 → above the Shorts/Reels caption & button zones; 16:9 → classic lower third
  const size = portrait ? 60 : 44, lh = portrait ? 100 : 74, base = portrait ? 1318 : 958;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  cur.lines.forEach((line, i) => {
    const kin = prog(T, cur.t0 + i * 0.07, cur.t0 + i * 0.07 + 0.2);
    const kout = prog(T, cur.t1 - 0.1, cur.t1);
    if (kin <= 0) return;
    const segs = subSegments(line);
    // auto-fit: 9:16 labels stay inside x≈120–960, clear of the Shorts/Reels button column
    const maxW = portrait ? 840 : 1400;
    setFont(ctx, FONT.kr, size, 800);
    ctx.letterSpacing = '-1px';
    const w0 = segs.reduce((a, g) => a + ctx.measureText(g.s).width, 0);
    const fs = Math.min(size, size * maxW / (w0 + size));
    setFont(ctx, FONT.kr, fs, 800);
    const widths = segs.map(g => ctx.measureText(g.s).width);
    const tw = widths.reduce((a, b) => a + b, 0);
    const rw = tw + fs * 1.0, rh = size * 1.46;
    const seed = 7000 + (hashStr(line) % 900);
    ctx.save();
    ctx.translate(W / 2, base + i * lh - size * 0.34);
    ctx.rotate(i % 2 ? 0.011 : -0.009);
    const e = lerp(0.72, 1, E.outBack(kin, 2.4)) * (1 - 0.08 * kout);
    ctx.scale(e, e);
    ctx.globalAlpha *= clamp(kin * 3) * (1 - kout);
    // hard sticker shadow, then the ivory label with a boiling ink edge
    sketch(ctx, shp.rrect(-rw / 2 + 7, -rh / 2 + 8, rw, rh, 18), { fill: PAL.ink, stroke: null, fillOffset: [0, 0], seed, amp: 1 });
    sketch(ctx, shp.rrect(-rw / 2, -rh / 2, rw, rh, 18), { fill: PAL.ivory, w: 4, fillOffset: [0, 0], seed: seed + 1, amp: 1.1 });
    ctx.textBaseline = 'middle';
    let x = -tw / 2;
    segs.forEach((g, j) => {
      ctx.fillStyle = g.hl ? PAL.clayDeep : PAL.ink;
      ctx.fillText(g.s, x, fs * 0.04);
      x += widths[j];
    });
    ctx.restore();
  });
  ctx.restore();
}

function subtitlesToSrt(lang = SUBS_LANG || 'ko') {
  const pad = (n, k = 2) => String(n).padStart(k, '0');
  const ts = s => {
    const ms = Math.round(s * 1000);
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
  };
  return (SUBS[lang] || []).map((c, i) => `${i + 1}\n${ts(c.t0)} --> ${ts(c.t1)}\n${c.lines.map(l => l.replace(/\*/g, '')).join('\n')}\n`).join('\n');
}
