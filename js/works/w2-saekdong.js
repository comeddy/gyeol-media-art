// 결 · GYEOL — 2관 오방 · 색동(色동)
// 색동저고리의 오색 띠처럼 세로 리본 16개가 노이즈로 물결진다.
// 포인터가 지나가면 그 지점에서 파동이 위아래로 전파(스프링 체인)하며 나부낀다.
import { fitCanvas, noise2, clamp } from '../core/canvas.js';

// 색동 팔레트: 적·황·청·녹·백 순환
const SAEK = ['#C23B22', '#E3A81C', '#2C5F93', '#3F7A48', '#EDE6D6'];
const MUK = '#0E0C0A';
const R = 16;      // 리본 수
const M = 48;      // 리본당 세로 노드 수(파동 체인)

export default (() => {
  let cv, cx;
  let W = 0, H = 0, dpr = 1;
  let disp, vel;                 // 각 노드의 수평 변위/속도 Float32Array(R*M)
  let lastPtr = null;            // {x,y} 직전 포인터(속도 계산용)

  const baseX = (i) => ((i + 0.5) / R) * W;
  const widthOf = (i) => 26 + 12 * Math.abs(Math.sin(i * 1.7 + 0.4)); // 24~40px

  function alloc() {
    disp = new Float32Array(R * M);
    vel = new Float32Array(R * M);
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.lineJoin = 'round';
  }

  // 1D 파동 방정식으로 변위를 갱신 — 이웃 결합으로 파가 위아래로 전파.
  function stepWave() {
    const C = 0.30, K = 0.008, DAMP = 0.955;
    for (let i = 0; i < R; i++) {
      const o = i * M;
      for (let k = 0; k < M; k++) {
        const cur = disp[o + k];
        const left = k > 0 ? disp[o + k - 1] : cur;
        const right = k < M - 1 ? disp[o + k + 1] : cur;
        const acc = (left + right - 2 * cur) * C - cur * K;
        let v = (vel[o + k] + acc) * DAMP;
        vel[o + k] = v;
        disp[o + k] = cur + v;
      }
    }
  }

  // 포인터 근처 리본의 해당 y노드에 속도 주입(빠를수록 크게).
  function inject(e) {
    const spd = lastPtr ? clamp(e.x - lastPtr.x, -50, 50) : 0;
    const k = clamp(Math.round((e.y / H) * (M - 1)), 0, M - 1);
    for (let i = 0; i < R; i++) {
      const d = Math.abs(baseX(i) - e.x);
      if (d >= 100) continue;
      const fall = 1 - d / 100;
      vel[i * M + k] += spd * 0.16 * fall;
      if (k > 0) vel[i * M + k - 1] += spd * 0.09 * fall;
      if (k < M - 1) vel[i * M + k + 1] += spd * 0.09 * fall;
    }
  }

  function render(t) {
    cx.fillStyle = MUK;
    cx.fillRect(0, 0, W, H);
    for (let i = 0; i < R; i++) {
      const bx = baseX(i), hw = widthOf(i) / 2, o = i * M;
      const xs = new Array(M);
      for (let k = 0; k < M; k++) {
        const y = (k / (M - 1)) * H;
        xs[k] = bx + 30 * noise2(y * 0.004 + i, t * 0.1) + disp[o + k];
      }
      cx.beginPath();
      for (let k = 0; k < M; k++) {                    // 왼쪽 가장자리
        const y = (k / (M - 1)) * H;
        if (k === 0) cx.moveTo(xs[k] - hw, y); else cx.lineTo(xs[k] - hw, y);
      }
      for (let k = M - 1; k >= 0; k--) {               // 오른쪽 가장자리(되돌아옴)
        const y = (k / (M - 1)) * H;
        cx.lineTo(xs[k] + hw, y);
      }
      cx.closePath();
      cx.fillStyle = SAEK[i % SAEK.length];
      cx.globalAlpha = 0.82;
      cx.fill();
      cx.globalAlpha = 1;
    }
  }

  return {
    init(ctx) {
      cv = ctx.canvas;
      W = ctx.width; H = ctx.height;
      setup();
      alloc();
      render(0);
    },

    frame(t, dt) {
      stepWave();
      render(t);
    },

    pointer(e) {
      if (e.type === 'up') { lastPtr = null; return; }
      if (e.type === 'move') inject(e);
      lastPtr = { x: e.x, y: e.y };
    },

    resize(w, h) { W = w; H = h; setup(); alloc(); },

    dispose() { disp = null; vel = null; cx = null; cv = null; lastPtr = null; },
  };
})();
