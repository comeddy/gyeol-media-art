// 결 · GYEOL — 5관 노방(노방주 sheer silk) Layered Sheer Cloth
// 반투명 담채 비단 9장이 multiply로 겹쳐, 겹칠수록 색이 깊어진다.
// 느린 부유(noise 드리프트 + 미세 회전). 포인터로 레이어를 끌 수 있다.
import { fitCanvas, noise2, mulberry32, clamp } from '../core/canvas.js';

export default (() => {
  let cv, cx, W = 0, H = 0, dpr = 1, tsec = 0;
  let layers = [];
  let grabbed = null, grabOff = { x: 0, y: 0 };

  const BG = '#E5DECE';
  const PAL = ['#A8B8C8', '#D9C9A3', '#C9A8A0', '#9FB39A', '#EDE6D6', '#B8A3C0'];

  function build() {
    const rng = mulberry32(0x5ABC5);
    const m = Math.min(W, H);
    layers = [];
    for (let i = 0; i < 9; i++) {
      const w = m * (0.25 + rng() * 0.30);
      const h = m * (0.25 + rng() * 0.30);
      layers.push({
        cx: W * (0.18 + rng() * 0.64),
        cy: H * (0.18 + rng() * 0.64),
        w, h, col: PAL[i % PAL.length],
        sx: rng() * 100, sy: rng() * 100, sr: rng() * 100,
        grabbed: false,
      });
    }
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!layers.length) build();
  }

  function centerOf(L) {
    if (L.grabbed) return { x: L.cx, y: L.cy, a: L.angle || 0 };
    const dx = noise2(L.sx, tsec * 0.05) * 26;
    const dy = noise2(L.sy, tsec * 0.05 + 50) * 26;
    const a = noise2(L.sr, tsec * 0.04) * 0.22;
    L.angle = a;
    return { x: L.cx + dx, y: L.cy + dy, a };
  }

  function render() {
    cx.globalCompositeOperation = 'source-over';
    cx.fillStyle = BG; cx.fillRect(0, 0, W, H);
    cx.globalCompositeOperation = 'multiply';
    cx.globalAlpha = 0.35;
    for (const L of layers) {
      const c = centerOf(L);
      cx.save();
      cx.translate(c.x, c.y); cx.rotate(c.a);
      cx.fillStyle = L.col;
      cx.fillRect(-L.w / 2, -L.h / 2, L.w, L.h);
      cx.restore();
    }
    // 잡힌 레이어 가장자리 은은히 밝아짐
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = 1;
    for (const L of layers) {
      if (!L.grabbed) continue;
      const c = centerOf(L);
      cx.save();
      cx.translate(c.x, c.y); cx.rotate(c.a);
      cx.strokeStyle = 'rgba(90,80,60,0.5)'; cx.lineWidth = 2.5;
      cx.strokeRect(-L.w / 2, -L.h / 2, L.w, L.h);
      cx.restore();
    }
    cx.globalCompositeOperation = 'source-over';
    cx.globalAlpha = 1;
  }

  function hit(px, py) {
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      const c = centerOf(L);
      const cos = Math.cos(-c.a), sin = Math.sin(-c.a);
      const dx = px - c.x, dy = py - c.y;
      const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
      if (Math.abs(lx) <= L.w / 2 && Math.abs(ly) <= L.h / 2) return { L, c };
    }
    return null;
  }

  return {
    init(ctx) {
      cv = ctx.canvas; W = ctx.width; H = ctx.height;
      setup(); render();
    },
    frame(t) { tsec = t; render(); },
    pointer(e) {
      if (e.type === 'down') {
        const h = hit(e.x, e.y);
        if (h) {
          grabbed = h.L; grabbed.grabbed = true;
          grabOff = { x: e.x - h.c.x, y: e.y - h.c.y };
          grabbed.cx = h.c.x; grabbed.cy = h.c.y;
          // 잡힌 레이어를 맨 위로
          layers.splice(layers.indexOf(grabbed), 1); layers.push(grabbed);
        }
      } else if (e.type === 'move' && grabbed) {
        grabbed.cx = e.x - grabOff.x; grabbed.cy = e.y - grabOff.y;
      } else if (e.type === 'up' && grabbed) {
        grabbed.grabbed = false; grabbed = null;
      }
    },
    resize(w, h) { W = w; H = h; layers = []; grabbed = null; setup(); render(); },
    dispose() { cx = null; cv = null; layers = []; grabbed = null; },
  };
})();
