// 결 · GYEOL — 전수 스모크 하네스
// ?selftest 일 때 main.js가 지연 로드한다. 각 작품을 순차로 마운트하고
// main RAF와 별개로 frame을 동기 60회 직접 호출해 성능·렌더를 검증한다.
//
// 검증 항목 (작품별):
//   ok         : 예외 0 · 로드/init 오류 0 · 렌더가 균일하지 않음(!uniform)
//   errors     : mountWork 중 수집된 __GYEOL__.currentErrors + 동기 frame 예외
//   uniform    : #stage 캔버스를 64×64로 다운샘플 → 96바이트 간격 샘플이 모두 같은 값이면 true
//   msPerFrame : 동기 60프레임 총시간 / 60 (< 16 이면 60fps 여유)
//
// 결과: window.__SMOKE__ = { done, results:[{id, ok, errors, uniform, msPerFrame}] }
// URL: ?selftest (전수) · &wing=N (해당 관만)

import { WORKS } from './data.js';

const GY = window.__GYEOL__;
const FRAMES = 60;
const DT = 1 / 60;          // 고정 타임스텝 (프레임 독립 검증)
const SAMPLE_SIZE = 64;     // 다운샘플 해상도
const SAMPLE_STRIDE = 96;   // 픽셀 데이터 샘플 간격(바이트)

const SMOKE = { done: false, results: [] };
window.__SMOKE__ = SMOKE;

// ── 관 필터 ─────────────────────────────────────────────────────────────
function targetWorks() {
  const m = /(?:[?&])wing=(\d+)/.exec(location.search);
  if (!m) return WORKS.slice();
  const no = parseInt(m[1], 10);
  return WORKS.filter((w) => w.wing === no);
}

// ── 진행 오버레이 ───────────────────────────────────────────────────────
let overlay = null;
function ensureOverlay() {
  overlay = document.createElement('div');
  overlay.id = 'smoke-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', right: '0', zIndex: '99999',
    maxWidth: '46vw', maxHeight: '100vh', overflow: 'auto',
    padding: '.7rem .9rem', background: 'rgba(14,12,10,.92)', color: '#EDE6D6',
    font: '12px/1.5 "Space Mono", ui-monospace, monospace', whiteSpace: 'pre',
    letterSpacing: '.02em', pointerEvents: 'none', borderBottomLeftRadius: '.4rem',
  });
  document.body.append(overlay);
}
function renderOverlay(total, currentId) {
  if (!overlay) return;
  const done = SMOKE.results.length;
  const okN = SMOKE.results.filter((r) => r.ok).length;
  const lines = [`SELFTEST  ${done}/${total}  ok:${okN}`];
  if (currentId) lines.push(`▶ ${currentId} …`);
  for (const r of SMOKE.results) {
    lines.push(`${r.ok ? '✓' : '✗'} ${r.id.padEnd(14)} ${r.msPerFrame.toFixed(2)}ms${r.uniform ? ' [uniform]' : ''}`);
  }
  overlay.textContent = lines.join('\n');
}

// ── 픽셀 균일성 검사 ────────────────────────────────────────────────────
// #stage 캔버스를 64×64 2d 오프스크린에 축소 → getImageData → 96바이트 간격 샘플.
// 고유값이 1개 이하면 uniform(=아무것도 안 그렸거나 단색) 으로 본다.
function isUniform() {
  const canvas = document.querySelector('#stage canvas');
  if (!canvas || !canvas.width || !canvas.height) return true;
  try {
    const off = document.createElement('canvas');
    off.width = SAMPLE_SIZE; off.height = SAMPLE_SIZE;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(canvas, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const data = octx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    const seen = new Set();
    for (let i = 0; i < data.length; i += SAMPLE_STRIDE) seen.add(data[i]);
    return seen.size <= 1;
  } catch {
    return true; // 읽기 실패(taint 등)는 검증 불가 → 보수적으로 uniform 취급
  }
}

// ── 작품 1점 스모크 ─────────────────────────────────────────────────────
// mountWork → pauseLoop(main 정지 + 인스턴스 회수) → frame 동기 60회 → 픽셀 검사 → unmount.
// 예외/로드 실패는 모두 캐치해 ok:false 로 기록하고 다음 작품으로 넘어간다.
async function runOne(work) {
  const errors = [];
  let uniform = true, msPerFrame = 0, inst = null;

  try {
    await GY.mountWork(work.id);           // init 완료 후 resolve · currentErrors 리셋됨
    inst = GY.pauseLoop();                  // main RAF 정지 → 마운트된 인스턴스(없으면 null)
  } catch (err) {
    errors.push('mount ' + work.id + ': ' + (err && err.message || err));
  }

  const hasFrame = inst && typeof inst.frame === 'function';
  if (hasFrame) {
    const t0 = performance.now();
    let f = 0;
    try {
      for (; f < FRAMES; f++) inst.frame(f * DT, DT);   // t=0 부터 dt 씩
    } catch (err) {
      errors.push('frame ' + work.id + '@' + f + ': ' + (err && err.stack || err.message || err));
    }
    msPerFrame = (performance.now() - t0) / FRAMES;
    uniform = isUniform();                  // 마지막 렌더 상태에서 검사 (unmount 이전)
  }

  // mountWork 중 발생/수집된 오류(load·init·비동기)를 합친다
  for (const e of GY.currentErrors) errors.push(e);

  try { GY.unmountWork(); } catch (err) { errors.push('unmount ' + work.id + ': ' + (err && err.message || err)); }

  const ok = errors.length === 0 && hasFrame && !uniform;
  return { id: work.id, ok, errors, uniform, msPerFrame };
}

// ── 드라이버 ────────────────────────────────────────────────────────────
async function run() {
  const works = targetWorks();
  ensureOverlay();
  renderOverlay(works.length, null);
  for (const work of works) {
    renderOverlay(works.length, work.id);
    let result;
    try {
      result = await runOne(work);
    } catch (err) {                          // 하네스 자체 예외도 결과로 흡수
      result = { id: work.id, ok: false, errors: ['harness: ' + (err && err.message || err)], uniform: true, msPerFrame: 0 };
    }
    SMOKE.results.push(result);
    renderOverlay(works.length, null);
  }
  SMOKE.done = true;
  renderOverlay(works.length, null);
}

run();
