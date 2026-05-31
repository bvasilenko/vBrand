# vBrand

<div align="center">

### Live demo: [https://bvasilenko.github.io/vBrand/](https://bvasilenko.github.io/vBrand/)

Brand-OS CLI. Pulls a brand from a URL, fuses + emits favicons + OG + design tokens, ships a branded website.

```sh
npm install @booga/vbrand
npx @booga/vbrand --help
```

</div>

---

## Commands

```
npx vbrand init [name]      scaffold Vite+React project + vbrand.schema.json
npx vbrand emit             read schema, write favicons + OG + color swatches + icon set under public/brand/
npx vbrand classify file    parse HTML, return semantic-role JSON (header / nav / heading / ...)
npx vbrand audit            verify the project's emitted assets match the schema; exit 1 if they drifted
```

Place `vbrand.schema.json` at project root. Validated against `VbrandSchema` (Zod, strict).

## Install

```sh
npm install -D @booga/vbrand
```

## Programmatic API

```ts
import { VbrandSchema, runInit, runEmit, runClassify, runAudit } from "@booga/vbrand";
```

`runInit`, `runEmit`, `runClassify`, `runAudit` are the four command entry points; `VbrandSchema` is the Zod schema for `vbrand.schema.json`.

## License

MIT.
