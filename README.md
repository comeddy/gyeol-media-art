# 결 · GYEOL

[![License](https://img.shields.io/badge/License-All_Rights_Reserved-lightgrey.svg)]()
[![Works](https://img.shields.io/badge/works-32-green.svg)]()
[![Wings](https://img.shields.io/badge/wings-8-blue.svg)]()
[![No Build](https://img.shields.io/badge/build-none-brightgreen.svg)]()
[![Live Demo](https://img.shields.io/badge/demo-live-orange.svg)](https://gyeol.zerojin.art/)

<a href="#english"><img src="https://img.shields.io/badge/lang-English-blue.svg" alt="English"></a>
<a href="#korean"><img src="https://img.shields.io/badge/lang-한국어-red.svg" alt="Korean"></a>

An interactive generative media art exhibition that reimagines Korean aesthetics in code — 32 works across 8 wings. | 한국적 미감을 코드로 다시 빚은 인터랙티브 제너러티브 미디어 아트 전시 — 8관 32작품.

---

<a id="english"></a>

# English

## Overview

`결` (gyeol) is a Korean word for the grain and texture that nature carves into itself — the ripple of water, the grain of wood, the flow of breath, the weave of silk. **결 · GYEOL** reimagines that idea as generative art: 32 canvas-based works spread across 8 themed wings, each responding to touch, sound, tilt, and hand gestures.

The entire exhibition is a build-free static web app — no framework, no bundler, no dependencies to install. Every sensor and heavy feature degrades gracefully, so a work that expects a microphone or a webcam still runs with a pointer fallback when those are unavailable.

Live demo: **https://gyeol.zerojin.art/**

## Features

- **32 generative works across 8 wings** — Each wing explores one facet of Korean aesthetics (ink, color, script, negative space, textile, music, folk painting, and the cycle of seasons).
- **Multi-modal interaction** — Works respond to pointer/touch, microphone level (blow into the mic), device tilt (gyroscope), and hand tracking via MediaPipe.
- **Graceful degradation by design** — Sensors and the hand tracker never throw. On permission denial, missing hardware, or unsupported browsers, works fall back to pointer input. Modules have zero import-time side effects, so they are safe to load in Node.
- **Pentatonic Web Audio engine** — A shared audio singleton generates a Korean pentatonic (평조) scale, tuned to individual works.
- **Build-free architecture** — Pure ES modules loaded directly by the browser. No transpiler, no bundler, no `node_modules`.
- **Full smoke-test harness** — A `?selftest` mode mounts every work and drives 60 synchronous frames to verify rendering and performance (32/32 must pass before deploy).

## Prerequisites

- A modern browser with Canvas 2D, WebGL, Web Audio API, and ES module support.
- A local static HTTP server for development — ES modules are blocked on the `file://` protocol by CORS.
- Microphone and hand-tracking features require a secure context (`localhost` or HTTPS) because of the `getUserMedia` security policy.
- No package manager or build toolchain is required.

## Installation

```bash
# Clone the repository
git clone https://github.com/comeddy/gyeol-media-art.git
cd gyeol-media-art

# Serve the static files over HTTP (any static server works)
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a modern browser.

## Usage

1. From the atrium, pick one of the 8 wings, then choose a work to open the viewer.
2. Interact with the active work:
   - Touch or drag on the canvas.
   - Toggle sound with the `∿` button, then blow into the microphone.
   - Tilt your device (gyroscope) on mobile.
   - Use hand gestures on works that support MediaPipe hand tracking.
3. Navigate inside the viewer with prev `‹` / next `›`, read work info with `ⓘ`, and close with `✕`.

The 8 wings:

| # | Wing | Theme | Works |
|---|------|-------|-------|
| 1 | 묵향 Mukhyang | Ink wash | Ilpil, Mukjuk, Ujung, Balmuk |
| 2 | 오방 Obang | Five cardinal colors | Dancheong, Obangjin, Saekdong, Nakhwa |
| 3 | 훈민 Hunmin | Hangul script | Jamo, Gang, Jeongeum, Hwalja |
| 4 | 여백 Yeobaek | Negative space | Dalhangari, Bingnyeol, Boreumdal, Sum |
| 5 | 조각보 Jogakbo | Patchwork craft | Jogakbo, Homjil, Nobang, Maedeup |
| 6 | 풍류 Pungnyu | Music | Samulnori, Oeum, Cheong, Sanjo |
| 7 | 민화 Minhwa | Folk painting | Ilwol, Hojakdo, Sipjangsaeng, Eobyeon |
| 8 | 세시 Sesi | Seasons and time | Seumulnet, Jagyeongnu, Dalgeurimja, Sibiji |

## Project Structure

```
gyeol-media-art/
  index.html        # Atrium (exhibition home) entry point
  making-of.html    # Making-of page
  css/              # Stylesheet
  js/
    main.js         # Hash router, viewer, work loader, RAF loop
    data.js         # Wing and work metadata
    selftest.js     # Full smoke-test harness
    core/           # Shared engines (audio, canvas, hands, sensors)
    works/          # 32 work modules (w1-* through w8-*)
  docs/             # Design and implementation documents
  deploy.sh         # S3 + CloudFront deploy script
```

Each work module has a uniform contract: `default export = { init(ctx), frame(t, dt), pointer(e)?, resize(w, h)?, dispose()? }`, where `ctx = { canvas, width, height, audio, sensors, hands }`.

## Testing

The project ships a browser-based smoke-test harness instead of a unit-test runner. Serve the files, then append `?selftest` to the URL:

```bash
# Serve locally first
python3 -m http.server 8000

# Then open in a browser:
# http://localhost:8000/?selftest          Full smoke test (all 32 works)
# http://localhost:8000/?selftest&wing=3    Only wing 3
```

Results are exposed on `window.__SMOKE__` as `{ done, results: [{ id, ok, errors, uniform, msPerFrame }] }`. A work passes when it raises no exceptions, produces a non-uniform render, and stays under 16 ms per frame.

## Deployment

The live site is hosted on Amazon S3 (private, OAC-only) behind CloudFront. Redeploy with the script at the repository root:

```bash
# Sync index.html, making-of.html, css/, and js/ to S3, then invalidate CloudFront
./deploy.sh
```

`deploy.sh` uploads only the runtime assets — `docs/` and local tooling directories are never pushed to S3.

## Contributing

1. Fork the repository
2. Create your branch (`git checkout -b feat/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) style (`feat:`, `fix:`, `docs:`, `chore:`).

## License

All Rights Reserved. © 2026 결 · GYEOL — Generative Korean Aesthetics.

This project does not grant a license for reuse, redistribution, or modification. Contact the maintainer for permission.

## Contact

- Maintainer: [comeddy](https://github.com/comeddy)
- Issues: https://github.com/comeddy/gyeol-media-art/issues
- Email: comeddy@gmail.com

---

<a id="korean"></a>

# 한국어

## 개요

`결`은 자연이 스스로 새기는 무늬와 질감을 뜻하는 우리말입니다 — 물결, 나뭇결, 숨결, 비단결. **결 · GYEOL**은 그 개념을 제너러티브 아트로 다시 빚은 전시입니다. 여덟 개의 주제별 전시관에 걸쳐 32개의 캔버스 작품이 놓여 있으며, 각 작품은 터치·소리·기울기·손동작에 반응합니다.

전시 전체가 빌드가 필요 없는 정적 웹 앱입니다 — 프레임워크도, 번들러도, 설치할 의존성도 없습니다. 모든 센서와 무거운 기능은 우아하게 저하되어, 마이크나 웹캠을 기대하는 작품도 해당 장치가 없을 때 pointer 폴백으로 동작합니다.

라이브 데모: **https://gyeol.zerojin.art/**

## 주요 기능

- **8관 32작품 제너러티브 아트** — 각 관은 한국적 미감의 한 갈래(수묵, 색채, 문자, 여백, 규방공예, 음악, 민화, 세시)를 탐구합니다.
- **멀티모달 인터랙션** — 작품은 pointer/터치, 마이크 레벨(마이크에 불기), 기기 기울기(자이로), MediaPipe 손 인식에 반응합니다.
- **설계에 내장된 우아한 폴백** — 센서와 손 인식기는 예외를 던지지 않습니다. 권한 거부·하드웨어 부재·미지원 브라우저에서는 pointer 입력으로 폴백합니다. 모듈은 import 시점 부작용이 전혀 없어 Node에서 불러도 안전합니다.
- **오음계 Web Audio 엔진** — 공유 오디오 싱글턴이 평조(平調) 오음계 사운드를 생성하며, 작품마다 맞춰 조율됩니다.
- **빌드리스 아키텍처** — 브라우저가 직접 로드하는 순수 ES 모듈. 트랜스파일러도, 번들러도, `node_modules`도 없습니다.
- **전수 스모크 테스트 하네스** — `?selftest` 모드가 모든 작품을 마운트하고 60프레임을 동기로 구동해 렌더와 성능을 검증합니다(배포 전 32/32 통과 필수).

## 사전 요구 사항

- Canvas 2D, WebGL, Web Audio API, ES 모듈을 지원하는 모던 브라우저.
- 개발용 로컬 정적 HTTP 서버 — ES 모듈은 `file://` 프로토콜에서 CORS로 차단됩니다.
- 마이크·손 인식 기능은 `getUserMedia` 보안 정책상 보안 컨텍스트(`localhost` 또는 HTTPS)를 요구합니다.
- 패키지 매니저나 빌드 툴체인은 필요하지 않습니다.

## 설치 방법

```bash
# 저장소 클론
git clone https://github.com/comeddy/gyeol-media-art.git
cd gyeol-media-art

# 정적 파일을 HTTP로 서빙 (어떤 정적 서버든 가능)
python3 -m http.server 8000
```

이후 모던 브라우저에서 `http://localhost:8000`에 접속합니다.

## 사용법

1. 아트리움에서 8개 관 중 하나를 고른 뒤, 작품을 선택해 뷰어를 엽니다.
2. 활성 작품과 상호작용합니다:
   - 캔버스를 터치하거나 드래그합니다.
   - `∿` 버튼으로 사운드를 켠 뒤 마이크에 불어 봅니다.
   - 모바일에서는 기기를 기울입니다(자이로).
   - MediaPipe 손 인식을 지원하는 작품에서는 손동작을 사용합니다.
3. 뷰어 안에서 이전 `‹` / 다음 `›`으로 이동하고, `ⓘ`로 작품 정보를 보며, `✕`로 닫습니다.

8개 전시관:

| # | 전시관 | 테마 | 작품 |
|---|------|-------|-------|
| 1 | 묵향 Mukhyang | 수묵 | 일필·묵죽·우중산수·발묵 |
| 2 | 오방 Obang | 오방색 | 단청·오방진·색동·낙화 |
| 3 | 훈민 Hunmin | 한글 | 자모·글자의 강·정음·활자 |
| 4 | 여백 Yeobaek | 여백미 | 달항아리·빙렬·보름달·숨 |
| 5 | 조각보 Jogakbo | 규방공예 | 조각보·홈질·노방·매듭 |
| 6 | 풍류 Pungnyu | 음악 | 사물놀이·오음·청·산조 |
| 7 | 민화 Minhwa | 회화 | 일월오봉도·호작도·십장생·어변성룡 |
| 8 | 세시 Sesi | 세시·시간 | 스물넷·자격루·달그림자·십이지 |

## 프로젝트 구조

```
gyeol-media-art/
  index.html        # 아트리움(전시 홈) 진입점
  making-of.html    # 제작 과정 페이지
  css/              # 스타일시트
  js/
    main.js         # 해시 라우터·뷰어·작품 로더·RAF 루프
    data.js         # 관·작품 메타데이터
    selftest.js     # 전수 스모크 하네스
    core/           # 공용 엔진 (audio·canvas·hands·sensors)
    works/          # 32개 작품 모듈 (w1-* ~ w8-*)
  docs/             # 설계·구현 문서
  deploy.sh         # S3 + CloudFront 배포 스크립트
```

각 작품 모듈은 동일한 계약을 따릅니다: `default export = { init(ctx), frame(t, dt), pointer(e)?, resize(w, h)?, dispose()? }`, 여기서 `ctx = { canvas, width, height, audio, sensors, hands }`.

## 테스트

이 프로젝트는 단위 테스트 러너 대신 브라우저 기반 스모크 테스트 하네스를 제공합니다. 파일을 서빙한 뒤 URL에 `?selftest`를 붙입니다:

```bash
# 먼저 로컬 서버 실행
python3 -m http.server 8000

# 이후 브라우저에서 접속:
# http://localhost:8000/?selftest          전수 스모크 테스트 (32작품 전체)
# http://localhost:8000/?selftest&wing=3    3관만
```

결과는 `window.__SMOKE__`에 `{ done, results: [{ id, ok, errors, uniform, msPerFrame }] }` 형태로 노출됩니다. 작품은 예외가 없고, 균일하지 않은 렌더를 만들며, 프레임당 16ms 미만일 때 통과합니다.

## 배포

라이브 사이트는 Amazon S3(비공개, OAC 전용)에 호스팅되고 CloudFront 뒤에 놓여 있습니다. 저장소 루트의 스크립트로 재배포합니다:

```bash
# index.html·making-of.html·css/·js/를 S3에 sync한 뒤 CloudFront 무효화
./deploy.sh
```

`deploy.sh`는 런타임 자산만 업로드합니다 — `docs/`와 로컬 도구 디렉터리는 S3에 올리지 않습니다.

## 기여 방법

1. 저장소를 Fork 합니다
2. 브랜치를 생성합니다 (`git checkout -b feat/amazing-feature`)
3. 변경 사항을 커밋합니다 (`git commit -m 'feat: add amazing feature'`)
4. 브랜치에 Push 합니다 (`git push origin feat/amazing-feature`)
5. Pull Request를 엽니다

커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/) 스타일(`feat:`, `fix:`, `docs:`, `chore:`)을 따릅니다.

## 라이선스

All Rights Reserved. © 2026 결 · GYEOL — Generative Korean Aesthetics.

이 프로젝트는 재사용·재배포·수정에 대한 라이선스를 부여하지 않습니다. 사용 허가가 필요하면 관리자에게 문의해 주세요.

## 연락처

- 관리자: [comeddy](https://github.com/comeddy)
- 이슈: https://github.com/comeddy/gyeol-media-art/issues
- 이메일: comeddy@gmail.com
