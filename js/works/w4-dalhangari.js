// 결 · GYEOL — 4관 여백 · 달항아리(達항아리) Moon Jar
// 먹빛 어둠 속 백자 달항아리. 좌우대칭 8제어점 캣멀롬 프로파일을
//   40개 수평 슬라이스 타원으로 회전체처럼 쌓아 은은한 볼륨을 만든다.
// mic.level()이 물레의 손 — 소리에 제어점이 바깥으로 부풀며 일렁이고,
//   조용하면 8초에 걸쳐 이상(理想) 형태로 복원. 마이크 미가용 시 포인터 드래그로 당김.
import { fitCanvas, clamp, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, audio, sensors;
  let W = 0, H = 0, dpr = 1;
  let cxp = 0, top = 0, Hj = 0, S = 0;   // 중심x · 항아리 상단y · 항아리 높이 · 스케일
  let toneCd = 0;                         // 저음 울림 쿨다운(초)
  let drag = null;                        // 폴백 드래그 상태 { i, r } 또는 null

  // 좌우대칭 반(半)프로파일 8제어점: (yNorm 0=입 1=굽, rNorm 반경). 달항아리의 불완전한 대칭.
  const PY = [0.00, 0.09, 0.21, 0.35, 0.52, 0.70, 0.88, 1.00];
  const PR = [0.16, 0.13, 0.33, 0.45, 0.50, 0.41, 0.24, 0.17];
  const N = 8;
  const SLICES = 40;
  const phase = [0.0, 0.9, 1.9, 2.7, 3.6, 4.4, 5.2, 6.0]; // 제어점별 일렁임 위상
  const defR = new Float32Array(N);       // 제어점별 반경 변형량(px), 이상형태 대비
  const effY = new Float32Array(N);
  const effR = new Float32Array(N);

  const PORCELAIN = '#EDE6D6';   // 백자
  const SHADE = '#B8B0A0';       // 그늘

  function layout() {
    cxp = W / 2;
    Hj = Math.min(W, H) * 0.66;
    S = Hj;                       // 반경도 높이 기준으로 스케일(비율 고정)
    top = H / 2 - Hj / 2;
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
  }

  // 균일 캣멀롬 (반경 보간)
  function cr(p0, p1, p2, p3, u) {
    const u2 = u * u, u3 = u2 * u;
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
  }

  // 임의 y(px)에서 프로파일 반경(px). effY는 단조 증가.
  function radiusAt(y) {
    if (y <= effY[0]) return effR[0];
    if (y >= effY[N - 1]) return effR[N - 1];
    let i = 0;
    while (i < N - 1 && effY[i + 1] < y) i++;
    const u = (y - effY[i]) / (effY[i + 1] - effY[i] || 1);
    const a = effR[Math.max(0, i - 1)], b = effR[i], c = effR[Math.min(N - 1, i + 1)], d = effR[Math.min(N - 1, i + 2)];
    return Math.max(0, cr(a, b, c, d, u));
  }

  function drawBackground() {
    cx.fillStyle = '#0E0C0A';
    cx.fillRect(0, 0, W, H);
  }

  return {
    init(ctx) {
      cv = ctx.canvas; audio = ctx.audio; sensors = ctx.sensors;
      W = ctx.width; H = ctx.height;
      setup();
      drawBackground();
      this.frame(0, 0);   // 배경 위 즉시 초기 형태
    },

    frame(t, dt) {
      const mic = sensors && sensors.mic;
      const level = mic ? mic.level() : 0;
      const micOn = mic ? mic.available : false;

      // 제어점 변형 목표 결정
      for (let i = 0; i < N; i++) {
        let target;
        if (micOn) {
          // 소리 크기에 비례해 바깥으로 부풀며 일렁임(제어점마다 다른 위상)
          const wob = 0.55 + 0.45 * Math.sin(t * 1.7 + phase[i]);
          target = level * S * 0.14 * wob;
        } else if (drag && drag.i === i) {
          target = drag.r;                 // 폴백: 당긴 만큼
        } else {
          target = 0;                      // 이상 형태로 복원
        }
        // 부풀 땐 빠르게, 잦아들 땐 8초에 걸쳐(τ≈2.6s) 천천히
        const rising = Math.abs(target) > Math.abs(defR[i]);
        const tau = rising ? 0.28 : 2.6;
        const k = dt > 0 ? 1 - Math.exp(-dt / tau) : 1;
        defR[i] += (target - defR[i]) * k;
      }
      for (let i = 0; i < N; i++) {
        effY[i] = top + PY[i] * Hj;
        effR[i] = Math.max(0, PR[i] * S + defR[i]);
      }

      // 큰 변형 순간 낮은 울림
      toneCd -= dt;
      if (micOn && level > 0.5 && toneCd <= 0 && audio) {
        audio.tone({ deg: 0, oct: -2, vol: 0.2, dur: 2 });
        toneCd = 1.6;
      }

      drawBackground();

      // 40개 수평 슬라이스 타원 — 백자 볼륨 + 유약 셰이딩
      const sh = Hj / SLICES;
      for (let s = 0; s < SLICES; s++) {
        const yy = top + (s + 0.5) * (Hj / SLICES);
        const r = radiusAt(yy);
        if (r < 0.6) continue;
        const hl = cxp - 0.32 * r;         // 좌상단 광원 하이라이트 위치
        const g = cx.createLinearGradient(cxp - r, 0, cxp + r, 0);
        g.addColorStop(0, SHADE);
        g.addColorStop(clamp((hl - (cxp - r)) / (2 * r), 0.05, 0.5), PORCELAIN);
        g.addColorStop(1, SHADE);
        cx.fillStyle = g;
        cx.beginPath();
        cx.ellipse(cxp, yy, r, sh * 0.92, 0, 0, TAU);
        cx.fill();
      }

      // 유약 하이라이트: 배 좌상단의 부드러운 세로 광택
      const by = top + 0.46 * Hj, br = radiusAt(by);
      const hg = cx.createRadialGradient(cxp - br * 0.34, by - Hj * 0.06, 2, cxp - br * 0.34, by, br * 0.7);
      hg.addColorStop(0, 'rgba(255,252,244,0.35)');
      hg.addColorStop(1, 'rgba(255,252,244,0)');
      cx.fillStyle = hg;
      cx.beginPath();
      cx.ellipse(cxp - br * 0.28, by - Hj * 0.02, br * 0.5, Hj * 0.24, 0, 0, TAU);
      cx.fill();
    },

    pointer(e) {
      if (sensors && sensors.mic && sensors.mic.available) return; // 마이크가 물레면 폴백 비활성
      if (e.type === 'down' || e.type === 'move') {
        // 가장 가까운 제어점(y기준) 선택, 중심축에서의 거리로 당김량 산정
        let bi = 0, bd = Infinity;
        for (let i = 0; i < N; i++) {
          const yv = top + PY[i] * Hj;
          const d = Math.abs(e.y - yv);
          if (d < bd) { bd = d; bi = i; }
        }
        const pull = Math.abs(e.x - cxp) - PR[bi] * S;
        drag = { i: bi, r: clamp(pull, -PR[bi] * S * 0.5, S * 0.22) };
        if (e.type === 'down' && audio) audio.tone({ deg: 0, oct: -2, vol: 0.15, dur: 1.2 });
      } else if (e.type === 'up') {
        drag = null;
      }
    },

    resize(w, h) { W = w; H = h; setup(); drawBackground(); },

    dispose() { cx = null; cv = null; drag = null; audio = null; sensors = null; },
  };
})();
