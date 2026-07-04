// 결 · GYEOL — 4관 여백 · 빙렬(氷裂) Crackle Glaze
// 유백색 유약 위로 청회색 균열이 얼음 갈라지듯 번져 자란다.
// 성장 워커: 씨앗에서 전진하며 방향이 미세히 흔들리고, 낮은 확률로 분기하며,
//   기존 균열선 8px 근처에 닿으면 멈춘다. 총 5000세그먼트에서 성장을 마치고 정적으로 감상.
import { fitCanvas, noise2, mulberry32, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio, rand;
  let W = 0, H = 0, dpr = 1;
  let grid, cols = 0, rows = 0, stamp = 0;
  let walkers = [], segCount = 0;
  const CELL = 8;                 // 근접 정지 격자(=8px)
  const GRACE = 4;                // 자기 최근 자취는 통과(스탬프 차)
  const MAX_SEG = 5000;
  const MAX_WALK = 500;
  const BASE = '#E9E4D8';         // 유백
  const CRACK = '#8A93A0';        // 균열 청회

  function cellOf(x, y) {
    const gx = x / CELL | 0, gy = y / CELL | 0;
    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return -1;
    return gx + gy * cols;
  }

  function seed(x, y) {
    if (segCount >= MAX_SEG || walkers.length >= MAX_WALK) return;
    walkers.push({ x, y, a: rand() * TAU, w: 0.5 + rand() * 0.5, alive: true });
    const ci = cellOf(x, y);
    if (ci >= 0) grid[ci] = ++stamp;
  }

  function drawMottle() {
    cx.fillStyle = BASE;
    cx.fillRect(0, 0, W, H);
    // 미세 noise 얼룩 — 은은한 유약의 결
    const step = 14;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const n = noise2(x * 0.02, y * 0.02);
        const l = 216 + n * 12;           // 유백 근방에서 밝기만 미세 변주
        cx.fillStyle = `rgb(${l},${l - 6},${l - 18})`;
        cx.globalAlpha = 0.5;
        cx.fillRect(x, y, step, step);
      }
    }
    cx.globalAlpha = 1;
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.max(1, Math.ceil(W / CELL));
    rows = Math.max(1, Math.ceil(H / CELL));
    grid = new Int32Array(cols * rows);
    stamp = 0; segCount = 0; walkers = [];
    cx.lineCap = 'round';
    cx.strokeStyle = CRACK;
  }

  function reseed() {
    // 시작 씨앗 3개 — 화면 중앙부에 흩어
    for (let i = 0; i < 3; i++) {
      seed(W * (0.3 + rand() * 0.4), H * (0.3 + rand() * 0.4));
    }
  }

  function step(wk) {
    if (!wk.alive) return;
    const dist = 1.5 + rand() * 1.5;                 // 1.5~3px 전진
    wk.a += (rand() - 0.5) * 0.5;                    // 방향 미세 흔들림
    const nx = wk.x + Math.cos(wk.a) * dist;
    const ny = wk.y + Math.sin(wk.a) * dist;
    const ci = cellOf(nx, ny);
    if (ci < 0) { wk.alive = false; return; }         // 화면 밖
    const occ = grid[ci];
    if (occ !== 0 && stamp - occ > GRACE) { wk.alive = false; return; } // 기존 균열 근처 → 정지
    cx.lineWidth = wk.w;
    cx.beginPath();
    cx.moveTo(wk.x, wk.y);
    cx.lineTo(nx, ny);
    cx.stroke();
    wk.x = nx; wk.y = ny;
    grid[ci] = ++stamp;
    segCount++;
    // 확률 0.02로 분기(각도 ±0.6)
    if (rand() < 0.02 && walkers.length < MAX_WALK && segCount < MAX_SEG) {
      const da = (rand() < 0.5 ? -1 : 1) * 0.6;
      walkers.push({ x: wk.x, y: wk.y, a: wk.a + da, w: wk.w, alive: true });
    }
  }

  return {
    init(ctx) {
      cv = ctx.canvas; audio = ctx.audio;
      W = ctx.width; H = ctx.height;
      rand = mulberry32(0x51ce55);
      setup();
      drawMottle();
      reseed();
      // 초기 몇 스텝 미리 진행해 즉시 균열 흔적을 보인다(비균일 보장)
      for (let k = 0; k < 40; k++) for (const wk of walkers.slice()) step(wk);
    },

    frame() {
      if (segCount >= MAX_SEG) return;                 // 성장 종료 — 정적 감상
      const snap = walkers.slice();                    // 이번 프레임에 추가된 분기는 다음 프레임부터
      for (const wk of snap) if (segCount < MAX_SEG) step(wk);
    },

    pointer(e) {
      if (e.type !== 'down') return;
      if (segCount >= MAX_SEG) return;
      seed(e.x, e.y);
      if (audio) audio.tone({ deg: 2, oct: -1, vol: 0.1 });
    },

    resize(w, h) { W = w; H = h; setup(); drawMottle(); reseed(); },

    dispose() { grid = null; walkers = []; cx = null; cv = null; audio = null; },
  };
})();
