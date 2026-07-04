# 결 · GYEOL 미디어 아트 전시 사이트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한국적 미감을 제너러티브 알고리즘으로 재해석한 8관 32작품 인터랙티브 미디어 아트 전시 사이트를 만들어 S3+CloudFront에 배포한다.

**Architecture:** Zero-build 바닐라 ES 모듈. index.html 단일 진입점 + 해시 라우터(main.js)가 작품 모듈(works/*.js)을 동적 import로 지연 로딩. 모든 작품은 동일한 모듈 계약을 구현하고, main.js가 RAF 루프를 소유하여 작품의 frame()을 호출한다(누수 방지). 센서/오디오/손인식은 core/*로 일원화.

**Tech Stack:** Vanilla JS (ES2022 모듈), Canvas 2D + WebGL, three.js 0.161.0 (import map CDN), MediaPipe Tasks Vision (CDN, 지연 로딩), Web Audio API, Google Fonts(Gowun Batang, Space Mono).

**Spec:** `docs/superpowers/specs/2026-07-04-gyeol-media-art-design.md`

## Global Constraints

- **Zero-build**: 번들러·npm 의존성·빌드 단계 금지. 배포물 = 저장소의 정적 파일 그대로.
- **초기 전송량 < 100KB**: index.html + css/style.css + js/main.js + js/data.js 합계 (폰트·CDN 라이브러리 제외).
- **성능**: selftest 기준 작품당 60프레임 평균 frame() 비용 < 16ms. 미달 작품은 파티클 수 등 파라미터 축소.
- **언어**: UI는 한국어, 포인트 텍스트만 영문. 전시 제목 표기는 `결 · GYEOL` 고정.
- **CDN 버전 고정**: three.js `0.161.0`, MediaPipe `@mediapipe/tasks-vision@0.10.14`. 다른 버전 금지.
- **작품 모듈 계약**(아래) 엄수. main.js와 작품은 계약으로만 통신.
- **개발 서버**: `python3 -m http.server 8000 --directory /home/ec2-user/media-art` (ES 모듈은 file:// 불가).
- **검증 도구**: Playwright MCP 브라우저(`mcp__plugin_playwright_playwright__browser_*`). npm playwright 설치 금지.
- **커밋**: Task 단위. 메시지 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **색 팔레트(전역 CSS 변수)**: 배경 먹빛 `#0E0C0A`, 한지 `#EDE6D6`, 오방색 — 적 `#C23B22` 청 `#2C5F93` 황 `#E3A81C` 백 `#EDE6D6` 흑 `#1A1611`.

## 작품 모듈 계약 (모든 works/*.js가 구현)

```js
// js/works/w{wing}-{id}.js — 파일명 규칙 고정. data.js의 id와 일치.
export default {
  // main.js가 mount 시 호출. ctx = { canvas, audio, sensors, hands, width, height, dpr }
  // canvas는 매 mount마다 새 엘리먼트(2d/webgl 컨텍스트 충돌 방지). 컨텍스트는 작품이 직접 획득.
  init(ctx) {},
  // main.js 소유 RAF 루프가 호출. t=경과초, dt=프레임간격초(최대 0.05로 클램프됨)
  frame(t, dt) {},
  // 정규화 포인터. e = { type: 'down'|'move'|'up', x, y } (CSS px, 캔버스 좌표계)
  pointer(e) {},
  resize(w, h) {},   // CSS px
  dispose() {},      // 자체 등록 리스너·GL 자원·오디오 노드 해제. RAF는 만들지 않았으므로 없음.
}
```

- **작품은 자체 RAF 루프를 만들지 않는다** — frame()만 구현. (누수 방지가 계약에 내장됨)
- needs(`mic`|`hands`|`gyro`|`webgl`)는 data.js에만 선언 — main.js가 배지 표시·권한 안내에 사용.
- 센서 폴백은 core/sensors.js가 보장: 권한 거부/미지원이어도 API는 항상 값을 반환(대체 값).

## 파일 맵

| 파일 | 책임 | 생성 Task |
|---|---|---|
| `index.html` | 아트리움 + 뷰어 셸 마크업, import map | 1 |
| `css/style.css` | 전역 스타일, 한지 질감, 뷰어/카드 레이아웃 | 1 |
| `js/data.js` | WINGS(8) + WORKS(32) 메타데이터 단일 소스 | 2 |
| `js/core/canvas.js` | fitCanvas, 루프 유틸, noise, mulberry32, lerp, clamp | 3 |
| `js/core/audio.js` | 오음계 신스, 앰비언트, 마스터 토글 | 4 |
| `js/core/sensors.js` | 마이크 레벨/자이로 틸트 + 자동 폴백 | 5 |
| `js/core/hands.js` | MediaPipe 손 랜드마크 래퍼(지연 로딩) | 6 |
| `js/main.js` | 해시 라우터, 뷰어 셸, 작품 로더, RAF 루프 소유 | 7 |
| `js/works/w1-balmuk.js` | 파일럿 작품(발묵) — 계약 레퍼런스 구현 | 7 |
| `js/selftest.js` | `?selftest` 전수 스모크 하네스 | 8 |
| `js/works/*.js` (31개) | 관별 작품 모듈 | 9–16 |
| `making-of.html` | 제작 과정 + 실제 프롬프트 기록 | 17 |

---

### Task 1: 정적 뼈대 — index.html + css/style.css

**Files:**
- Create: `index.html`
- Create: `css/style.css`

**Interfaces:**
- Produces: `#stage`(작품 캔버스 마운트 지점), `#atrium`(관 카드 그리드 `#wings`), `#viewer`(뷰어 오버레이: `#viewer-title`, `#viewer-desc`, `#viewer-note`, `[data-action=prev|next|close|info|sound]` 버튼), `body[data-view="atrium"|"viewer"]` 상태 어트리뷰트. main.js(Task 7)가 이 셀렉터들에 의존.

- [ ] **Step 1: index.html 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="description" content="결 · GYEOL — 한국적 미감을 코드로 다시 빚은 8관 32작품 인터랙티브 미디어 아트 전시." />
  <title>결 · GYEOL — 한국적 미감의 제너러티브 전시</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="./css/style.css" />
  <script type="importmap">
  { "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/" } }
  </script>
</head>
<body data-view="atrium">
  <div class="grain" aria-hidden="true"></div>
  <header class="topbar">
    <button class="brand" data-action="home" aria-label="아트리움으로">결 · GYEOL</button>
    <button class="sound-toggle" data-action="sound" aria-pressed="false" aria-label="사운드 켜기/끄기">∿</button>
  </header>
  <main id="atrium" class="atrium">
    <section class="hero">
      <p class="hero__eyebrow">GENERATIVE KOREAN AESTHETICS</p>
      <h1 class="hero__title">결</h1>
      <p class="hero__lead">물결, 나뭇결, 숨결, 비단결 — 자연이 스스로 새기는 무늬를 코드로 다시 빚었습니다.
        여덟 개의 전시관, 서른두 개의 작품. 만지고, 불고, 기울이고, 손짓해 보세요.</p>
      <p class="hero__meta">32 WORKS · 8 WINGS · INTERACTIVE</p>
    </section>
    <section id="wings" class="wings" aria-label="전시관 목록"><!-- main.js가 주입 --></section>
    <footer class="foot"><a href="./making-of.html">이 전시는 어떻게 만들어졌나 →</a></footer>
  </main>
  <section id="viewer" class="viewer" hidden>
    <div id="stage" class="stage"></div>
    <div class="viewer__hud">
      <button data-action="close" aria-label="닫기">✕</button>
      <button data-action="prev" aria-label="이전 작품">‹</button>
      <button data-action="next" aria-label="다음 작품">›</button>
      <button data-action="info" aria-label="작품 정보" aria-expanded="false">ⓘ</button>
    </div>
    <aside id="panel" class="viewer__panel" hidden>
      <h2 id="viewer-title"></h2>
      <p id="viewer-desc"></p>
      <p id="viewer-note" class="note"></p>
    </aside>
    <p id="hint" class="viewer__hint" hidden></p>
  </section>
  <script type="module" src="./js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: css/style.css 작성** — 핵심 규칙(전체 코드는 이 뼈대를 유지하며 살을 붙임):

```css
:root {
  --ink:#0E0C0A; --paper:#EDE6D6; --red:#C23B22; --blue:#2C5F93;
  --gold:#E3A81C; --black:#1A1611;
  --serif:'Gowun Batang',serif; --mono:'Space Mono',monospace;
}
* { margin:0; box-sizing:border-box; }
html,body { height:100%; }
body { background:var(--ink); color:var(--paper); font-family:var(--serif); overflow-x:hidden; }
.grain { position:fixed; inset:0; pointer-events:none; opacity:.06; z-index:50;
  background-image:url("data:image/svg+xml,..."); /* feTurbulence 노이즈 SVG data URI */ }
body[data-view="viewer"] #atrium { display:none; }
body[data-view="atrium"] #viewer { display:none; }
.viewer { position:fixed; inset:0; }
.stage, .stage canvas { position:absolute; inset:0; width:100%; height:100%; }
.wings { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1rem; padding:2rem; }
.wing-card { border:1px solid color-mix(in srgb,var(--paper) 20%,transparent); padding:1.5rem; cursor:pointer;
  transition:border-color .3s; background:none; color:inherit; text-align:left; }
.work-chip { font-family:var(--mono); font-size:.75rem; opacity:.7; }
@media (max-width:600px){ .hero__title{font-size:4rem} .wings{padding:1rem} }
```

관 카드·뷰어 HUD·패널·힌트·모바일 대응을 포함해 완성하되, style.css는 22KB 이하로 유지.

- [ ] **Step 3: 서버 기동 + 육안 검증**

Run: `python3 -m http.server 8000 --directory /home/ec2-user/media-art` (run_in_background)
Playwright MCP: `browser_navigate` → `http://localhost:8000/` → `browser_snapshot`
Expected: 히어로 텍스트 "결" 렌더, 콘솔에 main.js 404 외 에러 없음(main.js는 Task 7).

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css && git commit -m "feat: 아트리움/뷰어 정적 뼈대"
```

---

### Task 2: js/data.js — 8관 32작품 메타데이터

**Files:**
- Create: `js/data.js`

**Interfaces:**
- Produces: `export const WINGS`(8개: `{no, id, name, hanja, tagline, desc}`), `export const WORKS`(32개: `{id, wing, title, en, desc, how, needs}`), `export function wingWorks(no)`. main.js·selftest.js가 소비. `id`는 작품 파일명 `w{wing}-{id}.js`와 일치해야 함.

- [ ] **Step 1: data.js 작성** — 스키마와 1관 예시(나머지 관도 동일 구조로 스펙 §2 표의 32작품 전부 작성):

```js
export const WINGS = [
  { no:1, id:'mukhyang', name:'묵향', hanja:'墨', tagline:'수묵의 물성',
    desc:'먹이 번지고, 붓이 지나가고, 안개가 산을 삼킨다. 수묵의 물성을 코드로 옮겼다.' },
  // ... 2 오방 五方 / 3 훈민 訓民 / 4 여백 餘白 / 5 조각보 / 6 풍류 風流 / 7 민화 民畫 / 8 세시 歲時
];
export const WORKS = [
  { id:'balmuk', wing:1, title:'발묵', en:'Bleeding Ink',
    desc:'화선지에 먹이 스며들 듯, 터치한 자리에서 먹이 번져 나간다.',
    how:'터치/드래그로 먹을 떨어뜨리세요. 오래 누를수록 짙게 스며듭니다.',
    needs:[] },
  { id:'ilpil', wing:1, title:'일필', en:'One Stroke', desc:'…', how:'드래그로 붓을 끄세요. 속도가 갈필과 윤필을 가릅니다.', needs:[] },
  { id:'ujung', wing:1, title:'우중산수', en:'Mountains in Rain', desc:'…', how:'기기를 기울이면 시점이 움직입니다.', needs:['gyro'] },
  { id:'mukjuk', wing:1, title:'묵죽', en:'Ink Bamboo', desc:'…', how:'마이크에 바람을 불어 보세요.', needs:['mic'] },
  // ... 32작품 전부. desc/how는 각 1~2문장의 실제 전시 문구로 작성.
];
export const wingWorks = (no) => WORKS.filter(w => w.wing === no);
```

스펙 §2 표의 관·작품명·인터랙션 태그를 그대로 옮긴다. needs 분배: mic 4점(mukjuk, dalhangari, samulnori, cheong), hands 2점(jeongeum, sibiji), gyro 2점(ujung, nakhwa), webgl은 일월오봉도(ilwol) 등 셰이더 작품에만.

- [ ] **Step 2: 검증** — `node --input-type=module -e "import('./js/data.js').then(m=>{const e=[];if(m.WINGS.length!==8)e.push('wings');if(m.WORKS.length!==32)e.push('works');for(const w of m.WORKS){if(![1,2,3,4,5,6,7,8].includes(w.wing))e.push(w.id)}console.log(e.length?'FAIL '+e:'OK')})"` → `OK`

- [ ] **Step 3: Commit** — `git add js/data.js && git commit -m "feat: 8관 32작품 메타데이터"`

---

### Task 3: js/core/canvas.js — 공통 유틸

**Files:**
- Create: `js/core/canvas.js`

**Interfaces:**
- Produces: `fitCanvas(canvas, w, h, dpr)` (버퍼 크기 세팅+스케일 반환), `noise2(x,y)`/`noise3(x,y,z)` (심플렉스/펄린, -1..1), `mulberry32(seed)` (시드 난수 함수 반환), `lerp(a,b,t)`, `clamp(v,min,max)`, `TAU`. 모든 작품 모듈이 소비.

- [ ] **Step 1: 구현** — 외부 의존 없는 순수 함수만. Perlin은 고전 3D permutation 방식(코드 ~60줄), `noise2(x,y)=noise3(x,y,0)`.

```js
export const TAU = Math.PI * 2;
export const lerp = (a,b,t) => a + (b-a)*t;
export const clamp = (v,lo,hi) => v<lo?lo:v>hi?hi:v;
export function mulberry32(seed){ let a=seed>>>0; return ()=>{ a|=0;a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
export function fitCanvas(canvas,w,h,dpr=Math.min(devicePixelRatio||1,2)){
  canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
  canvas.style.width=w+'px'; canvas.style.height=h+'px'; return dpr; }
// noise3: 고전 Perlin (permutation table 512, fade/grad) — 표준 구현 그대로.
export function noise3(x,y,z){ /* 표준 Perlin 구현 */ }
export const noise2 = (x,y) => noise3(x,y,0);
```

- [ ] **Step 2: 검증** — `node --input-type=module -e "import('./js/core/canvas.js').then(m=>{const v=m.noise3(0.5,0.3,0.1);console.log(typeof v==='number'&&v>=-1&&v<=1&&m.noise3(0.5,0.3,0.1)===v?'OK':'FAIL')})"` → `OK` (결정적·범위 확인)

- [ ] **Step 3: Commit** — `git add js/core/canvas.js && git commit -m "feat: 캔버스/노이즈 공통 유틸"`

---

### Task 4: js/core/audio.js — 오음계 오디오 엔진

**Files:**
- Create: `js/core/audio.js`

**Interfaces:**
- Produces: default export 싱글턴 `audio` — `audio.ensure()`(제스처 후 AudioContext 생성/resume), `audio.tone({deg=0, oct=0, dur=0.8, vol=0.3, type='sine'})`(오음계 음 재생), `audio.setAmbient(wingNo|null)`(관별 앰비언트 드론 시작/정지), `audio.muted` (get/set, 마스터 게인 0/1), `audio.level` 없음(입력은 sensors 담당). 작품들은 ctx.audio로 접근.

- [ ] **Step 1: 구현 요점**

```js
// 오음계(평조): 황종 Eb 기준 5음 — 도(0) 레(1) 미(2) 솔(3) 라(4)를 반음 [0,2,4,7,9]로 매핑
const SCALE = [0,2,4,7,9];
const BASE = 311.13; // Eb4
function freqOf(deg, oct=0){ const n=SCALE[((deg%5)+5)%5] + 12*(Math.floor(deg/5)+oct); return BASE*Math.pow(2,n/12); }
```

- `ensure()`: 최초 호출 시 `new AudioContext()` + 마스터 GainNode + 컴프레서 연결. suspended면 resume.
- `tone()`: OscillatorNode + Gain envelope(attack 0.01, exp decay). AudioContext 없으면 no-op.
- `setAmbient(no)`: 관 번호를 시드로 낮은 드론 2음 + 느린 LFO. 이전 앰비언트는 페이드아웃 후 정지.
- `muted`: 마스터 게인 0/1 램프. 토글 버튼(main.js)과 연결.

- [ ] **Step 2: 검증** — AudioContext는 브라우저 전용이므로 Task 7 E2E에서 통합 검증. 여기서는 구문 검증만: `node --check js/core/audio.js` → exit 0. (ESM이라 `node --input-type=module -e "import('./js/core/audio.js').then(()=>console.log('OK')).catch(e=>console.log('FAIL',e.message))"` — AudioContext 미정의 환경에서도 import 시점 에러가 없도록 지연 초기화로 작성) → `OK`

- [ ] **Step 3: Commit** — `git add js/core/audio.js && git commit -m "feat: 오음계 오디오 엔진"`

---

### Task 5: js/core/sensors.js — 센서 허브 (폴백 내장)

**Files:**
- Create: `js/core/sensors.js`

**Interfaces:**
- Produces: default export 싱글턴 `sensors` —
  - `sensors.mic.request() → Promise<boolean>` (권한 요청, 거부/미지원 시 false)
  - `sensors.mic.available → boolean`, `sensors.mic.level() → 0..1` (RMS. 미가용 시 항상 0)
  - `sensors.tilt() → {x,y}` (-1..1. 자이로 가용 시 기기 기울기, 아니면 **마우스 위치를 화면 중심 기준으로 매핑한 대체값** — 폴백이 API에 내장)
  - `sensors.tiltSource → 'gyro'|'pointer'`
  - `sensors.dispose()` (스트림/리스너 해제 — main.js가 뷰어 닫을 때 호출)

- [ ] **Step 1: 구현 요점**
  - mic: `getUserMedia({audio:true})` → AnalyserNode(fftSize 512) → `level()`은 time-domain RMS를 0..1 정규화. 실패 시 `available=false`, `level()=0`.
  - tilt: iOS는 `DeviceOrientationEvent.requestPermission` 필요 — 최초 `tilt()` 사용 작품 진입 시 main.js가 버튼 제스처로 요청. `beta/gamma`를 -1..1 클램프. 이벤트 미발화 3초면 pointer 폴백 확정.
  - pointer 폴백: window pointermove에서 `(x/W*2-1, y/H*2-1)` 저장.

- [ ] **Step 2: 검증** — `node --input-type=module -e "import('./js/core/sensors.js').then(m=>{const s=m.default;const t=s.tilt();console.log(typeof s.mic.level()==='number'&&typeof t.x==='number'?'OK':'FAIL')})"` → `OK` (Node에서도 폴백 경로로 값 반환 = 폴백 설계 증명)

- [ ] **Step 3: Commit** — `git add js/core/sensors.js && git commit -m "feat: 마이크/자이로 센서 허브(폴백 내장)"`

---

### Task 6: js/core/hands.js — MediaPipe 손 인식 래퍼

**Files:**
- Create: `js/core/hands.js`

**Interfaces:**
- Produces: default export 싱글턴 `hands` — `hands.request() → Promise<boolean>`(카메라 권한+모델 로딩, 실패 false), `hands.available → boolean`, `hands.get() → Array<{landmarks:[{x,y}×21], pinch:number}>`(정규화 0..1 좌표, 최신 프레임. 미가용 시 빈 배열), `hands.stop()`. 손 작품 2점(jeongeum, sibiji)만 소비.

- [ ] **Step 1: 구현 요점**
  - `request()`에서만 CDN 동적 import: `import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14')` + HandLandmarker(GPU, numHands 2, VIDEO 모드) + `getUserMedia({video:{width:640}})` → 숨김 `<video>`.
  - 내부 RAF로 `detectForVideo` 실행, 결과를 `latest`에 저장. `get()`은 `latest` 반환(호출측 프레임과 분리).
  - `pinch` = 엄지endpoint(4)–검지endpoint(8) 거리. `stop()`: 스트림 트랙 stop + RAF 취소.
  - 실패(권한 거부·모델 로딩 실패·WebGL 미지원) 시 `available=false` — 작품은 pointer 폴백으로 동작.

- [ ] **Step 2: 검증** — import 시점 부작용 없음 확인: `node --input-type=module -e "import('./js/core/hands.js').then(m=>console.log(m.default.get().length===0?'OK':'FAIL'))"` → `OK`

- [ ] **Step 3: Commit** — `git add js/core/hands.js && git commit -m "feat: MediaPipe 손 인식 래퍼(지연 로딩)"`

---

### Task 7: js/main.js — 라우터·뷰어·로더 + 파일럿 작품 발묵

**Files:**
- Create: `js/main.js`
- Create: `js/works/w1-balmuk.js`

**Interfaces:**
- Consumes: Task 1 셀렉터, Task 2 `WINGS/WORKS/wingWorks`, Task 3~6 코어 전부.
- Produces: 해시 라우트 `#/w/{wing}` (관 입구), `#/w/{wing}/{workId}` (작품 뷰어). 전역 훅 `window.__GYEOL__ = { mountWork(id), unmountWork(), currentErrors: [] }` — selftest(Task 8)가 소비. `window.addEventListener('error'|'unhandledrejection')`로 에러를 `currentErrors`에 수집.

- [ ] **Step 1: main.js 구현 요점**
  - **라우터**: `hashchange` → parse → `render()`. 아트리움은 WINGS로 관 카드 주입(카드 클릭 → `#/w/{no}`), 관 입구는 작품 4점 카드(제목·en·needs 배지·how 문구), 카드 클릭 → 뷰어.
  - **뷰어 mount 절차**: ① `#stage`에 새 `<canvas>` 생성 ② `import('./works/w'+w.wing+'-'+w.id+'.js')` ③ needs에 mic/gyro/hands 있으면 힌트바(`#hint`)에 권한 안내 + 탭하면 `request()` (거부돼도 진행) ④ `work.init(ctx)` ⑤ RAF 루프 시작(`frame(t,dt)`, dt는 0.05 클램프) ⑥ 관 프리페치: 같은 관 나머지 3작품 `import()` (idle 시).
  - **unmount 절차**: RAF 정지 → `work.dispose()` → 캔버스 제거 → `sensors.dispose()` → `hands.stop()`.
  - **pointer 정규화**: pointerdown/move/up을 캔버스 좌표로 변환해 `work.pointer({type,x,y})`.
  - **모듈 로딩 실패**: 뷰어에 오류 카드(작품명 + "이 작품은 잠시 쉬고 있습니다") 표시, ‹ › 이동은 유지.
  - **사운드 토글**: 최초 클릭 제스처에서 `audio.ensure()` 후 `audio.muted` 토글, `aria-pressed` 동기화. 관 입장 시 `audio.setAmbient(wingNo)`.
  - 초기 전송량 예산: main.js ≤ 30KB.

- [ ] **Step 2: 파일럿 작품 w1-balmuk.js — 계약 레퍼런스 구현 (전체 코드)**

```js
import { fitCanvas, noise2, clamp, TAU } from '../core/canvas.js';
export default (() => {
  let cv, cx, W, H, dpr, field, drops = [], down = null, audio;
  const CELL = 4; let cols, rows;                    // 저해상 잉크 확산 격자
  function alloc(){ cols=Math.ceil(W/CELL); rows=Math.ceil(H/CELL);
    field=new Float32Array(cols*rows); }
  return {
    init(ctx){ ({audio}=ctx); cv=ctx.canvas; W=ctx.width; H=ctx.height;
      dpr=fitCanvas(cv,W,H); cx=cv.getContext('2d'); cx.scale(dpr,dpr);
      cx.fillStyle='#EDE6D6'; cx.fillRect(0,0,W,H); alloc(); },
    frame(t,dt){
      if(down){ const i=(down.x/CELL|0)+(down.y/CELL|0)*cols;
        if(field[i]!==undefined) field[i]=clamp(field[i]+dt*2.5,0,1); }
      // 확산: 4-이웃 평균으로 스미기 + 종이 결(noise) 따라 이방성
      const nf=new Float32Array(field);
      for(let y=1;y<rows-1;y++) for(let x=1;x<cols-1;x++){
        const i=x+y*cols, g=.12+.10*noise2(x*.15,y*.15);
        nf[i]+= g*(field[i-1]+field[i+1]+field[i-cols]+field[i+cols]-4*field[i]); }
      field=nf;
      // 렌더: 농도→먹빛, 가장자리 번짐은 옅게
      const img=cx.getImageData(0,0,cv.width,cv.height);
      // (성능: 실제 구현은 offscreen 저해상 캔버스에 그리고 drawImage 확대 — getImageData 매 프레임 금지)
      cx.restore();
    },
    pointer(e){ if(e.type==='down'){ down=e; audio.tone({deg:(e.x*5/W)|0, oct:-1, vol:.15}); }
      else if(e.type==='move'&&down){ down=e; } else if(e.type==='up'){ down=null; } },
    resize(w,h){ W=w;H=h; dpr=fitCanvas(cv,W,H); cx=cv.getContext('2d');
      cx.scale(dpr,dpr); cx.fillStyle='#EDE6D6'; cx.fillRect(0,0,W,H); alloc(); },
    dispose(){ field=null; drops=null; },
  };
})();
```

주의: frame의 렌더는 **저해상 offscreen 캔버스(cols×rows)에 픽셀 단위로 찍고 `drawImage`로 확대**한다(위 주석). 화선지 질감은 배경색+noise2 알갱이. 먹색은 농도에 따라 `#1A1611`→`#0E0C0A`.

- [ ] **Step 3: E2E 검증** (서버 기동 상태에서 Playwright MCP)
  1. `browser_navigate` `http://localhost:8000/#/w/1/balmuk`
  2. `browser_console_messages` → 에러 0건
  3. `browser_evaluate`: `(()=>{const c=document.querySelector('#stage canvas');const o=document.createElement('canvas');o.width=64;o.height=64;o.getContext('2d').drawImage(c,0,0,64,64);const d=o.getContext('2d').getImageData(0,0,64,64).data;const s=new Set();for(let i=0;i<d.length;i+=97)s.add(d[i]);return s.size})()` → `> 1` (빈 캔버스 아님)
  4. `browser_click` 캔버스 드래그 후 재샘플 → 픽셀 변화 확인
  5. `browser_navigate` `http://localhost:8000/` → 아트리움 관 카드 8개 렌더 확인

- [ ] **Step 4: Commit** — `git add js/main.js js/works/w1-balmuk.js && git commit -m "feat: 라우터/뷰어/로더 + 파일럿 작품 발묵"`

---

### Task 8: js/selftest.js — 전수 스모크 하네스

**Files:**
- Create: `js/selftest.js`
- Modify: `js/main.js` (부트 시 `location.search.includes('selftest')`면 `import('./selftest.js')` 1줄 추가)

**Interfaces:**
- Consumes: `window.__GYEOL__.mountWork/unmountWork`, `WORKS`.
- Produces: `window.__SMOKE__ = { done:boolean, results:[{id, ok, errors:string[], uniform:boolean, msPerFrame:number}] }`. URL 파라미터 `?selftest&wing=3`으로 관 필터.

- [ ] **Step 1: 구현** — 각 작품에 대해: `mountWork(id)` → `work.frame`을 dt=1/60로 **동기 60회 직접 호출** → 64×64 다운샘플 픽셀 셋 크기>1 확인(uniform 체크) → 60회 호출 총 시간/60 = msPerFrame 기록 → `unmountWork()` → 수집된 `currentErrors`를 결과에 첨부. 권한 요청은 하지 않음(폴백 경로 검증이 목적). 전부 끝나면 `done=true`.

- [ ] **Step 2: 검증** — Playwright MCP: `browser_navigate` `http://localhost:8000/?selftest&wing=1` → `browser_wait_for`(`window.__SMOKE__.done`) → `browser_evaluate` `JSON.stringify(window.__SMOKE__)` → balmuk `ok:true, uniform:false, msPerFrame<16`. (아직 미구현 작품 3점은 로딩 실패로 `ok:false` — 정상)

- [ ] **Step 3: Commit** — `git add js/selftest.js js/main.js && git commit -m "feat: 전수 스모크 셀프테스트 하네스"`

---

## 관(Wing) Task 공통 규칙 — Task 9~16 전체 적용

- 각 작품 = `js/works/w{wing}-{id}.js` 1파일, **작품 모듈 계약** 그대로 구현. 자체 RAF·전역 리스너 금지(등록했다면 dispose에서 해제).
- 권한 요청 금지 — mic/hands/gyro는 `ctx.sensors`/`ctx.hands`의 현재 상태만 읽는다(요청은 main.js 담당). `available=false`면 반드시 각 스펙의 폴백 동작으로 그린다.
- 렌더 원칙: 배경은 먹빛(`#0E0C0A`) 또는 한지(`#EDE6D6`) 중 스펙 지정색. 파티클 수·그리드 해상도는 msPerFrame < 16ms를 지키는 선에서 조정.
- 사운드: `ctx.audio.tone()`만 사용(오음계 자동 정합). 포인터 이벤트당 최대 1회, 볼륨 ≤ 0.3.
- 각 관 Task의 검증은 동일: 서버 기동 상태에서 Playwright MCP로 `http://localhost:8000/?selftest&wing={N}` → `window.__SMOKE__.done` 대기 → 결과에서 **해당 관 4작품 모두 `ok:true, uniform:false, msPerFrame<16`** 확인. 이어서 뷰어에서 각 작품을 열어 스크린샷으로 육안 확인(콘솔 에러 0).
- Task 9~16은 상호 의존이 없어 **병렬 실행 가능** (subagent-driven 시 관 단위 디스패치).

---

### Task 9: 1관 묵향 墨 — 일필·우중산수·묵죽 (발묵은 Task 7 완료)

**Files:**
- Create: `js/works/w1-ilpil.js`, `js/works/w1-ujung.js`, `js/works/w1-mukjuk.js`

**Interfaces:**
- Consumes: 작품 모듈 계약, `core/canvas.js`(noise2, mulberry32, lerp, clamp, fitCanvas), `ctx.audio.tone`, `ctx.sensors.tilt/mic`.

- [ ] **Step 1: w1-ilpil.js 일필 (One Stroke)** — 붓질 다이내믹스
  - 배경 한지. 포인터 드래그 = 획. 획은 중심 폴리라인 + 좌우로 8~14가닥 브리슬 오프셋(mulberry32 시드 고정)을 각각 이은 곡선.
  - 드래그 **속도**가 화법을 가름: 빠름 → 갈필(가닥 간격 벌어지고 중간중간 끊김, 농도 ↓), 느림 → 윤필(폭 넓고 진함, 가장자리 살짝 번짐). 폭 = `lerp(28, 6, clamp(speed/25,0,1))`.
  - 획은 누적되되 40초에 걸쳐 서서히 바램(전체 캔버스에 반투명 한지색 오버레이 주기 적용).
  - 사운드: 획 시작 시 `tone({deg:2, oct:-1, vol:.12})`.

- [ ] **Step 2: w1-ujung.js 우중산수 (Mountains in Rain)** — 안개 산맥 시차
  - 배경 먹빛→회백 수직 그라데이션. 능선 7겹: 각 겹 `y = baseY + amp * noise2(x*freq + layerSeed, t*0.02)`, 뒤 겹일수록 옅은 회색(안개에 잠김).
  - `sensors.tilt()` → 시차: 앞 겹일수록 큰 수평 오프셋(`tilt.x * 40 * depth`), 수직도 미세 반영. (데스크톱은 포인터 폴백 — sensors가 자동 처리)
  - 비: 스트릭 300개(길이 8~14px, 살짝 기운 각도), 하단 능선에 닿으면 재생성. 안개 밴드가 t에 따라 천천히 흐름.

- [ ] **Step 3: w1-mukjuk.js 묵죽 (Ink Bamboo)** — 마이크 바람
  - 한지 배경. 대나무 3~5그루: 줄기 = 마디(節) 단위 세그먼트 기둥(마디 사이 미세 틈), 각 마디에서 잎 클러스터(획 3~6개, 먹 농담 3톤).
  - 바람 = `wind = 0.15 + sensors.mic.level()*2.5` (불면 세짐). 줄기 sway = `sin(t*1.3 + phase) * wind * 유연도(위로 갈수록 큼)`, 잎은 고주파 파르르 추가.
  - `mic.available === false`면 힌트 대체: 포인터 드래그 x속도가 바람. (main.js가 needs 배지로 안내)
  - 사운드: 강풍 순간(level>0.4) 잎 스치는 tone({deg:4, oct:1, vol:.08}).

- [ ] **Step 4: 관 selftest 검증** — Playwright MCP: `browser_navigate` `http://localhost:8000/?selftest&wing=1` → `browser_evaluate` `window.__SMOKE__` → 4작품 전부 `ok:true, uniform:false, msPerFrame<16`. 뷰어에서 3작품 각각 열어 `browser_take_screenshot` 육안 확인, 콘솔 에러 0.

- [ ] **Step 5: Commit** — `git add js/works/w1-*.js && git commit -m "feat: 1관 묵향 — 일필·우중산수·묵죽"`

---

### Task 10: 2관 오방 五方 — 단청 만다라·오방진·색동·낙화

**Files:**
- Create: `js/works/w2-dancheong.js`, `js/works/w2-obangjin.js`, `js/works/w2-saekdong.js`, `js/works/w2-nakhwa.js`

**Interfaces:**
- Consumes: 계약 + core. 오방색 CSS 변수와 동일한 hex를 JS 상수로 사용: `['#C23B22','#2C5F93','#E3A81C','#EDE6D6','#1A1611']`.

- [ ] **Step 1: w2-dancheong.js 단청 만다라** — 연화문 제너레이터
  - 먹빛 배경, 중앙 극좌표 대칭 문양. 대칭수 N ∈ {8,10,12}, 꽃잎 = 파라메트릭 곡선 `r(θ) = R * (0.55 + 0.45·cos(N·θ))^p` 변형을 3~5겹(연화·당초·주화 레이어), 겹마다 오방색 순환 + 머리초 그라데이션(끝단 백색 테).
  - 전체가 0.05rad/s로 서서히 회전. 탭/클릭 → 새 시드(mulberry32)로 문양 재생성(0.8초 크로스페이드) + `tone` 아르페지오 3음(deg 0·2·4 순차).

- [ ] **Step 2: w2-obangjin.js 오방진** — 오방색 파티클 진법
  - 파티클 600개, 5군(오방색). 진형 = 타깃 포인트 집합: ①오방진(중앙+동서남북 원) ②일자진(가로 5열) ③원진(동심원 5겹) — 12초마다 순환, 파티클은 스프링 추적(`v += (target-p)*0.02; v *= 0.92`).
  - 포인터 = 반경 120px 척력. 진형 전환 시 `tone({deg:3, oct:-1, vol:.1})`.

- [ ] **Step 3: w2-saekdong.js 색동** — 유동 리본
  - 먹빛 배경, 세로 리본 16개(색동 팔레트 적·황·청·녹`#3F7A48`·백 순환). 각 리본은 세로 폴리라인 `x = baseX + 30·noise2(y*0.004 + i, t*0.1)`, 폭 24~40px, 부드러운 알파.
  - 포인터가 지나가면 그 y지점에서 파동이 위아래로 전파(스프링 체인). 빠르게 휘저으면 리본이 나부낌.

- [ ] **Step 4: w2-nakhwa.js 낙화** — 꽃잎 물리 (자이로)
  - 먹빛 배경 상단에 매화 가지 실루엣(고정 데코). 꽃잎 220개: 5엽 매화 꽃잎 셰이프(회전·크기 변주, 백~담홍 `#E8C9C4`), 낙하 = 중력 + `noise2` 바람 + **`sensors.tilt().x`로 낙하 편향**(기기 기울이면 쏠림).
  - 바닥 쌓임: 열 단위 높이맵, 쌓인 꽃잎은 정적 렌더로 이관. 탭 → 그 지점 반경의 쌓인 꽃잎이 다시 흩날림 + `tone({deg:1, oct:1, vol:.1})`.

- [ ] **Step 5: 관 selftest 검증** — `http://localhost:8000/?selftest&wing=2` → 4작품 `ok:true, uniform:false, msPerFrame<16`. 뷰어 육안 확인(특히 낙화는 마우스 폴백으로 편향 확인), 콘솔 에러 0.

- [ ] **Step 6: Commit** — `git add js/works/w2-*.js && git commit -m "feat: 2관 오방 — 단청·오방진·색동·낙화"`

---

### Task 11: 3관 훈민 訓民 — 자모 우주·글자의 강·정음 별자리·활자 비

**Files:**
- Create: `js/works/w3-jamo.js`, `js/works/w3-gang.js`, `js/works/w3-jeongeum.js`, `js/works/w3-hwalja.js`

**Interfaces:**
- Consumes: 계약 + core + `ctx.hands`(jeongeum만). 글자→파티클 타깃 변환은 공통 기법: offscreen 캔버스에 글자를 크게 렌더 → `getImageData` 알파 샘플링(간격 6px) → 타깃 점 배열. (이 함수는 각 작품 파일 안에 지역 구현 — works 간 import 금지, core에 추가하지 않음: YAGNI)

- [ ] **Step 1: w3-jamo.js 자모 우주** — 파티클 글자 조합
  - 먹빛 배경. 파티클 700개, 각각 랜덤 자모(ㄱ~ㅎ, ㅏ~ㅣ 24종, 12~18px Gowun Batang)로 부유(noise 드리프트).
  - 9초 주기: 단어 하나(['결','숨','빛','물','바람','새벽'] 순환)를 offscreen 샘플링 → 파티클이 스프링으로 타깃 집결(3초 유지) → 해산. 집결 완료 시 `tone({deg:0, vol:.15})`.
  - 포인터 = 척력(집결 중에도 흐트러뜨릴 수 있음 — 놓으면 복귀).

- [ ] **Step 2: w3-gang.js 글자의 강** — 흐르는 텍스트
  - 먹빛 배경, 화면 전체 noise flow field(`angle = noise2(x*0.003, y*0.003 + t*0.05) * TAU`). 기본 시구 "흐르는 것이 어디 물뿐이랴"의 글자들이 필드를 따라 흘러감(궤적 잔상 알파 페이드, 글자 크기 14~34px 변주).
  - 탭 → 그 지점에 시구 글자들이 새로 방류. 흐름이 화면 밖으로 나가면 반대편 재진입. 글자색 = 한지색, 잔상은 청묵색 `#2C5F93` 20%.

- [ ] **Step 3: w3-jeongeum.js 정음 별자리 (손 인식)**
  - 밤하늘(먹빛 + 미세 별 200개). 자모 별 14개(초성 ㄱㄴㄷㅁㅅㅇㅈ + 중성 ㅏㅓㅗㅜㅡㅣㅑ)가 큰 별로 산포, 글자와 광륜 렌더.
  - `hands.get()[0]` 검지 끝(landmark 8)이 커서 별. **pinch < 0.05**면 가장 가까운 자모 별을 잡아 끌기, 초성 별을 중성 별에 30px 이내로 놓으면 음절 합성(예: ㄱ+ㅏ→'가')이 큰 글자로 2초 표시 + 두 별 사이 별자리 선 영구 연결 + `tone({deg:4, vol:.2})`.
  - 폴백(`hands.available===false`): 포인터 드래그로 동일 조작. 힌트 문구는 main.js가 needs 기반 표시.

- [ ] **Step 4: w3-hwalja.js 활자 비** — 세로 활자 낙하
  - 한지 배경(고서 느낌). 훈민정음 서문 "나랏말싸미 듕귁에 달아…" 텍스트를 글자 단위로 세로 컬럼 20~28개에 배치, 위→아래로 서로 다른 속도 낙하(고서 세로쓰기처럼 오른쪽 컬럼부터).
  - 글자색 먹, 컬럼 선두 글자는 주묵색 `#C23B22`(낙관 느낌). 포인터 반경 80px 안 글자는 옆으로 비켜남(척력 + 복귀 스프링).

- [ ] **Step 5: 관 selftest 검증** — `http://localhost:8000/?selftest&wing=3` → 4작품 `ok:true, uniform:false, msPerFrame<16` (jeongeum은 hands 미가용 폴백 경로로 통과해야 함). 뷰어 육안 확인, 콘솔 에러 0.

- [ ] **Step 6: Commit** — `git add js/works/w3-*.js && git commit -m "feat: 3관 훈민 — 자모 우주·글자의 강·정음 별자리·활자 비"`

---

### Task 12: 4관 여백 餘白 — 달항아리·빙렬·보름달·숨

**Files:**
- Create: `js/works/w4-dalhangari.js`, `js/works/w4-bingnyeol.js`, `js/works/w4-boreumdal.js`, `js/works/w4-sum.js`

**Interfaces:**
- Consumes: 계약 + core + `ctx.sensors.mic`(dalhangari만).

- [ ] **Step 1: w4-dalhangari.js 달항아리 (마이크)**
  - 먹빛 배경 중앙에 달항아리. 프로파일 = 제어점 8개 좌우대칭 캣멀롬 곡선(입·목·어깨·배·굽). 렌더: 프로파일 회전체를 수평 슬라이스 타원 40개로 그려 은은한 볼륨(백자색 `#EDE6D6`→그늘 `#B8B0A0` 셰이딩) + 유약 하이라이트.
  - **`mic.level()`이 물레의 손**: 레벨에 비례해 제어점들이 바깥으로 부풀며 일렁임(각 제어점 위상 다르게), 조용하면 8초에 걸쳐 이상 형태로 복원. 폴백: 포인터 드래그가 가까운 제어점을 당김.
  - 사운드: 큰 변형 순간(level>0.5) `tone({deg:0, oct:-2, vol:.2, dur:2})` 낮은 울림.

- [ ] **Step 2: w4-bingnyeol.js 빙렬** — 백자 균열 성장
  - 유백색 배경(`#E9E4D8`, 미세 noise 얼룩). 균열 = 성장 워커: 씨앗에서 시작, 매 프레임 1.5~3px 전진 + 방향 `angle += (rand-0.5)*0.5`, 확률 0.02로 분기(각도 ±0.6), 기존 균열선 근처(8px)에 오면 정지. 선폭 0.5~1px, 청회색 `#8A93A0`.
  - 시작 시 씨앗 3개 자동. 탭 → 그 지점에 새 씨앗 + `tone({deg:2, oct:-1, vol:.1})`. 균열 총 세그먼트 5000개 도달 시 성장 종료(정적 감상).

- [ ] **Step 3: w4-boreumdal.js 보름달**
  - 먹빛 밤하늘, 중앙 상단 보름달(반경 min(W,H)*0.22): 디스크 + `noise2` 크레이터 음영 + 2겹 헤일로(radial gradient).
  - 구름 4~6장: noise 기반 소프트 블롭 밴드가 천천히 흘러 달을 가림/드러냄(가릴 때 달빛 산란 밝아짐). 포인터 드래그 = 구름 밀기(속도 부여). 하단 능선 실루엣 1겹.

- [ ] **Step 4: w4-sum.js 숨** — 호흡하는 여백
  - 한지 배경. 중앙 먹 원 하나: 반경 `R = base * (1 + 0.18·breath)`, breath = 들숨 4초/날숨 6초 사이클(easing). 가장자리는 발묵처럼 부드러운 번짐(radial gradient 3겹). 배경 원주에 극세 동심원 파문.
  - 포인터 누르는 동안 호흡 정지(원이 미세 떨림), 떼면 크게 한 번 내쉬며(1.5배 팽창 후 복귀) `tone({deg:0, oct:-2, vol:.15, dur:3})`.
  - 이 작품은 의도적 미니멀 — 요소 추가 금지(여백의 미).

- [ ] **Step 5: 관 selftest 검증** — `http://localhost:8000/?selftest&wing=4` → 4작품 `ok:true, uniform:false, msPerFrame<16`. 뷰어 육안 확인, 콘솔 에러 0.

- [ ] **Step 6: Commit** — `git add js/works/w4-*.js && git commit -m "feat: 4관 여백 — 달항아리·빙렬·보름달·숨"`

---

### Task 13: 5관 조각보 — 조각보·홈질·노방·매듭

**Files:**
- Create: `js/works/w5-jogakbo.js`, `js/works/w5-homjil.js`, `js/works/w5-nobang.js`, `js/works/w5-maedeup.js`

**Interfaces:**
- Consumes: 계약 + core. 담채 팔레트 상수: `['#A8B8C8','#D9C9A3','#C9A8A0','#9FB39A','#EDE6D6','#B8A3C0']` (쪽·치자·소목·쑥·소색·자색 담채).

- [ ] **Step 1: w5-jogakbo.js 조각보** — 재귀 분할 보자기
  - 화면 중앙 정방형(변 min(W,H)*0.82)을 BSP 재귀 분할: 깊이 4~6, 분할비 0.3~0.7(mulberry32). 각 조각 = 담채 팔레트 + `noise2` 직물 결(가로세로 미세 스트라이프 알파).
  - 시접선: 조각 경계에 이중 실선(간격 2px, 침색 `#6A5A48`) + 모서리 스티치 점. 완성 보자기는 아주 느리게 숨쉬듯 밝기 진동.
  - 탭 → 재분할: 기존 조각들이 0.9초간 미끄러지며 새 배치로 전환(위치·크기 보간) + `tone({deg:1, vol:.12})`.

- [ ] **Step 2: w5-homjil.js 홈질** — 스티치 드로잉
  - 한지 배경. 포인터 드래그 궤적을 스무딩(이동평균)한 경로에 등간격(9px) 홈질 대시(길이 5px, 실 두께 1.5px)를 박음. 실색은 오방 실색 순환(획마다 다음 색).
  - 드래그 놓으면 경로 끝에 매듭 점. 실이 당겨지는 애니메이션: 새 대시가 순차적으로 나타남(바느질 진행감) + 대시마다 아주 작은 `tone({deg:3, oct:1, vol:.05})` (10대시당 1회로 제한).
  - 화면에 획 30개 초과 시 오래된 획부터 옅어지며 소멸.

- [ ] **Step 3: w5-nobang.js 노방** — 반투명 겹침
  - 소색 배경(`#E5DECE`). 노방(얇은 비단) 사각 레이어 9장: 각각 담채색, `globalCompositeOperation='multiply'`, alpha 0.35, 크기 화면의 25~55%, 느린 부유(noise 드리프트 + 미세 회전).
  - 겹치는 영역에서 색이 깊어지는 것이 작품의 핵심 — 3장 이상 겹침 영역은 자연히 짙은 침색. 포인터로 레이어 드래그 이동 가능(잡힌 레이어는 가장자리 은은히 밝아짐).

- [ ] **Step 4: w5-maedeup.js 매듭** — 끈 물리
  - 먹빛 배경. 버렛(Verlet) 로프 1가닥: 입자 60개, 제약 반복 8회, 상단 고정점에서 늘어짐. 로프 렌더 = 두께 6px 주홍(`#C23B22`) 곡선 + 하이라이트 1px.
  - 모드 순환(14초): ①자유 — 중력+바람에 흔들림 ②연화매듭 — 입자별 타깃 좌표(연꽃 매듭 도안을 20×20 격자 좌표 배열로 하드코딩)로 스프링 수렴 ③풀림 — 타깃 해제. 포인터 = 로프 아무 입자나 잡아 끌기(잡는 동안 모드 정지).
  - 매듭 완성 순간 `tone({deg:4, oct:-1, vol:.15})`.

- [ ] **Step 5: 관 selftest 검증** — `http://localhost:8000/?selftest&wing=5` → 4작품 `ok:true, uniform:false, msPerFrame<16`. 뷰어 육안 확인, 콘솔 에러 0.

- [ ] **Step 6: Commit** — `git add js/works/w5-*.js && git commit -m "feat: 5관 조각보 — 조각보·홈질·노방·매듭"`

---

### Task 14: 6관 풍류 風流 — 사물놀이·오음·청·산조

**Files:**
- Create: `js/works/w6-samulnori.js`, `js/works/w6-oeum.js`, `js/works/w6-cheong.js`, `js/works/w6-sanjo.js`

**Interfaces:**
- Consumes: 계약 + core + `ctx.sensors.mic`(samulnori, cheong), `ctx.audio.tone`(전부).

- [ ] **Step 1: w6-samulnori.js 사물놀이 (마이크)**
  - 먹빛 배경, 4방에 사물 표식(꽹과리=금원, 징=백원, 장구=모래시계 실루엣, 북=적원 — 단순 기하 문양).
  - 온셋 감지: `level()`이 직전 0.5초 이동평균의 1.8배 && >0.12 이면 타격 → 랜덤 사물 1개 발광 + 파티클 방사(꽹과리=금 스파크 40개, 북=먹 파동 링, 장구=양방 파열, 징=느린 대형 링) + 세기∝level.
  - 폴백(mic 미가용): 탭 위치에서 가장 가까운 사물 타격. 사운드: 타격 시 `tone({deg:[0,2,3,4][sabmul], oct:-1, vol:.2})`.

- [ ] **Step 2: w6-oeum.js 오음** — 궁상각치우 현
  - 먹빛 배경에 가로 현 5줄(거문고 느낌, 위→아래 = 우치각상궁, 굵기 점증). 각 현에 음명 표기(宮商角徵羽 + 한글).
  - 포인터가 현을 가로지르면 튕김: 현이 감쇠 사인 진동(진폭 12px, 2초 감쇠) + `tone({deg:현번호, dur:1.6, vol:.25})` + 진동 마루에서 먹점 파티클 낙하.
  - 자동 가락: 사용자 입력 8초 없으면 mulberry32 시퀀스로 4초당 1음 자동 연주.

- [ ] **Step 3: w6-cheong.js 청 (마이크)** — 소리의 두루마리
  - 한지 배경 세로 두루마리. `level()` 파형이 중앙 세로축 기준 좌우 대칭 파문으로 실시간 기록되며 위로 스크롤(소리 지문이 쌓임). 조용하면 가는 먹선, 크면 넓은 발묵 밴드.
  - 시간이 오래되면 위쪽 기록은 옅어지며 두루마리 말림 표현(상단 원통 음영). 폴백: 포인터 x거리(중앙 기준)가 레벨 대체.

- [ ] **Step 4: w6-sanjo.js 산조** — 가락이 그리는 점묘
  - 먹빛 배경. 오음계 마르코프 체인(전이: 인접 음 60%, 도약 30%, 반복 10%)이 장단 간격으로 `tone` 연주. 음마다 화면에 붓점 하나(음높이=y, 시간=x 좌→우, deg별 크기·농담 변주) — 가락이 점묘 산수처럼 쌓임.
  - 장단 토글: 탭할 때마다 진양조(3.2초/음) ↔ 중모리(1.6초) ↔ 자진모리(0.55초) 순환, 우상단에 장단명 표시. x가 화면 끝에 닿으면 두루마리처럼 전체가 왼쪽으로 밀림.

- [ ] **Step 5: 관 selftest 검증** — `http://localhost:8000/?selftest&wing=6` → 4작품 `ok:true, uniform:false, msPerFrame<16` (mic 미가용 폴백 경로 통과 필수). 뷰어 육안 확인, 콘솔 에러 0.

- [ ] **Step 6: Commit** — `git add js/works/w6-*.js && git commit -m "feat: 6관 풍류 — 사물놀이·오음·청·산조"`

---

### Task 15: 7관 민화 民畫 — 일월오봉도·호작도·십장생·어변성룡

**Files:**
- Create: `js/works/w7-ilwol.js`, `js/works/w7-hojakdo.js`, `js/works/w7-sipjangsaeng.js`, `js/works/w7-eobyeon.js`

**Interfaces:**
- Consumes: 계약 + core. ilwol만 `needs:['webgl']` — WebGL 컨텍스트 실패 시 Canvas2D 간이판 필수(계약의 폴백 규칙).

- [ ] **Step 1: w7-ilwol.js 일월오봉도 (WebGL 셰이더)**
  - 전면 쿼드 + 프래그먼트 셰이더 1개: 다섯 봉우리(x축 5개 가우시안 능선 SDF 합성, 청록 `#1E4D45`→감청 그라데이션), 좌 백달·우 적일(SDF 원 + 글로우), 하단 파도(중첩 사인 물결 밴드), 소나무 실루엣 2그루(좌우, 단순 삼각 클러스터 SDF).
  - uniform: `uTime`(파도·글로우 맥동), `uHour`(실제 `new Date().getHours()` — 새벽/낮/석양/밤 4단계 하늘색 보간), `uPointer`(해·달이 포인터 방향으로 최대 8% 끌림).
  - 폴백: `getContext('webgl')` 실패 시 동일 구도의 Canvas2D 그라데이션+도형 간이판 렌더(셰이더 없음, 정적+파도만 애니).

- [ ] **Step 2: w7-hojakdo.js 호작도 (Gray-Scott 반응확산)**
  - 저해상 그리드 144×144에 Gray-Scott: `F=0.042, k=0.063, Du=0.16, Dv=0.08`, 프레임당 8회 반복(msPerFrame 초과 시 6회로). V 농도 → 호랑이 무늬(주황 `#C67B3B` 바탕에 먹 줄무늬).
  - 호랑이 실루엣 마스크(앉은 호랑이 옆모습 — 하드코딩 폴리곤 30~40점)를 offscreen에 렌더 → 마스크 안쪽만 무늬 표시, 바깥은 한지 배경. 눈·코 고정 데코, 상단 가지에 까치 실루엣 1마리(단순 폴리곤, 좌우로 까딱임).
  - 초기 시드: 마스크 안 랜덤 점 20개. 포인터 터치 = V 주입(무늬가 그 자리에서 새로 자람). 리셋 없음 — 계속 자라는 그림.

- [ ] **Step 3: w7-sipjangsaeng.js 십장생** — Boids 학
  - 담청 배경(`#22313A`) 위 담채 십장생 배경 요소: 해(우상 금원), 소나무(좌하 실루엣), 거북(하단, 6초 주기 미세 이동), 불로초 언덕.
  - 학 18마리 Boids: 분리(반경 28)·정렬(60)·응집(90) + 속도 2.2~3.4 클램프. 학 렌더 = 몸통 타원 + 목/다리 선 + 날개 V(위상별 접힘, 각자 위상 다름), 백색+먹 테두리, 머리 정수리 단정(丹頂) 적점.
  - 포인터 = 유인점(응집 가중 2배). 사운드: 무리 선회 급변 시 `tone({deg:4, oct:1, vol:.06})` (4초 쿨다운).

- [ ] **Step 4: w7-eobyeon.js 어변성룡** — 잉어의 승천
  - 먹빛 배경, 하단 수면(사인 물결 2겹). 잉어 파티클 300개(방추형 스트로크 + 꼬리, 주홍/금 2톤): 평시 수면 아래 유영(noise 흐름).
  - 사이클 20초: ①유영 6초 ②승천 — 나선 상승 소용돌이(중심 = 화면 중앙 or 포인터) 6초 ③합체 — 용 실루엣 폴리라인(S자 굴곡 + 머리·수염·뿔 단순 획, 하드코딩 40점)에 파티클 스프링 정렬, 용 눈 발광 4초 ④산개 — 비늘처럼 흩어져 낙하 4초. 승천 시 `tone({deg:0→4 글리산도 대체: 0.5초 간격 5음 상행, vol:.12})`.
  - 포인터: 소용돌이 중심 끌기(②단계), 평시엔 잉어 유인.

- [ ] **Step 5: 관 selftest 검증** — `http://localhost:8000/?selftest&wing=7` → 4작품 `ok:true, uniform:false, msPerFrame<16` (hojakdo 반복 횟수 조정 포함). 뷰어에서 ilwol WebGL 렌더 + 폴백 경로(`browser_evaluate`로 webgl 강제 실패는 불가하므로 코드 리뷰로 폴백 분기 존재 확인) 점검, 콘솔 에러 0.

- [ ] **Step 6: Commit** — `git add js/works/w7-*.js && git commit -m "feat: 7관 민화 — 일월오봉도·호작도·십장생·어변성룡"`

---

### Task 16: 8관 세시 歲時 — 스물넷·자격루·달그림자·십이지

**Files:**
- Create: `js/works/w8-seumulnet.js`, `js/works/w8-jagyeongnu.js`, `js/works/w8-dalgeurimja.js`, `js/works/w8-sibiji.js`

**Interfaces:**
- Consumes: 계약 + core + `ctx.hands`(sibiji만). 날짜 계산은 작품 내 하드코딩 테이블(외부 API 금지).

- [ ] **Step 1: w8-seumulnet.js 스물넷** — 24절기 시계
  - 먹빛 배경 중앙 대형 링(반경 min(W,H)*0.36): 24칸, 각 칸에 절기명(입춘~대한, 12px 세로쓰기). 절기 날짜 테이블 하드코딩(2026년 기준 24개: 입춘 2/4, 우수 2/19, … 대한 1/20 — 구현 시 정확한 2026 날짜 확인해 기입).
  - 현재 날짜의 절기 칸 하이라이트(금색 발광) + 링 안쪽에 해당 절기 모티프 파티클(예: 소서·대서=매미 날개 파문, 입춘=연둣빛 싹, 대설=눈송이 — 계절군 4종 모티프로 단순화: 봄 싹/여름 파문/가을 낙엽/겨울 눈). 중앙에 현재 시각 시침·분침(가는 먹선).
  - 링은 1년=1회전 기준 현재 각도로 정렬. 드래그로 링을 돌려 다른 절기 미리보기(놓으면 현재로 복귀).

- [ ] **Step 2: w8-jagyeongnu.js 자격루** — 물시계
  - 먹빛 배경. 구조: 상단 파수호(항아리 단면) → 물줄기 → 하단 수수호(원통, 수위 상승) + 부표 화살. 물방울 파티클(중력, 낙하점에서 튐 2~3방울), 수면 = 사인 잔물결.
  - 수위가 눈금(전체 높이의 1/12씩)에 닿을 때마다: 구슬이 굴러가는 표식 + 종 울림 `tone({deg:0, oct:-2, dur:2.5, vol:.25})` + 인형(나무 인형 실루엣)이 북채 드는 모션 1회. 수수호 가득 차면 서서히 배수 후 반복.
  - 포인터 드래그 = 물줄기 기울이기(낙하점 이동). 실제 시각 연동: 현재 '시(時)'가 우상단에 12지 시명으로 표기(자시·축시…).

- [ ] **Step 3: w8-dalgeurimja.js 달그림자** — 음력 위상
  - 먹빛 배경. 달 위상 계산: 기준 신월 epoch `2026-06-15T00:00Z`(구현 시 정확한 2026년 6월 신월 시각 확인해 기입), 주기 29.53059일 → 오늘 위상각. 달 렌더 = 밝은 원 + 위상각에 따른 그림자 원 오프셋 합성(터미네이터 곡선).
  - 하단 바다: 위상에 따라 조수 진폭 변화(보름·신월=사리 큰 물결, 반달=조금 잔물결) — 사인 물결 3겹 진폭 연동.
  - 드래그(가로) = 위상 스크럽(±15일, 날짜·음력일 표기 갱신), 놓으면 3초에 걸쳐 오늘로 복귀.

- [ ] **Step 4: w8-sibiji.js 십이지 (손 인식)**
  - 먹빛 배경, 12지신 링: 12칸에 지지 한자(子丑寅卯辰巳午未申酉戌亥) + 동물 심볼(단순 획 아이콘 — 원·삼각 조합 수준의 추상 문양, 사실화 금지). 현재 시(時) 칸은 금색 발광 + 칸 아래 시간대 표기("오시 11:30–13:30" 형식).
  - **손 인식**: `hands.get()[0]` 손바닥 중심(landmark 9) x좌표로 링 회전, pinch로 가리킨 지신 확대(칸이 중앙으로 확대 + 해당 지신 문양 파티클 방사 + `tone({deg:칸%5, vol:.15})`).
  - 폴백: 포인터 드래그 회전 + 탭 확대. 링 바깥 원주에 12지 시계 눈금 + 현재 시각 침.

- [ ] **Step 5: 관 selftest 검증** — `http://localhost:8000/?selftest&wing=8` → 4작품 `ok:true, uniform:false, msPerFrame<16` (sibiji는 hands 폴백 경로 통과). 뷰어 육안 확인 — 스물넷·달그림자는 오늘 날짜 기준 표기가 실제와 맞는지 확인, 콘솔 에러 0.

- [ ] **Step 6: Commit** — `git add js/works/w8-*.js && git commit -m "feat: 8관 세시 — 스물넷·자격루·달그림자·십이지"`

---

### Task 17: making-of.html — 제작 과정 페이지

**Files:**
- Create: `making-of.html` (스타일은 `css/style.css` 재사용 + 페이지 내 최소 추가)

**Interfaces:**
- Consumes: `css/style.css`의 CSS 변수·타이포. index.html 푸터 링크가 이 파일을 가리킴(이미 존재).

- [ ] **Step 1: 콘텐츠 작성** — 정적 단일 페이지(JS 불필요). 구성:
  1. **개요**: 결·GYEOL이 무엇인지, 참고한 Generative Hours(3일 제작)와의 관계, 이번 제작 소요 시간(실측치 기입 — 배포 완료 후 세션 시작~배포 시각으로 계산).
  2. **참고 사이트와 다른 접근**: "만들고 → 보고 → 고치기" 반복(참고) vs "설계 먼저 → 인터페이스 계약 고정 → 8관 병렬 제작 → 전수 자동 검증"(본 전시). 계약 코드 블록과 selftest 결과 스크린샷 요약 포함.
  3. **실제 사용 프롬프트**: 이 세션의 실제 사용자 발화를 그대로 기록 — 최초 요청("이 사이트와 유사한 사이트를 만들고 싶어… 더 빠르고 더 훌륭한 사이트를 만들자"), 이후 선택 답변들(목적=나만의 전시, 컨셉=한국적 미감, 규모=8관 32작품, 인터랙션 4종, S3+CloudFront, making-of 포함, "A", "네"×3, "네에 진행"). 브레인스토밍 → 스펙 → 플랜 → 병렬 실행 각 단계에서 무엇이 자동으로 이루어졌는지 주석.
  4. **기술 노트**: zero-build 구조, 작품 모듈 계약, 센서 폴백 설계, 오음계 오디오, 관별 핵심 알고리즘 표(8행).
  5. 하단: 전시로 돌아가기 링크.

- [ ] **Step 2: 검증** — Playwright MCP: `http://localhost:8000/making-of.html` 렌더 + 모바일 뷰포트(`browser_resize` 390×844) 가로 스크롤 없음 확인.

- [ ] **Step 3: Commit** — `git add making-of.html && git commit -m "feat: making-of 제작 과정 페이지"`

---

### Task 18: 통합 검증 — 전수 selftest·성능·모바일

**Files:**
- Modify: (발견된 결함 수정 대상 파일들)

- [ ] **Step 1: 전수 selftest** — `http://localhost:8000/?selftest` (관 필터 없음) → `__SMOKE__.results` 32건 전부 `ok:true, uniform:false, msPerFrame<16`. 실패 작품은 해당 파일 수정 후 재실행(수정 커밋은 `fix:` 프리픽스).

- [ ] **Step 2: 마운트/언마운트 반복 누수 점검** — `browser_evaluate`로 `__GYEOL__.mountWork/unmountWork`를 한 작품당 5회 반복 × 대표 8작품(관당 1) → 반복 후 `performance.memory.usedJSHeapSize` 증가율 < 50% && `document.querySelectorAll('#stage canvas').length === 0`(언마운트 후) 확인.

- [ ] **Step 3: 초기 전송량 측정** — `curl -s localhost:8000/index.html localhost:8000/css/style.css localhost:8000/js/main.js localhost:8000/js/data.js | wc -c` → < 102400.

- [ ] **Step 4: 모바일 뷰포트** — `browser_resize` 390×844 → 아트리움·관 입구·뷰어(작품 2점 샘플) 스크린샷: 레이아웃 깨짐·가로 스크롤 없음, HUD 버튼 터치 크기(≥40px) 확인.

- [ ] **Step 5: 실 FPS 샘플링** — 뷰어에서 무거운 작품 3점(hojakdo, eobyeon, jamo) 각각 `browser_evaluate`: `new Promise(r=>{let n=0,t0=performance.now();const f=()=>{n++<120?requestAnimationFrame(f):r(120000/(performance.now()-t0))};requestAnimationFrame(f)})` → ≥ 30 (fps).

- [ ] **Step 6: Commit** — 수정 발생 시 `git add -A && git commit -m "fix: 통합 검증 결함 수정"`

---

### Task 19: 품질 게이트 — content-review-agent ≥ 85점

- [ ] **Step 1: 리뷰 디스패치** — Agent 도구로 `aws-content-plugin:content-review-agent` 실행. 입력: 사이트 URL(로컬 서버), index.html·making-of.html·data.js의 전시 문구, 스크린샷. 관점: 레이아웃, 용어 일관성(작품명·관명), 오탈자, 접근성(aria/대비), 할루시네이션(절기 날짜·국악 용어·한자 표기 정확성).
- [ ] **Step 2: 85점 미만이면** 지적 사항 수정 → 재리뷰. 85점 이상까지 반복(수정 커밋 `fix: 품질 리뷰 반영`).
- [ ] **Step 3: 리뷰 결과 요약을 커밋 메시지에 기록** — `git commit --allow-empty -m "chore: 품질 게이트 통과 (content-review NN점)"`

---

### Task 20: S3 + CloudFront 배포 + 배포 후 스모크

**Files:**
- Create: `deploy.sh` (재배포용 3줄 스크립트)

- [ ] **Step 1: 리소스 생성** — 리전 `us-east-1` 고정(CloudFront OAC 정책 단순화). 버킷명 `gyeol-media-art-$(aws sts get-caller-identity --query Account --output text)`.

```bash
ACCT=$(aws sts get-caller-identity --query Account --output text)
BUCKET=gyeol-media-art-$ACCT
aws s3 mb s3://$BUCKET --region us-east-1
# OAC 생성
OAC_ID=$(aws cloudfront create-origin-access-control --origin-access-control-config \
  Name=gyeol-oac,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3 \
  --query OriginAccessControl.Id --output text)
# 배포 생성: DefaultRootObject=index.html, Origin=$BUCKET.s3.us-east-1.amazonaws.com(OAC 연결),
# ViewerProtocolPolicy=redirect-to-https, CachePolicy=CachingOptimized(658327ea-f89d-4fab-a63d-7e88639e58f6),
# HTTP2, PriceClass_200. --distribution-config JSON 파일로 전달.
# 이후 버킷 정책: cloudfront.amazonaws.com 서비스 프린시펄 + AWS:SourceArn=배포 ARN 조건으로 s3:GetObject 허용.
```

- [ ] **Step 2: 업로드·무효화 (deploy.sh)**

```bash
#!/usr/bin/env bash
set -euo pipefail
aws s3 sync /home/ec2-user/media-art s3://$BUCKET \
  --exclude ".git/*" --exclude "docs/*" --exclude "deploy.sh" --delete
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

- [ ] **Step 3: 배포 대기** — `aws cloudfront wait distribution-deployed --id $DIST_ID` (수 분).

- [ ] **Step 4: 배포 URL 스모크** — Playwright MCP로 `https://{배포도메인}/?selftest` → 32작품 전부 ok 확인 + 아트리움·작품 2점 스크린샷 + making-of.html 렌더 확인. **여기서 실측 제작 시간을 making-of.html에 기입하고 재업로드·재무효화.**

- [ ] **Step 5: Commit** — `git add deploy.sh && git commit -m "feat: S3+CloudFront 배포 스크립트"` 후 최종 URL을 사용자에게 보고.

---

## Self-Review 결과

1. **스펙 커버리지**: 스펙 §2 32작품 → Task 7(발묵)+9~16(31작품) 전부 매핑 ✓ / §3 아키텍처 → Task 1~8 ✓ / §5 검증 3단계 → selftest(작품별)=관 Task+18, 성능·모바일=18, 품질 게이트=19 ✓ / §6 배포=20 ✓ / §7 making-of=17 ✓ / 인터랙션 분배(mic 4: mukjuk·dalhangari·samulnori·cheong / hands 2: jeongeum·sibiji / gyro 2: ujung·nakhwa) ✓
2. **플레이스홀더 스캔**: 절기 날짜·신월 epoch는 "구현 시 정확한 값 확인해 기입"으로 조사 행위를 명시(값 미정이 아니라 조사 지시) — 허용. 그 외 TBD 없음 ✓
3. **타입 일관성**: `__GYEOL__.mountWork/unmountWork`(T7↔T8↔T18), `__SMOKE__.results[].{ok,uniform,msPerFrame}`(T8↔관Task↔T18), `sensors.mic.level()/tilt()`(T5↔작품들), `hands.get()[].landmarks/pinch`(T6↔T11/T16), `tone({deg,oct,dur,vol})`(T4↔전 작품) — 서명 일치 ✓
