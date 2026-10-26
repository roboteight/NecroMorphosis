// Standalone full-canvas renderer for the screen saver: no UI, no input. The native host injects
// window.NM_CONFIG before this script runs.
import { FRAGMENT_SHADER, VERTEX_SHADER } from '../../src/app/fractal/fractal.shader';
import { FractalSettings } from '../../src/app/fractal/settings';

interface SaverConfig {
  settings: FractalSettings;
  zoom: number;
  quality: 'low' | 'med' | 'high';
  /** Set when cycling: every preset's settings, the index to start on, and seconds per preset. */
  cycle?: { presets: FractalSettings[]; start: number; seconds: number };
}

// Reports to the native host, which writes to the system log (subsystem: NecroMorphosis).
const report = (msg: string) => {
  try {
    (window as any).webkit.messageHandlers.nm.postMessage(msg);
  } catch {
    /* running outside the saver host */
  }
};
window.addEventListener('error', (e) => report(`error: ${e.message} @${e.lineno}`));
report('script start');

const config = (window as unknown as { NM_CONFIG: SaverConfig }).NM_CONFIG;
const c: FractalSettings = { ...config.settings };
const target: FractalSettings = { ...config.settings };

const canvas = document.getElementById('glcanvas') as HTMLCanvasElement;
const gl = canvas.getContext('webgl')!;
report(`webgl: ${gl ? gl.getParameter(gl.VERSION) : 'UNAVAILABLE'} size ${window.innerWidth}x${window.innerHeight}`);

function compile(type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) report(`shader: ${gl.getShaderInfoLog(shader)}`);
  return shader;
}

const program = gl.createProgram()!;
gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
gl.linkProgram(program);
report(`link: ${gl.getProgramParameter(program, gl.LINK_STATUS)}`);
gl.useProgram(program);

gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(program, 'position');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const u = (name: string) => gl.getUniformLocation(program, name);
const uniforms = {
  res: u('u_resolution'), mouse: u('u_mouse'), time: u('u_time'), zoom: u('u_zoom'), travel: u('u_travel'),
  fold: u('u_fold'), tint: u('u_tint'), hue: u('u_hue'), shape: u('u_shape'), form: u('u_form'),
  look: u('u_look'), extra: u('u_extra'),
};

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * { low: 0.4, med: 0.7, high: 1 }[config.quality];
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(uniforms.res, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

const start = performance.now();
let lastNow = 0;
let frameCount = 0;
let travel = 0;
const MORPH_SECONDS = 6;
if (config.cycle) {
  const { presets, seconds } = config.cycle;
  let index = config.cycle.start;
  setInterval(() => {
    index = (index + 1) % presets.length;
    Object.assign(target, presets[index]);
  }, seconds * 1000);
}

function render(now: number): void {
  const dt = lastNow ? Math.min((now - lastNow) / 1000, 0.1) : 0;
  lastNow = now;
  // Ease every setting toward the current preset so cycling morphs instead of snapping.
  const k = 1 - Math.exp(-dt / (MORPH_SECONDS / 4));
  for (const key of Object.keys(c) as (keyof FractalSettings)[]) {
    // fractalDepth is an integer fold count, so it steps rather than blends
    c[key] = key === 'fractalDepth' ? target[key] : c[key] + (target[key] - c[key]) * k;
  }
  travel += dt * c.speed * 1.5;
  gl.uniform1f(uniforms.time, (now - start) * 0.001);
  gl.uniform2f(uniforms.mouse, 0, 0);
  gl.uniform1f(uniforms.travel, travel);
  gl.uniform1f(uniforms.fold, c.fractalDepth);
  gl.uniform1f(uniforms.tint, c.tint);
  gl.uniform1f(uniforms.hue, c.pulseHue);
  gl.uniform4f(uniforms.shape, c.radius, c.ribSpacing, c.spine, c.cables);
  gl.uniform4f(uniforms.form, c.ribThickness, c.cableThickness, c.twist, c.breathing);
  gl.uniform4f(uniforms.look, c.detail, c.fog, c.lamp, c.pulse);
  gl.uniform4f(uniforms.extra, c.spineCurve, c.spineHeight, c.cableWeave, 0);
  gl.uniform1f(uniforms.zoom, config.zoom);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  frameCount++;
  requestAnimationFrame(render);

setInterval(() => report(`frames=${frameCount} visibility=${document.visibilityState} glerr=${gl.getError()}`), 3000);
}
requestAnimationFrame(render);
