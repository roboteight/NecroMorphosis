// Dumps slider and preset definitions so the native settings sheet is generated from settings.ts.
import { writeFileSync } from 'node:fs';
import { PRESETS, SLIDERS } from '../../src/app/fractal/settings';

writeFileSync(process.argv[2], JSON.stringify({ sliders: SLIDERS, presets: PRESETS, defaultPreset: PRESETS.length - 1 }, null, 2));
