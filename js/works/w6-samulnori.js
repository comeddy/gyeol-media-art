// 결 · GYEOL — 6관 풍류 · 사물놀이(四物놀이) Samulnori
// 먹빛 마당의 4방에 꽹과리·징·장구·북. 마이크 온셋(직전 0.5초 이동평균의
// 1.8배 && >0.12)을 타격으로 감지해 사물 하나가 발광하고 입자가 터진다.
// 마이크 미가용이면 탭 위치에서 가장 가까운 사물을 친다. frame의 발음은
// 온셋(이벤트)에서만 — 매 프레임 무조건 발음하지 않는다.
import { fitCanvas, clamp, mulberry32, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio, sensors;
  let W = 0, H = 0, dpr = 1;
  const rng = mulberry32(0x6d5a11);

  const INK = '#0E0C0A', PAPER = '#EDE6D6', RED = '#C23B22', GOLD = '#E3A81C';

  // 사물 4점: idx 0꽹과리 1징 2장구 3북. deg=[0,2,3,4][idx], 4방 배치.
  let sab = [];                       // {name, kind, x, y, r, color, glow}
  let sparks = [];                    // {x,y,vx,vy,life,max,size,color}
  let rings = [];                     // {x,y,r,vr,max,life,maxLife,color,w}
  const hist = new Float32Array(30);  // 직전 0.5초(30프레임) level 링버퍼
  let hi = 0, lastOnset = -1;

  function place() {
    const cxp = W / 2, cyp = H / 2, R = Math.min(W, H) * 0.31;
    const mk = Math.max(26, Math.min(W, H) * 0.085);
    sab = [
      { name: '꽹과리', kind: 'gong', x: cxp, y: cyp - R, r: mk * 0.8, color: GOLD, glow: 0 },
      { name: '징', kind: 'jing', x: cxp + R, y: cyp, r: mk * 1.15, color: PAPER, glow: 0 },
      { name: '장구', kind: 'janggu', x: cxp, y: cyp + R, r: mk, color: PAPER, glow: 0 },
      { name: '북', kind: 'buk', x: cxp - R, y: cyp, r: mk * 1.05, color: RED, glow: 0 },
    ];
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    place();
  }

  function hit(idx, intensity) {
    const s = sab[idx];
    if (!s) return;
    s.glow = Math.min(1.4, s.glow + 0.7 + intensity);
    const n = clamp(intensity, 0.2, 1);
    if (s.kind === 'gong') {                    // 꽹과리 = 금 스파크 40개
      for (let i = 0; i < 40; i++) {
        const a = rng() * TAU, sp = (70 + rng() * 320) * (0.5 + n);
        sparks.push({ x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.35 + rng() * 0.3, max: 0.65, size: 1 + rng() * 2.4, color: GOLD });
      }
    } else if (s.kind === 'jing') {             // 징 = 느린 대형 링
      rings.push({ x: s.x, y: s.y, r: s.r, vr: (60 + 40 * n), max: Math.min(W, H) * 0.6,
        life: 1.6, maxLife: 1.6, color: PAPER, w: 3 + 3 * n });
    } else if (s.kind === 'janggu') {           // 장구 = 양방(좌우) 파열
      for (let i = 0; i < 26; i++) {
        const dir = i % 2 ? 1 : -1, sp = (120 + rng() * 260) * (0.5 + n);
        sparks.push({ x: s.x, y: s.y, vx: dir * sp, vy: (rng() - 0.5) * 90,
          life: 0.4 + rng() * 0.35, max: 0.75, size: 1.2 + rng() * 2, color: PAPER });
      }
    } else {                                    // 북 = 먹 파동 링
      rings.push({ x: s.x, y: s.y, r: s.r * 0.7, vr: (150 + 120 * n), max: Math.min(W, H) * 0.5,
        life: 0.9, maxLife: 0.9, color: INK, w: 5 + 8 * n });
      rings.push({ x: s.x, y: s.y, r: s.r * 0.7, vr: (110 + 90 * n), max: Math.min(W, H) * 0.4,
        life: 0.9, maxLife: 0.9, color: RED, w: 2 + 3 * n });
    }
    if (audio) audio.tone({ deg: [0, 2, 3, 4][idx], oct: -1, dur: 0.4, vol: 0.2, type: 'triangle' });
  }

  function drawSab(s) {
    const g = clamp(s.glow, 0, 1.4);
    cx.save();
    if (g > 0.01) { cx.shadowColor = s.color; cx.shadowBlur = 24 * g; }
    cx.globalAlpha = 0.85 + 0.15 * Math.min(1, g);
    if (s.kind === 'janggu') {                  // 모래시계(장구) 실루엣
      const w = s.r * 1.15, h = s.r * 1.25;
      cx.fillStyle = s.color;
      cx.beginPath();
      cx.moveTo(s.x - w, s.y - h); cx.lineTo(s.x + w, s.y - h);
      cx.lineTo(s.x - w * 0.18, s.y); cx.lineTo(s.x + w, s.y + h);
      cx.lineTo(s.x - w, s.y + h); cx.lineTo(s.x + w * 0.18, s.y);
      cx.closePath(); cx.fill();
    } else {                                    // 원형 사물(꽹과리·징·북)
      cx.fillStyle = s.color;
      cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, TAU); cx.fill();
      cx.globalAlpha = 0.5 + 0.5 * Math.min(1, g);
      cx.lineWidth = 2; cx.strokeStyle = INK;
      cx.beginPath(); cx.arc(s.x, s.y, s.r * 0.62, 0, TAU); cx.stroke();
    }
    cx.restore();
  }

  function background() {
    const grd = cx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#141210'); grd.addColorStop(1, INK);
    cx.fillStyle = grd; cx.fillRect(0, 0, W, H);
  }

  return {
    init(ctx) {
      cv = ctx.canvas; audio = ctx.audio; sensors = ctx.sensors;
      W = ctx.width; H = ctx.height;
      setup();
      background();
      for (const s of sab) drawSab(s);   // init 즉시 렌더
    },

    frame(t, dt) {
      const lv = sensors ? sensors.mic.level() : 0;
      // 온셋 감지: 현재 level > 직전 0.5초 평균의 1.8배 && > 0.12 (refractory 0.1s)
      let sum = 0; for (let i = 0; i < hist.length; i++) sum += hist[i];
      const avg = sum / hist.length;
      if (sensors && sensors.mic.available && lv > 0.12 && lv > avg * 1.8 && t - lastOnset > 0.1) {
        lastOnset = t;
        hit(rng() * 4 | 0, clamp(lv, 0, 1));
      }
      hist[hi] = lv; hi = (hi + 1) % hist.length;

      background();
      for (const s of sab) { if (s.glow > 0) s.glow = Math.max(0, s.glow - dt * 2.4); drawSab(s); }

      // 링 갱신·그리기
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r = Math.min(r.max, r.r + r.vr * dt); r.life -= dt;
        if (r.life <= 0) { rings.splice(i, 1); continue; }
        cx.globalAlpha = clamp(r.life / r.maxLife, 0, 1) * 0.8;
        cx.lineWidth = r.w; cx.strokeStyle = r.color;
        cx.beginPath(); cx.arc(r.x, r.y, r.r, 0, TAU); cx.stroke();
      }
      // 스파크 갱신·그리기
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.life -= dt; if (p.life <= 0) { sparks.splice(i, 1); continue; }
        p.vy += 240 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        cx.globalAlpha = clamp(p.life / p.max, 0, 1);
        cx.fillStyle = p.color;
        cx.beginPath(); cx.arc(p.x, p.y, p.size, 0, TAU); cx.fill();
      }
      cx.globalAlpha = 1;
    },

    pointer(e) {
      if (e.type !== 'down') return;
      if (sensors && sensors.mic.available) return; // 마이크 있으면 온셋만
      let best = 0, bd = Infinity;                   // 폴백: 가장 가까운 사물
      for (let i = 0; i < sab.length; i++) {
        const dx = sab[i].x - e.x, dy = sab[i].y - e.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      hit(best, 0.7);
    },

    resize(w, h) { W = w; H = h; setup(); background(); for (const s of sab) drawSab(s); },

    dispose() {
      cx = null; cv = null; audio = null; sensors = null;
      sab = []; sparks = []; rings = []; hist.fill(0); hi = 0; lastOnset = -1;
    },
  };
})();
