// 결 · GYEOL — 8관 세시 · 스물넷(二十四節氣) 절기 시계
// 오늘 날짜가 스물네 절기 중 어디에 닿아 있는지 실시간으로 새긴다.
// 24칸 링 + 계절 모티프 파티클(봄 싹/여름 파문/가을 낙엽/겨울 눈) + 중앙 시침·분침.
// 성능: 고정 파티클 풀, 자체 RAF 없음. init에서 배경/링 즉시 그린다.
import { mulberry32, clamp, TAU } from '../core/canvas.js';
import { fitCanvas } from '../core/canvas.js';

const PAPER = '#EDE6D6', INK = '#0E0C0A', INK2 = '#1A1611';
const BLUE = '#2C5F93', GOLD = '#E3A81C';
const SPROUT = '#8FB03A', LEAF = '#C57A2A';

// 24절기 [이름, 월, 일] — 2026년 기준, 입춘→대한 세시 순서. (소한·대한은 이듬해 1월)
const TERMS = [
  ['입춘', 2, 4], ['우수', 2, 18], ['경칩', 3, 5], ['춘분', 3, 20], ['청명', 4, 5], ['곡우', 4, 20],
  ['입하', 5, 5], ['소만', 5, 21], ['망종', 6, 6], ['하지', 6, 21], ['소서', 7, 7], ['대서', 7, 23],
  ['입추', 8, 7], ['처서', 8, 23], ['백로', 9, 7], ['추분', 9, 23], ['한로', 10, 8], ['상강', 10, 23],
  ['입동', 11, 7], ['소설', 11, 22], ['대설', 12, 7], ['동지', 12, 22], ['소한', 1, 5], ['대한', 1, 20],
];

export default (() => {
  let cv, cx, W = 0, H = 0, dpr = 1, audio;
  let drag = null;      // { x0, off0 } — 드래그 시작 상태
  let dragOff = 0;      // 링 회전 오프셋(rad). 놓으면 0(현재)으로 복귀
  let spawnAcc = 0;
  const rand = mulberry32(24071);
  const P = [];         // 계절 모티프 파티클

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 입춘 기준 단조 증가 타임라인. 1월(소한·대한)은 이듬해로 배치해 연 주기를 잇는다.
  function timeline(now) {
    const m = now.getMonth() + 1;
    const Y = m === 1 ? now.getFullYear() - 1 : now.getFullYear();
    const dates = TERMS.map(([, mm, dd]) => new Date(mm === 1 ? Y + 1 : Y, mm - 1, dd).getTime());
    const anchor = dates[0];
    return { dates, anchor, yearLen: new Date(Y + 1, 1, 4).getTime() - anchor };
  }
  // 오늘이 속한 절기 인덱스 = 마지막으로 지난 절기 경계.
  function curIndex(t, tl) {
    for (let i = 23; i >= 0; i--) if (t >= tl.dates[i]) return i;
    return 0;
  }

  function spawn(sea, ox, oy, R) {
    if (P.length > 48) return;
    const a = rand() * TAU, r = rand() * R * 0.8;
    P.push({
      sea, x: ox + Math.cos(a) * r, y: oy + Math.sin(a) * r, age: 0,
      life: 2.4 + rand() * 2, seed: rand(), rot: rand() * TAU,
      vx: (rand() - 0.5) * 12, vy: sea === 0 ? -12 - rand() * 10 : 10 + rand() * 12,
    });
  }

  function drawParticle(p) {
    const k = clamp(1 - p.age / p.life, 0, 1);
    cx.globalAlpha = k * 0.85;
    if (p.sea === 0) {                     // 봄 · 연둣빛 싹
      cx.strokeStyle = SPROUT; cx.lineWidth = 1.6;
      cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x, p.y - 10 * (1 - k) - 3); cx.stroke();
      cx.fillStyle = SPROUT;
      cx.beginPath(); cx.ellipse(p.x + 2, p.y - 9, 3, 1.5, -0.5, 0, TAU); cx.fill();
    } else if (p.sea === 1) {              // 여름 · 파문
      cx.strokeStyle = BLUE; cx.lineWidth = 1.2;
      cx.beginPath(); cx.arc(p.x, p.y, (1 - k) * 24 + 3, 0, TAU); cx.stroke();
    } else if (p.sea === 2) {              // 가을 · 낙엽
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot + p.age * 1.8);
      cx.fillStyle = LEAF; cx.beginPath(); cx.ellipse(0, 0, 4.5, 2.2, 0, 0, TAU); cx.fill(); cx.restore();
    } else {                              // 겨울 · 눈
      cx.fillStyle = PAPER;
      cx.beginPath(); cx.arc(p.x, p.y, 1.6 + p.seed * 1.4, 0, TAU); cx.fill();
    }
    cx.globalAlpha = 1;
  }

  function render(dt) {
    const now = new Date();
    const tl = timeline(now);
    const ox = W / 2, oy = H / 2, R = Math.min(W, H) * 0.36;

    cx.fillStyle = INK; cx.fillRect(0, 0, W, H);

    const ci = curIndex(now.getTime(), tl);                // 오늘이 속한 절기(=상단 정렬 기준)
    let hi = 0, best = 9;                                  // 상단에 가장 가까운 칸(드래그 미리보기)
    for (let i = 0; i < 24; i++) {
      const a = ((i - ci) / 24) * TAU + dragOff;
      const d = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      if (d < best) { best = d; hi = i; }
    }

    // 바깥 링
    cx.strokeStyle = 'rgba(237,230,214,0.28)'; cx.lineWidth = 1;
    cx.beginPath(); cx.arc(ox, oy, R, 0, TAU); cx.stroke();
    cx.beginPath(); cx.arc(ox, oy, R * 0.86, 0, TAU); cx.stroke();

    // 24칸: 눈금 + 절기명(세로쓰기 2자)
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    for (let i = 0; i < 24; i++) {
      const ang = -Math.PI / 2 + ((i - ci) / 24) * TAU + dragOff;
      const cxp = Math.cos(ang), syp = Math.sin(ang);
      const on = i === hi;
      cx.strokeStyle = on ? GOLD : 'rgba(237,230,214,0.35)';
      cx.lineWidth = on ? 2 : 1;
      cx.beginPath();
      cx.moveTo(ox + cxp * R, oy + syp * R);
      cx.lineTo(ox + cxp * R * 0.86, oy + syp * R * 0.86);
      cx.stroke();
      const tx = ox + cxp * R * 0.955, ty = oy + syp * R * 0.955;
      cx.font = (on ? '700 ' : '400 ') + '12px "Gowun Batang", serif';
      cx.shadowBlur = on ? 14 : 0; cx.shadowColor = GOLD;
      cx.fillStyle = on ? GOLD : 'rgba(237,230,214,0.82)';
      const name = TERMS[i][0];
      cx.fillText(name[0], tx, ty - 7);
      cx.fillText(name[1], tx, ty + 7);
      cx.shadowBlur = 0;
    }

    // 계절 모티프 파티클 (상단 절기의 계절)
    const sea = (hi / 6) | 0;
    spawnAcc += dt;
    while (spawnAcc > 0.11) { spawnAcc -= 0.11; spawn(sea, ox, oy, R * 0.82); }
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.age >= p.life) { P.splice(i, 1); continue; }
      drawParticle(p);
    }

    // 중앙 시침·분침 (가는 먹선) — 실제 현재 시각
    const hA = -Math.PI / 2 + ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * TAU;
    const mA = -Math.PI / 2 + (now.getMinutes() + now.getSeconds() / 60) / 60 * TAU;
    cx.strokeStyle = INK2; cx.lineCap = 'round';
    cx.lineWidth = 3; cx.beginPath(); cx.moveTo(ox, oy);
    cx.lineTo(ox + Math.cos(hA) * R * 0.34, oy + Math.sin(hA) * R * 0.34); cx.stroke();
    cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(ox, oy);
    cx.lineTo(ox + Math.cos(mA) * R * 0.5, oy + Math.sin(mA) * R * 0.5); cx.stroke();
    cx.fillStyle = GOLD; cx.beginPath(); cx.arc(ox, oy, 3.5, 0, TAU); cx.fill();

    // 상단 오늘 표기
    cx.font = '400 13px "Space Mono", monospace';
    cx.fillStyle = 'rgba(237,230,214,0.7)'; cx.textAlign = 'center';
    cx.fillText(`${now.getMonth() + 1}월 ${now.getDate()}일 · ${TERMS[hi][0]}`, ox, oy + R + 26);
  }

  return {
    init(ctx) {
      cv = ctx.canvas; audio = ctx.audio; W = ctx.width; H = ctx.height;
      setup(); render(0);
    },
    frame(t, dt) {
      if (!drag) dragOff *= Math.max(0, 1 - dt * 4);   // 놓으면 현재로 복귀
      render(dt);
    },
    pointer(e) {
      if (e.type === 'down') {
        drag = { x0: e.x, off0: dragOff };
        if (audio) audio.tone({ deg: 2, oct: -1, dur: 0.3, vol: 0.12 });
      } else if (e.type === 'move' && drag) {
        dragOff = drag.off0 + (e.x - drag.x0) * 0.006;
      } else if (e.type === 'up') { drag = null; }
    },
    resize(w, h) { W = w; H = h; setup(); },
    dispose() { P.length = 0; drag = null; dragOff = 0; cx = null; cv = null; },
  };
})();
