// 결 · GYEOL — 1관 묵향 · 발묵(潑墨) Bleeding Ink
// 화선지에 먹이 스며들 듯, 터치한 자리에서 먹이 번져 나간다.
// 운필: 가우시안 붓 반경으로 낙묵하고 이전→현재 점을 보간해 획이 끊기지 않는다.
//   느린 획은 굵고 짙게(먹 고임), 빠른 획은 가늘고 옅게 + 붓결 갈필(渴筆).
// 성능: 저해상 확산 격자(cols×rows)를 offscreen ImageData에 픽셀로 찍고
//   drawImage로 확대한다 — 매 프레임 getImageData 금지. ImageData는 1회 생성 후 재사용.
import { fitCanvas, noise2, clamp } from '../core/canvas.js';

export default (() => {
  let cv, cx, off, octx, img, field, next, audio;
  let W = 0, H = 0, dpr = 1, cols = 0, rows = 0;
  let down = null;              // { x, y } (CSS px) 눌린 위치, 없으면 null
  const CELL = 5;               // 저해상 잉크 확산 격자 셀 크기(CSS px)
  const BRUSH = 14;             // 붓 기본 반경(CSS px) — 필압에 따라 0.6~1.15배
  const CAP = 1.8;              // 셀 먹 저장고 상한 — 1 초과분은 계속 번져 나가는 먹 고임

  const PAPER = [237, 230, 214]; // 한지 #EDE6D6
  const INK_LO = [26, 22, 17];   // 옅은 먹 #1A1611
  const INK_HI = [14, 12, 10];   // 짙은 먹 #0E0C0A

  function alloc() {
    cols = Math.max(1, Math.ceil(W / CELL));
    rows = Math.max(1, Math.ceil(H / CELL));
    field = new Float32Array(cols * rows);
    next = new Float32Array(cols * rows);
    off = document.createElement('canvas');
    off.width = cols; off.height = rows;
    octx = off.getContext('2d');
    img = octx.createImageData(cols, rows);
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); // CSS px 좌표계
    cx.imageSmoothingEnabled = true;       // 저해상 확대 시 부드러운 번짐
    alloc();
  }

  // 낙묵: (px,py) 중심 가우시안 붓 자국. dry(0..1)가 클수록 붓결 따라 먹이 갈라진다(갈필).
  function brush(px, py, amt, rad, dry) {
    const gx = px / CELL, gy = py / CELL;
    const r = Math.max(1, rad / CELL);
    const x0 = clamp(Math.floor(gx - r), 0, cols - 1), x1 = clamp(Math.ceil(gx + r), 0, cols - 1);
    const y0 = clamp(Math.floor(gy - r), 0, rows - 1), y1 = clamp(Math.ceil(gy + r), 0, rows - 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - gx) / r, dy = (y - gy) / r;
        const q = dx * dx + dy * dy;
        if (q > 1) continue;
        if (dry > 0 && noise2(x * 0.8, y * 0.8) < dry * 0.4) continue;
        const i = x + y * cols;
        field[i] = clamp(field[i] + amt * Math.exp(-q * 2.2), 0, CAP);
      }
    }
  }

  // 운필: 이전 점→현재 점 구간을 따라 낙묵. 이동 속도가 필압을 대신한다 —
  //   느린 획은 굵고 짙게 먹이 고이고, 빠른 획은 가늘고 옅은 갈필이 된다.
  function stroke(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const speed = clamp(len / 28, 0, 1);
    const rad = BRUSH * (1.15 - 0.5 * speed);
    const amt = 0.34 * (1.15 - 0.45 * speed);
    const dry = Math.max(0, speed - 0.5);
    const steps = Math.max(1, Math.ceil(len / (CELL * 0.9)));
    for (let s = 1; s <= steps; s++) {
      brush(a.x + dx * s / steps, a.y + dy * s / steps, amt, rad, dry);
    }
  }

  return {
    init(ctx) {
      audio = ctx.audio;
      cv = ctx.canvas;
      W = ctx.width; H = ctx.height;
      setup();
    },

    frame(t, dt) {
      // 1) 누르고 있으면 붓을 눌러 두듯 먹이 고인다(오래 누를수록 짙고 넓게)
      if (down) brush(down.x, down.y, dt * 3.5, BRUSH * 1.1, 0);

      // 2) 확산: 4-이웃 라플라시안 + 종이 결(noise2) 이방성. dt 정규화로 프레임 독립.
      const k = clamp(dt * 12, 0, 0.85);
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          const i = x + y * cols;
          const g = 0.12 + 0.10 * noise2(x * 0.15, y * 0.15);
          const lap = field[i - 1] + field[i + 1] + field[i - cols] + field[i + cols] - 4 * field[i];
          next[i] = field[i] + k * g * lap;
        }
      }
      // 경계 셀은 확산 없이 복사
      for (let x = 0; x < cols; x++) { const b = x + (rows - 1) * cols; next[x] = field[x]; next[b] = field[b]; }
      for (let y = 0; y < rows; y++) { const l = y * cols, r = l + cols - 1; next[l] = field[l]; next[r] = field[r]; }
      const tmp = field; field = next; next = tmp;

      // 3) 농도 → 먹빛 픽셀. 종이 결은 배경색에 옅은 noise 알갱이.
      const d = img.data;
      for (let y = 0, p = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++, p += 4) {
          const dens = clamp(field[x + y * cols], 0, 1);
          const grain = noise2(x * 0.6, y * 0.6) * 6;
          const a = Math.pow(dens, 0.75);       // 가장자리 번짐을 옅게
          const na = 1 - a;
          d[p]     = (PAPER[0] + grain) * na + (INK_LO[0] + (INK_HI[0] - INK_LO[0]) * dens) * a;
          d[p + 1] = (PAPER[1] + grain) * na + (INK_LO[1] + (INK_HI[1] - INK_LO[1]) * dens) * a;
          d[p + 2] = (PAPER[2] + grain) * na + (INK_LO[2] + (INK_HI[2] - INK_LO[2]) * dens) * a;
          d[p + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      cx.drawImage(off, 0, 0, cols, rows, 0, 0, W, H);
    },

    pointer(e) {
      if (e.type === 'down') {
        down = { x: e.x, y: e.y };
        // 첫 낙묵 — 기존 대비 총 먹량 약 5배. 넓게 스미는 갓 + 짙은 심의 이중 구조.
        brush(e.x, e.y, 0.45, BRUSH, 0);
        brush(e.x, e.y, 0.6, BRUSH * 0.45, 0);
        if (audio) audio.tone({ deg: clamp(e.x * 5 / W | 0, 0, 4), oct: -1, vol: 0.15 });
      } else if (e.type === 'move' && down) {
        stroke(down, e);
        down = { x: e.x, y: e.y };
      } else if (e.type === 'up') {
        down = null;
      }
    },

    resize(w, h) { W = w; H = h; setup(); },

    dispose() { field = null; next = null; img = null; off = null; octx = null; cx = null; down = null; },
  };
})();
