// 결 · GYEOL — 8관 세시 · 십이지(十二支) 손 인식
// 12지신 링: 지지 한자 + 추상 문양(원·삼각·선). 현재 시(時) 칸 금색 발광.
// 손: landmark 9 x로 링 회전, pinch로 지신 확대+문양 방사. 폴백: 드래그 회전+탭 확대.
import { mulberry32, clamp, TAU, fitCanvas } from '../core/canvas.js';

const INK = '#0E0C0A', INK2 = '#1A1611', PAPER = '#EDE6D6';
const RED = '#C23B22', BLUE = '#2C5F93', GOLD = '#E3A81C';
const HANJA = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const KNAME = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const RANGES = [[23, 1], [1, 3], [3, 5], [5, 7], [7, 9], [9, 11], [11, 13], [13, 15], [15, 17], [17, 19], [19, 21], [21, 23]];
const pad = (n) => String(n % 24).padStart(2, '0') + ':00';

export default (() => {
  let cv, cx, W = 0, H = 0, dpr = 1, audio, hands;
  let rot = 0, dragOff = 0, drag = null, moved = 0;
  let selIdx = -1, selZoom = 0, pinchLatch = false;
  const rand = mulberry32(12097);
  const P = [];

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 추상 지신 문양 — 원·삼각·선 조합(사실화 금지)
  function symbol(i, x, y, s, col) {
    cx.strokeStyle = col; cx.fillStyle = col; cx.lineWidth = Math.max(1.2, s * 0.06);
    const arc = (r, a0, a1) => { cx.beginPath(); cx.arc(x, y, r, a0, a1); cx.stroke(); };
    const dot = (dx, dy, r) => { cx.beginPath(); cx.arc(x + dx, y + dy, r, 0, TAU); cx.fill(); };
    const line = (ax, ay, bx, by) => { cx.beginPath(); cx.moveTo(x + ax, y + ay); cx.lineTo(x + bx, y + by); cx.stroke(); };
    const tri = (r, ro) => { cx.beginPath(); for (let k = 0; k < 3; k++) { const a = ro + k * TAU / 3; const fx = x + Math.cos(a) * r, fy = y + Math.sin(a) * r; k ? cx.lineTo(fx, fy) : cx.moveTo(fx, fy); } cx.closePath(); cx.stroke(); };
    switch (i) {
      case 0: arc(s * 0.5, 0, TAU); line(s * 0.4, s * 0.3, s * 0.7, s * 0.5); break;        // 자·쥐
      case 1: tri(s * 0.55, -Math.PI / 2); dot(0, s * 0.1, s * 0.12); break;                 // 축·소
      case 2: arc(s * 0.5, 0, TAU); line(-s * 0.4, -s * 0.3, s * 0.4, s * 0.3); line(-s * 0.4, 0, s * 0.4, s * 0.5); break; // 인·범
      case 3: arc(s * 0.4, 0, TAU); line(-s * 0.2, -s * 0.4, -s * 0.2, -s * 0.8); line(s * 0.2, -s * 0.4, s * 0.2, -s * 0.8); break; // 묘·토끼
      case 4: cx.beginPath(); for (let k = 0; k <= 8; k++) { const px = x - s * 0.6 + k * s * 0.15, py = y + Math.sin(k) * s * 0.3; k ? cx.lineTo(px, py) : cx.moveTo(px, py); } cx.stroke(); break; // 진·용
      case 5: cx.beginPath(); cx.arc(x, y - s * 0.25, s * 0.3, Math.PI, 0); cx.arc(x, y + s * 0.25, s * 0.3, Math.PI, 0, true); cx.stroke(); break; // 사·뱀
      case 6: arc(s * 0.45, 0, TAU); tri(s * 0.7, -Math.PI / 2); break;                      // 오·말
      case 7: arc(s * 0.4, 0, TAU); arc(s * 0.55, Math.PI * 0.8, Math.PI * 1.2); break;       // 미·양
      case 8: arc(s * 0.5, 0, TAU); dot(0, -s * 0.55, s * 0.18); break;                       // 신·잔나비
      case 9: arc(s * 0.45, 0, TAU); line(s * 0.4, -s * 0.2, s * 0.85, 0); line(s * 0.85, 0, s * 0.4, s * 0.2); break; // 유·닭
      case 10: tri(s * 0.55, Math.PI / 2); arc(s * 0.22, 0, TAU); break;                      // 술·개
      default: arc(s * 0.5, 0, TAU); tri(s * 0.3, 0); break;                                  // 해·돼지
    }
  }

  function radiate(i, col) {
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU;
      P.push({ x: W / 2, y: H / 2, vx: Math.cos(a) * (90 + rand() * 60), vy: Math.sin(a) * (90 + rand() * 60), age: 0, life: 1.1, col });
    }
  }
  function pick() {   // 상단에 가장 가까운 칸
    let bi = 0, best = 9;
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + i / 12 * TAU + rot + dragOff;
      let d = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
      if (d < best) { best = d; bi = i; }
    }
    return bi;
  }
  function select(i) {
    selIdx = i; selZoom = 0; radiate(i, [RED, BLUE, GOLD, PAPER, BLUE][i % 5]);
    if (audio) audio.tone({ deg: i % 5, oct: -1, dur: 0.4, vol: 0.15 });
  }

  function render(dt, t) {
    const now = new Date(), h = now.getHours();
    const cur = Math.floor(((h + 1) % 24) / 2);

    // 손 인식 우선, 없으면 폴백
    const hs = (hands && hands.get) ? hands.get() : [];
    if (hands && hands.available && hs.length && hs[0].landmarks && hs[0].landmarks[9]) {
      const px = hs[0].landmarks[9].x;                 // 0..1 (거울)
      rot += ((0.5 - px) * Math.PI * 1.5 - rot) * Math.min(1, dt * 5);
      const pinching = hs[0].pinch < 0.06;
      if (pinching && !pinchLatch) { pinchLatch = true; select(pick()); }
      if (!pinching) pinchLatch = false;
    }
    if (!drag) dragOff *= Math.max(0, 1 - dt * 3);
    if (selIdx >= 0) selZoom = Math.min(1, selZoom + dt * 2.5);

    const ox = W / 2, oy = H / 2, R = Math.min(W, H) * 0.34;
    cx.fillStyle = INK; cx.fillRect(0, 0, W, H);

    // 바깥 12시 눈금 + 현재 시각 침
    cx.strokeStyle = 'rgba(237,230,214,0.3)'; cx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + i / 12 * TAU;
      cx.beginPath();
      cx.moveTo(ox + Math.cos(a) * R * 1.12, oy + Math.sin(a) * R * 1.12);
      cx.lineTo(ox + Math.cos(a) * R * 1.18, oy + Math.sin(a) * R * 1.18);
      cx.stroke();
    }
    const timeA = -Math.PI / 2 + (((h + 1) % 24) / 2 + now.getMinutes() / 120) / 12 * TAU;
    cx.strokeStyle = GOLD; cx.lineWidth = 2; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(ox, oy); cx.lineTo(ox + Math.cos(timeA) * R * 1.1, oy + Math.sin(timeA) * R * 1.1); cx.stroke();

    // 12지신 링
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + i / 12 * TAU + rot + dragOff;
      const cxp = ox + Math.cos(a) * R, cyp = oy + Math.sin(a) * R;
      const on = i === cur;
      symbol(i, cxp, cyp - 16, 15, on ? GOLD : 'rgba(237,230,214,0.7)');
      cx.font = (on ? '700 ' : '400 ') + '22px "Gowun Batang", serif';
      cx.shadowBlur = on ? 16 : 0; cx.shadowColor = GOLD;
      cx.fillStyle = on ? GOLD : 'rgba(237,230,214,0.85)';
      cx.fillText(HANJA[i], cxp, cyp + 14);
      cx.shadowBlur = 0;
    }

    // 확대된 지신 (중앙)
    if (selIdx >= 0 && selZoom > 0.01) {
      cx.globalAlpha = selZoom;
      symbol(selIdx, ox, oy - 10, 44 * selZoom, GOLD);
      cx.font = `700 ${(40 * selZoom) | 0}px "Gowun Batang", serif`;
      cx.fillStyle = GOLD; cx.fillText(HANJA[selIdx], ox, oy + 46);
      cx.globalAlpha = 1;
    }

    // 방사 파티클
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.age >= p.life) { P.splice(i, 1); continue; }
      cx.globalAlpha = clamp(1 - p.age / p.life, 0, 1);
      cx.fillStyle = p.col; cx.beginPath(); cx.arc(p.x, p.y, 3, 0, TAU); cx.fill();
    }
    cx.globalAlpha = 1;

    // 현재 시 표기
    const [s0, s1] = RANGES[cur];
    cx.textAlign = 'center'; cx.fillStyle = GOLD; cx.font = '700 18px "Gowun Batang", serif';
    cx.fillText(`${KNAME[cur]}시`, ox, oy + R + 34);
    cx.font = '400 13px "Space Mono", monospace'; cx.fillStyle = 'rgba(237,230,214,0.7)';
    cx.fillText(`${pad(s0)}–${pad(s1)}`, ox, oy + R + 58);
    if (!(hands && hands.available)) {
      cx.fillStyle = 'rgba(237,230,214,0.4)'; cx.font = '400 11px "Space Mono", monospace';
      cx.fillText('드래그로 돌리고 탭으로 짚으세요', ox, oy + R + 78);
    }
  }

  return {
    init(ctx) {
      cv = ctx.canvas; audio = ctx.audio; hands = ctx.hands; W = ctx.width; H = ctx.height;
      setup(); render(0, 0);
    },
    frame(t, dt) { render(dt, t); },
    pointer(e) {
      if (e.type === 'down') { drag = { x0: e.x, off0: dragOff }; moved = 0; }
      else if (e.type === 'move' && drag) {
        const d = e.x - drag.x0; moved += Math.abs(d); dragOff = drag.off0 + d * 0.006;
      } else if (e.type === 'up') {
        if (drag && moved < 8) select(pick());   // 탭 = 확대
        drag = null;
      }
    },
    resize(w, h) { W = w; H = h; setup(); },
    dispose() { P.length = 0; drag = null; dragOff = 0; rot = 0; selIdx = -1; cx = null; cv = null; },
  };
})();
