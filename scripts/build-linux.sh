#!/usr/bin/env bash
# Compila MDCAT Extended para Linux y genera paquetes .deb, .rpm y .AppImage.
#   ./scripts/build-linux.sh           perfil "dist" (binario más pequeño)
#   ./scripts/build-linux.sh --fast    perfil "release" (compila más rápido)
#   ./scripts/build-linux.sh --deps    instala antes las dependencias del sistema (Debian/Ubuntu)
set -euo pipefail

cd "$(dirname "$0")/.."

PROFILE="dist"
for arg in "$@"; do
  case "$arg" in
    --fast) PROFILE="release" ;;
    --deps)
      sudo apt-get update
      sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
        librsvg2-dev libssl-dev libxdo-dev patchelf file build-essential curl wget
      ;;
    *) echo "Opción desconocida: $arg" >&2; exit 1 ;;
  esac
done

if ! pkg-config --exists webkit2gtk-4.1; then
  echo "Falta webkit2gtk-4.1. Ejecuta: ./scripts/build-linux.sh --deps" >&2
  exit 1
fi

[ -d node_modules ] || npm ci
npx tauri build -- --profile "$PROFILE"

VERSION=$(node -p "require('./package.json').version")
mkdir -p binarios
cp "target/$PROFILE/mdcat-tauri" "binarios/mdcat-${VERSION}-linux-x86_64"
find "target/$PROFILE/bundle" \( -name "*.deb" -o -name "*.rpm" -o -name "*.AppImage" \) -name "*${VERSION}*" \
  -exec cp {} binarios/ \;
ls -lh binarios | grep "$VERSION"
