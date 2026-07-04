// 결 · GYEOL — 1관 묵향 · 발묵(潑墨) Bleeding Ink
// 화선지에 먹이 스며들 듯, 터치한 자리에서 먹이 번져 나간다.
// 성능: 저해상 확산 격자(cols×rows)를 offscreen ImageData에 픽셀로 찍고
//   drawImage로 확대한다 — 매 프레임 getImageData 금지. ImageData는 1회 생성 후 재사용.
import { fitCanvas, noise2, clamp } from '../core/canvas.js';

export default (() => {
  let cv, cx, off, octx, img, field, next, audio;
  let W = 0, H = 0, dpr = 1, cols = 0, rows = 0;
  let down = null;              // { x, y } (CSS px) 눌린 위치, 없으면 null
  const CELL = 5;               // 저해상 잉크 확산 격자 셀 크기(CSS px)

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

  function deposit(px, py, amt) {
    const gx = clamp(px / CELL | 0, 0, cols - 1);
    const gy = clamp(py / CELL | 0, 0, rows - 1);
    const i = gx + gy * cols;
    field[i] = clamp(field[i] + amt, 0, 1.4);
    // 붓끝 번짐: 4-이웃에도 옅게 스민다
    const side = amt * 0.35;
    if (gx > 0) field[i - 1] = clamp(field[i - 1] + side, 0, 1.4);
    if (gx < cols - 1) field[i + 1] = clamp(field[i + 1] + side, 0, 1.4);
    if (gy > 0) field[i - cols] = clamp(field[i - cols] + side, 0, 1.4);
    if (gy < rows - 1) field[i + cols] = clamp(field[i + cols] + side, 0, 1.4);
  }

  return {
    init(ctx) {
      audio = ctx.audio;
      cv = ctx.canvas;
      W = ctx.width; H = ctx.height;
      setup();
    },

    frame(t, dt) {
      // 1) 누르고 있으면 잉크 주입(오래 누를수록 짙게)
      if (down) deposit(down.x, down.y, dt * 3.2);

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
        deposit(e.x, e.y, 0.5); // 첫 점 즉시 반응
        if (audio) audio.tone({ deg: clamp(e.x * 5 / W | 0, 0, 4), oct: -1, vol: 0.15 });
      } else if (e.type === 'move' && down) {
        down = { x: e.x, y: e.y };
      } else if (e.type === 'up') {
        down = null;
      }
    },

    resize(w, h) { W = w; H = h; setup(); },

    dispose() { field = null; next = null; img = null; off = null; octx = null; cx = null; down = null; },
  };
})();
