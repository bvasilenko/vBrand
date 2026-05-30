# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-05-30

### Fixed

- `vbrand pull <url>` now extracts `voiceCanonical` from `og:title` (high confidence) falling through to `<title>` then JSON-LD `Organization.name`. The `<title>` trailer-strip heuristic applies only to `name`; `voiceCanonical` preserves the raw title verbatim so the two fields remain semantically distinct.
- `vbrand pull <url>` now extracts `voiceDescription` from `og:description` (high confidence) falling through to `meta[name=description]` then JSON-LD `Organization.description` / `WebSite.description`. Extracted prose is pre-sanitized (em-dash → en-dash, flag-emoji stripped) to pass `voice.test.ts` guards.
- Colors cascade extended: when `<meta name="theme-color">` is absent, `vbrand pull` now falls through to JSON-LD `Brand.color` / `Organization.brand.color` (medium) then inline `<style>` CSS-variable hex/rgb declarations (low). External stylesheet fetch is explicitly out of scope; the parser reads only inline `<style>` blocks of the already-fetched HTML. 0.2.0 deprecated.
- CI `deprecate-superseded-range` step now uses `<${CURRENT}` as the semver range instead of `<MAJOR.MINOR.0`, so patch releases (e.g. 0.2.0→0.2.1) correctly deprecate the immediate predecessor rather than only earlier minor versions. A follow-up `deprecate-020-migration-note` step overrides 0.2.0's deprecation message with the targeted reason: "0.2.0 missed extractable voice fields and CSS-color fallback; superseded by 0.2.1".
- HTML signal extraction factored into `src/lib/pull/html-signals.ts`; `from-url.ts` delegates to it. Inline color CSS-variable parse capped at 4 entries per the contract.
- Demo at `examples/demo/` (in-repo) now renders web-extractable fields (`name`, `voiceCanonical`, `voiceDescription`, `colors`, `favicon`, `og`, `icons`) and donor-spec deep fields (`typeTokens`, `marks`, `themes`, `illustration`, `slots`, `fusePolicies`) as two visually distinct groups, so a first-time visitor reads the confidence table correctly.
- HTML page ETag caching: `from-url.ts` stores the fetched HTML and `ETag` in the per-slug cache directory; subsequent pulls send `If-None-Match` and reuse the cached HTML on 304, so `vbrand emit` output is byte-equal across reruns against a stable source.
- Hex-color validator in the URL signal extractor accepts only structurally valid CSS hex lengths (3, 4, 6, 8 digits) and rejects malformed 5- and 7-digit values at every cascade rung (theme-color, JSON-LD, inline CSS vars).
- Demo Stripe candidate fixture corrected: `colors` now reports `confidence: none` / `reason: dynamic-render-required` to match what `vbrand pull https://stripe.com` actually returns (Stripe ships no inline `<style>` blocks or static color signals in its HTML).

## [0.2.0] - 2026-05-30

### Added

- Five-command API: `pull`, `fuse`, `emit`, `audit`, `publish`. `init` and `classify` removed from public surface.
- `vbrand pull` accepts `./file.json`, `https://…`, `gh:<handle>`, and `npm:<pkg>` locator prefixes; writes per-source `<slug>.candidate.json`; never overwrites `vbrand.schema.json`.
- `vbrand pull https://<host>` extracts `name`, `colors`, `favicon` from live HTML via og: meta, `theme-color`, and link/img selectors. PI-detection on all extracted text fields.
- `vbrand pull gh:<handle>` seeds candidate from GitHub profile HTML (pinned-block selector primary, REST fallback, fixture-replay mode via `VBRAND_GH_FIXTURE_DIR`).
- `vbrand fuse` is RFC 7396 compliant with umbrella-wins conflict resolution; emits scrub-gate findings as parseable JSON; per-field `$fuse` policy hints in schema.
- `vbrand emit` writes deterministic favicons (sharp), Satori-composed `og.png`, `manifest.webmanifest`, CSS-variables file, and `DESIGN.md` with YAML frontmatter; pixel-equivalent across linux-x64 and linux-arm64.
- `vbrand audit --strict` detects `<img>` without `alt`, heading skips, asset hash drift, and placeholder slots; writes `reports/audit-<DATE>.md`.
- `vbrand audit --against=<url>` writes brand-sync alignment report.
- `vbrand publish --as=registry-item` writes DTCG-adjacent registry entry; `--as=dtcg` writes DTCG-Format-Module bundle (gated behind `--experimental`); `--as=npm` writes publishable npm package shape.
- WCAG+APCA dual contrast validator, 8-axis CSS-var cascade emitter, brand-marks geometry contract, theme registry (five named modes), illustration schema wired in.
- Cross-arch OG pixel-equivalence CI job (ubuntu-24.04-arm, pixelmatch at 1% tolerance).
- `*.tsbuildinfo` excluded from git; tarball budget CI step (3 MB unpacked).

## [0.1.3] - 2026-05-28

### Changed

- Public surface scrubbed: the term "Brand-OS" (sub-brand donor vocabulary) is removed from README, package description, CLI help text, exported type names (`BrandOsSchema` -> `VbrandSchema`), and the schema filename (`brand-os.schema.json` -> `vbrand.schema.json`). README headline rewritten in plain language (the prior "audit brand drift" phrasing was cryptic for a first-time visitor). 0.1.2 deprecated.

## [0.1.2] - 2026-05-28

### Fixed

- Default scaffolded `vbrand.schema.json` referenced asset paths (`assets/logo.png`, `assets/og-source.png`, `assets/icons/`) that did not exist in the bundled template, so `vbrand emit` failed immediately after `vbrand init`. Schema now points at `src/assets/logo-placeholder.png` which is the only image actually shipped, and `icons.source` points at `src/assets/`. 0.1.1 deprecated.

## [0.1.1] - 2026-05-28

### Fixed

- 0.1.0 tarball was missing the scaffold template directory; `vbrand init` failed with ENOENT against `node_modules/@booga/vbrand/template`. Build pipeline now copies `src/template/` to `template/` at package root via `scripts/copy-template.mjs`, and `template` is in `package.json:files`. 0.1.0 deprecated.

## [0.1.0] - 2026-05-27

### Added

- `vbrand init [name]` - scaffold Vite+React project pre-wired to vUi with `vbrand.schema.json`
- `vbrand emit` - read `vbrand.schema.json`, emit `public/brand/` (favicons, OG image, color swatches, icon set)
- `vbrand classify <html-file>` - parse HTML, classify nodes by semantic role, output JSON
- `vbrand audit` - check brand surface against schema; exit 0 clean, exit 1 on drift
- `VbrandSchema` - Zod schema (strict) exported from package root
