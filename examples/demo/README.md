# vBrand 0.3.0 demo - HONEST rendering of the literal pull output

This demo renders the literal output of:

```bash
npx @booga/vbrand@0.3.0 pull https://stripe.com
```

run in a pristine npm consumer. The candidate JSON it produced lives at
[`stripe-com.candidate.json`](./stripe-com.candidate.json) and is imported
directly into [`src/main.jsx`](./src/main.jsx). No hand-tuned palette; no
LLM-authored Stripe copy.

Empty fields on the page are intentional - they show the deterministic
extractor's actual signal coverage on stripe.com today. Once vBrand 0.3.1
ships fuse-baseline injection (AC#40 5-of-5 close), the empty fields fill
from baseline defaults at `confidence: low` and `vbrand emit` produces a
real `public/brand/brand-tokens.css` for the demo's `:root`.

## How the candidate was produced (verbatim)

```bash
# pristine consumer
rm -rf /tmp/vbrand-real-pull
mkdir -p /tmp/vbrand-real-pull/consumer
cd /tmp/vbrand-real-pull/consumer
npm init -y
npm install @booga/vbrand@0.3.0
npx vbrand pull https://stripe.com
# - Pulling brand signals...
# Candidate written -> /tmp/vbrand-real-pull/consumer/stripe-com.candidate.json
```

That `stripe-com.candidate.json` was copied verbatim into this directory.

## Field coverage that the demo surfaces

| field             | confidence | source              | rendered as                                       |
| ----------------- | ---------- | ------------------- | ------------------------------------------------- |
| name              | medium     | og:title            | hero heading + footer brand.name                  |
| voiceCanonical    | high       | og:title            | hero eyebrow + CTA heading + footer tagline       |
| voiceDescription  | high       | og:description      | hero description                                  |
| favicon           | high       | link[rel=icon]      | evidence card (local cache path + sizes)          |
| og                | high       | default             | evidence card (dimensions only; no asset on disk) |
| colors            | none       | dynamic-render-req'd | warn-tone pill + evidence note                    |
| typeTokens        | none       | absent-in-source    | features-grid card marked "missing"               |
| icons             | none       | absent-in-source    | features-grid card marked "missing"               |
| marks             | none       | absent-in-source    | features-grid card marked "missing"               |
| themes            | none       | absent-in-source    | features-grid card marked "missing"               |

## The fuse gap (not fixed in this demo)

```bash
cd /tmp/vbrand-real-pull/consumer
npx vbrand fuse stripe-com.candidate.json stripe-com.candidate.json
# - Fusing schemas...
# Cannot produce canonical schema from candidates. Missing required fields:
#   assets.icons, tokens. Add more candidate sources or augment manually.
```

That failure is expected and tracked in the 0.3.0 close log; the fix is the
`fuse --baseline` injection landing in 0.3.1.

## The full intended production-command sequence (when 0.3.1 ships)

```bash
# 1. Pull brand signals from a real URL
npx @booga/vbrand pull https://stripe.com

# 2. Fuse candidates into one canonical vbrand.schema.json (baseline-injects missing fields)
npx @booga/vbrand fuse --baseline stripe-com.candidate.json

# 3. Emit brand assets (favicons, OG image, design tokens, DESIGN.md)
npx @booga/vbrand emit

# 4. Drop CI scaffolding (workflow + Dockerfile + deploy manifest + secret-setter)
npx @booga/vbrand init-ci --forge=github

# 5. Deploy to a docker-compatible host
npx @booga/vbrand deploy --target=compose-ssh --host=unix:///var/run/docker.sock
```

Until step 2 actually fuses without erroring, the demo can only honestly
render step 1's output - which is what you see here.

## Dev-loop preview

```bash
bun install
bun run dev      # http://localhost:5290
```

For container preview against an already-built image:

```bash
docker compose up -d
# http://localhost:8080
docker compose down
```
