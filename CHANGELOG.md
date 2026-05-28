# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-05-28

### Fixed

- Default scaffolded `brand-os.schema.json` referenced asset paths (`assets/logo.png`, `assets/og-source.png`, `assets/icons/`) that did not exist in the bundled template, so `vbrand emit` failed immediately after `vbrand init`. Schema now points at `src/assets/logo-placeholder.png` which is the only image actually shipped, and `icons.source` points at `src/assets/`. 0.1.1 deprecated.

## [0.1.1] - 2026-05-28

### Fixed

- 0.1.0 tarball was missing the scaffold template directory; `vbrand init` failed with ENOENT against `node_modules/@booga/vbrand/template`. Build pipeline now copies `src/template/` to `template/` at package root via `scripts/copy-template.mjs`, and `template` is in `package.json:files`. 0.1.0 deprecated.

## [Unreleased]

## [0.1.0] - 2026-05-27

### Added

- `vbrand init [name]` - scaffold Vite+React project pre-wired to vUi with `brand-os.schema.json`
- `vbrand emit` - read `brand-os.schema.json`, emit `public/brand/` (favicons, OG image, color swatches, icon set)
- `vbrand classify <html-file>` - parse HTML, classify nodes by semantic role, output JSON
- `vbrand audit` - check brand surface against schema; exit 0 clean, exit 1 on drift
- `BrandOsSchema` - Zod schema (strict) exported from package root
