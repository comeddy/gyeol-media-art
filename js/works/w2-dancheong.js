// 결 · GYEOL — 2관 오방 · 단청 만다라(丹靑 曼陀羅)
// 먹빛 위에 오방색 연화문이 극좌표 대칭으로 피어나 만다라를 이룬다.
// 전체가 아주 느리게 돌고, 탭하면 새 시드로 문양이 다시 핀다(0.8초 크로스페이드).
import { fitCanvas, mulberry32, lerp, clamp, TAU } from '../core/canvas.js';

const OBANG = ['#C23B22', '#2C5F93', '#E3A81C', '#EDE6D6', '#1A1611']; // 적·청·황·백·흑
const MUK = '#0E0C0A';   // 먹빛 배경
const HANJI = '#EDE6D6'; // 한지 백 — 머리초 끝단 테

export default (() => {
  let cv, cx, audio;
  let W = 0, H = 0, dpr = 1;
  let cur = null, prev = null, fade = 1; // 크로스페이드 0..1 (1=정상)
  let rot = 0;                           // 전체 회전각(rad)
  let seed = 0x2c5f93;                   // 탭마다 갱신되는 시드

  // 시드 → 문양 설계: 대칭수 N ∈ {8,10,12}, 연화·당초·주화 3~5겹.
  function makeDesign(s) {
    const rnd = mulberry32(s >>> 0);
    const N = [8, 10, 12][(rnd() * 3) | 0];
    const count = 3 + ((rnd() * 3) | 0); // 3~5겹
    const shift = (rnd() * 5) | 0;
    const layers = [];
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      layers.push({
        R: lerp(0.97, 0.30, t),                 // 바깥겹이 크고 안겹이 작다
        p: 0.55 + rnd() * 1.35,                 // 꽃잎 뾰족함
        color: OBANG[(i + shift) % 5],          // 겹마다 오방색 순환
        spin: (rnd() < 0.5 ? 1 : -1) * (0.3 + rnd() * 0.85),
        phase: rnd() * TAU,
        beads: rnd() < 0.6,                      // 주화(구슬) 장식
      });
    }
    return { N, layers, core: OBANG[(shift + 2) % 5] };
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.lineJoin = 'round';
  }

  // 원점(중심) 기준 한 겹의 연화문을 그린다. r(θ)=R·(0.55+0.45cos(Nθ))^p.
  function drawRose(d, layer, baseR, breathe) {
    const R = layer.R * baseR * breathe;
    cx.save();
    cx.rotate(rot * layer.spin + layer.phase);
    cx.beginPath();
    const steps = d.N * 16;
    for (let k = 0; k <= steps; k++) {
      const th = (k / steps) * TAU;
      const f = Math.pow(Math.max(0, 0.55 + 0.45 * Math.cos(d.N * th)), layer.p);
      const r = R * f;
      const x = Math.cos(th) * r, y = Math.sin(th) * r;
      if (k === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
    }
    cx.closePath();
    const g = cx.createRadialGradient(0, 0, R * 0.04, 0, 0, R);
    g.addColorStop(0, layer.color);
    g.addColorStop(0.72, layer.color);
    g.addColorStop(1, HANJI); // 머리초 백색 끝단 테
    cx.fillStyle = g;
    cx.fill();
    cx.strokeStyle = HANJI;
    cx.lineWidth = baseR * 0.005;
    cx.stroke();
    if (layer.beads) {
      cx.fillStyle = HANJI;
      for (let m = 0; m < d.N; m++) {
        const th = (m / d.N) * TAU;
        const r = R * 0.98;
        cx.beginPath();
        cx.arc(Math.cos(th) * r, Math.sin(th) * r, baseR * 0.014, 0, TAU);
        cx.fill();
      }
    }
    cx.restore();
  }

  function drawDesign(d, alpha, baseR) {
    if (!d || alpha <= 0.001) return;
    cx.globalAlpha = alpha;
    for (let i = 0; i < d.layers.length; i++) {
      const breathe = 1 + 0.03 * Math.sin(rot * 3 + i * 1.3);
      drawRose(d, d.layers[i], baseR, breathe);
    }
    // 연꽃 중심 씨방
    cx.fillStyle = d.core;
    cx.beginPath();
    cx.arc(0, 0, baseR * 0.09 * (1 + 0.05 * Math.sin(rot * 4)), 0, TAU);
    cx.fill();
    cx.strokeStyle = HANJI;
    cx.lineWidth = baseR * 0.008;
    cx.stroke();
    cx.globalAlpha = 1;
  }

  return {
    init(ctx) {
      audio = ctx.audio;
      cv = ctx.canvas;
      W = ctx.width; H = ctx.height;
      setup();
      cur = makeDesign(seed);
      // 배경 즉시 그리기(무입력 렌더 보장)
      cx.fillStyle = MUK;
      cx.fillRect(0, 0, W, H);
      cx.save();
      cx.translate(W / 2, H / 2);
      drawDesign(cur, 1, Math.min(W, H) * 0.46);
      cx.restore();
    },

    frame(t, dt) {
      rot += dt * 0.05;                        // 0.05 rad/s 회전
      if (fade < 1) fade = clamp(fade + dt / 0.8, 0, 1);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.globalAlpha = 1;
      cx.fillStyle = MUK;
      cx.fillRect(0, 0, W, H);
      const baseR = Math.min(W, H) * 0.46;
      cx.save();
      cx.translate(W / 2, H / 2);
      if (fade < 1) drawDesign(prev, 1 - fade, baseR);
      drawDesign(cur, fade < 1 ? fade : 1, baseR);
      cx.restore();
    },

    pointer(e) {
      if (e.type !== 'down') return;
      prev = cur;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      cur = makeDesign(seed);
      fade = 0;                                // 0.8초 크로스페이드 시작
      if (audio) audio.tone({ deg: (seed % 5), oct: 0, dur: 0.6, vol: 0.22, type: 'triangle' });
    },

    resize(w, h) { W = w; H = h; setup(); },

    dispose() { cx = null; cv = null; cur = null; prev = null; audio = null; },
  };
})();
