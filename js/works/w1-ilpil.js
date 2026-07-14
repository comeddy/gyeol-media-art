// 결 · GYEOL — 1관 묵향 · 일필(一筆) One Stroke
// 한 번의 붓질 안에 갈필(乾)과 윤필(潤)이 함께 산다. 드래그 속도가 화법을 가른다.
// 획 = 짙은 획심(윤필일수록 넓고 진하게) + 좌우 브리슬 가닥(시드 고정).
// 꾹 누르면(붓 정지) 먹이 스며 원형으로 번진다 — frame()에서 √시간 성장 블룸.
// 속도 판정은 EMA(drySm)로 관성을 줘 굵기가 튀지 않는다. 누적된 획은
// 40초에 걸쳐 반투명 한지색 페이드로 서서히 바랜다.
// 성능: 획은 persistent 오프스크린(strokes)에 누적 렌더 — 매 프레임 재그리기 없음.
//   프레임당 비용 = paper blit + strokes 페이드 fillRect + strokes blit.
import { fitCanvas, noise2, mulberry32, lerp, clamp, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, paper, pcx, strokes, scx, audio;
  let W = 0, H = 0, dpr = 1;
  let last = null;             // 직전 포인터 점 { x, y }
  let bristles = null;         // 현재 획의 가닥 프로필 [{ frac, alpha, tone }]
  let holdT = 0;               // 현 위치에 붓이 머문 시간(초) — 꾹 누름 번짐 축적
  let drySm = 0.35;            // 갈필/윤필 판정 관성(EMA) — 굵기 튐 방지
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
      scx.strokeStyle = 'rgba(30,26,20,0.07)';
      scx.lineWidth = width * 1.7;
      scx.beginPath(); scx.moveTo(x0, y0); scx.lineTo(x1, y1); scx.stroke();
    }
    // 획심(核): 먹이 실린 심지 — 느릴수록 넓고 짙어 힘있는 획이 된다.
    // 세그먼트가 겹치며 알파가 쌓여 윤필 중심은 거의 순먹으로 채워진다.
    scx.strokeStyle = `rgba(22,19,15,${lerp(0.45, 0.06, dry)})`;
    scx.lineWidth = width * lerp(0.9, 0.25, dry);
    scx.beginPath(); scx.moveTo(x0, y0); scx.lineTo(x1, y1); scx.stroke();
    const bt = Math.max(0.7, width / bristles.length * (1.1 - dry * 0.5));
    for (const b of bristles) {
      if (dry > 0.15 && rnd() < dry * 0.5) continue;  // 갈필 끊김
      const off = b.frac * spread;
      const ox = nx * off, oy = ny * off;
      // 먹 농담 3톤: 짙은 흑 / 먹빛 / 옅은 먹.
      const t3 = b.tone < 0.34 ? [14, 12, 10] : b.tone < 0.7 ? [26, 22, 17] : [54, 46, 36];
      const a = clamp(lerp(0.62, 0.13, dry) * b.alpha, 0.03, 0.7);
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
      last = null; holdT = 0; drySm = 0.35;   // 재마운트 시 잔여 상태 이월 방지
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
      // 꾹 누름 번짐: 붓이 머무는 동안 먹이 스며 원형으로 번진다.
      // 반지름은 √시간(확산), 짙기는 프레임마다 쌓여 중심부터 순먹이 된다.
      if (last && bristles) {
        holdT += dt;
        if (holdT > 0.12) {
          const g = clamp((holdT - 0.12) / 2.2, 0, 1);
          const r = 10 + 36 * Math.sqrt(g);
          const grad = scx.createRadialGradient(last.x, last.y, r * 0.15, last.x, last.y, r);
          grad.addColorStop(0, `rgba(16,13,10,${clamp(dt * 2.2, 0, 0.06)})`);
          grad.addColorStop(1, 'rgba(16,13,10,0)');
          scx.fillStyle = grad;
          scx.beginPath(); scx.arc(last.x, last.y, r, 0, TAU); scx.fill();
        }
      }
      cx.drawImage(strokes, 0, 0, W, H);
    },

    pointer(e) {
      if (e.type === 'down') {
        newStroke();
        last = { x: e.x, y: e.y };
        holdT = 0; drySm = 0.3;      // 붓을 막 댄 상태 — 중간보다 촉촉하게 시작
        // 붓을 대는 첫 점(먹점).
        scx.fillStyle = 'rgba(20,17,13,0.55)';
        scx.beginPath(); scx.arc(e.x, e.y, 8, 0, TAU); scx.fill();
        if (audio) audio.tone({ deg: 2, oct: -1, vol: 0.12 });
      } else if (e.type === 'move' && last && bristles) {
        const dist = Math.hypot(e.x - last.x, e.y - last.y);
        if (dist > 2.5) holdT = 0;   // 이동 재개 → 번짐 중단
        const dry = clamp(dist / 25, 0, 1);
        drySm = lerp(drySm, dry, 0.35);   // 붓 관성 — 급격한 굵기 변화 완화
        const width = lerp(40, 5, drySm);
        drawSeg(last.x, last.y, e.x, e.y, drySm, width);
        last = { x: e.x, y: e.y };
      } else if (e.type === 'up') {
        last = null; holdT = 0;
      }
    },

    resize(w, h) { W = w; H = h; setup(); },

    dispose() {
      cx = pcx = scx = null; paper = strokes = null;
      last = null; bristles = null; audio = null;
    },
  };
})();
