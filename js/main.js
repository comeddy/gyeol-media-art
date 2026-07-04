// 결 · GYEOL — 해시 라우터 · 뷰어 · 작품 로더 · RAF 루프
// 아트리움(관 카드) ↔ 관 입구(작품 카드) ↔ 뷰어(캔버스 작품)를 오가는 단일 진입점.
// 작품 모듈 계약: default export = { init(ctx), frame(t,dt), pointer(e)?, resize(w,h)?, dispose()? }
//   ctx = { canvas, width, height, audio, sensors, hands }  (width/height는 CSS px)
// 전역 훅: window.__GYEOL__ = { mountWork(id)→Promise<work>, unmountWork(), currentErrors:[] }

import { WINGS, WORKS, wingWorks } from './data.js';
import audio from './core/audio.js';
import sensors from './core/sensors.js';
import hands from './core/hands.js';

// ── DOM 레퍼런스 (index.html 계약 셀렉터) ──────────────────────────────
const $ = (s) => document.querySelector(s);
const body = document.body;
const wingsEl = $('#wings');
const viewerEl = $('#viewer');
const stageEl = $('#stage');
const panelEl = $('#panel');
const titleEl = $('#viewer-title');
const descEl = $('#viewer-desc');
const noteEl = $('#viewer-note');
const hintEl = $('#hint');
const soundBtn = $('[data-action="sound"]');

// ── 상수 ──────────────────────────────────────────────────────────────
const NEEDS_LABEL = { mic: '마이크', hands: '손 인식', gyro: '기울임', webgl: 'WebGL' };
const NEEDS_REQ = ['mic', 'hands', 'gyro']; // 권한 요청이 필요한 needs (webgl 제외)
const DT_MAX = 0.05;                         // dt 상한 (탭 백그라운드 복귀 스파이크 방지)
const HINT_FADE_MS = 3000;

// ── 상태 ──────────────────────────────────────────────────────────────
let current = null;      // { work, canvas, ctx2d } — 마운트된 작품 (없으면 null)
let rafId = 0;           // 현재 RAF 핸들 (0이면 정지)
let lastT = 0;           // 직전 프레임 타임스탬프
let mountSeq = 0;        // 마운트 세대 토큰 — 비동기 로드 경합 방지
let audioReady = false;  // 사용자 제스처로 audio.ensure()가 불렸는가
let hintTimer = 0;       // 힌트 페이드 타이머
let suppressHash = false;// 훅이 건 hash 변경으로 인한 route() 재실행 억제

// ── 전역 훅 & 에러 수집 ─────────────────────────────────────────────────
const GY = { mountWork, unmountWork, currentErrors: [] };
window.__GYEOL__ = GY;
const pushErr = (msg) => { try { GY.currentErrors.push(String(msg)); } catch { /* noop */ } };
window.addEventListener('error', (e) => pushErr(e.message || (e.error && e.error.message) || e.type));
window.addEventListener('unhandledrejection', (e) => pushErr(e.reason && (e.reason.stack || e.reason.message || e.reason) || 'unhandledrejection'));

// ── 작은 헬퍼 ───────────────────────────────────────────────────────────
function el(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}
function findWork(id) { return WORKS.find((w) => w.id === id) || null; }
function stageSize() {
  const r = stageEl.getBoundingClientRect();
  return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
}

// ══ 라우팅 ═════════════════════════════════════════════════════════════
// #/           → 아트리움(관 카드 8)
// #/w/{no}     → 관 입구(작품 4 카드)
// #/w/{no}/{id}→ 작품 뷰어
function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'w' && parts[1]) {
    const no = parseInt(parts[1], 10);
    if (parts[2]) return { view: 'viewer', no, id: parts[2] };
    return { view: 'wing', no };
  }
  return { view: 'atrium' };
}

function route() {
  const r = parseHash();
  if (r.view === 'viewer') {
    const work = findWork(r.id);
    if (work && work.wing === r.no) { enterViewer(work); return; }
    location.hash = '#/'; // 잘못된 작품 경로 → 아트리움
    return;
  }
  if (current || !viewerEl.hidden) leaveViewer();
  // 관 입장(입구·뷰어) 시 앰비언트를 흘리고, 아트리움에서만 정지 (플랜: 관 입장 시 setAmbient(wingNo)).
  // muted 기본 true라 사용자가 사운드를 켜기 전엔 무음 — 켜면 관 어디서든 해당 관 앰비언트가 흐른다.
  if (r.view === 'wing') { audio.setAmbient(r.no); renderWingEntrance(r.no); }
  else { audio.setAmbient(null); renderAtrium(); }
}

// ── 아트리움: 관 카드 8개 주입 ──────────────────────────────────────────
function renderAtrium() {
  body.dataset.view = 'atrium';
  wingsEl.setAttribute('aria-label', '전시관 목록');
  wingsEl.replaceChildren();
  for (const wing of WINGS) {
    const card = el('button', 'wing-card');
    card.type = 'button';
    card.setAttribute('aria-label', `${wing.name} — ${wing.tagline}`);
    card.append(el('span', 'wing-card__index', String(wing.no).padStart(2, '0')));
    const name = el('h2', 'wing-card__name', wing.name);
    if (wing.hanja) name.append(el('span', 'wing-card__hanja', wing.hanja));
    card.append(name, el('p', 'wing-card__theme', wing.tagline));
    const ul = el('ul', 'wing-card__works');
    for (const w of wingWorks(wing.no)) ul.append(el('li', 'work-chip', w.title));
    card.append(ul);
    card.addEventListener('click', () => { location.hash = `#/w/${wing.no}`; });
    wingsEl.append(card);
  }
}

// ── 관 입구: #wings 영역을 재활용해 작품 4점 카드 + 뒤로가기 ────────────
function renderWingEntrance(no) {
  const wing = WINGS.find((w) => w.no === no);
  if (!wing) { location.hash = '#/'; return; }
  body.dataset.view = 'atrium';
  wingsEl.setAttribute('aria-label', `${wing.name} 작품 목록`);
  wingsEl.replaceChildren();

  const head = el('div', 'wing-entry-head');
  Object.assign(head.style, { gridColumn: '1/-1', display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' });
  const back = el('button', 'wing-entry-back', '← 아트리움');
  back.type = 'button';
  Object.assign(back.style, { fontFamily: 'var(--mono)', fontSize: '.8rem', letterSpacing: '.12em', color: 'var(--gold)' });
  back.addEventListener('click', () => { location.hash = '#/'; });
  const h = el('h2', null, wing.name);
  Object.assign(h.style, { fontSize: '1.7rem', fontWeight: '700' });
  if (wing.hanja) { const hj = el('span', null, ' ' + wing.hanja); Object.assign(hj.style, { color: 'var(--paper-dim)', fontWeight: '400' }); h.append(hj); }
  head.append(back, h);

  const lead = el('p', null, wing.desc);
  Object.assign(lead.style, { gridColumn: '1/-1', color: 'var(--paper-dim)', maxWidth: '60ch' });
  wingsEl.append(head, lead);
  for (const w of wingWorks(no)) wingsEl.append(workCard(w));
}

function workCard(w) {
  const card = el('button', 'wing-card');
  card.type = 'button';
  card.setAttribute('aria-label', `${w.title} — ${w.en}`);
  card.append(el('span', 'wing-card__index', w.en.toUpperCase()));
  card.append(el('h2', 'wing-card__name', w.title));
  card.append(el('p', 'wing-card__theme', w.how));
  const ul = el('ul', 'wing-card__works');
  const badges = (w.needs && w.needs.length) ? w.needs.map((n) => NEEDS_LABEL[n] || n) : ['터치'];
  for (const b of badges) ul.append(el('li', 'work-chip', b));
  card.append(ul);
  card.addEventListener('click', () => { location.hash = `#/w/${w.wing}/${w.id}`; });
  return card;
}

// ══ 뷰어 · 마운트 / 언마운트 ═══════════════════════════════════════════
function enterViewer(work) { mountWork(work.id); } // 라우터 진입 (프라미스 불필요)

// window.__GYEOL__.mountWork — init 완료 후 work 객체로 resolve.
async function mountWork(id) {
  const work = findWork(id);
  if (!work) return Promise.reject(new Error('unknown work: ' + id));
  const seq = ++mountSeq;
  unmountWork();                        // 기존 작품 정리 (이 안의 dispose 예외는 이전 작품 몫)
  GY.currentErrors.length = 0;          // 계약: unmount 완료 후 리셋 → 새 작품에만 귀속
  if (seq !== mountSeq) return work;

  showViewerChrome(work);
  const h = `#/w/${work.wing}/${work.id}`;
  if (location.hash !== h) { suppressHash = true; location.hash = h; }
  audio.setAmbient(work.wing);

  const canvas = document.createElement('canvas');
  stageEl.append(canvas);
  setupHint(work);                      // bindPointer는 init 성공 후 (실패/레이스 경로 리스너 누수 방지)

  let mod;
  try {
    mod = await import(`./works/w${work.wing}-${work.id}.js`);
  } catch (err) {
    if (seq !== mountSeq) return work;
    pushErr('load ' + work.id + ': ' + (err && err.message || err));
    showErrorCard(work);
    return work;
  }
  if (seq !== mountSeq) return work;

  const inst = mod.default;
  const { w, h: hh } = stageSize();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  current = { work, canvas, inst };
  try {
    inst.init({ canvas, audio, sensors, hands, width: w, height: hh, dpr });
  } catch (err) {
    pushErr('init ' + work.id + ': ' + (err && err.message || err));
    showErrorCard(work);
    current = null;
    return work;
  }
  bindPointer(canvas);   // init 성공 후에만 포인터/윈도우 리스너 등록
  startLoop();
  return work;
}

// window.__GYEOL__.unmountWork — RAF 정지 → dispose → 캔버스 제거 → 센서/손 정리.
function unmountWork() {
  stopLoop();
  const inst = current && current.inst;
  if (inst && typeof inst.dispose === 'function') {
    try { inst.dispose(); } catch (err) { pushErr('dispose: ' + (err && err.message || err)); }
  }
  if (current && current.canvas) unbindPointer(current.canvas);
  stageEl.replaceChildren();            // 캔버스 · 오류 카드 제거
  current = null;
  try { sensors.dispose(); } catch { /* noop */ }
  try { hands.stop(); } catch { /* noop */ }
  clearHint();
}

function leaveViewer() {
  unmountWork();
  viewerWork = null;
  viewerEl.hidden = true;
  body.dataset.view = 'atrium';
  setPanel(false);
}

function showViewerChrome(work) {
  viewerWork = work;
  viewerEl.hidden = false;
  body.dataset.view = 'viewer';
  titleEl.textContent = work.title;
  descEl.textContent = work.desc;
  noteEl.textContent = work.how;
  setPanel(false);
}

// ── RAF 루프 (main.js 소유) ─────────────────────────────────────────────
function startLoop() { stopLoop(); lastT = performance.now(); rafId = requestAnimationFrame(loop); }
function stopLoop() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
function loop(t) {
  rafId = requestAnimationFrame(loop);
  const dt = Math.min((t - lastT) / 1000, DT_MAX);
  lastT = t;
  const inst = current && current.inst;
  if (!inst || typeof inst.frame !== 'function') return;
  try {
    inst.frame(t / 1000, dt);
  } catch (err) {
    stopLoop();
    pushErr('frame ' + (current && current.work.id) + ': ' + (err && err.stack || err));
    if (current) showErrorCard(current.work);
  }
}

// ── 포인터 정규화 → work.pointer({type,x,y}) (캔버스 CSS 좌표) ───────────
let ptr = null;
function bindPointer(canvas) {
  const send = (type) => (ev) => {
    if (type === 'down') { onFirstPointer(); if (ev.pointerId != null && canvas.setPointerCapture) { try { canvas.setPointerCapture(ev.pointerId); } catch { /* noop */ } } }
    const r = canvas.getBoundingClientRect();
    const inst = current && current.inst;
    if (inst && typeof inst.pointer === 'function') {
      try { inst.pointer({ type, x: ev.clientX - r.left, y: ev.clientY - r.top }); }
      catch (err) { pushErr('pointer: ' + (err && err.message || err)); }
    }
  };
  ptr = { canvas, down: send('down'), move: send('move'), up: send('up') };
  canvas.addEventListener('pointerdown', ptr.down);
  canvas.addEventListener('pointermove', ptr.move);
  window.addEventListener('pointerup', ptr.up);
}
function unbindPointer(canvas) {
  if (!ptr) return;
  canvas.removeEventListener('pointerdown', ptr.down);
  canvas.removeEventListener('pointermove', ptr.move);
  window.removeEventListener('pointerup', ptr.up);
  ptr = null;
}

// ── 권한 힌트 (#hint) + 첫 포인터다운 request() ──────────────────────────
let pendingNeeds = null;
function setupHint(work) {
  clearHint();
  const req = (work.needs || []).filter((n) => NEEDS_REQ.includes(n));
  pendingNeeds = req.length ? req : null;
  if (!pendingNeeds) return;
  const names = req.map((n) => NEEDS_LABEL[n]).join('·');
  showHint(`이 작품은 ${names}로 반응합니다 — 화면을 탭하면 시작됩니다`, false);
}
async function onFirstPointer() {
  if (!pendingNeeds) return;
  const needs = pendingNeeds; pendingNeeds = null;
  const names = needs.map((n) => NEEDS_LABEL[n]).join('·');
  const results = await Promise.all(needs.map(requestNeed));
  showHint(results.every(Boolean) ? `${names} 준비됨` : `${names} 없이도 감상할 수 있습니다`, true);
}
function requestNeed(n) {
  try {
    if (n === 'mic') return Promise.resolve(sensors.mic.request());
    if (n === 'gyro') return Promise.resolve(sensors.requestTilt());
    if (n === 'hands') return Promise.resolve(hands.request());
  } catch (err) { pushErr('request ' + n + ': ' + (err && err.message || err)); }
  return Promise.resolve(false);
}
function showHint(text, autoFade) {
  hintEl.textContent = text;
  hintEl.hidden = false;
  hintEl.setAttribute('aria-hidden', 'false');
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0; }
  if (autoFade) hintTimer = setTimeout(clearHint, HINT_FADE_MS);
}
function clearHint() {
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0; }
  hintEl.hidden = true;
  hintEl.setAttribute('aria-hidden', 'true');
  hintEl.textContent = '';
}

// ── 정보 패널 토글 (hidden + aria 동반 관리) ────────────────────────────
function setPanel(open) {
  panelEl.hidden = !open;
  panelEl.setAttribute('aria-hidden', open ? 'false' : 'true');
  const info = $('[data-action="info"]');
  if (info) info.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// ── 모듈 로딩/실행 실패 시 오류 카드 ────────────────────────────────────
function showErrorCard(work) {
  stopLoop();
  stageEl.replaceChildren();
  const box = el('div', 'viewer-error');
  Object.assign(box.style, { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '2rem' });
  const wrap = el('div');
  Object.assign(wrap.style, { display: 'grid', gap: '.6rem' });
  const t = el('p', null, work.title);
  Object.assign(t.style, { fontSize: '1.4rem', color: 'var(--paper)' });
  const m = el('p', null, '이 작품은 잠시 쉬고 있습니다');
  Object.assign(m.style, { fontFamily: 'var(--mono)', fontSize: '.8rem', color: 'var(--paper-dim)' });
  wrap.append(t, m);
  box.append(wrap);
  stageEl.append(box);
}

// 관 프리페치(같은 관 나머지 작품 idle import)는 의도적으로 생략한다.
// 정적 서버가 디렉터리 리스팅을 막고(404) 아직 없는 형제 모듈을 network로 탐지하면
// 콘솔 404를 남기므로, 32작품이 모두 존재하는 통합 단계에서 재도입한다.

// ══ 이벤트 바인딩 · 초기 진입 ══════════════════════════════════════════
let viewerWork = null;   // 뷰어에 걸린 작품 (로드 실패로 current=null이어도 ‹ ›·닫기 유지)
let resizeTimer = 0;

// 같은 관 내 이전/다음 작품으로 순환 이동.
function sibling(dir) {
  if (!viewerWork) return;
  const list = wingWorks(viewerWork.wing);
  const i = list.findIndex((w) => w.id === viewerWork.id);
  if (i < 0) return;
  const j = (i + dir + list.length) % list.length;
  location.hash = `#/w/${list[j].wing}/${list[j].id}`;
}

// 사운드 토글 — 최초 제스처에서 audio.ensure(), muted 토글, aria-pressed 동기화.
function toggleSound() {
  if (!audioReady) {
    audio.ensure();
    audioReady = true;
    if (viewerWork) audio.setAmbient(viewerWork.wing); // ensure 전 no-op였던 앰비언트 재적용
  }
  audio.muted = !audio.muted;
  soundBtn.setAttribute('aria-pressed', audio.muted ? 'false' : 'true');
}

function bind(action, fn) { const b = $(`[data-action="${action}"]`); if (b) b.addEventListener('click', fn); }
bind('home', () => { location.hash = '#/'; });
bind('sound', toggleSound);
bind('close', () => { location.hash = viewerWork ? `#/w/${viewerWork.wing}` : '#/'; });
bind('prev', () => sibling(-1));
bind('next', () => sibling(1));
bind('info', () => setPanel(panelEl.hidden));

window.addEventListener('resize', () => {
  if (!current) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const { w, h } = stageSize();
    const inst = current && current.inst;
    if (inst && typeof inst.resize === 'function') {
      try { inst.resize(w, h); } catch (err) { pushErr('resize: ' + (err && err.message || err)); }
    }
  }, 150);
});

window.addEventListener('keydown', (e) => {
  if (body.dataset.view !== 'viewer') return;
  if (e.key === 'Escape') location.hash = viewerWork ? `#/w/${viewerWork.wing}` : '#/';
  else if (e.key === 'ArrowLeft') sibling(-1);
  else if (e.key === 'ArrowRight') sibling(1);
});

window.addEventListener('hashchange', () => {
  if (suppressHash) { suppressHash = false; return; }
  route();
});

route(); // 초기 진입 (모듈 스크립트는 body 끝에 있어 DOM 준비 완료)
