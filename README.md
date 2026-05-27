# vBrand

Brand-OS CLI. Schema → favicons, OG images, color swatches, icon sets. HTML → classified AST. Brand surface → drift report.

```
npx vbrand init [name]      scaffold Vite+React project + brand-os.schema.json
npx vbrand emit             read schema, write public/brand/
npx vbrand classify file    HTML → classified+normalized JSON
npx vbrand audit            brand surface vs schema; exit 1 on drift
```

## Schema

`brand-os.schema.json` at project root. Validated against `BrandOsSchema` (Zod, strict).

```json
{
  "name": "my-brand",
  "voice": {
    "canonical": "Terse. Technical. First-person.",
    "repoDescription": "Design tokens + scaffold CLI."
  },
  "assets": {
    "favicon": { "source": "logo.png", "sizes": [16, 32, 180, 512] },
    "og": { "source": "og-source.png", "dimensions": [1200, 630] },
    "icons": { "source": "icons/", "set": ["chevron-right", "close", "menu"] }
  },
  "tokens": {
    "color": { "primary": "#0f172a", "accent": "#6366f1" },
    "type": { "sans": "Inter, system-ui, sans-serif" }
  }
}
```

## Install

```
npm install @booga/vbrand
```

## Contributing

Contributions welcome. Code of conduct: [Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

## License

MIT © 2026 bvasilenko
