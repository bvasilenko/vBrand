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
echo "probe: running sync rig..."
SYNC_PROBE_DIR="$(mktemp -d /tmp/vbrand-sync-probe-XXXXXX)"
_sync_cleanup() { rm -rf "$SYNC_PROBE_DIR"; }
trap '_probe_cleanup; _sync_cleanup' EXIT

UMBRELLA_DIR="$SYNC_PROBE_DIR/umbrella"
SITE_A="$SYNC_PROBE_DIR/site-a"
SITE_B="$SYNC_PROBE_DIR/site-b"
SITE_POISON="$SYNC_PROBE_DIR/site-poison"
DIST_DIR="$SYNC_PROBE_DIR/dist"

mkdir -p "$UMBRELLA_DIR" "$SITE_A" "$SITE_B" "$SITE_POISON" "$DIST_DIR"

PROBE_SCHEMA='{"name":"probe","voice":{"canonical":"Probe.","repoDescription":"Probe brand."},"assets":{"favicon":{"source":"logo.png","sizes":[32]},"og":{"dimensions":[1200,630]},"icons":{"source":"icons/","set":[]}},"tokens":{"color":{"primary":"#0f172a"},"type":{}}}'

printf '%s
' "$PROBE_SCHEMA" > "$UMBRELLA_DIR/vbrand.schema.json"
printf '%s
' "$PROBE_SCHEMA" > "$SITE_A/vbrand.schema.json"
printf '%s
' "$PROBE_SCHEMA" > "$SITE_B/vbrand.schema.json"

# Umbrella: init --as-umbrella and push
cd "$UMBRELLA_DIR"
VBRAND_SYNC_PRIVATE_KEY_OUTPUT="$("$VBRAND" sync init "file://$DIST_DIR" --as-umbrella --out-dir "$DIST_DIR" 2>&1)"
VBRAND_SYNC_PRIVATE_KEY="$(echo "$VBRAND_SYNC_PRIVATE_KEY_OUTPUT" | grep VBRAND_SYNC_PRIVATE_KEY= | cut -d= -f2- | tr -d '[:space:]')"

[[ -n "$VBRAND_SYNC_PRIVATE_KEY" ]] || {
  echo "probe: FAIL — could not extract sync private key" >&2
  exit 1
}

VBRAND_SYNC_PRIVATE_KEY="$VBRAND_SYNC_PRIVATE_KEY" "$VBRAND" sync push --out-dir "$DIST_DIR" || {
  echo "probe: FAIL — sync push failed" >&2
  exit 1
}
echo "probe: sync push ✓"

# Site A: clean adopt
cd "$SITE_A"
"$VBRAND" sync init "file://$DIST_DIR" || { echo "probe: FAIL — site-a sync init" >&2; exit 1; }
"$VBRAND" sync pull || { echo "probe: FAIL — site-a sync pull" >&2; exit 1; }
echo "probe: site-a sync pull ✓"

# Site B: override declared before pull
cd "$SITE_B"
"$VBRAND" sync init "file://$DIST_DIR" || { echo "probe: FAIL — site-b sync init" >&2; exit 1; }
"$VBRAND" sync override tokens.color.primary --value '"#ffffff"' --reason "site-b keeps white" || { echo "probe: FAIL — site-b override" >&2; exit 1; }
"$VBRAND" sync pull || { echo "probe: FAIL — site-b sync pull" >&2; exit 1; }
echo "probe: site-b sync pull with override ✓"

# Poisoned bundle: push with handle in schema should fail
cd "$UMBRELLA_DIR"
printf '%s
' '{"name":"probe","voice":{"canonical":"Probe.","repoDescription":"Probe."},"assets":{"favicon":{"source":"logo.png","sizes":[32]},"og":{"dimensions":[1200,630]},"icons":{"source":"icons/","set":[]}},"tokens":{"color":{"primary":"#secret-handle-ref"},"type":{}},"provenance":{"scrubbed_handles":["secret-handle"]}}' > "$UMBRELLA_DIR/vbrand.schema.json"
# Capture combined output; sync push is expected to exit non-zero with E_HANDLE_LEAK
POISONED_OUTPUT="$(VBRAND_SYNC_PRIVATE_KEY="$VBRAND_SYNC_PRIVATE_KEY" "$VBRAND" sync push --out-dir "$DIST_DIR" 2>&1 || true)"
if ! echo "$POISONED_OUTPUT" | grep -q E_HANDLE_LEAK; then
  echo "probe: FAIL - poisoned push should have emitted E_HANDLE_LEAK" >&2
  echo "actual output: $POISONED_OUTPUT" >&2
  exit 1
fi
echo "probe: poisoned push correctly refused ✓"

echo "probe: sync rig OK ✓"
