#!/usr/bin/env bash
# Pin the Obsidian window to an exact size before recording.
#
# 1536x864 is exactly 16:9, so a Retina capture (3072x1728) downscales to
# 1080p with no resampling artefacts and no letterboxing. The four README
# GIFs were shot at 1512x862, which is neither 16:9 nor consistent between
# takes -- this removes that variable.
#
# Requires Accessibility permission for whichever terminal runs it:
#   System Settings -> Privacy & Security -> Accessibility
#
# Usage: ./scripts/demo-recording/set-window.sh [WIDTH] [HEIGHT]

set -euo pipefail

WIDTH="${1:-1536}"
HEIGHT="${2:-864}"
X=80
Y=80

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This script is macOS-only (it drives System Events via AppleScript)." >&2
  echo "On other platforms, size the window to ${WIDTH}x${HEIGHT} by hand." >&2
  exit 1
fi

if ! pgrep -xq Obsidian; then
  echo "Obsidian is not running. Open the demo vault first." >&2
  exit 1
fi

osascript <<EOF
tell application "Obsidian" to activate
delay 0.3
tell application "System Events"
  tell process "Obsidian"
    set position of window 1 to {$X, $Y}
    set size of window 1 to {$WIDTH, $HEIGHT}
  end tell
end tell
EOF

echo "Obsidian window set to ${WIDTH}x${HEIGHT} at (${X}, ${Y})."
echo "Verify with a test capture before recording a real take."
