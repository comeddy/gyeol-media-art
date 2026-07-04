// 결 · GYEOL — 3관 훈민 · 자모 우주(Jamo Cosmos)
// 흩어진 자모 입자가 9초 주기로 한 낱말로 모였다 다시 별처럼 흩어진다.
// 글자→타깃: 오프스크린에 낱말을 크게 렌더 → getImageData 알파 샘플(6px 간격) → 타깃 점.
//   샘플링은 낱말이 바뀔 때만(매 프레임 금지). 자모 글리프는 색상별 스프라이트로 1회 캐시.
import { fitCanvas, noise2, mulberry32, clamp, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio, off, octx;
  let W = 0, H = 0, dpr = 1;
  let parts = [], sprites = null, targets = [];
  let rnd = mulberry32(0x3A303);
  let cycle = -1, toned = false, ptr = null;

  const N = 700, PERIOD = 9, STEP = 6, SPRITE = 34;
  const WORDS = ['결', '숨', '빛', '물', '바람', '새벽'];
  const JAMO = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
    'ㅏ','ㅑ','ㅓ','ㅕ','ㅗ','ㅛ','ㅜ','ㅠ','ㅡ','ㅣ'];
  const INK = '#0E0C0A';
  const HUES = ['#EDE6D6', '#EDE6D6', '#EDE6D6', '#E3A81C', '#2C5F93']; // 한지 위주 + 황·청 악센트

  function makeSet(color) {
    return JAMO.map((ch) => {
      const s = document.createElement('canvas');
      s.width = SPRITE; s.height = SPRITE;
      const g = s.getContext('2d');
      g.font = '22px "Gowun Batang", serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = color;
      g.fillText(ch, SPRITE / 2, SPRITE / 2 + 1);
      return s;
    });
  }

  function initParts() {
    parts = [];
    for (let i = 0; i < N; i++) {
      parts.push({
        x: rnd() * W, y: rnd() * H, vx: 0, vy: 0,
        set: (rnd() * HUES.length) | 0, gi: (rnd() * JAMO.length) | 0,
        size: 12 + rnd() * 6, a: 0.35 + rnd() * 0.5, tx: 0, ty: 0,
      });
    }
  }

  function sampleWord(word) {
    const ow = off.width, oh = off.height;
    octx.clearRect(0, 0, ow, oh);
    octx.fillStyle = '#fff';
    const fs = Math.min(oh * 0.62, (ow * 0.9) / Math.max(1, word.length) * 1.5);
    octx.font = `700 ${fs}px "Gowun Batang", serif`;
    octx.textAlign = 'center'; octx.textBaseline = 'middle';
    octx.fillText(word, ow / 2, oh / 2);
    const d = octx.getImageData(0, 0, ow, oh).data;
    const pts = [];
    for (let y = 0; y < oh; y += STEP) {
      for (let x = 0; x < ow; x += STEP) {
        if (d[(y * ow + x) * 4 + 3] > 128) pts.push({ x, y });
      }
    }
    // 셔플(Fisher–Yates) 후 파티클에 순환 배정
    for (let i = pts.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0; const t = pts[i]; pts[i] = pts[j]; pts[j] = t;
    }
    return pts;
  }

  function assignTargets() {
    if (!targets.length) return;
    for (let i = 0; i < parts.length; i++) {
      const p = targets[i % targets.length];
      parts[i].tx = p.x; parts[i].ty = p.y;
    }
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!off) { off = document.createElement('canvas'); octx = off.getContext('2d', { willReadFrequently: true }); }
    off.width = Math.max(1, W); off.height = Math.max(1, H);
    if (!sprites) sprites = HUES.map(makeSet);
    cx.fillStyle = INK; cx.fillRect(0, 0, W, H); // 배경 즉시
  }

  return {
    init(ctx) {
      audio = ctx.audio; cv = ctx.canvas; W = ctx.width; H = ctx.height;
      setup(); initParts(); cycle = -1;
    },

    frame(t, dt) {
      const c = Math.floor(t / PERIOD);
      if (c !== cycle) { cycle = c; targets = sampleWord(WORDS[((c % WORDS.length) + WORDS.length) % WORDS.length]); assignTargets(); toned = false; }
      const ph = t - c * PERIOD;
      const gather = ph < 6 && targets.length > 0;
      if (!toned && gather && ph >= 2 && audio) { audio.tone({ deg: 0, vol: 0.15, dur: 0.9 }); toned = true; }

      const damp = 1 - clamp(dt * 3.4, 0, 0.85);
      for (const p of parts) {
        if (gather) { p.vx += (p.tx - p.x) * 5.5 * dt; p.vy += (p.ty - p.y) * 5.5 * dt; }
        else {
          const ang = noise2(p.x * 0.0018, p.y * 0.0018 + t * 0.05) * TAU * 2;
          p.vx += Math.cos(ang) * 14 * dt; p.vy += Math.sin(ang) * 14 * dt;
        }
        if (ptr) {
          const dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy, R = 120;
          if (d2 < R * R) { const d = Math.sqrt(d2) || 1; const f = (1 - d / R) * 620; p.vx += (dx / d) * f * dt; p.vy += (dy / d) * f * dt; }
        }
        p.vx *= damp; p.vy *= damp;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -20) p.x += W + 40; else if (p.x > W + 20) p.x -= W + 40;
        if (p.y < -20) p.y += H + 40; else if (p.y > H + 20) p.y -= H + 40;
      }

      cx.fillStyle = INK; cx.fillRect(0, 0, W, H);
      for (const p of parts) {
        cx.globalAlpha = p.a;
        const sp = sprites[p.set][p.gi];
        cx.drawImage(sp, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      cx.globalAlpha = 1;
    },

    pointer(e) {
      if (e.type === 'down' || e.type === 'move') ptr = { x: e.x, y: e.y };
      else if (e.type === 'up') ptr = null;
    },

    resize(w, h) { W = w; H = h; setup(); assignTargets(); },

    dispose() { parts = []; sprites = null; targets = []; off = null; octx = null; cx = null; ptr = null; },
  };
})();
