#!/usr/bin/env bash
# The Safari Web Extension for iPhone and iPad: an Xcode project made from dist/safari (node tools/build.mjs safari).
#
#   tools/safari.sh            makes dist/safari-xcode/. Open its Vianney.xcodeproj in Xcode, choose your Team under Signing & Capabilities for the app and for its
#                              extension, and run it on a device. (A free Apple account runs it for 7 days; TestFlight and the App Store need the paid program.)
#   tools/safari.sh --build    also builds it for the iOS Simulator, unsigned, to see that it compiles: what the workflow .github/workflows/safari.yml does
#
# It needs macOS and Xcode: Apple's tool for this, safari-web-extension-packager, exists nowhere else. On another system, build dist/safari
# (node tools/build.mjs safari) and make the project on a Mac, or run that workflow on GitHub's.
#
#   APP_NAME     the name of the app, default Vianney
#   BUNDLE_ID    the identifier of the app (the extension gets ".Extension" after it), default cc.vianney.Vianney. Use one that is yours: Apple ties it to a Team.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$(uname)" != "Darwin" ]; then
  echo "The Xcode project of a Safari extension can only be made on a Mac (Xcode's safari-web-extension-packager)." >&2
  echo "Here: node tools/build.mjs safari makes dist/safari, which is what that tool takes. Or run the workflow 'Safari extension (iOS)' on GitHub." >&2
  exit 2
fi

APP="${APP_NAME:-Vianney}"
BUNDLE="${BUNDLE_ID:-cc.vianney.Vianney}"
OUT=dist/safari-xcode

node tools/build.mjs safari
rm -rf "$OUT"
xcrun safari-web-extension-packager dist/safari \
  --project-location "$OUT" --app-name "$APP" --bundle-identifier "$BUNDLE" \
  --swift --ios-only --copy-resources --no-open --no-prompt --force

PROJECT="$(find "$OUT" -maxdepth 3 -name '*.xcodeproj' | head -n 1)"
if [ -z "$PROJECT" ]; then echo "The packager made no Xcode project in $OUT." >&2; exit 1; fi
echo "Xcode project: $PROJECT"

if [ "${1:-}" = "--build" ]; then
  # the scheme of the app: the one named like it, else the first
  SCHEME="$(xcodebuild -list -json -project "$PROJECT" | node -e '
    let s = ""; process.stdin.on("data", (c) => { s += c; }).on("end", () => {
      const schemes = JSON.parse(s).project.schemes || [];
      process.stdout.write(schemes.find((n) => n === process.argv[1]) || schemes[0] || "");
    });' "$APP")"
  if [ -z "$SCHEME" ]; then echo "No scheme in $PROJECT." >&2; exit 1; fi
  xcodebuild -project "$PROJECT" -scheme "$SCHEME" -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
fi
