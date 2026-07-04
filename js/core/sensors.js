// 결 · GYEOL — 센서 허브 (폴백 내장)
// 32개 작품과 main.js가 마이크/기울기를 읽는 단일 창구.
// 핵심 설계: 폴백이 API에 내장 — 어떤 환경(권한 거부·미지원·Node)에서도
//   mic.level()은 숫자(미가용 0), tilt()는 {x,y} 숫자를 반환한다.
// import 시점 부작용 없음 — 마이크는 request()에서, 자이로 리스너는 tilt()/enableTilt() 최초 호출에서 지연 초기화.
import { clamp } from './canvas.js';

// deviceorientation의 beta(앞뒤)·gamma(좌우)를 ±45°를 -1..1로 매핑할 때의 기준 각.
const TILT_RANGE_DEG = 45;
// 자이로 이벤트가 이 시간 내 발화하지 않으면 pointer 폴백을 확정한다.
const GYRO_WAIT_MS = 3000;
// time-domain RMS(대개 작은 값)를 0..1로 끌어올리는 부스트 계수(이후 clamp).
const MIC_BOOST = 4;

class GyeolSensors {
  constructor() {
    // ── mic 상태 ──
    this._stream = null;       // MediaStream (getUserMedia 결과)
    this._audioCtx = null;     // 마이크 전용 AudioContext (audio.js와 분리)
    this._analyser = null;     // AnalyserNode(fftSize 512)
    this._timeData = null;     // getByteTimeDomainData 버퍼(Uint8Array, len=fftSize)
    this._micAvailable = false;
    this._micPromise = null;   // request() 중복 호출 시 재사용할 결과 프라미스

    // ── tilt 상태 ──
    this._tiltInited = false;
    this._tiltSource = 'pointer'; // 'gyro' | 'pointer'
    this._x = 0;                  // 최신 기울기 x (-1..1)
    this._y = 0;                  // 최신 기울기 y (-1..1)
    this._gyroFired = false;      // 유효한 deviceorientation 이벤트를 받았는가
    this._pointerEnabled = false;
    this._fallbackTimer = null;
    this._onOrient = null;        // 바인딩된 리스너 참조(해제용)
    this._onPointer = null;

    // ── 공개 mic 파사드 (sensors.mic.*) ──
    const inst = this;
    this.mic = {
      request: () => inst._micRequest(),
      level: () => inst._micLevel(),
      get available() { return inst._micAvailable; },
    };
  }

  // ───────────────────────── mic ─────────────────────────

  // 마이크 권한 요청. 성공 시 true, 거부/미지원 시 false(throw 금지).
  // 중복 호출은 기존 결과를 재사용한다(dispose 후 재요청 가능).
  async _micRequest() {
    if (this._micAvailable) return true;
    if (this._micPromise) return this._micPromise;
    this._micPromise = this._openMic();
    return this._micPromise;
  }

  async _openMic() {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const md = nav && nav.mediaDevices;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    // 미지원 환경(Node·비보안 컨텍스트 등)은 조용히 미가용 처리.
    if (!md || typeof md.getUserMedia !== 'function' || !AC) {
      this._micAvailable = false;
      return false;
    }
    let stream = null; // catch에서 트랙 정리 가능하도록 try 밖 스코프에 둔다.
    try {
      stream = await md.getUserMedia({ audio: true });
      const ctx = new AC();
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* 무시 */ } }
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      this._stream = stream;
      this._audioCtx = ctx;
      this._analyser = analyser;
      this._timeData = new Uint8Array(analyser.fftSize);
      this._micAvailable = true;
      return true;
    } catch {
      // 권한 거부/실패 — 폴백: 미가용 상태로 남기고 false 반환(프라미스는 캐시하여 재프롬프트 방지).
      // getUserMedia 성공 후 AudioContext/Analyser 생성이 throw했다면 스트림 트랙이 살아있어
      // 마이크 표시등이 잔존할 수 있으므로 확실히 정리한다(프라이버시).
      try { stream && stream.getTracks().forEach(t => t.stop()); } catch { /* 무시 */ }
      this._micAvailable = false;
      return false;
    }
  }

  // 현재 마이크 입력의 RMS를 0..1로 정규화. 미가용 시 항상 0.
  _micLevel() {
    const a = this._analyser;
    const data = this._timeData;
    if (!this._micAvailable || !a || !data) return 0;
    a.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128; // 0..255(중심 128) → -1..1
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    return clamp(rms * MIC_BOOST, 0, 1);
  }

  // ───────────────────────── tilt ─────────────────────────

  // 기기 기울기(자이로) 또는 마우스 위치(폴백)를 -1..1로 반환. 최초 호출 시 지연 초기화.
  tilt() {
    if (!this._tiltInited) this._initTilt();
    return { x: this._x, y: this._y };
  }

  get tiltSource() { return this._tiltSource; }

  // 리스너를 미리 붙이고 싶을 때(main.js) — tilt() 없이도 초기화 트리거.
  enableTilt() {
    if (!this._tiltInited) this._initTilt();
  }

  // iOS 13+ 권한(DeviceOrientationEvent.requestPermission)을 사용자 제스처 안에서 요청.
  // 승인 시 자이로 활성화 후 true, 거부/미지원 시 pointer 폴백 후 false.
  async requestTilt() {
    if (typeof window === 'undefined') return false;
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission();
        if (res === 'granted') { this._enableGyro(); return true; }
        this._enablePointer(); // 거부 → pointer 폴백 확정
        this._tiltInited = true;
        return false;
      } catch {
        if (!this._tiltInited) this._initTilt();
        return false;
      }
    }
    // 권한 불필요 — 그냥 초기화. 자이로 지원 여부를 반환.
    if (!this._tiltInited) this._initTilt();
    return !!DOE;
  }

  _initTilt() {
    if (this._tiltInited) return;
    this._tiltInited = true;
    if (typeof window === 'undefined') return; // Node: 리스너 없이 {x:0,y:0}
    if (typeof window.DeviceOrientationEvent !== 'undefined') this._enableGyro();
    else this._enablePointer();
  }

  // 자이로 리스너 등록 + 3초 폴백 타이머 무장. 이미 pointer면 그 리스너를 떼어낸다.
  _enableGyro() {
    if (typeof window === 'undefined') return;
    this._tiltInited = true;
    if (this._onPointer) {
      window.removeEventListener('pointermove', this._onPointer);
      this._onPointer = null;
      this._pointerEnabled = false;
    }
    this._tiltSource = 'gyro';
    this._gyroFired = false;
    if (!this._onOrient) {
      this._onOrient = (e) => this._handleOrient(e);
      window.addEventListener('deviceorientation', this._onOrient);
    }
    if (this._fallbackTimer != null) clearTimeout(this._fallbackTimer);
    this._fallbackTimer = setTimeout(() => {
      this._fallbackTimer = null;
      if (!this._gyroFired) this._enablePointer(); // 미발화 → pointer 폴백 확정
    }, GYRO_WAIT_MS);
  }

  _handleOrient(e) {
    // 자이로 미탑재 데스크톱은 beta/gamma가 모두 null인 이벤트를 흘린다 → 무시.
    if (e.beta == null && e.gamma == null) return;
    this._gyroFired = true;
    this._tiltSource = 'gyro';
    if (this._fallbackTimer != null) { clearTimeout(this._fallbackTimer); this._fallbackTimer = null; }
    this._x = clamp((e.gamma || 0) / TILT_RANGE_DEG, -1, 1);
    this._y = clamp((e.beta || 0) / TILT_RANGE_DEG, -1, 1);
  }

  // pointer 폴백: 마우스 위치를 화면 중심 기준 -1..1로 매핑.
  _enablePointer() {
    if (this._pointerEnabled) return;
    if (typeof window === 'undefined') return;
    this._pointerEnabled = true;
    this._tiltSource = 'pointer';
    if (this._onOrient) {
      window.removeEventListener('deviceorientation', this._onOrient);
      this._onOrient = null;
    }
    this._onPointer = (e) => this._handlePointer(e);
    window.addEventListener('pointermove', this._onPointer);
  }

  _handlePointer(e) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    this._x = clamp((e.clientX / w) * 2 - 1, -1, 1);
    this._y = clamp((e.clientY / h) * 2 - 1, -1, 1);
  }

  // ───────────────────────── dispose ─────────────────────────

  // 스트림 트랙 stop + AudioContext close + 모든 window 리스너 해제 + 상태 초기화.
  // 이후에도 tilt()/mic.level()은 안전하게 값을 반환하며, 다음 mount에서 재요청 가능.
  dispose() {
    // mic 정리
    if (this._stream) {
      for (const t of this._stream.getTracks()) { try { t.stop(); } catch { /* 무시 */ } }
    }
    if (this._audioCtx) { try { this._audioCtx.close(); } catch { /* 무시 */ } }
    this._stream = null;
    this._audioCtx = null;
    this._analyser = null;
    this._timeData = null;
    this._micAvailable = false;
    this._micPromise = null;

    // tilt 리스너 정리
    if (typeof window !== 'undefined') {
      if (this._onOrient) window.removeEventListener('deviceorientation', this._onOrient);
      if (this._onPointer) window.removeEventListener('pointermove', this._onPointer);
    }
    if (this._fallbackTimer != null) clearTimeout(this._fallbackTimer);
    this._onOrient = null;
    this._onPointer = null;
    this._fallbackTimer = null;
    this._tiltInited = false;
    this._pointerEnabled = false;
    this._gyroFired = false;
    this._tiltSource = 'pointer';
    this._x = 0;
    this._y = 0;
  }
}

const sensors = new GyeolSensors();
export default sensors;
