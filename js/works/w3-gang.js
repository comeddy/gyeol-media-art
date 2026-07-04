// 결 · GYEOL — 3관 훈민 · 글자의 강(River of Letters)
// 먹빛 화면 위 noise flow field를 따라 시구의 글자들이 강물처럼 흘러간다.
// 잔상은 청묵색 궤적으로 남아 페이드, 글자는 한지색. 탭하면 그 자리에서 시구가 새로 방류된다.
import { fitCanvas, noise2, mulberry32, clamp, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio;
  let W = 0, H = 0, dpr = 1;
  let letters = [], seq = 0;
  let rnd = mulberry32(0x64616e);

  const POEM = '흐르는 것이 어디 물뿐이랴';
  const CHARS = [...POEM].filter((c) => c.trim().length);
  const BASE = 90, CAP = 260;
  const INK = '#0E0C0A', PAPER = '#EDE6D6', TRAIL = 'rgba(44,95,147,0.2)'; // 청묵 20%

  const field = (x, y, t) => noise2(x * 0.003, y * 0.003 + t * 0.05) * TAU;

  function spawn(x, y) {
    const ch = CHARS[seq++ % CHARS.length];
    const size = 14 + rnd() * 20;
    return { ch, x, y, px: x, py: y, size, spd: 34 + rnd() * 46, a: 0.55 + rnd() * 0.45 };
  }

  function release(x, y, n) {
    for (let i = 0; i < n; i++) {
      const ox = x + (rnd() - 0.5) * 40, oy = y + (rnd() - 0.5) * 40;
      letters.push(spawn(ox, oy));
    }
    while (letters.length > CAP) letters.shift();
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.lineCap = 'round';
    cx.fillStyle = INK; cx.fillRect(0, 0, W, H); // 배경 즉시
  }

  function seed() {
    letters = []; seq = 0;
    for (let i = 0; i < BASE; i++) letters.push(spawn(rnd() * W, rnd() * H));
  }

  return {
    init(ctx) {
      audio = ctx.audio; cv = ctx.canvas; W = ctx.width; H = ctx.height;
      setup(); seed();
    },

    frame(t, dt) {
      // 잔상: 반투명 먹빛으로 화면을 덮어 이전 프레임을 서서히 지운다(궤적 페이드)
      cx.fillStyle = 'rgba(14,12,10,0.14)';
      cx.fillRect(0, 0, W, H);

      // 1) 청묵 궤적선
      cx.strokeStyle = TRAIL;
      for (const L of letters) {
        const ang = field(L.x, L.y, t);
        L.px = L.x; L.py = L.y;
        L.x += Math.cos(ang) * L.spd * dt;
        L.y += Math.sin(ang) * L.spd * dt;
        // 화면 밖으로 나가면 반대편 재진입
        let wrapped = false;
        if (L.x < -30) { L.x += W + 60; wrapped = true; } else if (L.x > W + 30) { L.x -= W + 60; wrapped = true; }
        if (L.y < -30) { L.y += H + 60; wrapped = true; } else if (L.y > H + 30) { L.y -= H + 60; wrapped = true; }
        if (wrapped) continue; // 재진입 순간의 긴 선은 그리지 않는다
        cx.lineWidth = L.size * 0.08;
        cx.beginPath(); cx.moveTo(L.px, L.py); cx.lineTo(L.x, L.y); cx.stroke();
      }

      // 2) 한지색 글자
      cx.fillStyle = PAPER;
      let fs = -1;
      for (const L of letters) {
        if (L.size !== fs) { fs = L.size; cx.font = `${fs.toFixed(1)}px "Gowun Batang", serif`; }
        cx.globalAlpha = L.a;
        cx.fillText(L.ch, L.x, L.y);
      }
      cx.globalAlpha = 1;
    },

    pointer(e) {
      if (e.type === 'down') {
        release(e.x, e.y, CHARS.length);
        if (audio) audio.tone({ deg: clamp((e.y / H * 5) | 0, 0, 4), oct: 0, vol: 0.16, dur: 0.7 });
      }
    },

    resize(w, h) { W = w; H = h; setup(); },

    dispose() { letters = []; cx = null; },
  };
})();
