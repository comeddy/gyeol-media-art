// 결 · GYEOL — 1관 묵향 · 우중산수(雨中山水) Mountains in Rain
// 안개가 산을 삼켰다 다시 내어놓는다. 능선 7겹이 시차(parallax)로 겹겹이 열리고,
// 비 스트릭이 내려 하단 능선에 닿으면 되살아난다. 안개 밴드가 천천히 흐른다.
// 인터랙션: sensors.tilt() → 앞 겹일수록 큰 수평 오프셋. 데스크톱은 sensors가
//   포인터로 자동 폴백하므로 이 모듈은 tilt 값만 읽는다.
import { fitCanvas, noise2, mulberry32, lerp, clamp } from '../core/canvas.js';

export default (() => {
  let cv, cx, sensors;
  let W = 0, H = 0, dpr = 1;
  let bg = null;               // 캐시된 수직 그라데이션
  const LAYERS = 7;
  const STEP = 6;              // 능선 폴리라인 x 간격(CSS px)
  const N = 300;               // 빗줄기 수
  let rx, ry, rlen, rspd;      // 빗줄기 상태 배열

  const layer = (i) => {
    const depth = i / (LAYERS - 1);            // 0=먼 겹, 1=앞 겹
    return {
      depth,
      seed: i * 37.71,
      baseY: H * (0.30 + depth * 0.52),
      amp: lerp(26, 78, depth),
      freq: 0.0022 + depth * 0.0018,
      // 안개에 잠긴 먼 겹은 옅은 청회색, 앞 겹은 짙은 먹빛.
      col: [lerp(150, 26, depth), lerp(156, 24, depth), lerp(164, 22, depth)],
    };
  };

  function allocRain() {
    const r = mulberry32(0x2c5f93);
    rx = new Float32Array(N); ry = new Float32Array(N);
    rlen = new Float32Array(N); rspd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      rx[i] = r() * (W + 60) - 30;
      ry[i] = r() * H;
      rlen[i] = 8 + r() * 6;
      rspd[i] = 420 + r() * 300;
    }
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bg = cx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0E0C0A');   // 먹빛 하늘
    bg.addColorStop(0.55, '#3a3b3d');
    bg.addColorStop(1, '#B8B6AE');   // 회백 안개 골
    allocRain();
    drawScene(0);                    // init에서 배경 즉시
  }

  // 앞(near) 능선 y — 빗줄기 착지 판정용.
  function groundY(x, t) {
    const L = layer(LAYERS - 1);
    return L.baseY + L.amp * noise2(x * L.freq + L.seed, t * 0.02);
  }

  function drawScene(t) {
    cx.fillStyle = bg;
    cx.fillRect(0, 0, W, H);
    const tilt = sensors ? sensors.tilt() : { x: 0, y: 0 };
    for (let i = 0; i < LAYERS; i++) {
      const L = layer(i);
      const xoff = tilt.x * 40 * L.depth;
      const yoff = tilt.y * 14 * L.depth;
      cx.beginPath();
      cx.moveTo(-40, H + 10);
      for (let x = -40; x <= W + 40; x += STEP) {
        const y = L.baseY + L.amp * noise2(x * L.freq + L.seed, t * 0.02) + yoff;
        cx.lineTo(x + xoff, y);
      }
      cx.lineTo(W + 40, H + 10);
      cx.closePath();
      cx.fillStyle = `rgb(${L.col[0] | 0},${L.col[1] | 0},${L.col[2] | 0})`;
      cx.fill();
      // 안개 밴드: 겹 사이에 흐르는 옅은 띠(수평 드리프트).
      if (i === 1 || i === 3 || i === 5) {
        const cy = L.baseY - L.amp * 0.4 + yoff;
        const drift = Math.sin(t * 0.05 + i) * 30;
        const fg = cx.createLinearGradient(0, cy - 40, 0, cy + 50);
        fg.addColorStop(0, 'rgba(210,212,214,0)');
        fg.addColorStop(0.5, `rgba(214,214,210,${0.12 + 0.05 * Math.sin(t * 0.1 + i)})`);
        fg.addColorStop(1, 'rgba(210,212,214,0)');
        cx.fillStyle = fg;
        cx.fillRect(drift - 30, cy - 40, W + 60, 90);
      }
    }
  }

  function drawRain(t, dt) {
    // 살짝 기운 각도(약 11도)로 하강. 하단 능선에 닿으면 상단 재생성.
    const lean = 0.19;
    cx.strokeStyle = 'rgba(226,228,230,0.28)';
    cx.lineWidth = 1;
    cx.beginPath();
    for (let i = 0; i < N; i++) {
      ry[i] += rspd[i] * dt;
      rx[i] += rspd[i] * dt * lean;
      if (ry[i] > groundY(rx[i], t) || rx[i] > W + 30) {
        const r = ((i * 2654435761) >>> 0) / 4294967296;
        rx[i] = ((rx[i] + r * 260) % (W + 60) + (W + 60)) % (W + 60) - 30;
        ry[i] = -rlen[i] - r * H * 0.3;
      }
      const dx = rlen[i] * lean, dy = rlen[i];
      cx.moveTo(rx[i], ry[i]);
      cx.lineTo(rx[i] - dx, ry[i] - dy);
    }
    cx.stroke();
  }

  return {
    init(ctx) {
      sensors = ctx.sensors;
      cv = ctx.canvas;
      W = ctx.width; H = ctx.height;
      setup();
    },

    frame(t, dt) {
      drawScene(t);
      drawRain(t, dt);
    },

    pointer() { /* tilt은 sensors가 전역 처리 — 별도 포인터 반응 없음 */ },

    resize(w, h) { W = w; H = h; setup(); },

    dispose() {
      cx = null; bg = null; sensors = null;
      rx = ry = rlen = rspd = null;
    },
  };
})();
