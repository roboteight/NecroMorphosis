# NecroMorphosis

## Giger Biomechanical Fractal

Angular standalone component (`app-fractal`) wrapping a WebGL GLSL raymarcher that renders a folded, ribbed biomechanical lattice. Controls use Angular Material.

## Features
- Drag to rotate, scroll wheel or dedicated zoom −/+ buttons and slider, reset-view button
- Presets: Cathedral, Vertebrae, Hive Matrix
- Optional dark-ambient Web Audio drone

## Run
    npm install   # already done if node_modules exists
    npm start     # then open http://localhost:4200

## macOS screen saver
> **Work in progress.** It renders and the settings sheet works, but performance needs tuning and it relies on a private WebKit setting (see `saver/Sources/NecroMorphosisView.swift`) plus some temporary diagnostic logging in `saver/web/main.ts`.

`saver/` builds `NecroMorphosis.saver`: a native shell hosting the same shader full-screen, with no UI. All settings (preset, every tuning slider, zoom, quality) are configured from System Settings → Screen Saver → Options.

    saver/build.sh                                   # needs Xcode command line tools
    open saver/build/NecroMorphosis.saver            # double-click to install

Slider and preset definitions are generated from `src/app/fractal/settings.ts` at build time.
