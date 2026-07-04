// 결 · GYEOL — 1관 묵향 · 일필(一筆) One Stroke
// 한 번의 붓질 안에 갈필(乾)과 윤필(潤)이 함께 산다. 드래그 속도가 화법을 가른다.
// 획은 중심 폴리라인 + 좌우 브리슬 가닥(시드 고정)으로 이뤄지고, 누적된 획은
// 40초에 걸쳐 반투명 한지색 페이드로 서서히 바랜다.
// 성능: 획은 persistent 오프스크린(strokes)에 누적 렌더 — 매 프레임 재그리기 없음.
//   프레임당 비용 = paper blit + strokes 페이드 fillRect + strokes blit.
import { fitCanvas, noise2, mulberry32, lerp, clamp, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, paper, pcx, strokes, scx, audio;
  let W = 0, H = 0, dpr = 1;
  let last = null;             // 직전 포인터 점 { x, y }
  let bristles = null;         // 현재 획의 가닥 프로필 [{ frac, alpha, tone }]
  let seed = 0x1f;             // 획마다 증가하는 시드
  let rnd = mulberry32(seed);  // 갈필 끊김 판정용

  const PAPER_HI = '#EFE9DA';  // 한지 상단(살짝 밝게)
  const PAPER_LO = '#E5DDCB';  // 한지 하단
  const PAPER_RGBA = 'rgba(233,226,210,';  // 페이드 오버레이용 한지색

  function buildPaper() {
    // 한지 바탕: 수직 그라데이션(R 변화 보장) + 발 무늬 결.
    const g = pcx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PAPER_HI);
    g.addColorStop(1, PAPER_LO);
    pcx.fillStyle = g;
    pcx.fillRect(0, 0, W, H);
    // 한지 섬유 결: 옅은 가로 짧은 획 다수(시드 고정).
    const fr = mulberry32(0x9e37);
    pcx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const y = fr() * H;
      const x = fr() * W;
      const len = 30 + fr() * 120;
      const dark = fr() < 0.5;
      pcx.strokeStyle = dark ? 'rgba(120,110,92,0.05)' : 'rgba(255,252,242,0.06)';
      pcx.lineWidth = 0.6 + fr() * 1.4;
      pcx.beginPath();
      pcx.moveTo(x, y);
      pcx.quadraticCurveTo(x + len * 0.5, y + (fr() - 0.5) * 6, x + len, y + (fr() - 0.5) * 10);
      pcx.stroke();
    }
    // 미세 알갱이 결(noise) — 저빈도 큰 얼룩으로 영역별 톤 차.
    pcx.globalAlpha = 0.06;
    for (let i = 0; i < 60; i++) {
      const x = fr() * W, y = fr() * H;
      const n = noise2(x * 0.01, y * 0.01);
      pcx.fillStyle = n > 0 ? '#7a6f5c' : '#fffcf2';
      const r = 20 + fr() * 60;
      pcx.beginPath();
      pcx.arc(x, y, r, 0, TAU);
      pcx.fill();
    }
    pcx.globalAlpha = 1;
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.imageSmoothingEnabled = true;
    paper = document.createElement('canvas');
    paper.width = Math.max(1, W); paper.height = Math.max(1, H);
    pcx = paper.getContext('2d');
    strokes = document.createElement('canvas');
    strokes.width = Math.max(1, W); strokes.height = Math.max(1, H);
    scx = strokes.getContext('2d');
    scx.lineCap = 'round';
    buildPaper();
    cx.drawImage(paper, 0, 0, W, H);  // init에서 배경 즉시
  }

  function newStroke() {
    seed = (seed + 0x6d2b) >>> 0;
    rnd = mulberry32(seed);
    const n = 8 + (rnd() * 7 | 0);   // 8~14가닥
    bristles = [];
    for (let j = 0; j < n; j++) {
      bristles.push({
        frac: (n === 1 ? 0 : j / (n - 1) - 0.5),
        alpha: 0.55 + rnd() * 0.45,  // 가닥별 농담 편차
        tone: rnd(),                  // 먹 농담 3톤 선택용
      });
    }
  }

  // p0→p1 한 세그먼트를 브리슬로 렌더. dry: 0(윤필)~1(갈필).
  function drawSeg(x0, y0, x1, y1, dry, width) {
    let dx = x1 - x0, dy = y1 - y0;
    const d = Math.hypot(dx, dy);
    if (d < 0.01) return;
    const ux = dx / d, uy = dy / d;
    const nx = -uy, ny = ux;                       // 법선
    const spread = width * (0.5 + dry * 1.0);      // 갈필일수록 가닥 벌어짐
    // 윤필 번짐 헤일로(느릴 때만).
    if (dry < 0.4) {
      scx.strokeStyle = 'rgba(30,26,20,0.05)';
      scx.lineWidth = width * 1.5;
      scx.beginPath(); scx.moveTo(x0, y0); scx.lineTo(x1, y1); scx.stroke();
    }
    const bt = Math.max(0.7, width / bristles.length * (1.1 - dry * 0.5));
    for (const b of bristles) {
      if (dry > 0.15 && rnd() < dry * 0.5) continue;  // 갈필 끊김
      const off = b.frac * spread;
      const ox = nx * off, oy = ny * off;
      // 먹 농담 3톤: 짙은 흑 / 먹빛 / 옅은 먹.
      const t3 = b.tone < 0.34 ? [14, 12, 10] : b.tone < 0.7 ? [26, 22, 17] : [54, 46, 36];
      const a = clamp(lerp(0.5, 0.13, dry) * b.alpha, 0.03, 0.7);
      scx.strokeStyle = `rgba(${t3[0]},${t3[1]},${t3[2]},${a})`;
      scx.lineWidth = bt;
      scx.beginPath();
      scx.moveTo(x0 + ox, y0 + oy);
      scx.lineTo(x1 + ox, y1 + oy);
      scx.stroke();
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
      // 배경 한지를 매 프레임 새로 깔고, 획 버퍼를 서서히 바래게 한 뒤 얹는다.
      cx.drawImage(paper, 0, 0, W, H);
      const fade = clamp(dt / 40, 0, 0.02);       // 40초 페이드
      scx.save();
      scx.globalCompositeOperation = 'destination-out';
      scx.fillStyle = `rgba(0,0,0,${fade})`;
      scx.fillRect(0, 0, W, H);
      scx.restore();
      cx.drawImage(strokes, 0, 0, W, H);
    },

    pointer(e) {
      if (e.type === 'down') {
        newStroke();
        last = { x: e.x, y: e.y };
        // 붓을 대는 첫 점(작은 먹점).
        scx.fillStyle = 'rgba(20,17,13,0.5)';
        scx.beginPath(); scx.arc(e.x, e.y, 6, 0, TAU); scx.fill();
        if (audio) audio.tone({ deg: 2, oct: -1, vol: 0.12 });
      } else if (e.type === 'move' && last && bristles) {
        const dist = Math.hypot(e.x - last.x, e.y - last.y);
        const dry = clamp(dist / 25, 0, 1);
        const width = lerp(28, 6, dry);
        drawSeg(last.x, last.y, e.x, e.y, dry, width);
        last = { x: e.x, y: e.y };
      } else if (e.type === 'up') {
        last = null;
      }
    },

    resize(w, h) { W = w; H = h; setup(); },

    dispose() {
      cx = pcx = scx = null; paper = strokes = null;
      last = null; bristles = null; audio = null;
    },
  };
})();
