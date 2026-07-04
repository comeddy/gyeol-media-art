// 결 · GYEOL — 5관 매듭(結 maedeup) Verlet Knot Rope
// 먹빛 위 한 가닥 끈. 자유(중력+바람) → 연화매듭 수렴 → 풀림, 14초 순환.
// 포인터로 끈의 아무 입자나 잡아 끌 수 있다(잡는 동안 순환 정지).
import { fitCanvas, noise2, lerp, clamp } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio, W = 0, H = 0, dpr = 1;
  const N = 60, ITER = 8;
  let P = [];                 // {x,y,ox,oy,pin}
  let rest = 0, anchor = { x: 0, y: 0 };
  let target = [];            // 화면좌표 매듭 타깃(연화매듭)
  let cycleT = 0, knotToned = false;
  let grab = -1, gp = { x: 0, y: 0 };

  const BG = '#0E0C0A';
  const ROPE = '#C23B22';
  const HI = '#E0714F';
  // 연화매듭 도안 — 20×20 격자 웨이포인트(중심 10,10, 상단 stem→4엽 로제트)
  const KNOT = [
    [10, 1], [10, 5], [13, 4], [15, 6], [17, 9], [15, 12], [13, 14], [10, 15],
    [7, 14], [5, 12], [3, 9], [5, 6], [7, 4], [10, 5], [10, 10], [13, 9],
    [15, 11], [13, 13], [10, 12], [7, 13], [5, 11], [7, 9], [10, 10], [10, 15],
    [12, 17], [10, 19], [8, 17], [10, 15],
  ];
  let gridPts = [];           // KNOT을 N개로 등간격 리샘플한 격자좌표

  function resample(wp, n) {
    const seg = [], cum = [0];
    for (let i = 1; i < wp.length; i++) {
      const d = Math.hypot(wp[i][0] - wp[i - 1][0], wp[i][1] - wp[i - 1][1]);
      seg.push(d); cum.push(cum[i - 1] + d);
    }
    const total = cum[cum.length - 1], out = [];
    for (let k = 0; k < n; k++) {
      const s = total * k / (n - 1);
      let i = 1; while (i < cum.length && cum[i] < s) i++;
      i = clamp(i, 1, wp.length - 1);
      const t = seg[i - 1] > 0 ? (s - cum[i - 1]) / seg[i - 1] : 0;
      out.push([lerp(wp[i - 1][0], wp[i][0], t), lerp(wp[i - 1][1], wp[i][1], t)]);
    }
    return out;
  }

  function mapGrid(g) {
    const sc = Math.min(W, H) * 0.040;
    return { x: W / 2 + (g[0] - 10) * sc, y: H * 0.5 + (g[1] - 10) * sc };
  }

  function build() {
    gridPts = resample(KNOT, N);
    anchor = mapGrid(KNOT[0]);
    rest = Math.min(W, H) * 0.5 / (N - 1);
    P = [];
    for (let i = 0; i < N; i++) {
      const x = anchor.x, y = anchor.y + i * rest;
      P.push({ x, y, ox: x, oy: y, pin: i === 0 });
    }
    target = gridPts.map(mapGrid);
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    build();
  }

  function mode() {
    if (grab >= 0) return 'grab';
    const c = cycleT % 14;
    return c < 5 ? 'free' : c < 11 ? 'knot' : 'release';
  }

  function step(dt) {
    const m = mode();
    if (m !== 'grab') cycleT += dt;
    if (m === 'free' || m === 'release') knotToned = false;
    const dt2 = dt * dt, g = 900, damp = 0.98;
    for (let i = 0; i < N; i++) {
      const p = P[i];
      if (p.pin || i === grab) continue;
      let ax = 0, ay = g;
      if (m === 'free') { ax = noise2(i * 0.12, cycleT * 0.5) * 900; }
      else if (m === 'release') { ax = noise2(i * 0.12, cycleT * 0.5) * 400; }
      else if (m === 'knot') { ay = g * 0.15; }
      const vx = (p.x - p.ox) * damp, vy = (p.y - p.oy) * damp;
      p.ox = p.x; p.oy = p.y;
      p.x += vx + ax * dt2; p.y += vy + ay * dt2;
    }
    if (m === 'knot') {                 // 타깃으로 스프링 수렴(위치 lerp)
      const kf = 1 - Math.exp(-dt * 3);
      for (let i = 1; i < N; i++) {
        if (i === grab) continue;
        P[i].x = lerp(P[i].x, target[i].x, kf);
        P[i].y = lerp(P[i].y, target[i].y, kf);
      }
    }
    for (let k = 0; k < ITER; k++) {
      P[0].x = anchor.x; P[0].y = anchor.y;
      if (grab >= 0) { P[grab].x = gp.x; P[grab].y = gp.y; }
      for (let i = 1; i < N; i++) {
        const a = P[i - 1], b = P[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-4, diff = (d - rest) / d;
        const mx = dx * 0.5 * diff, my = dy * 0.5 * diff;
        const aFix = a.pin || (i - 1) === grab, bFix = b.pin || i === grab;
        if (!aFix) { a.x += mx; a.y += my; }
        if (!bFix) { b.x -= mx; b.y -= my; }
      }
    }
    if (m === 'knot' && !knotToned) {
      let sum = 0; for (let i = 1; i < N; i++) sum += Math.hypot(P[i].x - target[i].x, P[i].y - target[i].y);
      if (sum / (N - 1) < 9) { knotToned = true; if (audio) audio.tone({ deg: 4, oct: -1, dur: 0.4, vol: 0.15, type: 'sine' }); }
    }
  }

  function render() {
    cx.fillStyle = BG; cx.fillRect(0, 0, W, H);
    for (let pass = 0; pass < 2; pass++) {
      cx.beginPath();
      cx.moveTo(P[0].x, P[0].y);
      for (let i = 1; i < N - 1; i++) {
        const mx = (P[i].x + P[i + 1].x) / 2, my = (P[i].y + P[i + 1].y) / 2;
        cx.quadraticCurveTo(P[i].x, P[i].y, mx, my);
      }
      cx.lineTo(P[N - 1].x, P[N - 1].y);
      if (pass === 0) { cx.strokeStyle = ROPE; cx.lineWidth = 6; cx.stroke(); }
      else { cx.save(); cx.translate(-1, -1.4); cx.strokeStyle = HI; cx.lineWidth = 1; cx.globalAlpha = 0.7; cx.stroke(); cx.restore(); }
    }
    cx.fillStyle = ROPE;
    cx.beginPath(); cx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2); cx.fill();
  }

  return {
    init(ctx) {
      audio = ctx.audio; cv = ctx.canvas; W = ctx.width; H = ctx.height;
      setup(); render();
    },
    frame(t, dt) { step(clamp(dt, 0.001, 1 / 30)); render(); },
    pointer(e) {
      if (e.type === 'down') {
        let best = -1, bd = 24 * 24;
        for (let i = 1; i < N; i++) { const d = (P[i].x - e.x) ** 2 + (P[i].y - e.y) ** 2; if (d < bd) { bd = d; best = i; } }
        if (best >= 0) { grab = best; gp = { x: e.x, y: e.y }; }
      } else if (e.type === 'move' && grab >= 0) { gp = { x: e.x, y: e.y }; }
      else if (e.type === 'up') { grab = -1; }
    },
    resize(w, h) { W = w; H = h; setup(); render(); },
    dispose() { cx = null; cv = null; P = []; target = []; gridPts = []; grab = -1; },
  };
})();
