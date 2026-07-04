// 결 · GYEOL — 5관 홈질(홈질 running stitch) Stitch Drawing
// 한지 위, 드래그 궤적을 스무딩한 경로에 등간격 홈질 대시를 순차로 박는다.
// 획마다 오방 실색을 순환. 30획 초과 시 오래된 획부터 옅어지며 소멸.
import { fitCanvas, noise2, clamp } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio, hanji, W = 0, H = 0, dpr = 1, tsec = 0;
  let strokes = [];         // {pts, dashes, ci, reveal, shown, done, fade, alpha}
  let cur = null, raw = [];
  let dashTotal = 0;

  const GAP = 9, DLEN = 5, TW = 1.5, MAXSTROKE = 30;
  const HANJI = '#EDE6D6';
  // 오방 실색(담채): 청·적·황·백(아이보리)·흑
  const THREAD = ['#5E7C8C', '#B24B3C', '#C39A3E', '#A99B7C', '#2E2A22'];
  let nextCi = 0;

  function makeHanji() {
    const w = Math.max(1, Math.round(W)), h = Math.max(1, Math.round(H));
    hanji = document.createElement('canvas'); hanji.width = w; hanji.height = h;
    const g = hanji.getContext('2d');
    const im = g.createImageData(w, h), d = im.data;
    const base = [237, 230, 214];
    for (let y = 0, p = 0; y < h; y++) {
      for (let x = 0; x < w; x++, p += 4) {
        const fib = noise2(x * 0.5, y * 0.06) * 6 + noise2(x * 0.05, y * 0.5) * 5;
        d[p] = clamp(base[0] + fib, 0, 255);
        d[p + 1] = clamp(base[1] + fib, 0, 255);
        d[p + 2] = clamp(base[2] + fib - 2, 0, 255);
        d[p + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.lineCap = 'round';
    makeHanji();
  }

  function rebuildDashes(s) {
    const pts = s.pts, dashes = [];
    if (pts.length < 2) { s.dashes = dashes; return; }
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      let ax = pts[i - 1].x, ay = pts[i - 1].y;
      const bx = pts[i].x, by = pts[i].y;
      let segLen = Math.hypot(bx - ax, by - ay);
      if (segLen < 1e-4) continue;
      const ux = (bx - ax) / segLen, uy = (by - ay) / segLen;
      let dist = GAP - (acc % GAP);   // 이어지는 등간격(9px) 유지
      while (dist <= segLen) {
        dashes.push({ x: ax + ux * dist, y: ay + uy * dist, ux, uy });
        dist += GAP;
      }
      acc += segLen;
    }
    s.dashes = dashes;
  }

  function pushSmoothed(s, x, y) {
    raw.push({ x, y });
    if (raw.length > 4) raw.shift();
    let sx = 0, sy = 0;
    for (const p of raw) { sx += p.x; sy += p.y; }
    const sp = { x: sx / raw.length, y: sy / raw.length };
    const last = s.pts[s.pts.length - 1];
    if (!last || Math.hypot(sp.x - last.x, sp.y - last.y) > 1.5) s.pts.push(sp);
    rebuildDashes(s);
  }

  function drawStroke(s) {
    const col = THREAD[s.ci];
    cx.globalAlpha = s.alpha;
    cx.strokeStyle = col; cx.lineWidth = TW;
    const n = Math.min(s.dashes.length, s.shown);
    cx.beginPath();
    for (let i = 0; i < n; i++) {
      const d = s.dashes[i];
      cx.moveTo(d.x - d.ux * DLEN / 2, d.y - d.uy * DLEN / 2);
      cx.lineTo(d.x + d.ux * DLEN / 2, d.y + d.uy * DLEN / 2);
    }
    cx.stroke();
    if (s.done && n === s.dashes.length && n > 0) {   // 경로 끝 매듭 점
      const e = s.dashes[n - 1];
      cx.fillStyle = col;
      cx.beginPath(); cx.arc(e.x, e.y, 2.2, 0, Math.PI * 2); cx.fill();
    }
    cx.globalAlpha = 1;
  }

  function render() {
    cx.drawImage(hanji, 0, 0, W, H);
    // 은은히 움직이는 빛(무입력에도 R채널 시변)
    const gx = W * (0.5 + 0.35 * Math.sin(tsec * 0.4));
    const gy = H * (0.5 + 0.28 * Math.cos(tsec * 0.33));
    const rg = cx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.6);
    rg.addColorStop(0, 'rgba(255,250,235,0.10)');
    rg.addColorStop(1, 'rgba(255,250,235,0)');
    cx.fillStyle = rg; cx.fillRect(0, 0, W, H);
    for (const s of strokes) drawStroke(s);
  }

  return {
    init(ctx) {
      audio = ctx.audio; cv = ctx.canvas; W = ctx.width; H = ctx.height;
      setup(); render();
    },
    frame(t, dt) {
      tsec = t;
      for (const s of strokes) {
        if (s.reveal < s.dashes.length) {
          s.reveal = Math.min(s.dashes.length, s.reveal + dt * 55);
          const ns = Math.floor(s.reveal);
          if (ns > s.shown) {
            dashTotal += ns - s.shown; s.shown = ns;
            if (audio && dashTotal % 10 === 0) audio.tone({ deg: 3, oct: 1, dur: 0.05, vol: 0.05, type: 'triangle' });
          }
        }
        if (s.fade) s.alpha = Math.max(0, s.alpha - dt * 0.4);
      }
      if (strokes.length > MAXSTROKE) { const o = strokes.find(s => !s.fade); if (o) o.fade = true; }
      strokes = strokes.filter(s => s.alpha > 0.01);
      render();
    },
    pointer(e) {
      if (e.type === 'down') {
        raw = [];
        cur = { pts: [], dashes: [], ci: nextCi, reveal: 0, shown: 0, done: false, fade: false, alpha: 1 };
        nextCi = (nextCi + 1) % THREAD.length;
        strokes.push(cur);
        pushSmoothed(cur, e.x, e.y);
      } else if (e.type === 'move' && cur) {
        pushSmoothed(cur, e.x, e.y);
      } else if (e.type === 'up' && cur) {
        cur.done = true; cur = null; raw = [];
      }
    },
    resize(w, h) { W = w; H = h; setup(); render(); },
    dispose() { cx = null; cv = null; hanji = null; strokes = []; cur = null; raw = []; },
  };
})();
