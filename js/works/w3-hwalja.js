// 결 · GYEOL — 3관 훈민 · 활자 비(Type Rain)
// 한지 위로 훈민정음 서문의 낱글자가 세로 컬럼으로 쏟아진다(고서 세로쓰기 — 오른쪽 컬럼부터).
// 글자색은 먹, 각 컬럼 선두 글자는 주묵색(낙관 느낌). 포인터 반경 80px 안 글자는 옆으로 비켜난다.
import { fitCanvas, mulberry32, clamp } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio;
  let W = 0, H = 0, dpr = 1;
  let glyphs = [], rnd = mulberry32(0x687776);
  let colW = 0, fontSize = 20, gap = 28, per = 8, seq = 0;
  let ptr = null;

  const COLS = 24;
  // 훈민정음 서문 (현대 표기 혼용) — 낱글자 단위로 방류
  const TEXT = '나랏말싸미듕귁에달아문자와로서르사맛디아니할쌔이런젼차로어린백셩이니르고져홀배이셔도마참내제뜨들시러펴디몯할노미하니라';
  const CHARS = [...TEXT];
  const PAPER = '#EDE6D6', INK = '#1A1611', VERMILION = '#C23B22';

  function build() {
    glyphs = [];
    colW = W / COLS;
    fontSize = clamp(colW * 0.62, 15, 26);
    gap = fontSize * 1.35;
    per = Math.ceil(H / gap) + 2;
    seq = 0;
    for (let k = 0; k < COLS; k++) {
      const co = COLS - 1 - k;                 // 시각상 오른쪽 컬럼부터 채운다
      const homeX = (co + 0.5) * colW;
      const spd = 42 + rnd() * 42;             // 컬럼마다 다른 낙하 속도
      const off0 = rnd() * gap;                // 컬럼별 위상차(정렬 방지) — 입장 즉시 화면 전체를 채운다
      for (let r = 0; r < per; r++) {
        glyphs.push({ col: co, homeX, x: homeX, vx: 0, y: r * gap - off0, ch: CHARS[seq++ % CHARS.length], spd });
      }
    }
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillStyle = PAPER; cx.fillRect(0, 0, W, H); // 배경 즉시
  }

  return {
    init(ctx) {
      audio = ctx.audio; cv = ctx.canvas; W = ctx.width; H = ctx.height;
      setup(); build();
    },

    frame(t, dt) {
      const damp = 1 - clamp(dt * 6, 0, 0.9);
      const minY = new Float32Array(COLS).fill(1e9);
      const head = new Int32Array(COLS).fill(-1);

      for (let i = 0; i < glyphs.length; i++) {
        const g = glyphs[i];
        g.y += g.spd * dt;
        if (g.y > H + gap) { g.y -= per * gap; g.ch = CHARS[seq++ % CHARS.length]; }
        // 옆으로 비켜남: 복귀 스프링 + 포인터 척력(수평)
        g.vx += (g.homeX - g.x) * 55 * dt;
        if (ptr) {
          const dx = g.x - ptr.x, dy = g.y - ptr.y, d = Math.hypot(dx, dy);
          if (d < 80) { const f = (1 - d / 80) * 950; g.vx += (dx / (d || 1)) * f * dt; }
        }
        g.vx *= damp;
        g.x += g.vx * dt;
        if (g.y < minY[g.col]) { minY[g.col] = g.y; head[g.col] = i; }
      }

      // 한지 배경 + 고서 괘선
      cx.fillStyle = PAPER; cx.fillRect(0, 0, W, H);
      cx.strokeStyle = 'rgba(26,22,17,0.06)'; cx.lineWidth = 1;
      for (let c = 1; c < COLS; c++) { const x = c * colW; cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); }

      cx.font = `${fontSize.toFixed(1)}px "Gowun Batang", serif`;
      // 먹 글자
      cx.fillStyle = INK;
      for (let i = 0; i < glyphs.length; i++) {
        if (head[glyphs[i].col] === i) continue;
        const g = glyphs[i];
        if (g.y < -gap || g.y > H + gap) continue;
        cx.fillText(g.ch, g.x, g.y);
      }
      // 컬럼 선두 글자 = 주묵(낙관)
      cx.fillStyle = VERMILION;
      for (let c = 0; c < COLS; c++) {
        const i = head[c]; if (i < 0) continue;
        const g = glyphs[i];
        if (g.y < -gap || g.y > H + gap) continue;
        cx.fillText(g.ch, g.x, g.y);
      }
    },

    pointer(e) {
      if (e.type === 'down' || e.type === 'move') ptr = { x: e.x, y: e.y };
      else if (e.type === 'up') ptr = null;
      if (e.type === 'down' && audio) audio.tone({ deg: clamp((e.x / W * 5) | 0, 0, 4), oct: -1, vol: 0.14, dur: 0.6 });
    },

    resize(w, h) { W = w; H = h; setup(); build(); },

    dispose() { glyphs = []; cx = null; ptr = null; },
  };
})();
