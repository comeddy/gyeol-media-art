// 결 · GYEOL — 6관 풍류 · 산조(散調) Sanjo
// 오음계 마르코프 체인(인접 60%·도약 30%·반복 10%)이 장단 간격으로 스스로
// 가락을 짠다. 음마다 붓점 하나 — 음높이=y, 시간=x(좌→우), deg별 크기·농담이
// 변주되어 점묘 산수처럼 쌓인다. 탭하면 진양조→중모리→자진모리로 장단을
// 순환하고, 붓점이 오른끝에 닿으면 두루마리처럼 전체가 왼쪽으로 밀린다.
import { fitCanvas, clamp, lerp, mulberry32, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio, grad = null;
  let W = 0, H = 0, dpr = 1;
  const chain = mulberry32(0x5a17c0);

  const INK = '#0E0C0A', PAPER = '#EDE6D6', GOLD = '#E3A81C';
  // 장단: 진양조 < 중모리 < 자진모리 (빠르기 증가). 초/음.
  const JANGDAN = [
    { name: '진양조', sec: 3.2 }, { name: '중모리', sec: 1.6 }, { name: '자진모리', sec: 0.55 },
  ];
  // deg 0궁 → 4우. 낮은 음은 크고 짙게, 높은 음은 작게. 오음별 농담(먹·흑·청·적·금).
  const DEG_COLOR = ['#1A1611', '#0E0C0A', '#2C5F93', '#C23B22', '#E3A81C'];

  let deg = 0, ji = 0;              // 현재 음, 장단 인덱스
  let lastNote = 0, cursorX = 0, step = 0;
  let dots = [];                    // {x,y,r,color,alpha}

  function yFor(d) { return lerp(H * 0.82, H * 0.18, d / 4); }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.textBaseline = 'top';
    grad = cx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#141210'); grad.addColorStop(1, INK);
    step = Math.max(10, W * 0.022);
    cursorX = W * 0.06;
  }

  // 마르코프 전이: 반복 10% · 인접 60% · 도약 30%.
  function nextDeg(d) {
    const r = chain();
    if (r < 0.10) return d;
    if (r < 0.70) {                            // 인접
      const dir = (d <= 0) ? 1 : (d >= 4) ? -1 : (chain() < 0.5 ? -1 : 1);
      return clamp(d + dir, 0, 4);
    }
    const jump = 2 + ((chain() * 2) | 0);      // 도약 ±2~3
    const dir = (d < 2) ? 1 : (d > 2) ? -1 : (chain() < 0.5 ? -1 : 1);
    return clamp(d + dir * jump, 0, 4);
  }

  function playNote(t) {
    deg = nextDeg(deg);
    const r = lerp(9, 4, deg / 4) + chain() * 1.6;   // 낮은음=큰 붓점
    const alpha = 0.5 + chain() * 0.35;              // 농담 변주
    dots.push({ x: cursorX, y: yFor(deg) + (chain() - 0.5) * 10, r, color: DEG_COLOR[deg], alpha });
    if (dots.length > 700) dots.shift();
    const iv = JANGDAN[ji].sec;
    if (audio) audio.tone({ deg, oct: 0, dur: clamp(iv * 0.6, 0.05, 1.4), vol: 0.22, type: 'sine' });
    // 커서 전진 — 오른끝이면 두루마리처럼 전체를 왼쪽으로 민다.
    cursorX += step;
    if (cursorX > W * 0.94) {
      cursorX = W * 0.94;
      for (let i = dots.length - 1; i >= 0; i--) {
        dots[i].x -= step;
        if (dots[i].x < -20) dots.splice(i, 1);
      }
    }
  }

  function drawScene() {
    cx.fillStyle = grad; cx.fillRect(0, 0, W, H);
    // 오음 안내선(5줄)
    cx.lineWidth = 1; cx.strokeStyle = 'rgba(237,230,214,0.08)';
    for (let d = 0; d < 5; d++) {
      const y = yFor(d);
      cx.beginPath(); cx.moveTo(W * 0.04, y); cx.lineTo(W * 0.96, y); cx.stroke();
    }
    // 붓점(점묘)
    for (const p of dots) {
      cx.globalAlpha = p.alpha;
      cx.fillStyle = p.color;
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, TAU); cx.fill();
    }
    cx.globalAlpha = 1;
    // 장단명(우상단)
    cx.fillStyle = GOLD;
    cx.font = '18px "Noto Serif KR", serif';
    cx.textAlign = 'right';
    cx.fillText(JANGDAN[ji].name, W - 18, 16);
  }

  return {
    init(ctx) {
      cv = ctx.canvas; audio = ctx.audio;
      W = ctx.width; H = ctx.height;
      setup();
      lastNote = -JANGDAN[ji].sec;   // 첫 음을 곧바로 발음
      drawScene();                   // init 즉시 렌더
    },

    frame(t, dt) {
      // 장단 간격 기반 발음(프레임당 무조건 발음 금지)
      if (t - lastNote >= JANGDAN[ji].sec) { lastNote = t; playNote(t); }
      drawScene();
    },

    pointer(e) {
      if (e.type !== 'down') return;
      ji = (ji + 1) % JANGDAN.length;   // 진양조 ↔ 중모리 ↔ 자진모리
    },

    resize(w, h) { W = w; H = h; setup(); drawScene(); },

    dispose() {
      cx = null; cv = null; audio = null; grad = null;
      dots = []; deg = 0; ji = 0; lastNote = 0; cursorX = 0;
    },
  };
})();
