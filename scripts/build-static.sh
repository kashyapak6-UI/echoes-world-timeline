#!/usr/bin/env bash
# Static export for GitHub Pages. Does not change the local `npm run dev` / `npm run build` server build.
# Moves app/api aside for the duration of this script only (API routes cannot be statically exported).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
STASH="$(mktemp -d)"
cleanup() {
  if [ -d "$STASH/api" ] && [ ! -d app/api ]; then
    mv "$STASH/api" app/api
  fi
  rm -rf "$STASH"
}
trap cleanup EXIT
if [ -d app/api ]; then
  mv app/api "$STASH/api"
fi
export STATIC_EXPORT=1
export NEXT_PUBLIC_STATIC_EXPORT=1
export NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-/echoes-world-timeline}"
npm run build
# GitHub Pages' Jekyll build ignores folders that start with _ (e.g. _next) unless this file is present.
touch out/.nojekyll
