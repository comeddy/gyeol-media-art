// 결 · GYEOL — 6관 풍류 · 오음(五音) Five Tones
// 먹빛 위 거문고 가로 현 5줄. 위→아래 = 우·치·각·상·궁(굵기 점증).
// 포인터가 현을 가로지르면 튕김 — 감쇠 사인 진동(진폭 12px, ~2초)과
// tone(dur 1.6), 마루에서 먹점 낙하. 8초 무입력 시 4초당 1음 자동 가락.
import { fitCanvas, clamp, lerp, mulberry32, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio;
  let W = 0, H = 0, dpr = 1;
  let prev = null;                 // 직전 포인터 위치 {x,y}
  let lastInput = 0, lastAuto = 0; // 자동 가락 타이밍(초)
  let started = false;             // 첫 frame에서 타이밍 기준(t) 고정
  const seq = mulberry32(0x0e5a17);

  const INK = '#0E0C0A', PAPER = '#EDE6D6', GOLD = '#E3A81C', BLUE = '#2C5F93';
  // 위→아래: 우(deg4·高) → 궁(deg0·低). 굵기는 아래로 갈수록 두껍다.
  const NAMES = [
    { deg: 4, hanja: '羽', ko: '우' }, { deg: 3, hanja: '徵', ko: '치' },
    { deg: 2, hanja: '角', ko: '각' }, { deg: 1, hanja: '商', ko: '상' },
    { deg: 0, hanja: '宮', ko: '궁' },
  ];
  let strings = [];   // {y, deg, hanja, ko, w, amp, age, px, fHz, drop}
  let dots = [];      // 먹점 낙하 {x,y,vy,life,max,size}

  function place() {
    strings = NAMES.map((n, i) => ({
      y: lerp(H * 0.16, H * 0.84, i / 4),
      deg: n.deg, hanja: n.hanja, ko: n.ko,
      w: lerp(1.4, 5.5, i / 4),      // 위=가늘게, 아래=굵게
      amp: 0, age: 0, px: W * 0.5, fHz: 3.2 + n.deg * 0.7, drop: 0,
    }));
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.textBaseline = 'middle';
    place();
  }

  function envelope(age) { return Math.exp(-age * 1.8); } // ~2초 감쇠

  function pluck(s, px) {
    s.amp = 12; s.age = 0; s.px = clamp(px, W * 0.08, W * 0.92); s.drop = 0;
    if (audio) audio.tone({ deg: s.deg, dur: 1.6, vol: 0.25, type: 'sine' });
  }

  function background() {
    cx.fillStyle = INK; cx.fillRect(0, 0, W, H);
    cx.fillStyle = 'rgba(44,95,147,0.05)';  // 은은한 청 안개
    cx.fillRect(0, 0, W, H);
  }

  function drawString(s) {
    const x0 = W * 0.08, x1 = W * 0.92, L = x1 - x0;
    const env = s.amp * envelope(s.age);
    const glow = clamp(env / 12, 0, 1);
    cx.save();
    cx.lineWidth = s.w;
    cx.lineCap = 'round';
    // 진동 세기에 따라 현 색을 한지→금으로 물들인다.
    cx.strokeStyle = glow > 0.02 ? GOLD : 'rgba(237,230,214,0.72)';
    if (glow > 0.02) { cx.shadowColor = GOLD; cx.shadowBlur = 14 * glow; }
    cx.beginPath();
    const N = 56;
    for (let i = 0; i <= N; i++) {
      const x = x0 + (L * i) / N, u = (x - x0) / L;
      const d = env * Math.sin(Math.PI * u) * Math.sin(TAU * s.fHz * s.age);
      const y = s.y + d;
      if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
    }
    cx.stroke();
    cx.restore();
    // 음명 표기(현 왼쪽)
    cx.fillStyle = glow > 0.02 ? GOLD : 'rgba(237,230,214,0.55)';
    cx.font = `${Math.round(s.w * 3 + 12)}px "Noto Serif KR", serif`;
    cx.textAlign = 'right';
    cx.fillText(s.hanja + ' ' + s.ko, x0 - 10, s.y);
  }

  return {
    init(ctx) {
      cv = ctx.canvas; audio = ctx.audio;
      W = ctx.width; H = ctx.height;
      setup();
      background();
      for (const s of strings) drawString(s);  // init 즉시 렌더
    },

    frame(t, dt) {
      if (!started) { started = true; lastInput = t; lastAuto = t; } // 기준시각 고정
      // 자동 가락: 8초 무입력 → 4초당 1음(시간 간격 기반 발음)
      if (t - lastInput > 8 && t - lastAuto >= 4) {
        lastAuto = t;
        const s = strings[(seq() * strings.length) | 0];
        pluck(s, W * (0.2 + seq() * 0.6));
      }

      background();
      for (const s of strings) {
        if (s.amp * envelope(s.age) > 0.05) {
          s.age += dt;
          // 마루에서 먹점 낙하(시간 간격 기반, 프레임당 무조건 아님)
          const env = s.amp * envelope(s.age);
          if (env > 4 && t - s.drop > 0.12) {
            s.drop = t;
            const crest = s.y - env;
            dots.push({ x: s.px, y: crest, vy: 20, life: 1.1, max: 1.1, size: 1.6 + env * 0.12 });
          }
        }
        drawString(s);
      }
      // 먹점 낙하 갱신
      for (let i = dots.length - 1; i >= 0; i--) {
        const p = dots[i];
        p.life -= dt; if (p.life <= 0) { dots.splice(i, 1); continue; }
        p.vy += 260 * dt; p.y += p.vy * dt;
        cx.globalAlpha = clamp(p.life / p.max, 0, 1) * 0.7;
        cx.fillStyle = INK;
        cx.beginPath(); cx.arc(p.x, p.y, p.size, 0, TAU); cx.fill();
      }
      cx.globalAlpha = 1;
    },

    pointer(e) {
      lastInput = performance.now() / 1000 || 0; // frame t와 동일 축 근사
      if (e.type === 'up') { prev = null; return; }
      const p = { x: e.x, y: e.y };
      if (e.type === 'down') { prev = p; return; }
      if (!prev) { prev = p; return; }
      // prev→p 선분이 현 y를 가로지르는 첫 현 하나만 튕긴다(이벤트당 1회).
      const xmin = W * 0.08, xmax = W * 0.92;
      let picked = null, pickX = 0;
      for (const s of strings) {
        const a = prev.y - s.y, b = p.y - s.y;
        if (a === 0 && b === 0) continue;
        if ((a <= 0 && b > 0) || (a >= 0 && b < 0)) {
          const tt = a === b ? 0 : a / (a - b);
          const cxs = lerp(prev.x, p.x, tt);
          if (cxs >= xmin && cxs <= xmax) { picked = s; pickX = cxs; break; }
        }
      }
      if (picked) pluck(picked, pickX);
      prev = p;
    },

    resize(w, h) { W = w; H = h; setup(); background(); for (const s of strings) drawString(s); },

    dispose() {
      cx = null; cv = null; audio = null; prev = null;
      strings = []; dots = []; lastInput = 0; lastAuto = 0; started = false;
    },
  };
})();
