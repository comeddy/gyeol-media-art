// 결 · GYEOL — 2관 오방 · 오방진(五方陣)
// 오방색 입자 600개가 세 진형(오방진·일자진·원진)을 12초마다 갈아입으며
// 스프링으로 제 자리를 찾아간다. 포인터는 반경 120px 척력으로 진을 흩는다.
import { fitCanvas, TAU } from '../core/canvas.js';

const OBANG = ['#C23B22', '#2C5F93', '#E3A81C', '#EDE6D6', '#1A1611']; // 적·청·황·백·흑
const N = 600;
const GS = N / 5;            // 군당 입자 수 = 120
const CYCLE = 12;            // 진형 전환 주기(초)
const REP_R = 120;           // 포인터 척력 반경(px)

export default (() => {
  let cv, cx, audio;
  let W = 0, H = 0, dpr = 1;
  let px, py, vx, vy, grp, gidx, targets;
  let mode = 0, timer = 0;
  let ptr = null;             // {x,y} 포인터 위치(누름/이동 중)

  function alloc() {
    px = new Float32Array(N); py = new Float32Array(N);
    vx = new Float32Array(N); vy = new Float32Array(N);
    grp = new Uint8Array(N); gidx = new Uint16Array(N);
    for (let i = 0; i < N; i++) {
      grp[i] = i % 5;
      gidx[i] = (i / 5) | 0;
      px[i] = Math.random() * W;
      py[i] = Math.random() * H;
    }
    targets = new Float32Array(N * 2);
  }

  // 진형별 목표점 계산. mode 0=오방진 1=일자진 2=원진.
  function computeTargets() {
    const cx0 = W / 2, cy0 = H / 2, s = Math.min(W, H);
    const cardinals = [[cx0, cy0], [cx0 + s * 0.33, cy0], [cx0 - s * 0.33, cy0],
      [cx0, cy0 + s * 0.33], [cx0, cy0 - s * 0.33]];
    for (let i = 0; i < N; i++) {
      const g = grp[i], j = gidx[i];
      let x, y;
      if (mode === 0) {                       // 오방진: 중앙 + 동서남북 원
        const c = cardinals[g];
        const ang = (j / GS) * TAU;
        const rr = s * 0.06 + (((j * 7) % GS) / GS) * s * 0.05;
        x = c[0] + Math.cos(ang) * rr; y = c[1] + Math.sin(ang) * rr;
      } else if (mode === 1) {                // 일자진: 가로 5열
        x = W * 0.12 + (j / (GS - 1)) * W * 0.76;
        y = cy0 + (g - 2) * s * 0.15;
      } else {                                // 원진: 동심원 5겹
        const rr = s * 0.11 + g * s * 0.075;
        const ang = (j / GS) * TAU + g * 0.35;
        x = cx0 + Math.cos(ang) * rr; y = cy0 + Math.sin(ang) * rr;
      }
      targets[i * 2] = x; targets[i * 2 + 1] = y;
    }
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function step() {
    const hasPtr = ptr !== null;
    for (let i = 0; i < N; i++) {
      const tx = targets[i * 2], ty = targets[i * 2 + 1];
      let ax = vx[i], ay = vy[i];
      ax += (tx - px[i]) * 0.02;
      ay += (ty - py[i]) * 0.02;
      if (hasPtr) {
        const dx = px[i] - ptr.x, dy = py[i] - ptr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < REP_R * REP_R) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / REP_R) * 4.5;
          ax += (dx / d) * f; ay += (dy / d) * f;
        }
      }
      ax *= 0.92; ay *= 0.92;
      vx[i] = ax; vy[i] = ay;
      px[i] += ax; py[i] += ay;
    }
  }

  function render() {
    cx.fillStyle = 'rgba(14,12,10,0.30)'; // 먹빛 잔상
    cx.fillRect(0, 0, W, H);
    for (let g = 0; g < 5; g++) {
      cx.fillStyle = OBANG[g];
      cx.beginPath();
      const r = g === 4 ? 2.6 : 2.2;        // 흑 군은 살짝 크게(가독)
      for (let i = g; i < N; i += 5) {
        cx.moveTo(px[i] + r, py[i]);
        cx.arc(px[i], py[i], r, 0, TAU);
      }
      cx.fill();
    }
  }

  return {
    init(ctx) {
      audio = ctx.audio;
      cv = ctx.canvas;
      W = ctx.width; H = ctx.height;
      setup();
      alloc();
      computeTargets();
      cx.fillStyle = '#0E0C0A';
      cx.fillRect(0, 0, W, H);
      render();
    },

    frame(t, dt) {
      timer += dt;
      if (timer >= CYCLE) {
        timer -= CYCLE;
        mode = (mode + 1) % 3;
        computeTargets();
        if (audio) audio.tone({ deg: 3, oct: -1, vol: 0.1, dur: 0.7, type: 'sine' });
      }
      step();
      render();
    },

    pointer(e) {
      if (e.type === 'up') ptr = null;
      else ptr = { x: e.x, y: e.y };
    },

    resize(w, h) {
      W = w; H = h; setup();
      for (let i = 0; i < N; i++) { px[i] = Math.min(px[i], W); py[i] = Math.min(py[i], H); }
      computeTargets();
    },

    dispose() {
      px = py = vx = vy = grp = gidx = targets = null;
      cx = null; cv = null; audio = null; ptr = null;
    },
  };
})();
