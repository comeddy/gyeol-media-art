// 결 · GYEOL — MediaPipe 손 인식 래퍼 (지연 로딩)
// 손 작품 2점(정음 별자리·십이지)만 소비하는 단일 창구.
// 핵심 설계: 무거운 것(CDN import·모델/wasm 로딩·getUserMedia·RAF 루프)은
//   전부 request()에서만 일어난다. import 시점 부작용 제로 —
//   Node에서 import 후 get()을 불러도 안전하게 빈 배열을 돌려준다.
// 모든 실패(권한 거부·모델/wasm 로딩 실패·카메라 없음·WebGL 미지원)는
//   throw하지 않고 available=false + request() false resolve로 흡수한다.
//   작품은 이 신호를 보고 pointer 폴백으로 동작한다.

// 버전 고정 — tasks-vision 라이브러리와 wasm 경로를 같은 버전으로 묶는다.
const VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const WASM_PATH = `${CDN}/wasm`;
// 손 랜드마크 모델(float16) — Google 공식 호스팅.
const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// video의 loadeddata가 이 시간 내 오지 않아도 진행한다(무한 대기 방지).
const VIDEO_READY_TIMEOUT_MS = 5000;
// 엄지 끝(4)·검지 끝(8) 랜드마크 인덱스 — pinch 거리 계산용.
const THUMB_TIP = 4;
const INDEX_TIP = 8;

class GyeolHands {
  constructor() {
    this._available = false;
    this._promise = null;    // request() 중복 호출 시 재사용할 in-flight/결과 프라미스
    this._vision = null;     // FilesetResolver 결과(wasm fileset)
    this._landmarker = null; // HandLandmarker 인스턴스
    this._stream = null;     // getUserMedia MediaStream
    this._video = null;      // 숨김 <video> 엘리먼트
    this._raf = 0;           // requestAnimationFrame id
    this._lastVideoTime = -1;// 같은 프레임 중복 검출 방지용
    this._latest = [];       // 최신 검출 결과(get()이 반환) — 호출측 프레임과 분리
  }

  // 카메라 권한 + 모델/wasm 로딩. 성공 true, 실패 false(throw 금지).
  // 중복 호출은 기존 프라미스를 재사용한다(stop 후 재요청 가능).
  request() {
    if (this._available) return Promise.resolve(true);
    if (this._promise) return this._promise;
    this._promise = this._start();
    return this._promise;
  }

  get available() { return this._available; }

  // 최신 프레임의 손 목록을 반환. 미가용 시 빈 배열.
  // 각 손: { landmarks: [{x,y}×21] (0..1 정규화), pinch: number }.
  get() { return this._latest; }

  // 지연 초기화 본체. 어느 단계에서 실패해도 부분 자원을 정리하고 false를 돌려준다.
  async _start() {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const md = nav && nav.mediaDevices;
    // 미지원 환경(Node·비보안 컨텍스트 등)은 조용히 미가용 처리.
    if (!md || typeof md.getUserMedia !== 'function' || typeof document === 'undefined') {
      this._available = false;
      return false;
    }
    try {
      // CDN 동적 import — 여기서 처음으로 무거운 라이브러리를 내려받는다.
      const vision = await import(CDN);
      const { FilesetResolver, HandLandmarker } = vision;
      this._vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      this._landmarker = await this._createLandmarker(HandLandmarker);

      // 카메라 스트림 → 숨김 video.
      this._stream = await md.getUserMedia({ video: { width: 640 } });
      this._video = this._makeVideo(this._stream);
      await this._waitVideoReady(this._video);
      try { await this._video.play(); } catch { /* 무음 재생 정책상 대개 성공, 실패해도 트랙 프레임은 흐른다 */ }

      this._available = true;
      this._loop();
      return true;
    } catch {
      // 어느 단계에서든 실패 — 부분 자원 정리 후 미가용.
      this._teardown();
      this._available = false;
      return false;
    }
  }

  // GPU delegate 우선, 실패 시 CPU로 재시도.
  async _createLandmarker(HandLandmarker) {
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      numHands: 2,
      runningMode: 'VIDEO',
    });
    try {
      return await HandLandmarker.createFromOptions(this._vision, opts('GPU'));
    } catch {
      return await HandLandmarker.createFromOptions(this._vision, opts('CPU'));
    }
  }

  // 화면 밖에 숨긴 video(스트림 프레임은 표시 여부와 무관하게 흐른다).
  _makeVideo(stream) {
    const v = document.createElement('video');
    v.srcObject = stream;
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('aria-hidden', 'true');
    const s = v.style;
    s.position = 'fixed';
    s.width = s.height = '1px';
    s.left = s.top = '-1px';
    s.opacity = '0';
    s.pointerEvents = 'none';
    document.body.appendChild(v);
    return v;
  }

  // 첫 프레임 디코드까지 대기(안전장치 타임아웃 포함).
  _waitVideoReady(video) {
    if (video.readyState >= 2) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      video.addEventListener('loadeddata', finish, { once: true });
      setTimeout(finish, VIDEO_READY_TIMEOUT_MS);
    });
  }

  // 내부 RAF 루프 — 새 프레임에서만 detectForVideo 실행, 결과를 latest에 저장.
  _loop() {
    const step = () => {
      this._raf = requestAnimationFrame(step);
      const v = this._video;
      const lm = this._landmarker;
      if (!v || !lm || v.readyState < 2 || !v.videoWidth) return;
      if (v.currentTime === this._lastVideoTime) return; // 같은 프레임 스킵
      this._lastVideoTime = v.currentTime;
      try {
        const res = lm.detectForVideo(v, performance.now());
        this._latest = this._toHands(res);
      } catch { /* 일시적 검출 오류는 해당 프레임만 건너뛴다 */ }
    };
    this._raf = requestAnimationFrame(step);
  }

  // MediaPipe 결과 → 공개 형태. 좌표는 0..1 정규화 그대로, pinch는 4↔8 유클리드 거리.
  _toHands(res) {
    const hands = res && res.landmarks;
    if (!hands || !hands.length) return [];
    const out = [];
    for (const raw of hands) {
      const landmarks = raw.map((p) => ({ x: p.x, y: p.y }));
      const a = raw[THUMB_TIP];
      const b = raw[INDEX_TIP];
      const pinch = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      out.push({ landmarks, pinch });
    }
    return out;
  }

  // RAF 취소 + 스트림 트랙 stop + video 제거 + landmarker.close(). latest 초기화.
  // 이후 request() 재호출로 다시 켤 수 있다.
  stop() {
    this._teardown();
    this._available = false;
    this._promise = null;
    this._lastVideoTime = -1;
    this._latest = [];
  }

  // 자원 해제(성공/실패 공통). 상태 플래그는 호출측(stop/_start)이 정리한다.
  _teardown() {
    if (this._raf) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    if (this._stream) {
      for (const t of this._stream.getTracks()) { try { t.stop(); } catch { /* 무시 */ } }
      this._stream = null;
    }
    if (this._video) {
      try { this._video.pause(); } catch { /* 무시 */ }
      this._video.srcObject = null;
      try { this._video.remove(); } catch { /* 무시 */ }
      this._video = null;
    }
    if (this._landmarker) {
      try { this._landmarker.close(); } catch { /* 무시 */ }
      this._landmarker = null;
    }
    this._vision = null;
  }
}

const hands = new GyeolHands();
export default hands;
