// 결 · GYEOL — 7관 민화 · 어변성룡(魚變成龍) Carp Becomes Dragon
// 20초 사이클: ①유영 6s ②승천(나선 소용돌이) 6s ③합체(용 폴리라인에 스프링 정렬) 4s ④산개 4s.
// 잉어 파티클 300 — 방추형 스트로크 + 꼬리, 주홍/금 2톤. 승천 시 오음 5음 상행 글리산도.
import { fitCanvas, noise2, clamp, lerp, mulberry32, TAU } from '../core/canvas.js';

const NP = 300;
const INK = '#0E0C0A', VERMILION = '#C23B22', GOLD = '#E3A81C', BLUE = '44,95,147';
const WL = 0.55;                        // 수면 비율(아래가 물)

// 용 척추 — 꼬리→머리 순서 하드코딩(S자 굴곡). 파티클이 이 선을 리샘플해 정렬한다.
const SPINE = [
  [0.16, 0.86], [0.21, 0.83], [0.27, 0.82], [0.33, 0.79], [0.38, 0.74], [0.415, 0.67],
  [0.425, 0.59], [0.405, 0.51], [0.37, 0.45], [0.335, 0.40], [0.325, 0.34], [0.35, 0.29],
  [0.40, 0.26], [0.47, 0.25], [0.54, 0.26], [0.60, 0.29], [0.655, 0.335], [0.695, 0.375],
  [0.725, 0.40], [0.755, 0.41], [0.785, 0.40], [0.81, 0.375], [0.815, 0.35], [0.80, 0.335],
];
const HORNS = [[[0.79, 0.34], [0.76, 0.27]], [[0.80, 0.35], [0.83, 0.27]]];
const WHISKERS = [[[0.815, 0.37], [0.90, 0.33]], [[0.815, 0.38], [0.88, 0.45]]];
const EYE = [0.775, 0.352];

export default (() => {
  let cv, cx, audio, rng;
  let W = 0, H = 0, dpr = 1;
  let ps = [];
  let dragonPts = new Float32Array(NP * 2);
  let ptr = null;
  let prevPhase = -1, seq = null;       // seq = { left, next } 글리산도 진행 상태

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 척추 폴리라인을 픽셀좌표로 변환해 등간격 NP점으로 리샘플.
  function buildDragon() {
    if (!dragonPts) dragonPts = new Float32Array(NP * 2);   // 재마운트(dispose 후) 대비 재할당
    const pts = SPINE.map((p) => [p[0] * W, p[1] * H]);
    const seg = []; let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(d); total += d;
    }
    for (let k = 0; k < NP; k++) {
      let target = total * k / (NP - 1), i = 0;
      while (i < seg.length && target > seg[i]) { target -= seg[i]; i++; }
      if (i >= seg.length) { dragonPts[k * 2] = pts[pts.length - 1][0]; dragonPts[k * 2 + 1] = pts[pts.length - 1][1]; continue; }
      const f = seg[i] ? target / seg[i] : 0;
      dragonPts[k * 2] = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f;
      dragonPts[k * 2 + 1] = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
    }
  }

  function initParticles() {
    rng = mulberry32(0xE0B7E);
    ps = [];
    for (let k = 0; k < NP; k++) {
      ps.push({ x: rng() * W, y: (WL + rng() * (1 - WL)) * H, vx: 0, vy: 0, seed: rng() * 100, gold: k % 2 === 0 });
    }
  }

  function resetSwim() {
    for (const p of ps) {
      p.x = rng() * W; p.y = (WL + rng() * (0.98 - WL)) * H;
      p.vx = (rng() - 0.5) * 1.5; p.vy = (rng() - 0.5) * 0.6;
    }
  }

  const phaseOf = (tc) => tc < 6 ? 0 : tc < 12 ? 1 : tc < 16 ? 2 : 3;

  // ── 렌더 조각 ───────────────────────────────────────────────────────────
  function water(t) {
    const wl = WL * H;
    cx.fillStyle = `rgba(${BLUE},0.10)`; cx.fillRect(0, wl, W, H - wl);
    cx.strokeStyle = `rgba(${BLUE},0.55)`; cx.lineWidth = 2;
    for (let layer = 0; layer < 2; layer++) {
      cx.beginPath();
      for (let px = 0; px <= W; px += 8) {
        const y = wl + layer * 10 + Math.sin(px * 0.02 + t * (1 + layer * 0.4)) * 6;
        px === 0 ? cx.moveTo(px, y) : cx.lineTo(px, y);
      }
      cx.stroke();
    }
  }
  function fish(p) {
    const s = Math.min(W, H) * 0.011;
    cx.save(); cx.translate(p.x, p.y); cx.rotate(Math.atan2(p.vy, p.vx));
    cx.fillStyle = p.gold ? GOLD : VERMILION;
    cx.beginPath(); cx.ellipse(0, 0, s * 1.7, s * 0.6, 0, 0, TAU); cx.fill();      // 방추형 몸통
    cx.beginPath(); cx.moveTo(-s * 1.5, 0); cx.lineTo(-s * 2.6, -s * 0.75); cx.lineTo(-s * 2.6, s * 0.75); cx.closePath(); cx.fill(); // 꼬리
    cx.restore();
  }
  function stroke(seg, w, col) {
    cx.strokeStyle = col; cx.lineWidth = w; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(seg[0][0] * W, seg[0][1] * H); cx.lineTo(seg[1][0] * W, seg[1][1] * H); cx.stroke();
  }
  function dragonHead(t) {
    const w = Math.min(W, H) * 0.01;
    for (const s of HORNS) stroke(s, w * 1.4, GOLD);
    for (const s of WHISKERS) stroke(s, w, `rgba(227,168,28,0.8)`);
    // 용 눈 발광
    const x = EYE[0] * W, y = EYE[1] * H, r = Math.min(W, H) * (0.012 + 0.004 * Math.sin(t * 8));
    const g = cx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, 'rgba(255,240,180,0.95)'); g.addColorStop(0.4, 'rgba(227,168,28,0.6)'); g.addColorStop(1, 'rgba(227,168,28,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r * 4, 0, TAU); cx.fill();
    cx.fillStyle = '#FFF6D8'; cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fill();
  }

  // 사이클 이벤트 — 승천 시작=글리산도 예약, 산개 시작=비늘 폭발, 유영 시작=재배치.
  function handleEvents(ph, t) {
    if (ph !== prevPhase) {
      if (ph === 1) seq = { left: 5, next: t };
      else if (ph === 3) {
        for (const p of ps) {
          const a = p.seed * TAU, sp = 2 + (p.seed % 1) * 3;
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 2.5;
        }
      } else if (ph === 0) resetSwim();
      prevPhase = ph;
    }
    if (seq && seq.left > 0 && t >= seq.next && audio) {
      const idx = 5 - seq.left;                     // 0→4 상행
      audio.tone({ deg: idx, oct: idx > 2 ? 1 : 0, dur: 0.4, vol: 0.12 });
      seq.left--; seq.next += 0.5;
      if (seq.left <= 0) seq = null;
    }
  }

  function update(dt, t) {
    const tc = t % 20, ph = phaseOf(tc), f = clamp(dt * 60, 0, 2);
    handleEvents(ph, t);
    const cx0 = ptr ? ptr.x : W * 0.5, cy0 = ptr ? ptr.y : H * 0.42;
    const wl = WL * H;
    for (let k = 0; k < ps.length; k++) {
      const p = ps[k];
      if (ph === 0) {                               // 유영 — noise 흐름 + 포인터 유인
        const a = noise2(p.x * 0.005 + p.seed, p.y * 0.005 + t * 0.08) * TAU * 2;
        let tvx = Math.cos(a) * 1.8, tvy = Math.sin(a) * 0.9 + 0.2;
        if (ptr) { tvx += (ptr.x - p.x) * 0.004; tvy += (ptr.y - p.y) * 0.004; }
        p.vx = lerp(p.vx, tvx, 0.05); p.vy = lerp(p.vy, tvy, 0.05);
        if (p.y < wl + 6) p.vy += 0.4;
      } else if (ph === 1) {                        // 승천 — 나선 소용돌이 상승
        const dx = p.x - cx0, dy = p.y - cy0, ang = Math.atan2(dy, dx);
        const tx = -Math.sin(ang), ty = Math.cos(ang);
        p.vx = lerp(p.vx, tx * 4.2 - dx * 0.03, 0.1);
        p.vy = lerp(p.vy, ty * 4.2 - dy * 0.03 - 2.6, 0.1);
      } else if (ph === 2) {                        // 합체 — 용 폴리라인에 스프링
        p.vx += (dragonPts[k * 2] - p.x) * 0.03 * f;
        p.vy += (dragonPts[k * 2 + 1] - p.y) * 0.03 * f;
        p.vx *= 0.84; p.vy *= 0.84;
      } else {                                      // 산개 — 낙하
        p.vy += 0.35 * f; p.vx *= 0.99;
      }
      p.x += p.vx * f; p.y += p.vy * f;
      if (ph === 0) {                               // 물속 유지
        if (p.x < 0) p.x += W; else if (p.x > W) p.x -= W;
        if (p.y > H - 4) { p.y = H - 4; p.vy *= -0.3; }
      }
    }
  }

  function draw(t) {
    cx.fillStyle = INK; cx.fillRect(0, 0, W, H);
    water(t);
    for (const p of ps) fish(p);
    if (phaseOf(t % 20) === 2) dragonHead(t);
  }

  return {
    init(ctx) {
      cv = ctx.canvas; W = ctx.width; H = ctx.height; audio = ctx.audio;
      prevPhase = -1; seq = null;                 // 재마운트 시 사이클 상태 초기화
      setup(); initParticles(); buildDragon();
      draw(0);                                      // init 즉시 렌더
    },
    frame(t, dt) { update(dt, t); draw(t); },
    pointer(e) { if (e.type === 'up') ptr = null; else ptr = { x: e.x, y: e.y }; },
    resize(w, h) { W = w; H = h; setup(); buildDragon(); },
    dispose() { ps = []; dragonPts = null; cx = null; ptr = null; audio = null; cv = null; seq = null; },
  };
})();
