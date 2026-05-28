# vBrand

CLI that turns one JSON schema into your project's brand assets and keeps them honest.

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
