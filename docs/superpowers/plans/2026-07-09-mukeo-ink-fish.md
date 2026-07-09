# 묵어(墨魚) Ink Fish 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1관 묵향의 발묵(w1-balmuk)을 수묵 물고기 떼 작품 묵어(w1-mukeo)로 교체한다.

**Architecture:** 시드 고정 보이드 물고기 14마리(척추 체인 + 유영 파동)를 매 프레임 벡터 렌더하고, 오프스크린 trail 캔버스에 저알파 잔상을 누적·페이드한다. 포인터는 먹이(유인)/공포(흩어짐)/먹방울(꾹 누름 번짐+짙어짐) 세 반응을 만든다.

**Tech Stack:** 순수 ES 모듈 + Canvas 2D. 빌드 없음. `js/core/canvas.js`의 `fitCanvas/noise2/mulberry32/lerp/clamp/TAU`만 사용.

**스펙:** `docs/superpowers/specs/2026-07-08-mukeo-ink-fish-design.md`

## Global Constraints

- 작품 모듈 계약: `default export = { init(ctx), frame(t,dt), pointer(e)?, resize(w,h)?, dispose()? }`, `ctx = { canvas, width, height, audio, sensors, hands }` (좌표는 CSS px)
- import 시점 부작용 금지 (Node에서 import만 해도 안전해야 함)
- 시드 고정 난수(`mulberry32`)만 사용 — selftest 결정성
- 프레임 예산: `?selftest` 기준 msPerFrame < 16
- 주석은 한국어, 기존 작품 파일들의 주석 밀도·형식을 따름
- **검증 시 브라우저 캐시 주의**: 이 저장소는 관 단위 프리페치가 있어 구버전 모듈이 휴리스틱 캐시로 살아남는다. 검증은 반드시 **새 포트**(예: 8002)의 no-cache 서버로 한다: `/tmp/claude-1000/-home-ec2-user-media-art/8845ab4c-1b1a-4ec8-888f-6b3d7b2c3f8f/scratchpad/nocache_server.py`를 포트만 바꿔 복사 실행
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: js/works/w1-mukeo.js — 작품 모듈 신규 작성

**Files:**
- Create: `js/works/w1-mukeo.js`

**Interfaces:**
- Consumes: `js/core/canvas.js`의 `fitCanvas, noise2, mulberry32, lerp, clamp, TAU`
- Produces: 작품 모듈 default export (계약 동일). Task 2가 `data.js`에 `id:'mukeo'`로 등록하면 `main.js`가 `./works/w1-mukeo.js`를 로드한다.

- [ ] **Step 1: 파일 전체 작성**

아래 코드를 그대로 `js/works/w1-mukeo.js`로 생성한다.

```js
// 결 · GYEOL — 1관 묵향 · 묵어(墨魚) Ink Fish
// 어해도(魚蟹圖)의 수묵 물고기 떼가 화선지 물속을 유영한다.
// 개체 = 척추 체인(머리가 끌고 마디가 따라오는 follow-chain) + 유영 파동.
// 머리는 짙은 먹 점획, 몸통은 뒤로 갈수록 가늘고, 꼬리는 갈필 3가닥.
// 원경 개체는 작고 옅다(대기원근). 행동: 보이드(분리·정렬·응집)+noise 방랑.
// 손 대면 먹이인 듯 모여들고, 빠르게 저으면 놀라 흩어지며, 꾹 누르면(0.4s+)
// 먹방울이 번지고 모여 마신 개체는 먹빛이 짙어진다(서서히 복귀).
// 잔상: 오프스크린 trail에 저알파 스탬프 → destination-out 페이드(~8초 소산).
// import 시점 부작용 없음 · 시드 고정 → selftest 결정적.
import { fitCanvas, noise2, mulberry32, lerp, clamp, TAU } from '../core/canvas.js';

export default (() => {
  let cv, cx, paper, pcx, trail, tcx, audio;
  let W = 0, H = 0, dpr = 1;
  let fish = null;
  let pt = null;                    // { x, y, holdT, lastMs } 포인터 (null=비접촉)
  let lastSchool = -9, lastScare = -9, tNow = 0;

  const N_FISH = 14;
  const SEG = 8;                    // 척추 마디 수
  const ATTRACT_R = 260;            // 먹이 유인 반경(px)
  const SCARE_SPEED = 900;          // px/s — 넘어서면 놀라 흩어짐
  const SCARE_R = 220;              // 놀람 전파 반경
  const HOLD_BLOOM = 0.4;           // 꾹 누름 판정(초)

  function buildPaper() {
    const g = pcx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#EDE6D6');
    g.addColorStop(1, '#E2DAC8');
    pcx.fillStyle = g; pcx.fillRect(0, 0, W, H);
    const fr = mulberry32(0xf15e);
    for (let i = 0; i < 70; i++) {
      const x = fr() * W, y = fr() * H;
      pcx.fillStyle = noise2(x * 0.008, y * 0.008) > 0 ? 'rgba(120,110,92,0.05)' : 'rgba(255,252,242,0.06)';
      pcx.beginPath(); pcx.arc(x, y, 18 + fr() * 46, 0, TAU); pcx.fill();
    }
  }

  function buildFish() {
    const r = mulberry32(0x3f15);
    fish = [];
    for (let i = 0; i < N_FISH; i++) {
      const depth = r();                                      // 0=근경 … 1=원경
      const size = lerp(34, 14, depth) * (0.85 + r() * 0.3);  // 몸길이(px)
      const ang = r() * TAU;
      const f = {
        x: W * (0.08 + 0.84 * r()), y: H * (0.08 + 0.84 * r()),
        vx: Math.cos(ang) * 50, vy: Math.sin(ang) * 50,
        phase: r() * TAU, wave: 5 + r() * 3,
        size, depth, seed: r() * 100,
        cruise: lerp(75, 45, depth) * (0.9 + r() * 0.2),      // 순항 속도(px/s)
        ink: 0,                                               // 먹 마심 게이지 0..1
        scareT: 0,                                            // 놀람 잔여 시간(초)
        sx: new Float32Array(SEG), sy: new Float32Array(SEG),
      };
      for (let k = 0; k < SEG; k++) {                         // 척추: 진행 반대쪽으로 초기화
        f.sx[k] = f.x - Math.cos(ang) * k * (size / SEG);
        f.sy[k] = f.y - Math.sin(ang) * k * (size / SEG);
      }
      fish.push(f);
    }
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.lineCap = 'round';
    paper = document.createElement('canvas');
    paper.width = Math.max(1, W); paper.height = Math.max(1, H);
    pcx = paper.getContext('2d');
    trail = document.createElement('canvas');
    trail.width = Math.max(1, W); trail.height = Math.max(1, H);
    tcx = trail.getContext('2d');
    tcx.lineCap = 'round';
    buildPaper();
    buildFish();
    cx.drawImage(paper, 0, 0, W, H);   // init 배경 즉시
  }

  // 개체 하나의 조향·적분·척추 갱신. 힘 단위는 px/s².
  function steer(f, dt) {
    let ax = 0, ay = 0;
    // 보이드: 반경 120px 이웃의 응집·정렬, 몸길이 1.4배 안은 분리.
    let cxS = 0, cyS = 0, vxS = 0, vyS = 0, n = 0;
    for (const o of fish) {
      if (o === f) continue;
      const dx = o.x - f.x, dy = o.y - f.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 120 * 120) {
        cxS += o.x; cyS += o.y; vxS += o.vx; vyS += o.vy; n++;
        if (d2 < (f.size * 1.4) ** 2) {
          const d = Math.sqrt(Math.max(d2, 1));
          ax -= dx / d * 90; ay -= dy / d * 90;
        }
      }
    }
    if (n) {
      ax += (cxS / n - f.x) * 0.25 + (vxS / n - f.vx) * 0.9;
      ay += (cyS / n - f.y) * 0.25 + (vyS / n - f.vy) * 0.9;
    }
    // noise 방랑: 개체별 시드로 진행각을 천천히 튼다.
    const wa = noise2(f.seed, tNow * 0.25) * 2.2;
    ax += Math.cos(wa) * 22; ay += Math.sin(wa) * 22;
    // 먹이 유인(놀란 동안 무시): 가까울수록 세게, 46px 안은 접선 선회.
    if (pt && f.scareT <= 0) {
      const dx = pt.x - f.x, dy = pt.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d < ATTRACT_R && d > 0.01) {
        if (d > 46) {
          const pull = lerp(180, 40, clamp(d / ATTRACT_R, 0, 1));
          ax += dx / d * pull; ay += dy / d * pull;
        } else { ax += -dy / d * 130; ay += dx / d * 130; }
      }
    }
    // 가장자리 회피: 여백 46px 안에서 안쪽으로 조향.
    const M = 46, TURN = 210;
    if (f.x < M) ax += TURN; else if (f.x > W - M) ax -= TURN;
    if (f.y < M) ay += TURN; else if (f.y > H - M) ay -= TURN;

    f.vx += ax * dt; f.vy += ay * dt;
    // 속도 정규화: 순항 속도로 완만히 수렴(놀라면 대시 330).
    const sp = Math.hypot(f.vx, f.vy) || 1;
    const want = f.scareT > 0 ? 330 : f.cruise * (pt ? 1.35 : 1);
    const k = 1 + (want / sp - 1) * clamp(dt * 2.5, 0, 1);
    f.vx *= k; f.vy *= k;
    f.scareT = Math.max(0, f.scareT - dt);
    f.ink = Math.max(0, f.ink - dt * 0.05);   // 마신 먹은 서서히 옅어진다
    f.x = clamp(f.x + f.vx * dt, 6, W - 6);
    f.y = clamp(f.y + f.vy * dt, 6, H - 6);

    // 척추 follow-chain: 머리가 끌고 각 마디는 앞 마디와 등간격 유지.
    const L = f.size / SEG;
    f.sx[0] = f.x; f.sy[0] = f.y;
    for (let s = 1; s < SEG; s++) {
      const dx = f.sx[s] - f.sx[s - 1], dy = f.sy[s] - f.sy[s - 1];
      const d = Math.hypot(dx, dy) || 1;
      f.sx[s] = f.sx[s - 1] + dx / d * L;
      f.sy[s] = f.sy[s - 1] + dy / d * L;
    }
  }

  // 렌더 좌표 스크래치(개체 간 공유 — 단일 스레드라 안전).
  const RX = new Float32Array(SEG), RY = new Float32Array(SEG);

  function drawFish(f) {
    const alphaMul = lerp(1, 0.42, f.depth);   // 대기원근: 원경 옅게
    const dark = lerp(0.55, 1, f.ink);         // 먹 마시면 짙게
    // 렌더 좌표 = 척추 + 유영 파동(마디 직각 방향, 꼬리로 갈수록 진폭↑).
    for (let s = 0; s < SEG; s++) {
      const s0 = Math.max(1, s);
      const dx = f.sx[s0] - f.sx[s0 - 1], dy = f.sy[s0] - f.sy[s0 - 1];
      const d = Math.hypot(dx, dy) || 1;
      const off = Math.sin(tNow * f.wave + f.phase + s * 0.85) * f.size * 0.055 * (s / SEG);
      RX[s] = f.sx[s] + (-dy / d) * off;
      RY[s] = f.sy[s] + (dx / d) * off;
    }
    // 잔상: 몸 중심선을 저알파로 trail에 풀어놓는다(먹이 물에 풀리듯).
    tcx.strokeStyle = `rgba(26,22,17,${0.022 * alphaMul * dark})`;
    tcx.lineWidth = f.size * 0.13;
    tcx.beginPath(); tcx.moveTo(RX[0], RY[0]);
    for (let s = 1; s < SEG; s++) tcx.lineTo(RX[s], RY[s]);
    tcx.stroke();
    // 몸통: 머리쪽 굵고 짙게 → 꼬리쪽 가늘고 옅게.
    for (let s = 1; s < SEG; s++) {
      const hf = s / (SEG - 1);
      cx.strokeStyle = `rgba(20,17,13,${alphaMul * dark * lerp(0.85, 0.3, hf)})`;
      cx.lineWidth = Math.max(0.6, f.size * lerp(0.15, 0.02, hf));
      cx.beginPath(); cx.moveTo(RX[s - 1], RY[s - 1]); cx.lineTo(RX[s], RY[s]); cx.stroke();
    }
    // 머리: 짙은 먹 점획.
    cx.fillStyle = `rgba(14,12,10,${alphaMul * dark * 0.9})`;
    cx.beginPath(); cx.arc(RX[0], RY[0], f.size * 0.085, 0, TAU); cx.fill();
    // 꼬리: 갈필 3가닥 부챗살.
    const tdx = RX[SEG - 1] - RX[SEG - 2], tdy = RY[SEG - 1] - RY[SEG - 2];
    const ta = Math.atan2(tdy, tdx);
    for (let j = -1; j <= 1; j++) {
      const a = ta + j * 0.34;
      cx.strokeStyle = `rgba(54,46,36,${alphaMul * dark * (j ? 0.35 : 0.5)})`;
      cx.lineWidth = Math.max(0.6, f.size * 0.025);
      cx.beginPath();
      cx.moveTo(RX[SEG - 1], RY[SEG - 1]);
      cx.lineTo(RX[SEG - 1] + Math.cos(a) * f.size * 0.34, RY[SEG - 1] + Math.sin(a) * f.size * 0.34);
      cx.stroke();
    }
  }

  return {
    init(ctx) {
      audio = ctx.audio;
      cv = ctx.canvas;
      W = ctx.width; H = ctx.height;
      pt = null; lastSchool = -9; lastScare = -9;   // 재마운트 상태 이월 방지
      setup();
    },

    frame(t, dt) {
      tNow = t;
      cx.drawImage(paper, 0, 0, W, H);
      // 잔상 소산(~8초).
      tcx.save();
      tcx.globalCompositeOperation = 'destination-out';
      tcx.fillStyle = `rgba(0,0,0,${clamp(dt / 8, 0, 0.05)})`;
      tcx.fillRect(0, 0, W, H);
      tcx.restore();
      if (pt) {
        pt.holdT += dt;
        // 꾹 누름 먹방울: √시간 번짐 + 근접 개체가 먹을 마신다.
        if (pt.holdT > HOLD_BLOOM) {
          const g = clamp((pt.holdT - HOLD_BLOOM) / 2.2, 0, 1);
          const r = 12 + 40 * Math.sqrt(g);
          const grad = tcx.createRadialGradient(pt.x, pt.y, r * 0.12, pt.x, pt.y, r);
          grad.addColorStop(0, `rgba(16,13,10,${clamp(dt * 1.8, 0, 0.05)})`);
          grad.addColorStop(1, 'rgba(16,13,10,0)');
          tcx.fillStyle = grad;
          tcx.beginPath(); tcx.arc(pt.x, pt.y, r, 0, TAU); tcx.fill();
          for (const f of fish) {
            if (Math.hypot(f.x - pt.x, f.y - pt.y) < 70) f.ink = clamp(f.ink + dt * 0.6, 0, 1);
          }
        }
        // 모여듦 사운드(스로틀): 반경 90px 안 3마리 이상.
        let near = 0;
        for (const f of fish) if (Math.hypot(f.x - pt.x, f.y - pt.y) < 90) near++;
        if (near >= 3 && audio && t - lastSchool > 1.5) {
          audio.tone({ deg: 1, oct: -1, vol: 0.07 });
          lastSchool = t;
        }
      }
      for (const f of fish) steer(f, dt);
      cx.drawImage(trail, 0, 0, W, H);
      for (const f of fish) drawFish(f);
    },

    pointer(e) {
      if (e.type === 'down') {
        pt = { x: e.x, y: e.y, holdT: 0, lastMs: performance.now() };
      } else if (e.type === 'move' && pt) {
        const now = performance.now();
        const dtm = Math.max(8, now - pt.lastMs);
        const dist = Math.hypot(e.x - pt.x, e.y - pt.y);
        if (dist > 2.5) pt.holdT = 0;                 // 이동 재개 → 번짐 중단
        // 빠른 저음: 반경 내 개체를 반대 방향으로 대시시킨다.
        if (dist / dtm * 1000 > SCARE_SPEED) {
          for (const f of fish) {
            const dx = f.x - e.x, dy = f.y - e.y;
            const d = Math.hypot(dx, dy);
            if (d < SCARE_R) {
              f.scareT = 0.9;
              f.vx = dx / (d || 1) * 330; f.vy = dy / (d || 1) * 330;
            }
          }
          if (audio && tNow - lastScare > 0.8) {
            audio.tone({ deg: 4, oct: 1, vol: 0.09 });
            lastScare = tNow;
          }
        }
        pt.x = e.x; pt.y = e.y; pt.lastMs = now;
      } else if (e.type === 'up') { pt = null; }
    },

    resize(w, h) { W = w; H = h; setup(); },

    dispose() {
      cx = pcx = tcx = null; paper = trail = null;
      fish = null; pt = null; audio = null;
    },
  };
})();
```

- [ ] **Step 2: 문법 검증**

Run: `node --check js/works/w1-mukeo.js`
Expected: 출력 없음(성공)

- [ ] **Step 3: 단독 행동 검증 (등록 전, fresh import)**

no-cache 서버를 8002 포트로 기동:

```bash
sed 's/port=8000/port=8002/' /tmp/claude-1000/-home-ec2-user-media-art/8845ab4c-1b1a-4ec8-888f-6b3d7b2c3f8f/scratchpad/nocache_server.py > /tmp/claude-1000/-home-ec2-user-media-art/8845ab4c-1b1a-4ec8-888f-6b3d7b2c3f8f/scratchpad/nocache_server_8002.py
nohup python3 /tmp/claude-1000/-home-ec2-user-media-art/8845ab4c-1b1a-4ec8-888f-6b3d7b2c3f8f/scratchpad/nocache_server_8002.py >/dev/null 2>&1 &
```

Playwright로 `http://localhost:8002/` 접속 후 browser_evaluate:

```js
async () => {
  const mod = await import('/js/works/w1-mukeo.js?v=t1');
  const inst = mod.default;
  const cvs = document.createElement('canvas');
  cvs.style.width = '700px'; cvs.style.height = '500px';
  document.body.append(cvs);
  inst.init({ canvas: cvs, width: 700, height: 500, audio: null, sensors: null, hands: null, dpr: 1 });
  const ctx = cvs.getContext('2d');
  const sample = () => {  // 64칸 그리드 R값 표본 — 균일 여부·먹 존재 판정
    const d = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
    let min = 255, max = 0;
    for (let i = 0; i < d.length; i += 4 * 997) { min = Math.min(min, d[i]); max = Math.max(max, d[i]); }
    return { min, max };
  };
  // 1) 무입력 유영: 60프레임 전후 짙은 픽셀(min) 존재 + 비균일
  let T = 0; const step = (n) => { for (let i = 0; i < n; i++) { T += 1 / 60; inst.frame(T, 1 / 60); } };
  step(60);
  const swim = sample();
  // 2) 모여듦: down 후 120프레임 — 포인터 반경 120px 내 개체 수 증가 확인(픽셀 근사)
  inst.pointer({ type: 'down', x: 350, y: 250 });
  step(150);
  const dNear = ctx.getImageData(290, 190, 120, 120).data;
  let darkNear = 0; for (let i = 0; i < dNear.length; i += 4) if (dNear[i] < 120) darkNear++;
  // 3) 먹방울: 계속 홀드 → ink 상승으로 개체가 짙어졌는지 (min 하강)
  step(120);
  const bloom = sample();
  inst.pointer({ type: 'up', x: 350, y: 250 });
  cvs.remove();
  return {
    swim_ok: swim.min < 140 && swim.max > 200,       // 먹 + 한지 공존(비균일)
    gather_ok: darkNear > 40,                        // 포인터 주변에 먹 픽셀 밀집
    bloom_ok: bloom.min <= swim.min,                 // 번짐/짙어짐으로 더 어두워짐
    raw: { swim, darkNear, bloom },
  };
}
```

Expected: `swim_ok: true, gather_ok: true, bloom_ok: true`

- [ ] **Step 4: Commit**

```bash
git add js/works/w1-mukeo.js
git commit -m "feat: 묵어(墨魚) 작품 모듈 — 보이드 수묵 물고기 떼

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 발묵 → 묵어 등록 교체 및 전수 검증

**Files:**
- Modify: `js/data.js:25-27` (balmuk 항목 교체)
- Modify: `making-of.html:132` (파일럿 서술 갱신)
- Delete: `js/works/w1-balmuk.js`

**Interfaces:**
- Consumes: Task 1의 `js/works/w1-mukeo.js` (id `mukeo` ↔ 파일명 `w{wing}-{id}.js` 규약)
- Produces: 없음 (최종 태스크)

- [ ] **Step 1: data.js 항목 교체**

`js/data.js`에서 아래 old를 new로 Edit:

old:
```js
  { id:'balmuk', wing:1, title:'발묵', en:'Bleeding Ink',
    desc:'화선지에 먹이 스며들 듯, 터치한 자리에서 먹이 번져 나간다.',
    how:'터치/드래그로 먹을 떨어뜨리세요. 오래 누를수록 짙게 스며듭니다.', needs:[] },
```

new:
```js
  { id:'mukeo', wing:1, title:'묵어', en:'Ink Fish',
    desc:'먹을 머금은 물고기 떼가 화선지 물속을 유영한다. 지나간 자리마다 먹이 물에 풀린다.',
    how:'손을 대면 모여들고, 빠르게 저으면 흩어집니다. 꾹 누르면 먹방울에 모여 먹빛이 짙어집니다.', needs:[] },
```

- [ ] **Step 2: making-of.html 파일럿 서술 갱신**

`making-of.html:132`에서 `한 점(발묵)은`을 `한 점(발묵 — 이후 관람 피드백으로 '묵어'로 교체)은`으로 Edit.

- [ ] **Step 3: 발묵 모듈 삭제**

```bash
git rm js/works/w1-balmuk.js
```

- [ ] **Step 4: 문법 검증**

Run: `node --check js/data.js`
Expected: 출력 없음(성공)

- [ ] **Step 5: 1관 selftest (8002 no-cache 서버, 새 브라우저 컨텍스트)**

Playwright: `http://localhost:8002/?selftest&wing=1` 접속 → browser_evaluate:

```js
async () => {
  const t0 = Date.now();
  while (!(window.__SMOKE__ && window.__SMOKE__.done) && Date.now() - t0 < 30000)
    await new Promise(r => setTimeout(r, 300));
  return window.__SMOKE__.results.map(r => ({ id: r.id, ok: r.ok, ms: Math.round(r.msPerFrame * 100) / 100, errors: r.errors }));
}
```

Expected: 4작품 = `mukeo, ilpil, ujung, mukjuk` 전부 `ok:true`, `errors:[]`, `ms < 16`. `balmuk` 부재 확인.

- [ ] **Step 6: 라이브 화면 스크린샷 육안 확인**

Playwright: `http://localhost:8002/#/w/1/mukeo` 접속 → 1.5초 대기 → 스크린샷.
Expected: 붓획 물고기 떼(짙은 머리·갈필 꼬리), 원경 개체는 옅음, 하단에 조작 안내 힌트.
확인 후 스크린샷 파일은 저장소에서 삭제.

- [ ] **Step 7: 전수 selftest 회귀**

Playwright: `http://localhost:8002/?selftest` → 동일 evaluate.
Expected: **32/32 `ok:true`** (mukeo 포함, balmuk 부재).

- [ ] **Step 8: Commit**

```bash
git add js/data.js making-of.html
git commit -m "feat: 발묵 → 묵어 교체 — 관람 피드백 반영 (selftest 32/32)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 계획 자가 리뷰 결과

- 스펙 §2 시각(체인·파동·갈필 꼬리·대기원근·잔상) → Task 1 코드에 전부 구현 ✓
- 스펙 §3 행동 표 4행(군영/유인/공포/먹방울) + 사운드 2종 → steer()/pointer()/frame()에 매핑 ✓
- 스펙 §5 교체 범위 5항목 → Task 2 Step 1~3 + docs 불변 방침 ✓
- 스펙 §6 검증 기준 4항목 → Task 1 Step 2·3, Task 2 Step 5~7 ✓
- 플레이스홀더 없음, 타입/이름 일관(`mukeo`, `w1-mukeo.js`, SEG/RX/RY) ✓
