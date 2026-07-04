// 결 · GYEOL — 6관 풍류 · 청(聽) Voice Scroll
// 한지 두루마리. mic level 파형이 중앙 세로축 기준 좌우 대칭 파문으로
// 기록되며 위로 스크롤한다(소리 지문이 쌓임). 조용하면 가는 먹선, 크면
// 넓은 발묵 밴드. 위쪽 오랜 기록은 옅어지고 상단 원통(두루마리 말림)으로
// 말려 든다. 마이크 미가용이면 포인터 x거리(중앙 기준)가 레벨을 대체한다.
import { fitCanvas, clamp, lerp } from '../core/canvas.js';

export default (() => {
  let cv, cx, sensors, off, octx, img;
  let W = 0, H = 0, dpr = 1, cols = 0, rows = 0;
  let levels = null;                 // 링버퍼: 0=최상단(오래됨), rows-1=최하단(최신)
  let cur = 0, acc = 0;              // 스무딩된 레벨, 행 전진 누적시간
  let ptrLevel = 0, ptrLast = -10;  // 폴백용 포인터 레벨, 마지막 입력시각
  const CELL = 6, ROWS_PER_SEC = 11;

  const PAPER = [237, 230, 214], INK = [14, 12, 10];

  function alloc() {
    cols = Math.max(8, Math.ceil(W / CELL));
    rows = Math.max(8, Math.ceil(H / CELL));
    levels = new Float32Array(rows);
    off = document.createElement('canvas');
    off.width = cols; off.height = rows;
    octx = off.getContext('2d');
    img = octx.createImageData(cols, rows);
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.imageSmoothingEnabled = true;
    alloc();
  }

  function paintBuffer() {
    const d = img.data, center = (cols - 1) / 2, soft = 3;
    for (let r = 0; r < rows; r++) {
      const lv = levels[r];
      const fade = Math.pow(r / (rows - 1), 1.15);      // 위(오래됨) 옅게
      const bandHalf = 0.6 + clamp(lv, 0, 1) * center * 0.92; // 조용=가는선
      for (let c = 0; c < cols; c++) {
        const dcol = Math.abs(c - center);
        let dens = clamp((bandHalf - dcol) / soft + 0.5, 0, 1); // 발묵 연변
        dens *= fade;
        const na = 1 - dens, p = (r * cols + c) * 4;
        d[p] = PAPER[0] * na + INK[0] * dens;
        d[p + 1] = PAPER[1] * na + INK[1] * dens;
        d[p + 2] = PAPER[2] * na + INK[2] * dens;
        d[p + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
  }

  function scrollShade() {
    // 상단 원통(두루마리 말림) — 어두운 밴드 + 아래로 페이드.
    const hh = Math.max(24, H * 0.11);
    const g = cx.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, '#3a3228'); g.addColorStop(0.55, '#8a7d63');
    g.addColorStop(1, 'rgba(237,230,214,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, W, hh);
    cx.fillStyle = 'rgba(255,250,238,0.35)';        // 원통 하이라이트
    cx.fillRect(0, hh * 0.32, W, Math.max(1, hh * 0.05));
  }

  function render() {
    paintBuffer();
    cx.drawImage(off, 0, 0, cols, rows, 0, 0, W, H);
    scrollShade();
  }

  return {
    init(ctx) {
      cv = ctx.canvas; sensors = ctx.sensors;
      W = ctx.width; H = ctx.height;
      setup();
      render();                       // init 즉시 렌더(한지+원통 음영 = 비균일)
    },

    frame(t, dt) {
      const micOn = sensors && sensors.mic.available;
      let target = micOn ? sensors.mic.level() : ptrLevel;
      if (!micOn && t - ptrLast > 0.25) ptrLevel = Math.max(0, ptrLevel - dt * 1.6);
      cur += (target - cur) * clamp(dt * 8, 0, 1);   // 부드럽게 추종
      // 시간 간격 기반 행 전진: 프레임률과 무관하게 ROWS_PER_SEC 행/초.
      acc += dt;
      const period = 1 / ROWS_PER_SEC;
      let steps = 0;
      while (acc >= period && steps < 8) {
        acc -= period; steps++;
        levels.copyWithin(0, 1);                     // 위로 스크롤
        levels[rows - 1] = clamp(cur, 0, 1);         // 최신 기록을 하단에
      }
      render();
    },

    pointer(e) {
      if (e.type === 'up') return;
      // 폴백: 중앙 기준 x거리를 레벨로. (마이크 있으면 mic가 우선)
      ptrLevel = clamp(Math.abs(e.x - W / 2) / (W / 2), 0, 1);
      ptrLast = performance.now() / 1000 || 0;
    },

    resize(w, h) { W = w; H = h; setup(); render(); },

    dispose() {
      cx = null; cv = null; sensors = null; off = null; octx = null; img = null;
      levels = null; cur = 0; acc = 0; ptrLevel = 0;
    },
  };
})();
