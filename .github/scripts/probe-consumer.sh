#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 bvasilenko
#
# Pre-publish gate: install the packed tarball in a pristine /tmp consumer
# directory and assert the binary works before any npm publish step runs.
#
# Usage:
#   bash .github/scripts/probe-consumer.sh              # pack fresh from repo root
#   bash .github/scripts/probe-consumer.sh /path/to.tgz # verify existing tarball

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPTS_DIR/../.." && pwd)"
PROBE_DIR="$(mktemp -d /tmp/vbrand-probe-XXXXXX)"
CONSUMER_DIR="$PROBE_DIR/consumer"

_probe_cleanup() { rm -rf "$PROBE_DIR"; }
trap _probe_cleanup EXIT

if [[ $# -ge 1 ]]; then
  TARBALL="$(realpath "$1")"
  echo "probe: using provided tarball: $TARBALL"
else
  echo "probe: packing from $REPO_ROOT ..."
  TARBALL_NAME="$(cd "$REPO_ROOT" && npm pack --pack-destination "$PROBE_DIR" --quiet 2>/dev/null | tail -1)"
  TARBALL="$PROBE_DIR/$TARBALL_NAME"
  echo "probe: packed → $TARBALL"
fi

[[ -f "$TARBALL" ]] || { echo "probe: FAIL — tarball not found: $TARBALL" >&2; exit 1; }

# --ignore-scripts skips postinstall native-binary downloads (sharp, @resvg/resvg-js);
# those are exercised by the full test suite in the verify job.
mkdir -p "$CONSUMER_DIR"
cd "$CONSUMER_DIR"
npm init -y > /dev/null 2>&1

echo "probe: installing tarball in pristine consumer dir ..."
npm install "$TARBALL" --ignore-scripts --quiet

VBRAND="$CONSUMER_DIR/node_modules/.bin/vbrand"
[[ -x "$VBRAND" ]] || { echo "probe: FAIL — vbrand binary not found at $VBRAND" >&2; exit 1; }
echo "probe: binary reachable ✓"

HELP_OUTPUT="$("$VBRAND" --help 2>&1)"
EXPECTED_COMMANDS=(pull fuse emit audit publish)

for cmd in "${EXPECTED_COMMANDS[@]}"; do
  echo "$HELP_OUTPUT" | grep -qE "^\s+${cmd}\b" || {
    echo "probe: FAIL — '${cmd}' absent from vbrand --help" >&2
    printf '%s\n' "$HELP_OUTPUT" >&2
    exit 1
  }
done

echo "probe: --help lists all 5 commands ✓"

printf '{"name":"probe-consumer","tokens":{"color":{"primary":"#0066cc"}}}\n' > "$CONSUMER_DIR/probe.json"
"$VBRAND" pull "$CONSUMER_DIR/probe.json" > /dev/null 2>&1

CANDIDATE_COUNT="$(find "$CONSUMER_DIR" -maxdepth 1 -name '*.candidate.json' | wc -l | tr -d ' ')"
[[ "$CANDIDATE_COUNT" -ge 1 ]] || {
  echo "probe: FAIL — vbrand pull wrote no candidate JSON" >&2
  exit 1
}

echo "probe: vbrand pull (local) wrote candidate JSON ✓"
echo "probe: OK — @booga/vbrand consumer probe passed"
