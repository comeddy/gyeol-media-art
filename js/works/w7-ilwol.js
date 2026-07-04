// 결 · GYEOL — 7관 민화 · 일월오봉도(日月五峰圖) Sun, Moon and Five Peaks
// 왕의 병풍. 다섯 봉우리·백달(좌)·적일(우)·파도·소나무를 전면 쿼드 프래그먼트 셰이더로 그린다.
// uHour = 실제 시각(4단계 하늘색) · uTime = 파도/글로우 맥동 · 해·달은 포인터로 최대 8% 끌림.
// WebGL 실패 시 동일 구도의 Canvas2D 간이판으로 폴백(계약 규칙): 정적 구도 + 파도만 애니.
import { fitCanvas, clamp, TAU } from '../core/canvas.js';

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// vUv 대신 gl_FragCoord/해상도로 uv 산출 — uResolution 유니폼으로 넘긴다.
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uHour;
uniform float uAspect;
uniform vec2 uSun;
uniform vec2 uMoon;

void skyPalette(float h, out vec3 top, out vec3 bot){
  vec3 nT=vec3(0.05,0.05,0.07), nB=vec3(0.10,0.13,0.20);
  vec3 dT=vec3(0.17,0.24,0.34), dB=vec3(0.80,0.47,0.26);
  vec3 yT=vec3(0.49,0.65,0.79), yB=vec3(0.93,0.90,0.84);
  vec3 kT=vec3(0.24,0.16,0.30), kB=vec3(0.76,0.23,0.13);
  if(h<6.0){ float t=clamp((h-2.0)/4.0,0.0,1.0); top=mix(nT,dT,t); bot=mix(nB,dB,t); }
  else if(h<13.0){ float t=clamp((h-6.5)/6.5,0.0,1.0); top=mix(dT,yT,t); bot=mix(dB,yB,t); }
  else if(h<18.5){ float t=clamp((h-13.0)/5.5,0.0,1.0); top=mix(yT,kT,t); bot=mix(yB,kB,t); }
  else { float t=clamp((h-18.5)/5.5,0.0,1.0); top=mix(kT,nT,t); bot=mix(kB,nB,t); }
}

float ridge(float x){
  float h=0.15; float d;
  d=(x-0.50)/0.11;  h=max(h,0.37*exp(-d*d));
  d=(x-0.29)/0.10;  h=max(h,0.30*exp(-d*d));
  d=(x-0.71)/0.10;  h=max(h,0.30*exp(-d*d));
  d=(x-0.11)/0.085; h=max(h,0.22*exp(-d*d));
  d=(x-0.89)/0.085; h=max(h,0.22*exp(-d*d));
  return h;
}

float tree(vec2 p, float cx){
  float base=0.14; float m=0.0;
  if(p.y>base-0.005 && p.y<base+0.05 && abs(p.x-cx)<0.006) m=1.0;
  for(int i=0;i<3;i++){
    float fi=float(i);
    float by=base+0.02+fi*0.055;
    float ty=by+0.085;
    float hw=0.055-fi*0.012;
    if(p.y>by && p.y<ty){ float t=(p.y-by)/(ty-by); if(abs(p.x-cx)<hw*(1.0-t)) m=1.0; }
  }
  return m;
}

float diskN(vec2 uv, vec2 c, float r){ return length((uv-c)*vec2(uAspect,1.0))/r; }

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 top, bot; skyPalette(uHour, top, bot);
  vec3 col = mix(bot, top, uv.y);

  float pulse = 0.5 + 0.5*sin(uTime*1.2);

  // 백달(좌) — 흰 원반 + 서늘한 글로우
  float md = diskN(uv, uMoon, 0.052);
  col += vec3(0.80,0.82,0.90)*0.35*exp(-md*2.2)*(0.7+0.3*pulse);
  col = mix(col, vec3(0.94,0.93,0.87), 1.0 - smoothstep(0.85, 1.0, md));

  // 적일(우) — 붉은 원반 + 따뜻한 글로우
  float sd = diskN(uv, uSun, 0.052);
  col += vec3(0.85,0.35,0.15)*0.45*exp(-sd*2.0)*(0.7+0.3*pulse);
  col = mix(col, vec3(0.76,0.23,0.13), 1.0 - smoothstep(0.85, 1.0, sd));

  // 다섯 봉우리 — 청록→감청 세로 그라데이션 + 능선 결
  float mh = 0.14 + ridge(uv.x);
  if(uv.y < mh){
    float t = clamp((uv.y-0.14)/(mh-0.14+0.0001), 0.0, 1.0);
    vec3 mcol = mix(vec3(0.118,0.302,0.271), vec3(0.08,0.15,0.27), t);
    mcol += 0.04*sin(uv.x*44.0);
    col = mcol;
  }

  // 소나무 두 그루(좌우) — 먹빛 실루엣
  float pm = max(tree(uv,0.20), tree(uv,0.80));
  col = mix(col, vec3(0.04,0.09,0.08), 0.92*step(0.5,pm));

  // 하단 파도 — 중첩 사인 물결 밴드 + 흰 이랑
  if(uv.y < 0.14){
    float y = uv.y;
    vec3 water = mix(vec3(0.09,0.16,0.28), vec3(0.16,0.34,0.42), y/0.14);
    float crest = (sin(uv.x*26.0+uTime*0.9)*0.5+0.5) * (sin(uv.x*15.0-uTime*0.6)*0.5+0.5);
    float line = 1.0 - smoothstep(0.0, 0.02, abs(fract(y*7.0+crest*0.4)-0.5)-0.02);
    water += vec3(0.85,0.88,0.85)*line*0.5;
    col = water;
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

export default (() => {
  let cv, gl, g2, mode = 'webgl';
  let prog, buf, loc = {};
  let W = 0, H = 0, dpr = 1;
  let hour = 12, hourCheck = -999;
  let ptr = null;                    // { x, y } uv 좌표(0..1, y 위로) or null
  const moonBase = [0.20, 0.80], sunBase = [0.80, 0.80];

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const msg = gl.getShaderInfoLog(s); gl.deleteShader(s);
      throw new Error('shader: ' + msg);
    }
    return s;
  }

  function initGL() {
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
    gl.deleteShader(vs); gl.deleteShader(fs);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const ap = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(ap);
    gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(prog);
    for (const n of ['uRes', 'uTime', 'uHour', 'uAspect', 'uSun', 'uMoon']) loc[n] = gl.getUniformLocation(prog, n);
  }

  function setup() {
    dpr = fitCanvas(cv, W, H);
    if (mode === 'webgl') gl.viewport(0, 0, cv.width, cv.height);
    else g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 해·달 위치 — 포인터 방향으로 각 축 최대 0.08(8%) 끌림.
  function bodies() {
    let mx = moonBase[0], my = moonBase[1], sx = sunBase[0], sy = sunBase[1];
    if (ptr) {
      mx += clamp(ptr.x - moonBase[0], -0.08, 0.08);
      my += clamp(ptr.y - moonBase[1], -0.08, 0.08);
      sx += clamp(ptr.x - sunBase[0], -0.08, 0.08);
      sy += clamp(ptr.y - sunBase[1], -0.08, 0.08);
    }
    return [mx, my, sx, sy];
  }

  function drawFrame(t) {
    const [mx, my, sx, sy] = bodies();
    if (mode === 'webgl') {
      gl.uniform2f(loc.uRes, cv.width, cv.height);
      gl.uniform1f(loc.uTime, t);
      gl.uniform1f(loc.uHour, hour);
      gl.uniform1f(loc.uAspect, W / Math.max(1, H));
      gl.uniform2f(loc.uMoon, mx, my);
      gl.uniform2f(loc.uSun, sx, sy);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      render2d(t, mx, my, sx, sy);
    }
  }

  // ── Canvas2D 폴백 — 셰이더와 같은 색·구도(정적 + 파도만 애니) ──────────
  const MIX = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function skyPal(h) {
    const nT = [13, 13, 18], nB = [26, 33, 51], Dt = [43, 61, 87], Db = [204, 120, 66];
    const Yt = [125, 166, 201], Yb = [237, 230, 214], Kt = [61, 41, 77], Kb = [194, 59, 33];
    if (h < 6) { const t = clamp((h - 2) / 4, 0, 1); return { top: MIX(nT, Dt, t), bot: MIX(nB, Db, t) }; }
    if (h < 13) { const t = clamp((h - 6.5) / 6.5, 0, 1); return { top: MIX(Dt, Yt, t), bot: MIX(Db, Yb, t) }; }
    if (h < 18.5) { const t = clamp((h - 13) / 5.5, 0, 1); return { top: MIX(Yt, Kt, t), bot: MIX(Yb, Kb, t) }; }
    const t = clamp((h - 18.5) / 5.5, 0, 1); return { top: MIX(Kt, nT, t), bot: MIX(Kb, nB, t) };
  }
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  function ridgeJS(x) {
    let h = 0.15, d;
    d = (x - 0.5) / 0.11; h = Math.max(h, 0.37 * Math.exp(-d * d));
    d = (x - 0.29) / 0.1; h = Math.max(h, 0.30 * Math.exp(-d * d));
    d = (x - 0.71) / 0.1; h = Math.max(h, 0.30 * Math.exp(-d * d));
    d = (x - 0.11) / 0.085; h = Math.max(h, 0.22 * Math.exp(-d * d));
    d = (x - 0.89) / 0.085; h = Math.max(h, 0.22 * Math.exp(-d * d));
    return h;
  }
  function glow(cx, cy, c, inten) {
    const r = Math.min(W, H) * 0.13;
    const rad = g2.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
    rad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${inten})`);
    rad.addColorStop(0.18, `rgba(${c[0]},${c[1]},${c[2]},${inten})`);
    rad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g2.fillStyle = rad; g2.beginPath(); g2.arc(cx, cy, r * 2.5, 0, TAU); g2.fill();
    g2.fillStyle = rgb(c); g2.beginPath(); g2.arc(cx, cy, r * 0.42, 0, TAU); g2.fill();
  }
  function pine(x, baseY) {
    g2.fillStyle = 'rgb(10,23,20)';
    g2.fillRect(x - 3, baseY - 40, 6, 44);
    for (let i = 0; i < 3; i++) {
      const by = baseY - 16 - i * 44, hh = 70, hw = (0.055 - i * 0.012) * W;
      g2.beginPath(); g2.moveTo(x, by - hh); g2.lineTo(x - hw, by); g2.lineTo(x + hw, by); g2.closePath(); g2.fill();
    }
  }
  function render2d(t, mx, my, sx, sy) {
    const { top, bot } = skyPal(hour);
    const grd = g2.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, rgb(top)); grd.addColorStop(1, rgb(bot));
    g2.fillStyle = grd; g2.fillRect(0, 0, W, H);
    glow(mx * W, (1 - my) * H, [237, 235, 219], 0.9);
    glow(sx * W, (1 - sy) * H, [217, 90, 38], 1.0);
    const wl = (1 - 0.14) * H;
    const mg = g2.createLinearGradient(0, 0.4 * H, 0, wl);
    mg.addColorStop(0, 'rgb(20,38,69)'); mg.addColorStop(1, 'rgb(30,77,69)');
    g2.fillStyle = mg; g2.beginPath(); g2.moveTo(0, H);
    for (let px = 0; px <= W; px += 4) g2.lineTo(px, (1 - (0.14 + ridgeJS(px / W))) * H);
    g2.lineTo(W, H); g2.closePath(); g2.fill();
    pine(0.20 * W, wl); pine(0.80 * W, wl);
    const wg = g2.createLinearGradient(0, wl, 0, H);
    wg.addColorStop(0, 'rgb(41,87,107)'); wg.addColorStop(1, 'rgb(23,41,72)');
    g2.fillStyle = wg; g2.fillRect(0, wl, W, H - wl);
    g2.strokeStyle = 'rgba(217,222,217,0.5)'; g2.lineWidth = 1.5;
    for (let row = 0; row < 5; row++) {
      const yb = wl + (row + 0.5) / 5 * (H - wl);
      g2.beginPath();
      for (let px = 0; px <= W; px += 6) {
        const w = Math.sin(px / W * 26 + t * 0.9) * 0.5 + 0.5;
        const y = yb + Math.sin(px * 0.05 + row + t) * 4 * w;
        px === 0 ? g2.moveTo(px, y) : g2.lineTo(px, y);
      }
      g2.stroke();
    }
  }

  return {
    init(ctx) {
      cv = ctx.canvas; W = ctx.width; H = ctx.height;
      const opt = { preserveDrawingBuffer: true, antialias: true };
      gl = cv.getContext('webgl', opt) || cv.getContext('experimental-webgl', opt);
      if (gl) {
        mode = 'webgl';
        // 셰이더 compile()/link 실패(예: highp 미지원 GPU) 시 오류 카드 대신 2D 폴백.
        try {
          initGL();
        } catch {
          // 획득한 GL 자원 정리 후 getContext-null 경로와 동일하게 Canvas2D로 전환.
          try { if (prog) gl.deleteProgram(prog); if (buf) gl.deleteBuffer(buf); } catch { /* noop */ }
          try { const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch { /* noop */ }
          gl = null; prog = null; buf = null; loc = {};
          mode = '2d'; g2 = cv.getContext('2d');
          // webgl에 묶인 캔버스는 getContext('2d')가 null을 반환(HTML 스펙) → 같은 DOM 위치에
          // 새 캔버스를 끼워 2D 컨텍스트를 얻는다. 폴백을 실제로 동작시키기 위한 필수 단계.
          if (!g2 && cv.parentNode) {
            const fresh = document.createElement('canvas');
            cv.replaceWith(fresh); cv = fresh; g2 = cv.getContext('2d');
          }
        }
      } else { mode = '2d'; g2 = cv.getContext('2d'); }
      hour = new Date().getHours();
      setup();
      drawFrame(0);                  // init 즉시 배경/구도 렌더
    },
    frame(t) {
      if (t - hourCheck > 5) { hourCheck = t; hour = new Date().getHours(); }
      drawFrame(t);
    },
    pointer(e) {
      if (e.type === 'up') { ptr = null; return; }
      ptr = { x: clamp(e.x / W, 0, 1), y: clamp(1 - e.y / H, 0, 1) };
    },
    resize(w, h) { W = w; H = h; setup(); },
    dispose() {
      if (gl) {
        try { if (prog) gl.deleteProgram(prog); if (buf) gl.deleteBuffer(buf); } catch { /* noop */ }
        const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
      }
      gl = null; g2 = null; prog = null; buf = null; loc = {}; ptr = null; cv = null;
    },
  };
})();
