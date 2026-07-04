// 결 · GYEOL — 8관 세시 · 달그림자 음력 위상
// 기준 신월 2026-06-15T02:54Z, 주기 29.530588일 → 오늘 위상. 밝은 원 + 터미네이터.
// 하단 바다: 사리(신월·보름) 큰 물결, 조금(반달) 잔물결 — 3겹 사인 진폭 연동.
// 드래그(가로) = 위상 스크럽(±15일), 놓으면 3초에 걸쳐 오늘로 복귀.
import { clamp, TAU, fitCanvas } from '../core/canvas.js';

const INK = '#0E0C0A', INK2 = '#1A1611', PAPER = '#EDE6D6';
const BLUE = '#2C5F93', GOLD = '#E3A81C';
const EPOCH = Date.UTC(2026, 5, 15, 2, 54, 0);   // 2026년 6월 신월
const SYN = 29.530588 * 86400000;                // 삭망월(ms)
const DAY = 86400000;

function phaseName(p) {
  if (p < 0.06 || p >= 0.94) return '신월';
  if (p < 0.19) return '초승달';
  if (p < 0.31) return '상현달';
  if (p < 0.44) return '차오르는 달';
  if (p < 0.56) return '보름달';
  if (p < 0.69) return '기우는 달';
  if (p < 0.81) return '하현달';
  return '그믐달';
}

export default (() => {
  let cv, cx, W = 0, H = 0, dpr = 1, audio;
  let scrub = 0, dragging = false, dragX0 = 0, dragBase = 0;
  let relFrom = 0, relT = -1;   // 복귀 애니메이션
  let phase = 0;

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawMoon(p, ox, oy, R) {
    cx.save();
    cx.beginPath(); cx.arc(ox, oy, R, 0, TAU); cx.clip();
    cx.fillStyle = INK2; cx.fillRect(ox - R, oy - R, 2 * R, 2 * R);   // 그림자면
    cx.fillStyle = PAPER;                                            // 밝은면
    const x = Math.cos(p * TAU) * R;
    cx.beginPath();
    if (p < 0.5) {                       // 차는 달 — 오른쪽이 밝다
      cx.arc(ox, oy, R, -Math.PI / 2, Math.PI / 2, false);
      cx.ellipse(ox, oy, Math.abs(x), R, 0, Math.PI / 2, -Math.PI / 2, x > 0);
    } else {                             // 기우는 달 — 왼쪽이 밝다
      cx.arc(ox, oy, R, Math.PI / 2, -Math.PI / 2, false);
      cx.ellipse(ox, oy, Math.abs(x), R, 0, -Math.PI / 2, Math.PI / 2, x < 0);
    }
    cx.fill();
    cx.restore();
    cx.strokeStyle = 'rgba(227,168,28,0.5)'; cx.lineWidth = 1.5;
    cx.beginPath(); cx.arc(ox, oy, R, 0, TAU); cx.stroke();
  }

  function render(dt, t) {
    // 복귀 애니메이션(3초)
    if (!dragging && relT >= 0) {
      relT += dt; const k = clamp(relT / 3, 0, 1);
      scrub = relFrom * (1 - k); if (k >= 1) { scrub = 0; relT = -1; }
    }
    const disp = Date.now() + scrub * DAY;
    let p = ((disp - EPOCH) % SYN) / SYN; if (p < 0) p += 1;
    phase = p;

    const ox = W / 2, oy = H * 0.37, R = Math.min(W, H) * 0.23;

    cx.fillStyle = INK; cx.fillRect(0, 0, W, H);

    // 은은한 달무리
    const halo = cx.createRadialGradient(ox, oy, R, ox, oy, R * 2.1);
    halo.addColorStop(0, 'rgba(227,168,28,0.10)'); halo.addColorStop(1, 'rgba(227,168,28,0)');
    cx.fillStyle = halo; cx.beginPath(); cx.arc(ox, oy, R * 2.1, 0, TAU); cx.fill();

    drawMoon(p, ox, oy, R);

    // 하단 바다 — 조수 진폭(사리/조금) 위상 연동
    const tide = 0.28 + 0.72 * Math.abs(Math.cos(p * TAU));   // 신월·보름=1, 반달=0
    const seaY = H * 0.72;
    const layers = [
      { amp: 26 * tide, f: 0.010, sp: 0.6, a: 0.5 },
      { amp: 18 * tide, f: 0.018, sp: -0.9, a: 0.4 },
      { amp: 11 * tide, f: 0.030, sp: 1.4, a: 0.32 },
    ];
    for (const L of layers) {
      cx.fillStyle = `rgba(44,95,147,${L.a})`;
      cx.beginPath(); cx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        const y = seaY + Math.sin(x * L.f + t * L.sp) * L.amp + (1 - tide) * 10;
        x === 0 ? cx.lineTo(x, y) : cx.lineTo(x, y);
      }
      cx.lineTo(W, H); cx.closePath(); cx.fill();
    }
    // 달빛 윤슬
    cx.fillStyle = 'rgba(237,230,214,0.18)';
    for (let x = ox - 40; x < ox + 40; x += 9) {
      const y = seaY + Math.sin(x * 0.01 + t * 0.6) * 26 * tide;
      cx.fillRect(x, y, 4, 2);
    }

    // 표기 — 위상명 · 날짜 · 음력일
    const d = new Date(disp);
    const lunarDay = Math.floor(p * 29.530588) + 1;
    const illum = Math.round((1 - Math.cos(p * TAU)) / 2 * 100);   // 조도(밝은 비율)
    cx.textAlign = 'center'; cx.fillStyle = PAPER;
    cx.font = '700 20px "Gowun Batang", serif';
    cx.fillText(phaseName(p), ox, oy + R + 40);
    cx.font = '400 13px "Space Mono", monospace'; cx.fillStyle = 'rgba(237,230,214,0.7)';
    cx.fillText(`${d.getMonth() + 1}.${d.getDate()} · 음력 ${lunarDay}일 · 밝기 ${illum}%`, ox, oy + R + 64);
  }

  return {
    init(ctx) {
      cv = ctx.canvas; audio = ctx.audio; W = ctx.width; H = ctx.height;
      setup(); render(0, 0);
    },
    frame(t, dt) { render(dt, t); },
    pointer(e) {
      if (e.type === 'down') {
        dragging = true; dragX0 = e.x; dragBase = scrub; relT = -1;
        if (audio) audio.tone({ deg: 3, oct: -1, dur: 0.3, vol: 0.12 });
      } else if (e.type === 'move' && dragging) {
        scrub = clamp(dragBase + (e.x - dragX0) / (W / 30), -15, 15);   // 화면폭 = ±15일
      } else if (e.type === 'up') {
        dragging = false; relFrom = scrub; relT = 0;
      }
    },
    resize(w, h) { W = w; H = h; setup(); },
    dispose() { dragging = false; scrub = 0; relT = -1; cx = null; cv = null; },
  };
})();
