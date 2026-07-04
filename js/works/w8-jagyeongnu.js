// 결 · GYEOL — 8관 세시 · 자격루(自擊漏) 물시계
// 상단 파수호 → 물줄기 → 하단 수수호(수위 상승) + 부표 화살. 눈금(1/12)마다 종·인형·구슬.
// 물방울(중력·튐), 수면 사인 잔물결. 드래그로 물줄기를 기울여 낙하점을 옮긴다.
import { clamp, TAU, fitCanvas } from '../core/canvas.js';

const PAPER = '#EDE6D6', INK = '#0E0C0A', INK2 = '#1A1611';
const RED = '#C23B22', BLUE = '#2C5F93', GOLD = '#E3A81C';
const JI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

export default (() => {
  let cv, cx, W = 0, H = 0, dpr = 1, audio;
  let level = 0, lastGauge = 0, draining = false;
  let tilt = 0, dragging = false;
  let doll = 0, bead = -1, phase = 0;   // doll: 북채 모션 타이머, bead: 구슬 진행(-1 대기)
  const drops = [];

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function geom() {
    const vesW = Math.min(W * 0.32, 200);
    const vx = W / 2 - vesW / 2, vTop = H * 0.42, vBot = H * 0.9;
    return { vesW, vx, vTop, vBot, outX: W / 2, outY: H * 0.30 };
  }

  function spawnDrop(g) {
    if (drops.length > 40) return;
    drops.push({ x: g.outX, y: g.outY + 6, vx: tilt * 0.6, vy: 40, splash: false });
  }
  function ring() { if (audio) audio.tone({ deg: 0, oct: -2, dur: 2.5, vol: 0.25 }); }

  function render(dt) {
    const g = geom();
    phase += dt * 2.2;
    // 수위 갱신
    if (draining) { level -= dt / 6; if (level <= 0) { level = 0; draining = false; lastGauge = 0; } }
    else {
      level += dt / 24;
      const cur = Math.floor(level * 12);
      if (cur > lastGauge && cur <= 12) { lastGauge = cur; doll = 0.7; bead = 0; ring(); }
      if (level >= 1) { level = 1; draining = true; }
    }
    if (doll > 0) doll = Math.max(0, doll - dt);
    if (bead >= 0) { bead += dt * 1.4; if (bead > 1) bead = -1; }

    const surfY = g.vBot - level * (g.vBot - g.vTop);
    const landX = clamp(W / 2 + tilt, g.vx + 12, g.vx + g.vesW - 12);

    cx.fillStyle = INK; cx.fillRect(0, 0, W, H);

    // 파수호(항아리 단면)
    cx.strokeStyle = 'rgba(237,230,214,0.55)'; cx.lineWidth = 2; cx.fillStyle = INK2;
    cx.beginPath();
    cx.moveTo(W / 2 - 62, H * 0.10); cx.lineTo(W / 2 + 62, H * 0.10);
    cx.lineTo(W / 2 + 40, H * 0.24); cx.lineTo(W / 2 + 8, H * 0.29);
    cx.lineTo(W / 2 - 8, H * 0.29); cx.lineTo(W / 2 - 40, H * 0.24);
    cx.closePath(); cx.fill(); cx.stroke();
    cx.fillStyle = 'rgba(44,95,147,0.5)';
    cx.beginPath();
    cx.moveTo(W / 2 - 50, H * 0.14); cx.lineTo(W / 2 + 50, H * 0.14);
    cx.lineTo(W / 2 + 30, H * 0.23); cx.lineTo(W / 2 - 30, H * 0.23); cx.closePath(); cx.fill();

    // 물줄기 (기울임 반영 곡선)
    cx.strokeStyle = 'rgba(120,170,210,0.65)'; cx.lineWidth = 2.4;
    cx.beginPath(); cx.moveTo(g.outX, g.outY);
    cx.quadraticCurveTo((g.outX + landX) / 2 + tilt * 0.3, (g.outY + surfY) / 2, landX, surfY);
    cx.stroke();

    // 물방울
    if (!draining) spawnDrop(g);
    cx.fillStyle = 'rgba(150,195,230,0.9)';
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.vy += 320 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.y >= surfY) {
        if (!d.splash) for (let s = 0; s < 3; s++)
          drops.push({ x: d.x, y: surfY - 2, vx: (s - 1) * 55, vy: -70 - s * 15, splash: true });
        drops.splice(i, 1); continue;
      }
      cx.beginPath(); cx.arc(d.x, d.y, d.splash ? 1.6 : 2.4, 0, TAU); cx.fill();
    }

    // 수수호(원통) + 수위 + 수면 잔물결
    cx.save(); cx.beginPath(); cx.rect(g.vx, surfY, g.vesW, g.vBot - surfY); cx.clip();
    cx.fillStyle = 'rgba(44,95,147,0.55)'; cx.fillRect(g.vx, surfY - 6, g.vesW, g.vBot - surfY + 6);
    cx.strokeStyle = 'rgba(150,195,230,0.7)'; cx.lineWidth = 1.4; cx.beginPath();
    for (let x = 0; x <= g.vesW; x += 6) {
      const yy = surfY + Math.sin(x * 0.08 + phase) * 2.4;
      x === 0 ? cx.moveTo(g.vx + x, yy) : cx.lineTo(g.vx + x, yy);
    }
    cx.stroke(); cx.restore();
    cx.strokeStyle = 'rgba(237,230,214,0.55)'; cx.lineWidth = 2;
    cx.strokeRect(g.vx, g.vTop, g.vesW, g.vBot - g.vTop);
    // 눈금 1/12
    cx.strokeStyle = 'rgba(237,230,214,0.4)'; cx.lineWidth = 1;
    for (let i = 1; i < 12; i++) {
      const yy = g.vBot - (i / 12) * (g.vBot - g.vTop);
      cx.beginPath(); cx.moveTo(g.vx, yy); cx.lineTo(g.vx + 10, yy); cx.stroke();
    }

    // 부표 화살 (수면 위로 솟음)
    const fx = g.vx + g.vesW / 2;
    cx.fillStyle = GOLD; cx.beginPath(); cx.ellipse(fx, surfY, 10, 4, 0, 0, TAU); cx.fill();
    cx.strokeStyle = GOLD; cx.lineWidth = 2.4;
    cx.beginPath(); cx.moveTo(fx, surfY); cx.lineTo(fx, surfY - 46); cx.stroke();
    cx.beginPath(); cx.moveTo(fx - 5, surfY - 40); cx.lineTo(fx, surfY - 50);
    cx.lineTo(fx + 5, surfY - 40); cx.closePath(); cx.fill();

    // 나무 인형 + 종 (눈금마다 북채 든다)
    const dx = g.vx + g.vesW + 40, dy = g.vTop + 30;
    if (dx < W - 20) {
      cx.strokeStyle = 'rgba(237,230,214,0.75)'; cx.fillStyle = INK2; cx.lineWidth = 2;
      cx.beginPath(); cx.arc(dx, dy, 9, 0, TAU); cx.fill(); cx.stroke();          // 머리
      cx.beginPath(); cx.moveTo(dx, dy + 9); cx.lineTo(dx, dy + 46); cx.stroke(); // 몸
      const arm = -0.5 - doll / 0.7 * 1.4;                                        // 북채 올림
      cx.beginPath(); cx.moveTo(dx, dy + 18);
      cx.lineTo(dx + Math.cos(arm) * 22, dy + 18 + Math.sin(arm) * 22); cx.stroke();
      cx.fillStyle = RED; cx.beginPath();
      cx.arc(dx + 4, dy + 58, 8, 0, TAU); cx.fill();                              // 종
    }

    // 구슬이 굴러가는 표식
    if (bead >= 0) {
      cx.fillStyle = GOLD;
      cx.beginPath(); cx.arc(W / 2 - 70 + bead * 140, H * 0.345, 4, 0, TAU); cx.fill();
    }

    // 우상단 12지 시명
    const h = new Date().getHours();
    const idx = Math.floor(((h + 1) % 24) / 2);
    cx.fillStyle = GOLD; cx.textAlign = 'right'; cx.textBaseline = 'top';
    cx.font = '700 22px "Gowun Batang", serif';
    cx.fillText(JI[idx] + '시', W - 24, 22);
    cx.font = '400 12px "Space Mono", monospace'; cx.fillStyle = 'rgba(237,230,214,0.6)';
    cx.fillText(String(h).padStart(2, '0') + ':00', W - 24, 52);
  }

  return {
    init(ctx) {
      cv = ctx.canvas; audio = ctx.audio; W = ctx.width; H = ctx.height;
      setup(); render(0);
    },
    frame(t, dt) { render(dt); },
    pointer(e) {
      if (e.type === 'down') { dragging = true; tilt = e.x - W / 2; }
      else if (e.type === 'move' && dragging) { tilt = e.x - W / 2; }
      else if (e.type === 'up') { dragging = false; }
    },
    resize(w, h) { W = w; H = h; setup(); },
    dispose() { drops.length = 0; dragging = false; tilt = 0; cx = null; cv = null; },
  };
})();
