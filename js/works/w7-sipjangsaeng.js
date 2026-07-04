// 결 · GYEOL — 7관 민화 · 십장생(十長生) Ten Longevities
// 담청 하늘에 학 18마리가 Boids로 떼 지어 난다. 배경엔 해·소나무·거북·불로초 언덕.
// 커서는 유인점(응집 2배). 무리가 급히 선회하면 학 울음 한 음(4초 쿨다운).
import { fitCanvas, noise2, clamp, mulberry32, TAU } from '../core/canvas.js';

const BG = '#22313A';                   // 담청 배경
const GOLD = '#E3A81C';                 // 해 (황)
const N_CRANE = 18;
const SEP = 28, ALIGN = 60, COH = 90;   // Boids 반경
const V_MIN = 2.2, V_MAX = 3.4;         // 속도 클램프(px/프레임 @60fps)

export default (() => {
  let cv, cx, audio;
  let W = 0, H = 0, dpr = 1;
  let flock = [];
  let ptr = null;                       // 유인점 { x, y } CSS px or null
  let prevAng = 0, lastTone = -999, T = 0;

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initFlock() {
    const rand = mulberry32(0x5183A);
    flock = [];
    for (let i = 0; i < N_CRANE; i++) {
      const a = rand() * TAU, sp = V_MIN + rand() * (V_MAX - V_MIN);
      flock.push({
        x: rand() * W, y: rand() * H,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        phase: rand() * TAU, seed: rand() * 100,
      });
    }
  }

  // ── 배경(담채 십장생) — 매 프레임 재도색(가벼움) ────────────────────────
  function drawSun() {
    const x = 0.83 * W, y = 0.20 * H, r = Math.min(W, H) * 0.09;
    const halo = cx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6);
    halo.addColorStop(0, 'rgba(227,168,28,0.55)');
    halo.addColorStop(1, 'rgba(227,168,28,0)');
    cx.fillStyle = halo; cx.beginPath(); cx.arc(x, y, r * 2.6, 0, TAU); cx.fill();
    cx.fillStyle = GOLD; cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fill();
  }
  function drawHills() {
    // 불로초 언덕 — 두 겹 완만한 둔덕 + 영지 점
    cx.fillStyle = 'rgba(46,77,69,0.55)';
    cx.beginPath(); cx.moveTo(0, H);
    for (let px = 0; px <= W; px += 8) cx.lineTo(px, H - (0.10 + 0.04 * Math.sin(px / W * 6 + 1)) * H);
    cx.lineTo(W, H); cx.closePath(); cx.fill();
    cx.fillStyle = 'rgba(30,77,69,0.75)';
    cx.beginPath(); cx.moveTo(0, H);
    for (let px = 0; px <= W; px += 8) cx.lineTo(px, H - (0.05 + 0.03 * Math.sin(px / W * 9 + 3)) * H);
    cx.lineTo(W, H); cx.closePath(); cx.fill();
    cx.fillStyle = 'rgba(194,59,34,0.5)';
    for (let i = 0; i < 5; i++) {
      const x = (0.15 + i * 0.17) * W, y = H - (0.055 + 0.02 * Math.sin(i * 2)) * H;
      cx.beginPath(); cx.ellipse(x, y, W * 0.012, H * 0.006, 0, 0, TAU); cx.fill();
    }
  }
  function drawPine() {
    const bx = 0.13 * W, by = 0.94 * H, s = Math.min(W, H);
    cx.strokeStyle = 'rgba(20,30,26,0.9)'; cx.lineWidth = s * 0.014; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(bx, by); cx.quadraticCurveTo(bx - s * 0.02, by - s * 0.16, bx + s * 0.03, by - s * 0.28); cx.stroke();
    cx.fillStyle = 'rgba(26,54,44,0.92)';
    for (let i = 0; i < 3; i++) {
      const cy = by - s * (0.20 + i * 0.06), cxp = bx + s * (0.01 + i * 0.012), w = s * (0.10 - i * 0.02);
      cx.beginPath(); cx.moveTo(cxp, cy - s * 0.07); cx.lineTo(cxp - w, cy); cx.lineTo(cxp + w, cy); cx.closePath(); cx.fill();
    }
  }
  function drawTurtle() {
    const ox = Math.sin(T * TAU / 6) * W * 0.02;   // 6초 주기 미세 이동
    const x = 0.62 * W + ox, y = 0.90 * H, s = Math.min(W, H) * 0.05;
    cx.fillStyle = 'rgba(60,66,40,0.9)';
    cx.beginPath(); cx.ellipse(x, y, s, s * 0.62, 0, 0, TAU); cx.fill();       // 등딱지
    cx.strokeStyle = 'rgba(20,24,14,0.8)'; cx.lineWidth = s * 0.06;
    cx.beginPath(); cx.moveTo(x - s, y); cx.lineTo(x + s, y); cx.moveTo(x, y - s * 0.6); cx.lineTo(x, y + s * 0.6); cx.stroke();
    cx.fillStyle = 'rgba(70,76,48,0.95)';
    cx.beginPath(); cx.arc(x + s * 1.1, y - s * 0.1, s * 0.28, 0, TAU); cx.fill();  // 머리
    cx.fillRect(x - s * 0.9, y + s * 0.5, s * 0.3, s * 0.3);                        // 다리
    cx.fillRect(x + s * 0.5, y + s * 0.5, s * 0.3, s * 0.3);
  }
  function drawBackground() {
    cx.fillStyle = BG; cx.fillRect(0, 0, W, H);
    drawSun(); drawHills(); drawPine(); drawTurtle();
  }

  // ── Boids: 분리·정렬·응집 + 포인터 유인(응집 2배) + 가장자리 선회 ──────
  function update(dt) {
    const f = clamp(dt * 60, 0, 2);
    for (let i = 0; i < flock.length; i++) {
      const b = flock[i];
      let sx = 0, sy = 0, ax = 0, ay = 0, an = 0, cxv = 0, cyv = 0, cn = 0;
      for (let j = 0; j < flock.length; j++) {
        if (i === j) continue;
        const o = flock[j], dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < SEP * SEP) { const d = Math.sqrt(d2) || 1; sx -= dx / d; sy -= dy / d; }
        if (d2 < ALIGN * ALIGN) { ax += o.vx; ay += o.vy; an++; }
        if (d2 < COH * COH) { cxv += o.x; cyv += o.y; cn++; }
      }
      let fx = sx * 1.6, fy = sy * 1.6;
      if (an) { fx += (ax / an - b.vx) * 0.12; fy += (ay / an - b.vy) * 0.12; }
      if (cn) { fx += (cxv / cn - b.x) * 0.0008; fy += (cyv / cn - b.y) * 0.0008; }
      if (ptr) { fx += (ptr.x - b.x) * 0.0016; fy += (ptr.y - b.y) * 0.0016; } // 유인 2배
      const m = 60;
      if (b.x < m) fx += 0.09; else if (b.x > W - m) fx -= 0.09;
      if (b.y < m) fy += 0.09; else if (b.y > H - m) fy -= 0.09;
      fx += noise2(b.seed, T * 0.4) * 0.13;
      fy += noise2(b.seed + 40, T * 0.4) * 0.13;
      b.vx += fx * f; b.vy += fy * f;
      const sp = Math.hypot(b.vx, b.vy) || 0.0001, cl = clamp(sp, V_MIN, V_MAX);
      b.vx = b.vx / sp * cl; b.vy = b.vy / sp * cl;
      b.x += b.vx * f; b.y += b.vy * f;
    }
    detectTurn();
  }

  // 무리 평균 진행각의 급변 → 학 울음 한 음(4초 쿨다운).
  function detectTurn() {
    let ax = 0, ay = 0;
    for (const b of flock) { ax += b.vx; ay += b.vy; }
    const ang = Math.atan2(ay, ax);
    let d = ang - prevAng;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    if (Math.abs(d) > 0.3 && T - lastTone > 4 && audio) {
      audio.tone({ deg: 4, oct: 1, dur: 0.5, vol: 0.06 });
      lastTone = T;
    }
    prevAng = ang;
  }

  // 학 한 마리 — 몸통 타원 + 목/머리 + 단정 적점 + 다리 + 날개 V(위상별 접힘).
  function crane(b) {
    const s = Math.min(W, H) * 0.02;
    cx.save(); cx.translate(b.x, b.y); cx.rotate(Math.atan2(b.vy, b.vx));
    cx.lineJoin = 'round'; cx.lineCap = 'round';
    cx.fillStyle = '#F2EEE4'; cx.strokeStyle = '#0E0C0A'; cx.lineWidth = s * 0.12;
    cx.beginPath(); cx.ellipse(0, 0, s * 1.4, s * 0.52, 0, 0, TAU); cx.fill(); cx.stroke();
    // 다리(뒤로 뻗음)
    cx.beginPath(); cx.moveTo(-s * 1.2, s * 0.05); cx.lineTo(-s * 2.7, s * 0.35);
    cx.moveTo(-s * 1.1, s * 0.1); cx.lineTo(-s * 2.6, s * 0.55); cx.stroke();
    // 목·머리·부리(앞으로)
    cx.beginPath(); cx.moveTo(s * 1.2, 0); cx.quadraticCurveTo(s * 2.2, -s * 0.5, s * 2.6, -s * 0.25); cx.stroke();
    cx.fillStyle = '#F2EEE4'; cx.beginPath(); cx.arc(s * 2.65, -s * 0.25, s * 0.26, 0, TAU); cx.fill(); cx.stroke();
    cx.beginPath(); cx.moveTo(s * 2.9, -s * 0.22); cx.lineTo(s * 3.4, -s * 0.12); cx.stroke();
    cx.fillStyle = '#C23B22'; cx.beginPath(); cx.arc(s * 2.6, -s * 0.46, s * 0.12, 0, TAU); cx.fill();
    // 날개 V — 각자 위상으로 퍼덕임
    const fold = 0.45 + 0.6 * (0.5 + 0.5 * Math.sin(T * 6 + b.phase));
    cx.strokeStyle = '#0E0C0A'; cx.lineWidth = s * 0.16;
    cx.beginPath();
    cx.moveTo(-s * 0.1, -s * 0.15); cx.lineTo(s * 0.5, -s * 1.7 * fold);
    cx.moveTo(-s * 0.1, s * 0.15); cx.lineTo(s * 0.5, s * 1.7 * fold);
    cx.stroke();
    cx.restore();
  }

  return {
    init(ctx) {
      cv = ctx.canvas; W = ctx.width; H = ctx.height; audio = ctx.audio;
      setup(); initFlock();
      drawBackground();
      for (const b of flock) crane(b);   // init 즉시 렌더
    },
    frame(t, dt) {
      T = t;
      update(dt);
      drawBackground();
      for (const b of flock) crane(b);
    },
    pointer(e) {
      if (e.type === 'up') ptr = null;
      else ptr = { x: e.x, y: e.y };
    },
    resize(w, h) { W = w; H = h; setup(); },
    dispose() { flock = []; cx = null; ptr = null; audio = null; cv = null; },
  };
})();
