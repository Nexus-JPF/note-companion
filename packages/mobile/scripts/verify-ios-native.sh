#!/usr/bin/env bash
# Verify iOS prebuild does not link ClerkExpo (ClerkKit SPM breaks pod install).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
cd "$ROOT"

QUICK=0
if [[ "${1:-}" == "--quick" ]] || [[ "${VERIFY_IOS_QUICK:-}" == "1" ]]; then
  QUICK=1
fi

can_read_file() {
  local file="$1"
  local timeout_secs="${2:-5}"
  if [[ ! -f "$file" ]]; then
    return 1
  fi
  perl -e "alarm shift; exec @ARGV" "$timeout_secs" head -c 1 "$file" >/dev/null 2>&1
}

echo "→ Checking expo autolinking for @clerk/expo..."
CLERK_MODULES="$(
  node --no-warnings --eval "require('expo/bin/autolinking')" \
    expo-modules-autolinking resolve --platform ios --json \
    | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log((j.modules||[]).map(m=>m.packageName).filter(n=>n.includes('clerk')).join(','));});"
)"
if [[ -n "$CLERK_MODULES" ]]; then
  echo "FAIL: @clerk/expo is still autolinked on iOS: $CLERK_MODULES"
  exit 1
fi
echo "OK: @clerk/expo excluded from iOS autolinking"

PODSPEC=""
for candidate in \
  "$ROOT/node_modules/@clerk/expo/ios/ClerkExpo.podspec" \
  "$REPO_ROOT/node_modules/@clerk/expo/ios/ClerkExpo.podspec"; do
  if [[ -f "$candidate" ]]; then
    PODSPEC="$candidate"
    break
  fi
done

if [[ -n "$PODSPEC" ]]; then
  if rg -q "spm_dependency" "$PODSPEC"; then
    echo "FAIL: @clerk/expo podspec still declares spm_dependency (pnpm patch did not apply)"
    exit 1
  fi
  echo "OK: @clerk/expo podspec has no spm_dependency (pnpm patch applied)"
else
  echo "WARN: @clerk/expo podspec not found — run pnpm install from repo root"
fi

NATIVE_SPEC=""
for candidate in \
  "$ROOT/node_modules/@clerk/expo/dist/specs/NativeClerkModule.js" \
  "$REPO_ROOT/node_modules/@clerk/expo/dist/specs/NativeClerkModule.js"; do
  if [[ -f "$candidate" ]]; then
    NATIVE_SPEC="$candidate"
    break
  fi
done

if [[ -n "$NATIVE_SPEC" ]]; then
  if rg -q "requireOptionalNativeModule" "$NATIVE_SPEC"; then
    echo "FAIL: NativeClerkModule.js still calls requireOptionalNativeModule (pnpm patch incomplete)"
    exit 1
  fi
  echo "OK: NativeClerkModule.js stubbed (no TurboModule lookup at import)"
else
  echo "WARN: NativeClerkModule.js not found — run pnpm install from repo root"
fi

echo "→ Checking expo autolinking for expo-secure-store..."
SECURE_MODULES="$(
  node --no-warnings --eval "require('expo/bin/autolinking')" \
    expo-modules-autolinking resolve --platform ios --json \
    | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log((j.modules||[]).map(m=>m.packageName).filter(n=>n==='expo-secure-store').join(','));});"
)"
if [[ -z "$SECURE_MODULES" ]]; then
  echo "FAIL: expo-secure-store is not autolinked on iOS (Clerk session would not persist)"
  exit 1
fi
echo "OK: expo-secure-store autolinked on iOS"

if [[ "$QUICK" == "1" ]]; then
  echo ""
  echo "Quick checks passed (prebuild skipped)."
  echo "Remote EAS builds are unaffected — safe to run: pnpm run build:ios:remote"
  exit 0
fi

echo "→ Checking splash assets are readable locally..."
UNREADABLE=()
for img in assets/splash.png assets/splash-white.png; do
  if ! can_read_file "$ROOT/$img" 5; then
    UNREADABLE+=("$img")
  fi
done

if [[ ${#UNREADABLE[@]} -gt 0 ]]; then
  echo ""
  echo "SKIP: Cannot read splash image(s) within 5s:"
  for img in "${UNREADABLE[@]}"; do
    echo "  - $img"
  done
  echo ""
  echo "This repo lives under an Obsidian/iCloud vault path. macOS often blocks reads"
  echo "until files are downloaded, which makes expo prebuild fail with ECANCELED."
  echo ""
  echo "Fix (pick one):"
  echo "  1. Finder → right-click packages/mobile/assets → Download Now"
  echo "  2. Run: pnpm verify:ios-native:quick   (Clerk checks only, no prebuild)"
  echo "  3. Clone/build outside iCloud (~/Developer/...)"
  echo ""
  echo "Core Clerk iOS checks above already passed. Remote EAS builds use git upload,"
  echo "not iCloud — pnpm run build:ios:remote should still work."
  exit 0
fi
echo "OK: splash assets readable"

echo "→ Running expo prebuild (no pod install)..."
if ! npx expo prebuild --platform ios --clean --no-install; then
  echo ""
  echo "Prebuild failed. If you see ECANCELED on splash images, use --quick or"
  echo "download assets locally (see messages above)."
  exit 1
fi

if rg -q "ClerkExpo|ClerkKit" "$ROOT/ios" 2>/dev/null; then
  echo "FAIL: ios/ project references ClerkExpo or ClerkKit"
  rg "ClerkExpo|ClerkKit" "$ROOT/ios" || true
  exit 1
fi
echo "OK: generated ios/ has no ClerkExpo/ClerkKit references"

echo ""
echo "All checks passed. Next steps (free, local):"
echo "  1. pod install && npx expo run:ios     # simulator/device (needs Xcode)"
echo "  2. pnpm run build:ios                  # local EAS build (no cloud credits)"
echo ""
