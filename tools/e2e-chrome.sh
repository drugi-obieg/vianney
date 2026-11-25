#!/usr/bin/env bash
# Start a throwaway headless Chrome for tools/e2e.py (port 9333, empty profile, extension debugging on).
# Usage: tools/e2e-chrome.sh [profile-dir]
set -euo pipefail
PORT=9333
PROFILE="${1:-${TMPDIR:-/tmp}/vianney-e2e-profile}"
pkill -f "remote-debugging-port=${PORT}" 2>/dev/null || true
sleep 1
rm -rf "$PROFILE"; mkdir -p "$PROFILE"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
nohup "$CHROME" --headless=new --remote-debugging-port=${PORT} --user-data-dir="$PROFILE" \
  --enable-unsafe-extension-debugging --mute-audio --no-first-run --no-default-browser-check --disable-gpu \
  --window-size=1400,1000 --lang=en-US > "$PROFILE/chrome.log" 2>&1 &
for i in $(seq 1 30); do
  sleep 0.5
  curl -s --max-time 2 "http://127.0.0.1:${PORT}/json/version" >/dev/null && { echo "Chrome ready on port ${PORT}"; exit 0; }
done
echo "Chrome did not start; see $PROFILE/chrome.log" >&2; exit 1
