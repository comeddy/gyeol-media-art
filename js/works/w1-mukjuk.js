// 결 · GYEOL — 1관 묵향 · 묵죽(墨竹) Ink Bamboo
// 먹빛 대숲이 바람에 흔들린다. 줄기는 마디(節) 단위 세그먼트로 서고, 마디마다
// 잎 클러스터(먹 농담 3톤)가 돋는다. 바람이 셀수록 크게 눕고 잎은 파르르 떤다.
// 바람 = 0.15 + mic.level()*2.5. 마이크 미가용 시 포인터 드래그 x속도가 바람.
import { fitCanvas, noise2, mulberry32, lerp, clamp, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, paper, pcx, audio, sensors;
  let W = 0, H = 0, dpr = 1;
  let stalks = null, nxs = null, nys = null;
  let windPtr = 0, lastPX = null, lastRustle = -1;

  const TONES = [[26, 22, 17], [14, 12, 10], [74, 64, 52]];  // 흑 · 먹빛 · 옅은먹

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
    const count = 3 + (r() * 3 | 0);            // 3~5그루
    stalks = [];
    let maxNodes = 0;
    for (let s = 0; s < count; s++) {
      const nodes = 6 + (r() * 3 | 0);          // 마디 수
      maxNodes = Math.max(maxNodes, nodes + 1);
      const segLen = (H * (0.62 + r() * 0.26)) / nodes;
      const st = {
        baseX: W * (0.12 + 0.76 * (s + r() * 0.5) / count),
        phase: r() * TAU,
        nodes, segLen,
        wBase: 7 + r() * 6,
        swayAmp: 26 + r() * 22,
        leaves: [],
      };
      for (let k = 1; k <= nodes; k++) {
        const nLeaf = 3 + (r() * 4 | 0);        // 획 3~6개
        for (let j = 0; j < nLeaf; j++) {
          const side = j % 2 ? 1 : -1;
          st.leaves.push({
            node: k,
            ang: -Math.PI / 2 + side * (0.5 + r() * 0.9),  // 위·바깥으로
            len: 34 + r() * 54,
            wid: 4 + r() * 4,
            tone: TONES[r() * 3 | 0],
            alpha: 0.6 + r() * 0.35,
            ph: r() * TAU,
          });
        }
      }
      stalks.push(st);
    }
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
      nys[k] = H - k * st.segLen;
    }
    // 마디 세그먼트(사이 미세 틈 + 마디 띠).
    for (let k = 1; k <= st.nodes; k++) {
      const hf = k / st.nodes;
      const w = lerp(st.wBase, st.wBase * 0.35, hf);
      const gapx = (nxs[k] - nxs[k - 1]) * 0.06, gapy = (nys[k] - nys[k - 1]) * 0.06;
      cx.strokeStyle = 'rgba(20,17,13,0.92)';
      cx.lineWidth = w;
      cx.beginPath();
      cx.moveTo(nxs[k - 1] + gapx, nys[k - 1] + gapy);
      cx.lineTo(nxs[k] - gapx, nys[k] - gapy);
      cx.stroke();
      // 마디 띠(節): 관절에 짙은 짧은 선.
      cx.strokeStyle = 'rgba(10,9,7,0.7)';
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
