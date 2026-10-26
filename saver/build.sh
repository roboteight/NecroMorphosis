#!/bin/zsh
# Builds saver/build/NecroMorphosis.saver (universal, ad-hoc signed).
set -euo pipefail
cd "$(dirname "$0")"
ESBUILD=../node_modules/.bin/esbuild
OUT=build/NecroMorphosis.saver
rm -rf build && mkdir -p $OUT/Contents/{MacOS,Resources}

# 1. Web renderer, inlined into a single HTML file.
$ESBUILD web/main.ts --bundle --minify --format=iife --target=safari16 --outfile=build/main.js --log-level=warning
cat > $OUT/Contents/Resources/index.html <<HTML
<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden;background:#000;cursor:none}canvas{display:block;width:100vw;height:100vh}</style></head>
<body><canvas id="glcanvas"></canvas><script>$(cat build/main.js)</script></body></html>
HTML

# 2. Slider/preset definitions for the native settings sheet.
$ESBUILD web/export-config.ts --bundle --platform=node --format=cjs --outfile=build/export-config.cjs --log-level=warning
node build/export-config.cjs $OUT/Contents/Resources/config.json

# 3. Native bundle (arm64 + x86_64).
for arch in arm64 x86_64; do
  swiftc Sources/*.swift -module-name NecroMorphosis -target $arch-apple-macos13.0 -O \
    -framework ScreenSaver -framework WebKit -framework AppKit \
    -Xlinker -bundle -o build/NecroMorphosis-$arch
done
lipo -create build/NecroMorphosis-arm64 build/NecroMorphosis-x86_64 -output $OUT/Contents/MacOS/NecroMorphosis
cp Info.plist $OUT/Contents/Info.plist
cp assets/thumbnail.png assets/thumbnail@2x.png $OUT/Contents/Resources/
codesign --force --sign - $OUT
echo "Built $OUT"
