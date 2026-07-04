// 결 · GYEOL — 4관 여백 · 숨(息) Breath
// 한지 위 먹 원 하나. 들숨 4초·날숨 6초의 호흡으로 천천히 부풀고 잦아든다.
// 가장자리는 발묵처럼 번지고, 배경 원주에 극세 동심원 파문이 인다.
// 누르는 동안 숨을 멈춰 미세히 떨리고, 떼면 크게 한 번 내쉰다.
// 의도적 미니멀 — 요소를 더하지 않는다. 여백이 곧 그림이다.
import { fitCanvas, clamp, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio;
  let W = 0, H = 0, dpr = 1, cxp = 0, cyp = 0, baseR = 0;
  let bt = 0;               // 호흡 시계(초)
  let held = false;         // 누르는 동안 호흡 정지
  let pulse = 0;            // 날숨 팽창(떼는 순간 0.5 → 감쇠)
  let trem = 0;             // 떨림 위상

  const PAPER = '#EDE6D6';  // 한지
  const INK = '14,12,10';   // 먹 #0E0C0A (rgb 성분)

  const ease = x => x * x * (3 - 2 * x);

  // 들숨 4s(0→1) · 날숨 6s(1→0)
  function breathAt(sec) {
    const p = ((sec % 10) + 10) % 10;
    if (p < 4) return ease(p / 4);
    return 1 - ease((p - 4) / 6);
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cxp = W / 2; cyp = H / 2;
    baseR = Math.min(W, H) * 0.17;
  }

  function render() {
    const breath = breathAt(bt);
    let R = baseR * (1 + 0.18 * breath) * (1 + pulse);
    if (held) R += Math.sin(trem * 13) * baseR * 0.006 + Math.sin(trem * 7.3) * baseR * 0.004;

    cx.fillStyle = PAPER;
    cx.fillRect(0, 0, W, H);

    // 배경 원주의 극세 동심원 파문
    cx.lineWidth = 0.5;
    for (let i = 1; i <= 5; i++) {
      const rr = R * (1.15 + i * 0.16) + breath * 4;
      cx.strokeStyle = `rgba(${INK},${0.05 - i * 0.008})`;
      cx.beginPath(); cx.arc(cxp, cyp, rr, 0, TAU); cx.stroke();
    }

    // 먹 원 — 발묵 3겹 번짐(radial gradient)
    const g = cx.createRadialGradient(cxp, cyp, 1, cxp, cyp, R * 1.28);
    g.addColorStop(0.0, `rgba(${INK},1)`);
    g.addColorStop(0.62, `rgba(${INK},1)`);       // 1겹: 짙은 심
    g.addColorStop(0.82, `rgba(${INK},0.7)`);      // 2겹: 번짐 시작
    g.addColorStop(0.94, `rgba(${INK},0.25)`);     // 3겹: 옅은 발묵
    g.addColorStop(1.0, `rgba(${INK},0)`);
    cx.fillStyle = g;
    cx.beginPath(); cx.arc(cxp, cyp, R * 1.28, 0, TAU); cx.fill();
  }

  return {
    init(ctx) {
      cv = ctx.canvas; audio = ctx.audio;
      W = ctx.width; H = ctx.height;
      setup();
      render();
    },

    frame(t, dt) {
      if (held) { trem += dt; }
      else { bt += dt; }
      if (pulse > 0.0001) pulse *= Math.exp(-dt / 0.9); else pulse = 0;
      render();
    },

    pointer(e) {
      if (e.type === 'down') { held = true; trem = 0; }
      else if (e.type === 'up') {
        if (held) {
          held = false;
          pulse = 0.5;                                  // 1.5배 팽창 후 복귀
          if (audio) audio.tone({ deg: 0, oct: -2, vol: 0.15, dur: 3 });
        }
      }
    },

    resize(w, h) { W = w; H = h; setup(); render(); },

    dispose() { cx = null; cv = null; audio = null; held = false; pulse = 0; },
  };
})();
