// 결 · GYEOL — 4관 여백 · 보름달(滿月) Full Moon
// 먹빛 밤하늘 위 보름달. 크레이터 음영과 2겹 헤일로.
// 구름 몇 장이 천천히 흘러 달을 가리고 드러내며, 가릴 때 달빛 산란이 번져 밝아진다.
// 포인터 드래그로 구름을 밀 수 있다. 하단에 능선 실루엣 한 겹.
import { fitCanvas, noise2, noise3, mulberry32, clamp, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, moon, mctx;
  let W = 0, H = 0, dpr = 1;
  let mx = 0, my = 0, Rm = 0;
  let clouds = [];
  let last = null;              // 드래그 이전 포인터

  const SKY_TOP = [10, 9, 8], SKY_BOT = [22, 20, 17];

  function buildMoon() {
    const d = Math.ceil(Rm * 2) + 2;
    moon = document.createElement('canvas');
    moon.width = d; moon.height = d;
    mctx = moon.getContext('2d');
    const img = mctx.createImageData(d, d);
    const data = img.data;
    const c = d / 2, R = Rm;
    for (let y = 0; y < d; y++) {
      for (let x = 0; x < d; x++) {
        const dx = x - c, dy = y - c, r = Math.hypot(dx, dy), p = (x + y * d) * 4;
        if (r > R) { data[p + 3] = 0; continue; }
        // 구면 라이팅(좌상단 광원) + noise 크레이터
        const nz = dx / R, ny = dy / R;
        const shade = clamp(1 - (nz * 0.45 + ny * 0.4) - r / R * 0.25, 0.35, 1);
        const cr = noise2(x * 0.06, y * 0.06) * 0.5 + noise2(x * 0.16, y * 0.16) * 0.25;
        const b = clamp(shade - Math.max(0, cr) * 0.35, 0.3, 1);
        const edge = clamp((R - r) / 3, 0, 1);   // 가장자리 안티에일리어싱
        data[p] = 233 * b; data[p + 1] = 228 * b; data[p + 2] = 216 * b;
        data[p + 3] = 255 * edge;
      }
    }
    mctx.putImageData(img, 0, 0);
  }

  function makeClouds() {
    const rand = mulberry32(0xb03ead);
    const n = 5;                                   // 4~6장
    clouds = [];
    for (let i = 0; i < n; i++) {
      clouds.push({
        x: rand() * W, y: H * (0.14 + rand() * 0.4),
        v: (0.4 + rand() * 0.7) * (rand() < 0.5 ? -1 : 1), // px/s 기본 표류
        push: 0, scale: 0.7 + rand() * 0.8, seed: rand() * 100,
        lobes: 6 + (rand() * 5 | 0),
      });
    }
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mx = W / 2; my = H * 0.32; Rm = Math.min(W, H) * 0.22;
    buildMoon();
  }

  function coverage() {
    // 구름이 달 중심을 얼마나 덮는가(0..1) — 헤일로 산란 강도
    let cov = 0;
    for (const c of clouds) {
      const span = Rm * 2.4 * c.scale;
      const dx = Math.abs(((c.x - mx + W * 1.5) % W) - W * 0.5); // 랩 고려한 수평거리
      const dy = Math.abs(c.y - my);
      if (dx < span && dy < Rm * 1.3) cov += (1 - dx / span) * (1 - dy / (Rm * 1.3)) * 0.6;
    }
    return clamp(cov, 0, 1);
  }

  function drawSky() {
    const g = cx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${SKY_TOP[0]},${SKY_TOP[1]},${SKY_TOP[2]})`);
    g.addColorStop(1, `rgb(${SKY_BOT[0]},${SKY_BOT[1]},${SKY_BOT[2]})`);
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);
  }

  function drawHalo(cov) {
    const a1 = 0.10 + cov * 0.30, a2 = 0.06 + cov * 0.22;
    const g1 = cx.createRadialGradient(mx, my, Rm * 0.8, mx, my, Rm * 2.6);
    g1.addColorStop(0, `rgba(233,228,216,${a1})`);
    g1.addColorStop(1, 'rgba(233,228,216,0)');
    cx.fillStyle = g1;
    cx.beginPath(); cx.arc(mx, my, Rm * 2.6, 0, TAU); cx.fill();
    const g2 = cx.createRadialGradient(mx, my, Rm, mx, my, Rm * 4.2);
    g2.addColorStop(0, `rgba(210,206,196,${a2})`);
    g2.addColorStop(1, 'rgba(210,206,196,0)');
    cx.fillStyle = g2;
    cx.beginPath(); cx.arc(mx, my, Rm * 4.2, 0, TAU); cx.fill();
  }

  function drawCloud(c, t) {
    const base = Rm * 0.9 * c.scale, spacing = base * 0.62;
    for (let j = 0; j < c.lobes; j++) {
      const off = (j - c.lobes / 2) * spacing;
      const n = noise3(j * 0.5, c.seed, t * 0.05);
      const px = c.x + off;
      const py = c.y + n * base * 0.5;
      const r = base * (0.55 + 0.5 * Math.abs(noise2(j * 0.7, c.seed)));
      for (let k = -1; k <= 1; k++) {                 // 좌·우 랩 복제
        const wx = px + k * W;
        if (wx < -r || wx > W + r) continue;
        const g = cx.createRadialGradient(wx, py, 1, wx, py, r);
        g.addColorStop(0, 'rgba(120,116,108,0.42)');
        g.addColorStop(1, 'rgba(120,116,108,0)');
        cx.fillStyle = g;
        cx.beginPath(); cx.arc(wx, py, r, 0, TAU); cx.fill();
      }
    }
  }

  function drawRidge() {
    cx.fillStyle = '#080706';
    cx.beginPath();
    cx.moveTo(0, H);
    const baseY = H * 0.86;
    for (let x = 0; x <= W; x += 8) {
      const y = baseY + noise2(x * 0.004, 7.3) * H * 0.06;
      cx.lineTo(x, y);
    }
    cx.lineTo(W, H);
    cx.closePath();
    cx.fill();
  }

  function render(t) {
    const cov = coverage();
    drawSky();
    drawHalo(cov);
    cx.drawImage(moon, mx - moon.width / 2, my - moon.height / 2);
    for (const c of clouds) drawCloud(c, t);
    drawRidge();
  }

  return {
    init(ctx) {
      cv = ctx.canvas;
      W = ctx.width; H = ctx.height;
      setup();
      makeClouds();
      render(0);
    },

    frame(t, dt) {
      for (const c of clouds) {
        c.x += (c.v + c.push) * dt;
        c.push *= Math.exp(-dt / 1.2);                 // 민 속도 감쇠
        if (c.x < -W * 0.6) c.x += W;
        if (c.x > W * 1.6) c.x -= W;
      }
      render(t);
    },

    pointer(e) {
      if (e.type === 'down') { last = { x: e.x, y: e.y }; }
      else if (e.type === 'move' && last) {
        const dx = e.x - last.x;
        // 포인터 y 근처 구름에 밀림 속도 부여
        for (const c of clouds) {
          if (Math.abs(c.y - e.y) < Rm * 1.6) c.push = clamp(c.push + dx * 4, -400, 400);
        }
        last = { x: e.x, y: e.y };
      } else if (e.type === 'up') { last = null; }
    },

    resize(w, h) { W = w; H = h; setup(); makeClouds(); render(0); },

    dispose() { cx = null; cv = null; moon = null; mctx = null; clouds = []; last = null; },
  };
})();
