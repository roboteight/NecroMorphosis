export interface FractalSettings {
  radius: number;
  ribSpacing: number;
  ribThickness: number;
  spine: number;
  spineCurve: number;
  spineHeight: number;
  cables: number;
  cableThickness: number;
  cableWeave: number;
  twist: number;
  breathing: number;
  fractalDepth: number;
  detail: number;
  fog: number;
  lamp: number;
  pulse: number;
  pulseHue: number;
  tint: number;
  speed: number;
}

export interface SliderDef {
  key: keyof FractalSettings;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const SLIDERS: SliderDef[] = [
  { key: 'radius', label: 'Tunnel radius', min: 0.9, max: 3.2, step: 0.05 },
  { key: 'ribSpacing', label: 'Rib spacing', min: 0.35, max: 2.6, step: 0.05 },
  { key: 'ribThickness', label: 'Rib thickness', min: 0.4, max: 2.0, step: 0.05 },
  { key: 'spine', label: 'Spine size', min: 0, max: 2, step: 0.05 },
  { key: 'spineCurve', label: 'Spine curve', min: 0, max: 1.2, step: 0.02 },
  { key: 'spineHeight', label: 'Spine height', min: 0, max: 1, step: 0.02 },
  { key: 'cables', label: 'Cable count', min: 0, max: 32, step: 1 },
  { key: 'cableThickness', label: 'Cable thickness', min: 0.4, max: 3, step: 0.05 },
  { key: 'cableWeave', label: 'Cable weave', min: 0, max: 2, step: 0.05 },
  { key: 'twist', label: 'Twist', min: -0.6, max: 0.6, step: 0.01 },
  { key: 'breathing', label: 'Breathing', min: 0, max: 0.4, step: 0.01 },
  { key: 'fractalDepth', label: 'Fractal depth', min: 0, max: 4, step: 1 },
  { key: 'detail', label: 'Surface detail', min: 0, max: 2.5, step: 0.05 },
  { key: 'fog', label: 'Fog', min: 0.02, max: 0.3, step: 0.01 },
  { key: 'lamp', label: 'Lamp brightness', min: 0.3, max: 3, step: 0.05 },
  { key: 'pulse', label: 'Pulse glow', min: 0, max: 2, step: 0.05 },
  { key: 'pulseHue', label: 'Pulse hue', min: 0, max: 1, step: 0.01 },
  { key: 'tint', label: 'Palette (green → sepia → blue)', min: 0, max: 1, step: 0.01 },
  { key: 'speed', label: 'Fly speed', min: 0, max: 2, step: 0.05 },
];

export interface Preset {
  name: string;
  note: string;
  settings: FractalSettings;
}

// Loose interpretations of recurring Giger motifs, not reproductions of specific paintings.
export const PRESETS: Preset[] = [
  {
    name: 'Passage Temple',
    note: 'Vast ribbed nave, bone-pale, a heavy spine underfoot',
    settings: { radius: 2.7, ribSpacing: 2.3, ribThickness: 1.4, spine: 1.5, spineCurve: 0.25, spineHeight: 0.0, cables: 6, cableThickness: 0.9, cableWeave: 0.3,
      twist: 0, breathing: 0.04, fractalDepth: 2, detail: 0.5, fog: 0.05, lamp: 1.6, pulse: 0.3,
      pulseHue: 0.1, tint: 0.5, speed: 0.5 },
  },
  {
    name: 'Necronom IV',
    note: 'Tight, dense ribcage corridor lined with hoses',
    settings: { radius: 1.45, ribSpacing: 0.6, ribThickness: 0.9, spine: 1.0, spineCurve: 0.2, spineHeight: 0.1, cables: 14, cableThickness: 1.0, cableWeave: 0.5,
      twist: 0, breathing: 0.1, fractalDepth: 3, detail: 1.0, fog: 0.11, lamp: 1.2, pulse: 0.9,
      pulseHue: 0.4, tint: 0.05, speed: 0.7 },
  },
  {
    name: 'Birth Machine',
    note: 'Narrow spiralling conduit of fat cold pipes, no spine',
    settings: { radius: 1.15, ribSpacing: 0.95, ribThickness: 0.7, spine: 0, spineCurve: 0.0, spineHeight: 0.0, cables: 20, cableThickness: 1.9, cableWeave: 1.4,
      twist: 0.4, breathing: 0.15, fractalDepth: 2, detail: 0.7, fog: 0.13, lamp: 1.1, pulse: 1.3,
      pulseHue: 0.55, tint: 0.95, speed: 0.6 },
  },
  {
    name: 'Space Jockey',
    note: 'Derelict hall: massive ribs, huge pipes, deep pitting',
    settings: { radius: 2.1, ribSpacing: 1.3, ribThickness: 1.9, spine: 0.5, spineCurve: 0.5, spineHeight: 0.0, cables: 4, cableThickness: 3.0, cableWeave: 0.2,
      twist: -0.1, breathing: 0.22, fractalDepth: 4, detail: 1.8, fog: 0.08, lamp: 1.9, pulse: 0.15,
      pulseHue: 0.08, tint: 0.3, speed: 0.4 },
  },
  {
    name: 'Biomechanoid Hive',
    note: 'Pulsing, writhing, ultra-dense and over-detailed',
    settings: { radius: 1.8, ribSpacing: 0.4, ribThickness: 0.6, spine: 0.7, spineCurve: 0.6, spineHeight: 0.2, cables: 28, cableThickness: 0.6, cableWeave: 1.0,
      twist: 0.18, breathing: 0.32, fractalDepth: 4, detail: 2.2, fog: 0.16, lamp: 1.4, pulse: 1.6,
      pulseHue: 0.85, tint: 0.2, speed: 0.9 },
  },
  {
    name: 'Vertebrae Gallery',
    note: 'A bare spine snaking mid-air through a weaving cage of hoses',
    settings: { radius: 1.7, ribSpacing: 0.8, ribThickness: 0.8, spine: 1.4, spineCurve: 0.5, spineHeight: 0.12,
      cables: 12, cableThickness: 1.1, cableWeave: 1.3, twist: 0.05, breathing: 0.08, fractalDepth: 3,
      detail: 1.1, fog: 0.09, lamp: 1.8, pulse: 0.8, pulseHue: 0.3, tint: 0.35, speed: 0.5 },
  },
];
