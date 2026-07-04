// 결 · GYEOL — 5관 조각보(組角褓) Patchwork Wrapping Cloth
// 정방형 보자기를 BSP로 재귀 분할, 담채 조각들의 우연한 조화.
// 시접선(이중 실선 + 모서리 스티치)과 느린 숨결. 탭하면 새 배치로 미끄러진다.
import { fitCanvas, noise2, mulberry32, lerp, clamp } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio, grain, gctx;
  let W = 0, H = 0, dpr = 1;
  let sq = { x: 0, y: 0, s: 0 };      // 보자기 정방형(CSS px)
  let seed = 1;
  let layout = [];                     // 안정 상태 조각들
  let from = null, to = null;          // 전환용
  let trans = 0, transDur = 0.9, transActive = false;
  let breathe = 0;

  // 담채 팔레트(쪽·치자·소목·쑥·소색·자색)
  const PAL = ['#A8B8C8', '#D9C9A3', '#C9A8A0', '#9FB39A', '#EDE6D6', '#B8A3C0']
    .map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const SEAM = '#6A5A48';
  const BG = '#E5DECE';

  function buildLayout() {
    const rng = mulberry32((seed = (seed * 1664525 + 1013904223) >>> 0));
    const maxD = 4 + (rng() * 3 | 0);           // 깊이 4~6
    const leaves = [];
    const minSize = Math.max(18, sq.s * 0.06);
    (function split(x, y, w, h, d) {
      const stop = d >= maxD || (d >= 2 && rng() < 0.14) || w < minSize * 2 || h < minSize * 2;
      if (stop) {
        leaves.push({ x, y, w, h, c: PAL[rng() * PAL.length | 0] });
        return;
      }
      const vert = w > h ? rng() < 0.72 : rng() < 0.28; // 긴 변을 가르는 경향
      const r = 0.3 + rng() * 0.4;                        // 분할비 0.3~0.7
      if (vert) { const cw = w * r; split(x, y, cw, h, d + 1); split(x + cw, y, w - cw, h, d + 1); }
      else { const ch = h * r; split(x, y, w, ch, d + 1); split(x, y + ch, w, h - ch, d + 1); }
    })(sq.x, sq.y, sq.s, sq.s, 0);
    return leaves;
  }

  function makeGrain() {
    const s = Math.max(1, Math.round(sq.s));
    grain = document.createElement('canvas');
    grain.width = s; grain.height = s;
    gctx = grain.getContext('2d');
    const im = gctx.createImageData(s, s);
    const d = im.data;
    for (let y = 0, p = 0; y < s; y++) {
      for (let x = 0; x < s; x++, p += 4) {
        // 가로·세로 미세 스트라이프 알파 + noise 결
        const warp = 0.5 + 0.5 * Math.sin(x * 1.9);
        const weft = 0.5 + 0.5 * Math.sin(y * 1.9);
        const n = noise2(x * 0.08, y * 0.08);
        const a = clamp((warp * 0.5 + weft * 0.5) * 26 + n * 16, 0, 42);
        d[p] = 60; d[p + 1] = 52; d[p + 2] = 40; d[p + 3] = a;
      }
    }
    gctx.putImageData(im, 0, 0);
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = Math.min(W, H) * 0.82;
    sq = { x: (W - s) / 2, y: (H - s) / 2, s };
    makeGrain();
    if (!layout.length) layout = buildLayout();
    transActive = false;
  }

  function drawPatch(x, y, w, h, c, bright) {
    cx.fillStyle = `rgb(${c[0] * bright | 0},${c[1] * bright | 0},${c[2] * bright | 0})`;
    cx.fillRect(x, y, w, h);
    // 시접: 이중 실선(간격 2px)
    cx.strokeStyle = SEAM; cx.lineWidth = 1;
    cx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (w > 8 && h > 8) cx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
    // 모서리 스티치 점
    cx.fillStyle = SEAM;
    for (const [px, py] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]])
      cx.fillRect(px - 0.5, py - 0.5, 1.4, 1.4);
  }

  function render() {
    cx.fillStyle = BG; cx.fillRect(0, 0, W, H);
    const bright = 1 + Math.sin(breathe) * 0.05;   // 느린 숨결
    if (transActive && to) {
      const e = trans < 0.5 ? 2 * trans * trans : 1 - Math.pow(-2 * trans + 2, 2) / 2; // easeInOut
      for (let i = 0; i < to.length; i++) {
        const a = from[i % from.length], b = to[i];
        drawPatch(lerp(a.x, b.x, e), lerp(a.y, b.y, e), lerp(a.w, b.w, e), lerp(a.h, b.h, e),
          [lerp(a.c[0], b.c[0], e), lerp(a.c[1], b.c[1], e), lerp(a.c[2], b.c[2], e)], bright);
      }
    } else {
      for (const p of layout) drawPatch(p.x, p.y, p.w, p.h, p.c, bright);
    }
    // 직물 결 오버레이(전체 보자기)
    cx.globalCompositeOperation = 'multiply';
    cx.drawImage(grain, sq.x, sq.y, sq.s, sq.s);
    cx.globalCompositeOperation = 'source-over';
    // 보자기 외곽 굵은 시접
    cx.strokeStyle = SEAM; cx.lineWidth = 2;
    cx.strokeRect(sq.x + 1, sq.y + 1, sq.s - 2, sq.s - 2);
  }

  return {
    init(ctx) {
      audio = ctx.audio; cv = ctx.canvas; W = ctx.width; H = ctx.height;
      setup(); render();
    },
    frame(t, dt) {
      breathe += dt * 0.6;
      if (transActive) {
        trans += dt / transDur;
        if (trans >= 1) { trans = 1; transActive = false; layout = to; to = from = null; }
      }
      render();
    },
    pointer(e) {
      if (e.type !== 'down') return;
      from = layout; to = buildLayout(); trans = 0; transActive = true;
      if (audio) audio.tone({ deg: 1, oct: 0, dur: 0.3, vol: 0.12, type: 'sine' });
    },
    resize(w, h) { W = w; H = h; layout = []; from = to = null; transActive = false; setup(); render(); },
    dispose() { cx = null; cv = null; grain = null; gctx = null; layout = []; from = to = null; transActive = false; },
  };
})();
