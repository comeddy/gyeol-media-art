// 결 · GYEOL — 2관 오방 · 낙화(落花)
// 상단 매화 가지에서 꽃잎이 중력·바람·기울기를 타고 흩날려 바닥에 쌓인다.
// 탭하면 그 자리에 쌓인 꽃잎이 다시 흩날린다. tilt().x가 낙하를 편향(데스크톱은 마우스 폴백).
import { fitCanvas, noise2, mulberry32, clamp, TAU } from '../core/canvas.js';

const MUK = '#0E0C0A';
const SILHOUETTE = '#1A1611';                              // 흑 — 가지 실루엣
const TINTS = ['#EDE6D6', '#EFE1DC', '#EAD3CD', '#E8C9C4']; // 백 ~ 담홍
const NP = 220;      // 꽃잎 수
const COLS = 72;     // 바닥 높이맵 열 수
const PILE = 2.4;    // 꽃잎 한 장이 쌓는 높이(px)
const BR_BLOOM = [[0.36, 0.22], [0.60, 0.20], [0.92, 0.19], [0.55, 0.06], [0.20, 0.08]];

export default (() => {
  let cv, cx, sensors, audio;
  let W = 0, H = 0, dpr = 1;
  let petals = [], floorY = null, sprites = [];

  // 5엽 매화 꽃잎 스프라이트를 오프스크린에 1회 렌더(백→담홍 방사 그라데이션 + 황색 꽃술).
  function makeSprite(edge) {
    const S = 44, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    const off = S * 0.19, pr = S * 0.21;
    for (let m = 0; m < 5; m++) {
      const a = (m / 5) * TAU - Math.PI / 2;
      const gx = Math.cos(a) * off, gy = Math.sin(a) * off;
      const rg = g.createRadialGradient(gx, gy, 1, gx, gy, pr);
      rg.addColorStop(0, '#FBF6EE');
      rg.addColorStop(1, edge);
      g.fillStyle = rg;
      g.beginPath(); g.arc(gx, gy, pr, 0, TAU); g.fill();
    }
    g.fillStyle = '#E3A81C';
    g.beginPath(); g.arc(0, 0, S * 0.06, 0, TAU); g.fill();
    return c;
  }

  function spawn() {
    petals = [];
    for (let i = 0; i < NP; i++) {
      petals.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.92,
        vx: (Math.random() - 0.5) * 24,
        vy: 10 + Math.random() * 40,
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 2.2,
        scale: 0.5 + Math.random() * 0.6,
        spr: sprites[(Math.random() * sprites.length) | 0],
        seed: Math.random() * TAU,
        piled: false,
      });
    }
  }

  // 상단 매화 가지 실루엣 + 가지 위 고정 꽃(데코).
  function drawBranch() {
    cx.strokeStyle = SILHOUETTE;
    cx.lineCap = 'round';
    const seg = (x0, y0, cx1, cy1, x1, y1, w) => {
      cx.lineWidth = w;
      cx.beginPath();
      cx.moveTo(x0 * W, y0 * H);
      cx.quadraticCurveTo(cx1 * W, cy1 * H, x1 * W, y1 * H);
      cx.stroke();
    };
    seg(-0.02, 0.02, 0.25, 0.10, 0.55, 0.06, Math.max(6, W * 0.010));
    seg(0.55, 0.06, 0.75, 0.03, 1.02, 0.10, Math.max(4, W * 0.007));
    seg(0.30, 0.085, 0.30, 0.16, 0.36, 0.22, Math.max(3, W * 0.004));
    seg(0.62, 0.058, 0.66, 0.14, 0.60, 0.20, Math.max(3, W * 0.004));
    seg(0.82, 0.07, 0.86, 0.13, 0.92, 0.19, Math.max(3, W * 0.004));
    const spr = sprites[0];
    for (const [bx, by] of BR_BLOOM) {
      const s = 0.7;
      cx.drawImage(spr, bx * W - spr.width * s / 2, by * H - spr.height * s / 2,
        spr.width * s, spr.height * s);
    }
  }

  function drawPetal(p) {
    const spr = p.spr, s = p.scale, w = spr.width * s, h = spr.height * s;
    cx.save();
    cx.translate(p.x, p.y);
    cx.rotate(p.rot);
    cx.drawImage(spr, -w / 2, -h / 2, w, h);
    cx.restore();
  }

  function render(t) {
    cx.fillStyle = MUK;
    cx.fillRect(0, 0, W, H);
    drawBranch();
    for (let i = 0; i < petals.length; i++) drawPetal(petals[i]);
  }

  function step(t, dt) {
    const tx = sensors ? sensors.tilt().x : 0; // -1..1 (데스크톱은 마우스 폴백)
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      if (p.piled) continue;
      const wind = noise2(p.x * 0.0025, t * 0.15) * 55 + tx * 150;
      p.vx += wind * dt;
      p.vy += 95 * dt;                         // 중력
      p.vx *= 0.98; p.vy *= 0.995;
      p.rot += p.vr * dt + Math.sin(t * 2 + p.seed) * 0.01;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -24) p.x = W + 24; else if (p.x > W + 24) p.x = -24;
      const col = clamp((p.x / W * COLS) | 0, 0, COLS - 1);
      if (p.y >= floorY[col]) {                // 바닥/쌓임에 안착
        p.y = floorY[col]; p.vx = 0; p.vy = 0; p.piled = true;
        floorY[col] = Math.max(H * 0.45, floorY[col] - PILE);
      }
    }
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return {
    init(ctx) {
      cv = ctx.canvas;
      sensors = ctx.sensors;
      audio = ctx.audio;
      W = ctx.width; H = ctx.height;
      setup();
      sprites = TINTS.map(makeSprite);
      floorY = new Float32Array(COLS).fill(H);
      spawn();
      render(0); // 배경·가지·꽃잎 즉시 렌더(무입력 렌더 보장)
    },

    frame(t, dt) {
      step(t, dt);
      render(t);
    },

    pointer(e) {
      if (e.type !== 'down') return;
      const rad = 130, r2 = rad * rad;
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        if (!p.piled) continue;
        const dx = p.x - e.x, dy = p.y - e.y;
        if (dx * dx + dy * dy >= r2) continue;
        const ang = Math.atan2(dy, dx), sp = 120 + Math.random() * 140;
        p.piled = false;
        p.vx = Math.cos(ang) * sp;
        p.vy = -Math.abs(Math.sin(ang) * sp) - 90; // 위로 튀어 흩날림
        p.vr = (Math.random() - 0.5) * 4.5;
        const col = clamp((p.x / W * COLS) | 0, 0, COLS - 1);
        floorY[col] = Math.min(H, floorY[col] + PILE);
      }
      if (audio) audio.tone({ deg: 1, oct: 1, vol: 0.1, dur: 0.5, type: 'sine' });
    },

    resize(w, h) {
      W = w; H = h; setup();
      floorY = new Float32Array(COLS).fill(H);
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.x = clamp(p.x, 0, W); p.y = clamp(p.y, 0, H); p.piled = false;
      }
    },

    dispose() {
      petals = []; floorY = null; sprites = [];
      cx = null; cv = null; sensors = null; audio = null;
    },
  };
})();
