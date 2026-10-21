import {
  ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy,
  afterNextRender, inject, signal, viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Drone } from './drone';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './fractal.shader';
import { FractalSettings, PRESETS, SLIDERS } from './settings';

const ZOOM_MIN = 1.2;
const ZOOM_MAX = 8;
const ZOOM_DEFAULT = 3.2;
const ZOOM_STEP = 0.4;

@Component({
  selector: 'app-fractal',
  imports: [MatExpansionModule, MatSelectModule, MatButtonModule, MatButtonToggleModule, MatCardModule, MatIconModule, MatSliderModule, MatTooltipModule],
  templateUrl: './fractal.component.html',
  styleUrl: './fractal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FractalComponent implements OnDestroy {
  readonly zoomMin = ZOOM_MIN;
  readonly zoomMax = ZOOM_MAX;

  readonly presets = PRESETS;
  readonly sliders = SLIDERS;
  readonly presetIndex = signal(PRESETS.length - 1);
  readonly settings = signal<FractalSettings>({ ...PRESETS[PRESETS.length - 1].settings });
  readonly quality = signal<'low' | 'med' | 'high'>('med');
  readonly panelOpen = signal(true);
  readonly fullscreen = signal(false);
  readonly zoom = signal(ZOOM_DEFAULT);
  readonly fps = signal(0);
  readonly audioOn = signal(false);

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('glcanvas');
  private readonly zone = inject(NgZone);
  private readonly snackBar = inject(MatSnackBar);
  private readonly drone = new Drone();

  private gl!: WebGLRenderingContext;
  private uniforms!: Record<'res' | 'mouse' | 'time' | 'zoom' | 'travel' | 'fold' | 'tint' | 'hue' | 'shape' | 'form' | 'look' | 'extra', WebGLUniformLocation | null>;
  private raf = 0;
  private dragging = false;
  private last = [0, 0];
  private target = [0, 0];
  private current = [0, 0];
  private smoothZoom = ZOOM_DEFAULT;
  private start = performance.now();
  private frames = 0;
  private lastFpsUpdate = this.start;
  private travel = 0;
  private lastNow = 0;
  private captureNext = false;
  private readonly onResize = () => this.resize();
  private readonly onFullscreen = () => this.fullscreen.set(!!document.fullscreenElement);

  constructor() {
    afterNextRender(() => this.initGl());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('fullscreenchange', this.onFullscreen);
    this.drone.destroy();
  }

  setPreset(index: number): void {
    this.presetIndex.set(index);
    this.settings.set({ ...PRESETS[index].settings });
    this.drone.setIntensity(this.settings().speed / 2);
  }

  setSetting(key: keyof FractalSettings, value: number): void {
    this.settings.update((s) => ({ ...s, [key]: value }));
    if (key === 'speed') this.drone.setIntensity(value / 2);
  }

  setQuality(q: 'low' | 'med' | 'high'): void {
    this.quality.set(q);
    this.resize();
  }

  togglePanel(): void {
    this.panelOpen.update((v) => !v);
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }

  screenshot(): void {
    this.captureNext = true;
  }

  zoomIn(): void {
    this.setZoom(this.zoom() - ZOOM_STEP);
  }

  zoomOut(): void {
    this.setZoom(this.zoom() + ZOOM_STEP);
  }

  resetView(): void {
    this.target = [0, 0];
    this.setZoom(ZOOM_DEFAULT);
  }

  setZoom(value: number): void {
    this.zoom.set(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)));
  }

  async toggleAudio(): Promise<void> {
    this.audioOn.set(await this.drone.toggle());
  }

  onPointerDown(e: PointerEvent): void {
    this.dragging = true;
    this.last = [e.clientX, e.clientY];
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.dragging) return;
    this.target[0] += ((e.clientX - this.last[0]) / window.innerWidth) * 1.5;
    this.target[1] += ((e.clientY - this.last[1]) / window.innerHeight) * 1.5;
    this.last = [e.clientX, e.clientY];
  }

  onPointerUp(): void {
    this.dragging = false;
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.setZoom(this.zoom() + Math.sign(e.deltaY) * 0.25);
  }

  private initGl(): void {
    const canvas = this.canvasRef().nativeElement;
    const gl = canvas.getContext('webgl');
    if (!gl) {
      this.snackBar.open('WebGL is not available in this browser.', 'Dismiss');
      return;
    }
    this.gl = gl;

    const program = gl.createProgram()!;
    gl.attachShader(program, this.compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, this.compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {
      res: gl.getUniformLocation(program, 'u_resolution'),
      mouse: gl.getUniformLocation(program, 'u_mouse'),
      time: gl.getUniformLocation(program, 'u_time'),
      zoom: gl.getUniformLocation(program, 'u_zoom'),
      travel: gl.getUniformLocation(program, 'u_travel'),
      fold: gl.getUniformLocation(program, 'u_fold'),
      tint: gl.getUniformLocation(program, 'u_tint'),
      hue: gl.getUniformLocation(program, 'u_hue'),
      shape: gl.getUniformLocation(program, 'u_shape'),
      form: gl.getUniformLocation(program, 'u_form'),
      look: gl.getUniformLocation(program, 'u_look'),
      extra: gl.getUniformLocation(program, 'u_extra'),
    };

    window.addEventListener('resize', this.onResize);
    document.addEventListener('fullscreenchange', this.onFullscreen);
    this.resize();
    // Render loop runs outside the zone; only signals touch the UI.
    this.zone.runOutsideAngular(() => (this.raf = requestAnimationFrame((t) => this.render(t))));
  }

  private compile(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(this.gl.getShaderInfoLog(shader));
      this.zone.run(() => this.snackBar.open('Shader failed to compile (see console).', 'Dismiss'));
    }
    return shader;
  }

  private resize(): void {
    const canvas = this.canvasRef().nativeElement;
    // evenly spaced steps (0.4 / 0.7 / 1.0) of the full-resolution pixel ratio
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * { low: 0.4, med: 0.7, high: 1 }[this.quality()];
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    this.gl.viewport(0, 0, canvas.width, canvas.height);
    this.gl.uniform2f(this.uniforms.res, canvas.width, canvas.height);
  }

  private render(now: number): void {
    const gl = this.gl;
    this.frames++;
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps.set(this.frames);
      this.frames = 0;
      this.lastFpsUpdate = now;
    }

    this.current[0] += (this.target[0] - this.current[0]) * 0.08;
    this.current[1] += (this.target[1] - this.current[1]) * 0.08;
    this.smoothZoom += (this.zoom() - this.smoothZoom) * 0.12;

    gl.uniform1f(this.uniforms.time, (now - this.start) * 0.001);
    gl.uniform2f(this.uniforms.mouse, this.current[0], this.current[1]);
    const c = this.settings();
    const dt = this.lastNow ? Math.min((now - this.lastNow) / 1000, 0.1) : 0;
    this.lastNow = now;
    this.travel += dt * c.speed * 1.5;
    gl.uniform1f(this.uniforms.travel, this.travel);
    gl.uniform1f(this.uniforms.fold, c.fractalDepth);
    gl.uniform1f(this.uniforms.tint, c.tint);
    gl.uniform1f(this.uniforms.hue, c.pulseHue);
    gl.uniform4f(this.uniforms.shape, c.radius, c.ribSpacing, c.spine, c.cables);
    gl.uniform4f(this.uniforms.form, c.ribThickness, c.cableThickness, c.twist, c.breathing);
    gl.uniform4f(this.uniforms.look, c.detail, c.fog, c.lamp, c.pulse);
    gl.uniform4f(this.uniforms.extra, c.spineCurve, c.spineHeight, c.cableWeave, 0);
    gl.uniform1f(this.uniforms.zoom, this.smoothZoom);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (this.captureNext) {
      this.captureNext = false;
      // toBlob must run in the same task as the draw call, since the drawing buffer isn't preserved
      this.canvasRef().nativeElement.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `giger-${PRESETS[this.presetIndex()].name.toLowerCase().replace(/\s+/g, '-')}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }

    this.raf = requestAnimationFrame((t) => this.render(t));
  }
}
