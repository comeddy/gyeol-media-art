// 결 · GYEOL — 3관 훈민 · 정음 별자리(Jeongeum Constellation)
// 밤하늘에 흩어진 자모 별을 손끝(또는 포인터)으로 끌어, 초성 별을 중성 별에 겹치면
// 음절이 합성되어 큰 글자로 잠시 떠오르고 두 별 사이에 별자리 선이 영구히 이어진다.
// 손 미가용(hands.available===false)이면 포인터 드래그로 동일 조작 — 권한 요청은 하지 않는다.
import { fitCanvas, mulberry32, clamp, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio, hands;
  let W = 0, H = 0, dpr = 1;
  let micro = [], stars = [], links = [], syllables = [];
  let held = -1, pinchPrev = false;
  let ptr = { x: 0, y: 0, down: false };
  let rnd = mulberry32(0x6a656f);

  // 초성 7 + 중성 7. code = 한글 조합용 초성/중성 인덱스.
  const CHO = [['ㄱ', 0], ['ㄴ', 2], ['ㄷ', 3], ['ㅁ', 6], ['ㅅ', 9], ['ㅇ', 11], ['ㅈ', 12]];
  const JUNG = [['ㅏ', 0], ['ㅓ', 4], ['ㅗ', 8], ['ㅜ', 13], ['ㅡ', 18], ['ㅣ', 20], ['ㅑ', 2]];
  const INK = '#0E0C0A', PAPER = '#EDE6D6', BLUE = '#2C5F93', GOLD = '#E3A81C';
  const SNAP = 30, GRAB = 64;

  const compose = (cho, jung) => String.fromCharCode(0xAC00 + (cho * 21 + jung) * 28);

  function build() {
    micro = [];
    for (let i = 0; i < 200; i++) micro.push({ x: rnd() * W, y: rnd() * H, r: 0.4 + rnd() * 1.1, ph: rnd() * TAU });
    stars = [];
    const place = (list, kind) => list.forEach(([ch, code]) => {
      stars.push({ ch, code, kind, x: (0.1 + rnd() * 0.8) * W, y: (0.12 + rnd() * 0.76) * H });
    });
    place(CHO, 'cho'); place(JUNG, 'jung');
    links = []; syllables = []; held = -1;
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillStyle = INK; cx.fillRect(0, 0, W, H); // 배경 즉시
  }

  function nearest(x, y, max) {
    let bi = -1, bd = max * max;
    for (let i = 0; i < stars.length; i++) {
      const dx = stars[i].x - x, dy = stars[i].y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  }

  // 잡고 있던 별을 놓을 때: 반대 종류의 별이 SNAP 이내면 음절 합성.
  function tryCompose(i, t) {
    const s = stars[i];
    for (let j = 0; j < stars.length; j++) {
      if (stars[j].kind === s.kind) continue;
      const dx = stars[j].x - s.x, dy = stars[j].y - s.y;
      if (dx * dx + dy * dy > SNAP * SNAP) continue;
      const cho = s.kind === 'cho' ? s : stars[j];
      const jung = s.kind === 'cho' ? stars[j] : s;
      const ch = compose(cho.code, jung.code);
      syllables.push({ ch, x: (s.x + stars[j].x) / 2, y: (s.y + stars[j].y) / 2, until: t + 2 });
      links.push([i, j]);
      if (audio) audio.tone({ deg: 4, vol: 0.2, dur: 1.0 });
      return;
    }
  }

  return {
    init(ctx) {
      audio = ctx.audio; cv = ctx.canvas; hands = ctx.hands;
      W = ctx.width; H = ctx.height;
      setup(); build();
    },

    frame(t, dt) {
      // 입력원: 손이 있으면 검지끝(landmark 8)+pinch, 없으면 포인터 드래그(동일 조작)
      const hs = hands && typeof hands.get === 'function' ? hands.get() : [];
      let cxp, cyp, active, pinch;
      if (hs.length && hs[0].landmarks && hs[0].landmarks[8]) {
        const lm = hs[0].landmarks[8];
        cxp = (1 - lm.x) * W; cyp = lm.y * H; active = true; pinch = hs[0].pinch < 0.05;
      } else {
        cxp = ptr.x; cyp = ptr.y; active = ptr.down; pinch = ptr.down;
      }
      if (pinch) {
        if (held < 0) held = nearest(cxp, cyp, GRAB);
        if (held >= 0) { stars[held].x = clamp(cxp, 0, W); stars[held].y = clamp(cyp, 0, H); }
      } else {
        if (pinchPrev && held >= 0) tryCompose(held, t);
        held = -1;
      }
      pinchPrev = pinch;

      cx.fillStyle = INK; cx.fillRect(0, 0, W, H);
      cx.fillStyle = PAPER;
      for (const m of micro) {
        cx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6 + m.ph));
        cx.fillRect(m.x, m.y, m.r, m.r);
      }
      cx.globalAlpha = 1;

      cx.strokeStyle = 'rgba(227,168,28,0.55)'; cx.lineWidth = 1;
      for (const [a, b] of links) {
        cx.beginPath(); cx.moveTo(stars[a].x, stars[a].y); cx.lineTo(stars[b].x, stars[b].y); cx.stroke();
      }

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i], glow = s.kind === 'cho' ? BLUE : GOLD;
        const g = cx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 26);
        g.addColorStop(0, glow); g.addColorStop(1, 'rgba(0,0,0,0)');
        cx.globalAlpha = i === held ? 0.95 : 0.6;
        cx.fillStyle = g; cx.beginPath(); cx.arc(s.x, s.y, 26, 0, TAU); cx.fill();
        cx.globalAlpha = 1;
        cx.fillStyle = PAPER; cx.font = '24px "Gowun Batang", serif';
        cx.fillText(s.ch, s.x, s.y);
      }

      if (active) {
        cx.strokeStyle = GOLD; cx.lineWidth = 2;
        cx.beginPath(); cx.arc(cxp, cyp, pinch ? 8 : 12, 0, TAU); cx.stroke();
        cx.globalAlpha = 0.85; cx.fillStyle = GOLD;
        cx.beginPath(); cx.arc(cxp, cyp, 2.5, 0, TAU); cx.fill(); cx.globalAlpha = 1;
      }

      if (syllables.length) {
        syllables = syllables.filter((s) => s.until > t);
        cx.fillStyle = PAPER;
        for (const s of syllables) {
          const life = clamp(s.until - t, 0, 2);
          cx.globalAlpha = clamp(life, 0, 1);
          const sz = 62 + (2 - life) * 24;
          cx.font = `${sz.toFixed(0)}px "Gowun Batang", serif`;
          cx.fillText(s.ch, s.x, s.y - 44);
        }
        cx.globalAlpha = 1;
      }
    },

    pointer(e) {
      if (e.type === 'down') { ptr.down = true; ptr.x = e.x; ptr.y = e.y; }
      else if (e.type === 'move') { ptr.x = e.x; ptr.y = e.y; }
      else if (e.type === 'up') { ptr.down = false; }
    },

    resize(w, h) { W = w; H = h; setup(); build(); },

    dispose() { micro = []; stars = []; links = []; syllables = []; held = -1; cx = null; },
  };
})();
