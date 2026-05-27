#!/usr/bin/env bash
# pre-commit-scrub.sh - scrub gate for per-package umbrella repos.
# Fails (exits 1) if any forbidden substring appears in tracked files.
#
# Run locally as a git pre-commit hook, and in CI as a workflow step.
#
# Usage:
#   bash pre-commit-scrub.sh                 # scan current repo working tree
#   bash pre-commit-scrub.sh <path>          # scan a specific path
#
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 bvasilenko

set -uo pipefail

# Allow caller to pass a target dir; default = repo root.
TARGET="${1:-.}"

# Forbidden patterns (case-insensitive). Source: docs/my/execution/02-conventions.md §3.
PATTERNS=(
  "alexy-os"
  "delta5-hq"
  "quant5-lab"
  "ui8kit"
  "buildy-ui"
  "ui\\.buildy\\.tw"
  "hinddy/tailwind-builder"
  "ruvnet/ruflo"
  "TauricResearch/TradingAgents"
  "/tmp/donors/"
  "@buildy/"
  "@editory/"
)

# What we don't scan: vendored/generated content where leaks would be donor-side artifacts
# unaffected by this repo's authoring decisions.
EXCLUDES=(
  ":(exclude)node_modules/**"
  ":(exclude)dist/**"
  ":(exclude)build/**"
  ":(exclude).next/**"
  ":(exclude)coverage/**"
  ":(exclude)*.lock"
  ":(exclude)bun.lockb"
  ":(exclude)package-lock.json"
  ":(exclude)pnpm-lock.yaml"
  ":(exclude)yarn.lock"
  ":(exclude).github/**"
)

cd "$TARGET" || { echo "scrub: target $TARGET not found" >&2; exit 2; }

# Use git ls-files when inside a repo (only commits-relevant content).
# Fall back to find when not inside a repo.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  FILES=$(git ls-files -- . "${EXCLUDES[@]}" 2>/dev/null)
else
  FILES=$(find . -type f \
    -not -path '*/node_modules/*' \
    -not -path '*/dist/*' \
    -not -path '*/build/*' \
    -not -path '*/.next/*' \
    -not -path '*/coverage/*' \
    -not -name '*.lock' \
    -not -name 'bun.lockb' \
    -not -name 'package-lock.json' \
    -not -name 'pnpm-lock.yaml' \
    -not -name 'yarn.lock')
fi

if [ -z "${FILES:-}" ]; then
  echo "scrub: no files to scan in $TARGET"
  exit 0
fi

LEAKED=0
echo "scrub: scanning $(echo "$FILES" | wc -l) files for ${#PATTERNS[@]} forbidden patterns..."

for pat in "${PATTERNS[@]}"; do
  # -i case-insensitive; -n line numbers; -E extended regex
  HITS=$(echo "$FILES" | xargs -d '\n' -I{} grep -inHE "$pat" {} 2>/dev/null || true)
  if [ -n "$HITS" ]; then
    echo
    echo "SCRUB LEAK: pattern '$pat' found in:"
    echo "$HITS" | head -20
    HIT_COUNT=$(echo "$HITS" | wc -l)
    if [ "$HIT_COUNT" -gt 20 ]; then
      echo "  ... ($((HIT_COUNT - 20)) more hits suppressed)"
    fi
    LEAKED=$((LEAKED + 1))
  fi
done

if [ "$LEAKED" -gt 0 ]; then
  echo
  echo "scrub: FAILED - $LEAKED forbidden pattern(s) found"
  echo "scrub: per docs/my/execution/02-conventions.md §3, all sub-brand handles, donor URLs,"
  echo "scrub: and third-party donor references must be removed before commit."
  exit 1
fi

echo "scrub: OK - no forbidden patterns found"
exit 0
