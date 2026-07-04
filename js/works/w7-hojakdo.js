// 결 · GYEOL — 7관 민화 · 호작도(虎鵲圖) Tiger and Magpie
// 무늬는 그리는 게 아니라 자란다. Gray-Scott 반응확산이 호랑이 실루엣 안에서 줄무늬로 번진다.
// 성능: 144×144 저해상 격자를 Float32Array 더블버퍼로 굴리고, ImageData 1회 생성 후 재사용,
//   putImageData → drawImage 확대(balmuk 패턴). getImageData는 마스크 생성 시 1회뿐.
import { fitCanvas, noise2, clamp, mulberry32, TAU } from '../core/canvas.js';

const N = 144;                          // 반응확산 격자 한 변
const ORANGE = [198, 123, 59];          // 호랑이 주황 #C67B3B
const INK = [14, 12, 10];               // 먹빛 #0E0C0A (줄무늬)
const PAPER = [237, 230, 214];          // 한지 #EDE6D6 (바깥 배경)

// 앉은 호랑이 옆모습 — 정규 좌표[0..1] 하드코딩 폴리곤(머리 좌상, 꼬리 우상, 앉은 뒷다리).
const TIGER = [
  [0.16, 0.40], [0.19, 0.34], [0.205, 0.29], [0.195, 0.24], [0.235, 0.285],
  [0.265, 0.245], [0.30, 0.30], [0.35, 0.30], [0.44, 0.26], [0.56, 0.275],
  [0.66, 0.30], [0.74, 0.34], [0.80, 0.35], [0.845, 0.29], [0.815, 0.285],
  [0.78, 0.36], [0.775, 0.46], [0.765, 0.62], [0.72, 0.78], [0.665, 0.84],
  [0.60, 0.845], [0.565, 0.74], [0.525, 0.80], [0.505, 0.845], [0.44, 0.845],
  [0.425, 0.72], [0.405, 0.845], [0.34, 0.845], [0.325, 0.72], [0.305, 0.845],
  [0.245, 0.845], [0.23, 0.70], [0.19, 0.60], [0.16, 0.50],
];

export default (() => {
  let cv, cx, off, octx, img;
  let u, v, u2, v2, mask;
  let W = 0, H = 0, dpr = 1, iters = 8;
  let down = null;                      // { x, y } CSS px, 눌린 위치 or null

  function alloc() {
    const n = N * N;
    u = new Float32Array(n); v = new Float32Array(n);
    u2 = new Float32Array(n); v2 = new Float32Array(n);
    u.fill(1); u2.fill(1);              // 경계셀은 갱신 안 함 → 양 버퍼 모두 U=1,V=0 고정
    off = document.createElement('canvas');
    off.width = N; off.height = N;
    octx = off.getContext('2d');
    img = octx.createImageData(N, N);
    buildMask();
    seed();
  }

  // 폴리곤을 격자 해상도 offscreen에 채워 그린 뒤 1회 getImageData로 마스크 비트맵 생성.
  function buildMask() {
    const c = document.createElement('canvas');
    c.width = N; c.height = N;
    const m = c.getContext('2d');
    m.fillStyle = '#000'; m.fillRect(0, 0, N, N);
    m.fillStyle = '#fff'; m.beginPath();
    for (let i = 0; i < TIGER.length; i++) {
      const x = TIGER[i][0] * N, y = TIGER[i][1] * N;
      i ? m.lineTo(x, y) : m.moveTo(x, y);
    }
    m.closePath(); m.fill();
    const d = m.getImageData(0, 0, N, N).data;
    mask = new Uint8Array(N * N);
    for (let i = 0, p = 0; i < N * N; i++, p += 4) mask[i] = d[p] > 128 ? 1 : 0;
  }

  // 마스크 안 랜덤 점 20개에 V 시드(3×3 패치). 결정적 seed.
  function seed() {
    const rand = mulberry32(0x7A1E9);
    let placed = 0, guard = 0;
    while (placed < 20 && guard++ < 2000) {
      const gx = 2 + (rand() * (N - 4) | 0), gy = 2 + (rand() * (N - 4) | 0);
      if (!mask[gx + gy * N]) continue;
      inject(gx, gy, 1);
      placed++;
    }
  }

  // 격자 좌표(gx,gy) 둘레에 V 주입 · U 소거 — 무늬 씨앗.
  function inject(gx, gy, r) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = gx + dx, y = gy + dy;
        if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1) continue;
        const i = x + y * N;
        v[i] = 0.6; u[i] = 0.2;
      }
    }
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.imageSmoothingEnabled = true;
  }

  // Gray-Scott 1스텝(dt=1) — 3×3 가중 라플라시안(직교 0.2·대각 0.05·중심 -1).
  function step() {
    const F = 0.042, k = 0.063, Du = 0.16, Dv = 0.08;
    for (let y = 1; y < N - 1; y++) {
      for (let x = 1; x < N - 1; x++) {
        const i = x + y * N;
        const uu = u[i], vv = v[i];
        const lu = (u[i - 1] + u[i + 1] + u[i - N] + u[i + N]) * 0.2
          + (u[i - 1 - N] + u[i + 1 - N] + u[i - 1 + N] + u[i + 1 + N]) * 0.05 - uu;
        const lv = (v[i - 1] + v[i + 1] + v[i - N] + v[i + N]) * 0.2
          + (v[i - 1 - N] + v[i + 1 - N] + v[i - 1 + N] + v[i + 1 + N]) * 0.05 - vv;
        const uvv = uu * vv * vv;
        u2[i] = uu + (Du * lu - uvv + F * (1 - uu));
        v2[i] = vv + (Dv * lv + uvv - (F + k) * vv);
      }
    }
    let t = u; u = u2; u2 = t;
    t = v; v = v2; v2 = t;
  }

  // 농도 → 픽셀. 마스크 안: 주황 바탕에 V가 짙을수록 먹 줄무늬. 바깥: 한지 + 옅은 결.
  function paint() {
    const d = img.data;
    for (let y = 0, i = 0, p = 0; y < N; y++) {
      for (let x = 0; x < N; x++, i++, p += 4) {
        if (mask[i]) {
          const t = clamp((v[i] - 0.1) / 0.28, 0, 1);
          d[p] = ORANGE[0] + (INK[0] - ORANGE[0]) * t;
          d[p + 1] = ORANGE[1] + (INK[1] - ORANGE[1]) * t;
          d[p + 2] = ORANGE[2] + (INK[2] - ORANGE[2]) * t;
        } else {
          const g = noise2(x * 0.5, y * 0.5) * 6;
          d[p] = PAPER[0] + g; d[p + 1] = PAPER[1] + g; d[p + 2] = PAPER[2] + g;
        }
        d[p + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
  }

  // ── 고정 데코(CSS px) — 호랑이 눈·코, 상단 가지의 까치 ───────────────────
  function eye(nx, ny) {
    const x = nx * W, y = ny * H, r = Math.min(W, H) * 0.026;
    cx.fillStyle = '#EDE6D6'; cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fill();
    cx.strokeStyle = '#0E0C0A'; cx.lineWidth = r * 0.28; cx.stroke();
    cx.fillStyle = '#0E0C0A'; cx.beginPath(); cx.arc(x - r * 0.15, y, r * 0.5, 0, TAU); cx.fill();
  }
  function magpie(t) {
    const x0 = 0.72 * W, y0 = 0.13 * H, s = Math.min(W, H) * 0.05;
    cx.save(); cx.translate(x0, y0); cx.rotate(Math.sin(t * 1.5) * 0.12);
    cx.fillStyle = '#141210';
    cx.beginPath(); cx.ellipse(0, 0, s * 0.9, s * 0.55, 0, 0, TAU); cx.fill();
    cx.beginPath(); cx.arc(-s * 0.8, -s * 0.3, s * 0.4, 0, TAU); cx.fill();
    cx.beginPath(); cx.moveTo(-s * 1.15, -s * 0.3); cx.lineTo(-s * 1.62, -s * 0.14); cx.lineTo(-s * 1.15, -s * 0.02); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(s * 0.7, 0); cx.lineTo(s * 1.9, s * 0.5); cx.lineTo(s * 1.9, s * 0.72); cx.lineTo(s * 0.7, s * 0.26); cx.closePath(); cx.fill();
    cx.fillStyle = '#EDE6D6'; cx.beginPath(); cx.ellipse(s * 0.15, s * 0.12, s * 0.4, s * 0.3, 0, 0, TAU); cx.fill();
    cx.restore();
  }
  function drawDeco(t) {
    // 상단 가지
    cx.strokeStyle = 'rgba(44,32,20,0.85)'; cx.lineWidth = Math.min(W, H) * 0.012;
    cx.beginPath(); cx.moveTo(0.52 * W, 0.05 * H);
    cx.quadraticCurveTo(0.74 * W, 0.10 * H, 0.98 * W, 0.20 * H); cx.stroke();
    magpie(t);
    // 호랑이 눈·코
    eye(0.235, 0.335); eye(0.288, 0.325);
    cx.fillStyle = '#0E0C0A';
    const nx = 0.165 * W, ny = 0.405 * H, ns = Math.min(W, H) * 0.02;
    cx.beginPath(); cx.moveTo(nx, ny - ns); cx.lineTo(nx - ns, ny + ns * 0.6); cx.lineTo(nx + ns, ny + ns * 0.6); cx.closePath(); cx.fill();
  }

  return {
    init(ctx) {
      cv = ctx.canvas; W = ctx.width; H = ctx.height;
      setup(); alloc();
      paint();
      cx.drawImage(off, 0, 0, N, N, 0, 0, W, H);
      drawDeco(0);
    },
    frame(t) {
      const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
      if (down) {
        inject(clamp(down.x / W * N | 0, 1, N - 2), clamp(down.y / H * N | 0, 1, N - 2), 2);
      }
      for (let s = 0; s < iters; s++) step();
      paint();
      cx.drawImage(off, 0, 0, N, N, 0, 0, W, H);
      drawDeco(t);
      const ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
      if (ms > 16 && iters === 8) iters = 6;   // 브리프: 초과 시 반복 8→6
    },
    pointer(e) {
      if (e.type === 'down') down = { x: e.x, y: e.y };
      else if (e.type === 'move' && down) down = { x: e.x, y: e.y };
      else if (e.type === 'up') down = null;
    },
    resize(w, h) { W = w; H = h; setup(); },   // 격자는 유지 — 계속 자라는 그림
    dispose() {
      u = v = u2 = v2 = mask = img = null;
      off = octx = cx = null; down = null;
    },
  };
})();
