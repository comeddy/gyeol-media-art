// 결 · GYEOL — 1관 묵향 · 묵죽(墨竹) Ink Bamboo
// 먹빛 대숲이 바람에 흔들린다. 줄기는 마디(節) 단위 세그먼트로 서고, 마디마다
// 잎 클러스터(먹 농담 3톤)가 돋는다. 바람이 셀수록 크게 눕고 잎은 파르르 떤다.
// 바람 = 0.15 + mic.level()*2.5. 마이크 미가용 시 포인터 드래그 x속도가 바람.
// 입체 배치: 각 그루에 깊이 z(0=전경·1=원경). 원경일수록 작게·옅게(대기원근)·
//   위쪽 뿌리(지평선 후퇴)·바람에 덜 흔들린다(시차). 원→근 순서로 겹쳐 그린다.
import { fitCanvas, noise2, mulberry32, lerp, clamp, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, paper, pcx, audio, sensors;
  let W = 0, H = 0, dpr = 1;
  let stalks = null, nxs = null, nys = null;
  let windPtr = 0, lastPX = null, lastRustle = -1;

  const TONES = [[26, 22, 17], [14, 12, 10], [74, 64, 52]];  // 흑 · 먹빛 · 옅은먹
  const PAPER = [230, 224, 207];  // 대기원근: 원경 먹을 지면(한지)색으로 섞어 흐린다.

  // 먹 tone을 깊이 z만큼 한지색으로 보간 — 멀수록 옅고 채도 낮은 회먹이 된다.
  function fade(tone, z, strength = 0.7) {
    const f = z * strength;
    return [
      Math.round(lerp(tone[0], PAPER[0], f)),
      Math.round(lerp(tone[1], PAPER[1], f)),
      Math.round(lerp(tone[2], PAPER[2], f)),
    ];
  }

  function buildPaper() {
    const g = pcx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#EDE6D6');
    g.addColorStop(1, '#E2DAC8');
    pcx.fillStyle = g; pcx.fillRect(0, 0, W, H);
    const fr = mulberry32(0xda1e);
    for (let i = 0; i < 70; i++) {
      const x = fr() * W, y = fr() * H;
      pcx.fillStyle = noise2(x * 0.008, y * 0.008) > 0 ? 'rgba(120,110,92,0.05)' : 'rgba(255,252,242,0.06)';
      pcx.beginPath(); pcx.arc(x, y, 18 + fr() * 46, 0, TAU); pcx.fill();
    }
  }

  function buildStalks() {
    const r = mulberry32(0x6d0c);
    const count = 8 + (r() * 5 | 0);            // 8~12그루 — 대숲
    stalks = [];
    let maxNodes = 0;
    for (let s = 0; s < count; s++) {
      const z = r();                            // 깊이 0=전경 … 1=원경 (x와 무상관)
      const depth = 1 - z;                       // 1=가까움 … 0=멂
      const scale = lerp(0.5, 1.12, depth);      // 원근 크기
      const alphaMul = lerp(0.4, 1, depth);      // 원경 옅게(대기원근)
      const leafGain = 0.45 + depth * 0.55;      // 원경은 잎 개수↓ (디테일 감소)
      const nodes = 5 + (r() * 3 | 0);           // 마디 수
      maxNodes = Math.max(maxNodes, nodes + 1);
      const segLen = (H * (0.6 + r() * 0.24)) / nodes * scale;
      const st = {
        baseX: W * (-0.04 + 1.08 * (s + r() * 0.7) / count),
        baseY: H - z * H * 0.2,                   // 원경일수록 위쪽 뿌리(지평선 후퇴)
        phase: r() * TAU,
        nodes, segLen, z, scale,
        wBase: (7 + r() * 6) * scale,
        swayAmp: (26 + r() * 22) * lerp(0.45, 1.3, depth),  // 시차: 가까운 대 크게 흔들
        inkA: 0.92 * alphaMul,
        nodeA: 0.7 * alphaMul,
        inkRGB: fade([20, 17, 13], z),
        nodeRGB: fade([10, 9, 7], z),
        leaves: [],
      };
      for (let k = 1; k <= nodes; k++) {
        const nLeaf = Math.max(1, Math.round((3 + (r() * 4 | 0)) * leafGain));  // 획
        for (let j = 0; j < nLeaf; j++) {
          const side = j % 2 ? 1 : -1;
          st.leaves.push({
            node: k,
            ang: -Math.PI / 2 + side * (0.5 + r() * 0.9),  // 위·바깥으로
            len: (34 + r() * 54) * scale,
            wid: (4 + r() * 4) * scale,
            tone: fade(TONES[r() * 3 | 0], z),
            alpha: (0.6 + r() * 0.35) * alphaMul,
            ph: r() * TAU,
          });
        }
      }
      stalks.push(st);
    }
    stalks.sort((a, b) => b.z - a.z);            // painter's: 원경(z큰)부터 → 근경이 위에 겹침
    nxs = new Float32Array(maxNodes);
    nys = new Float32Array(maxNodes);
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.lineCap = 'round';
    paper = document.createElement('canvas');
    paper.width = Math.max(1, W); paper.height = Math.max(1, H);
    pcx = paper.getContext('2d');
    buildPaper();
    buildStalks();
    cx.drawImage(paper, 0, 0, W, H);   // init 배경 즉시
  }

  function drawLeaf(x0, y0, ang, len, wid, tone, alpha) {
    const tx = x0 + Math.cos(ang) * len, ty = y0 + Math.sin(ang) * len;
    const mx = (x0 + tx) / 2, my = (y0 + ty) / 2;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    cx.fillStyle = `rgba(${tone[0]},${tone[1]},${tone[2]},${alpha})`;
    cx.beginPath();
    cx.moveTo(x0, y0);
    cx.quadraticCurveTo(mx + nx * wid, my + ny * wid, tx, ty);
    cx.quadraticCurveTo(mx - nx * wid, my - ny * wid, x0, y0);
    cx.fill();
  }

  function drawStalk(st, t, wind) {
    const sway = Math.sin(t * 1.3 + st.phase) * wind * st.swayAmp;
    const bend = noise2(st.phase, t * 0.15) * wind * 8;   // 미세 흔들림
    for (let k = 0; k <= st.nodes; k++) {
      const hf = k / st.nodes;
      nxs[k] = st.baseX + (sway + bend) * hf * hf;
      nys[k] = st.baseY - k * st.segLen;                  // 깊이별 뿌리 높이에서 위로
    }
    const [ir, ig, ib] = st.inkRGB, [nr, ng, nb] = st.nodeRGB;
    // 마디 세그먼트(사이 미세 틈 + 마디 띠). 색·투명도는 깊이별로 미리 계산됨.
    for (let k = 1; k <= st.nodes; k++) {
      const hf = k / st.nodes;
      const w = lerp(st.wBase, st.wBase * 0.35, hf);
      const gapx = (nxs[k] - nxs[k - 1]) * 0.06, gapy = (nys[k] - nys[k - 1]) * 0.06;
      cx.strokeStyle = `rgba(${ir},${ig},${ib},${st.inkA})`;
      cx.lineWidth = w;
      cx.beginPath();
      cx.moveTo(nxs[k - 1] + gapx, nys[k - 1] + gapy);
      cx.lineTo(nxs[k] - gapx, nys[k] - gapy);
      cx.stroke();
      // 마디 띠(節): 관절에 짙은 짧은 선.
      cx.strokeStyle = `rgba(${nr},${ng},${nb},${st.nodeA})`;
      cx.lineWidth = w * 1.25;
      cx.beginPath();
      cx.moveTo(nxs[k] - gapx * 0.3, nys[k] - gapy * 0.3);
      cx.lineTo(nxs[k], nys[k]);
      cx.stroke();
    }
    // 잎: 마디 위치에 부착, 고주파 파르르.
    for (const lf of st.leaves) {
      const k = lf.node;
      const flutter = Math.sin(t * 8 + lf.ph) * wind * 0.22;
      drawLeaf(nxs[k], nys[k], lf.ang + flutter, lf.len * (1 + wind * 0.08), lf.wid, lf.tone, lf.alpha);
    }
  }

  return {
    init(ctx) {
      audio = ctx.audio; sensors = ctx.sensors;
      cv = ctx.canvas;
      W = ctx.width; H = ctx.height;
      setup();
    },

    frame(t, dt) {
      cx.drawImage(paper, 0, 0, W, H);
      const micOn = sensors && sensors.mic.available;
      const level = micOn ? sensors.mic.level() : 0;
      windPtr *= Math.max(0, 1 - dt * 3);          // 포인터 바람 감쇠
      const wind = 0.15 + (micOn ? level * 2.5 : windPtr);
      for (const st of stalks) drawStalk(st, t, wind);
      // 강풍 순간 잎 스치는 소리(스로틀).
      if (level > 0.4 && audio && t - lastRustle > 0.5) {
        audio.tone({ deg: 4, oct: 1, vol: 0.08 });
        lastRustle = t;
      }
    },

    pointer(e) {
      // 마이크 폴백: 드래그 x속도가 바람.
      if (e.type === 'down') { lastPX = e.x; }
      else if (e.type === 'move' && lastPX != null) {
        windPtr = clamp(windPtr + Math.abs(e.x - lastPX) * 0.05, 0, 2.5);
        lastPX = e.x;
      } else if (e.type === 'up') { lastPX = null; }
    },

    resize(w, h) { W = w; H = h; setup(); },

    dispose() {
      cx = pcx = null; paper = null; stalks = null;
      nxs = nys = null; audio = null; sensors = null; lastPX = null;
    },
  };
})();
