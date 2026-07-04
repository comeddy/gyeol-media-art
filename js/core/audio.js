// 결 · GYEOL — 오음계 오디오 엔진 (Web Audio)
// 32개 작품 전부와 main.js가 ctx.audio로 공유하는 싱글턴.
// import 시점 부작용 없음 — AudioContext는 ensure() 첫 호출(사용자 제스처 후)에서 지연 생성.
import { mulberry32 } from './canvas.js';

// 오음계(평조): 황종 Eb 기준 5음 — 도(0) 레(1) 미(2) 솔(3) 라(4)를 반음 [0,2,4,7,9]로 매핑
const SCALE = [0, 2, 4, 7, 9];
const BASE = 311.13; // Eb4
function freqOf(deg, oct = 0) {
  const n = SCALE[((deg % 5) + 5) % 5] + 12 * (Math.floor(deg / 5) + oct);
  return BASE * Math.pow(2, n / 12);
}

// 지수 램프는 0을 지날 수 없다 — 사실상 0인 하한값.
const EPS = 0.0001;

class GyeolAudio {
  constructor() {
    this.ctx = null;       // AudioContext (지연 생성)
    this.master = null;    // 마스터 GainNode (muted 토글 대상)
    this.comp = null;      // DynamicsCompressor
    this.ambient = null;   // { gain, nodes[] } 현재 앰비언트 or null
    this._muted = true;    // 정책: 사용자가 사운드를 켜기 전까지 무음
  }

  // 사용자 제스처 후 최초 호출. AudioContext + 마스터 체인 생성, suspended면 resume.
  // 마스터 체인: master GainNode → DynamicsCompressor → destination.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null; // 브라우저 밖(Node 등)에서는 조용히 no-op
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = this._muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.comp = comp;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 오음계 음 하나를 연주. ensure() 전에 불리면 조용히 no-op.
  // 가야금/거문고를 연상시키는 소리 — 빠른 attack(0.01s) + exponential decay,
  // 살짝 디튠된 배음 1개(×2.003, 볼륨 30%)로 음색을 풍성하게.
  tone({ deg = 0, oct = 0, dur = 0.8, vol = 0.3, type = 'sine' } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const f = freqOf(deg, oct);
    const voice = (freq, peak) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const top = Math.max(peak, EPS * 2);
      g.gain.setValueAtTime(EPS, t0);
      g.gain.exponentialRampToValueAtTime(top, t0 + 0.01); // 빠른 attack
      g.gain.exponentialRampToValueAtTime(EPS, t0 + dur);  // 지수 감쇠
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
      osc.onended = () => { osc.disconnect(); g.disconnect(); };
    };
    voice(f, vol);
    voice(f * 2.003, vol * 0.3); // 살짝 디튠된 배음
  }

  // 관 번호 시드로 오음계 저음 드론 2음(oct -2) + 8~14초 주기 LFO 게인 흔들림을 시작.
  // 이전 앰비언트는 1.5초 페이드아웃 후 정리. null이면 정지만.
  setAmbient(wingNo) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.ambient) {
      this._stopAmbient(this.ambient);
      this.ambient = null;
    }
    if (wingNo == null) return;

    const rand = mulberry32(((wingNo | 0) * 374761393) >>> 0);
    const t0 = ctx.currentTime;

    // 앰비언트 마스터 게인 — 배경음은 아주 은은하게(base + LFO depth ≤ 0.08).
    const base = 0.05;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(base, t0 + 2); // 서서히 페이드 인
    g.connect(this.master);
    const nodes = [g];

    // 저음 드론 2음: 근음 + 5도 위(오음계 deg+3 = +7반음)
    const rootDeg = Math.floor(rand() * 5);
    for (const d of [rootDeg, rootDeg + 3]) {
      const osc = ctx.createOscillator();
      const ng = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freqOf(d, -2);
      osc.detune.value = rand() * 8 - 4; // ±4센트로 자연스러운 울림
      ng.gain.value = 0.5;
      osc.connect(ng);
      ng.connect(g);
      osc.start(t0);
      nodes.push(osc, ng);
    }

    // 느린 LFO가 앰비언트 게인을 흔든다(주기 8~14초, 진폭 0.02).
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 1 / (8 + rand() * 6);
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    lfo.start(t0);
    nodes.push(lfo, lfoGain);

    this.ambient = { gain: g, nodes };
  }

  // 앰비언트를 1.5초 페이드아웃 후 노드 정리.
  _stopAmbient(amb) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const p = amb.gain.gain;
    p.cancelScheduledValues(t0);
    p.setValueAtTime(p.value, t0);
    p.linearRampToValueAtTime(0, t0 + 1.5);
    for (const n of amb.nodes) {
      if (typeof n.stop === 'function') { try { n.stop(t0 + 1.5); } catch { /* 이미 정지 */ } }
    }
    setTimeout(() => {
      for (const n of amb.nodes) { try { n.disconnect(); } catch { /* 이미 해제 */ } }
    }, 1600);
  }

  get muted() { return this._muted; }

  // 마스터 게인 0↔1 linearRamp 0.3s. 토글 버튼(main.js)과 연결.
  set muted(v) {
    const val = !!v;
    this._muted = val;
    if (this.ctx && this.master) {
      const t0 = this.ctx.currentTime;
      const p = this.master.gain;
      p.cancelScheduledValues(t0);
      p.setValueAtTime(p.value, t0);
      p.linearRampToValueAtTime(val ? 0 : 1, t0 + 0.3);
    }
  }
}

const audio = new GyeolAudio();
export default audio;
