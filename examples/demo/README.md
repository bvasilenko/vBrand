# vBrand 0.3.0 - AC#40 Maximum-Capability Demo

The production-command sequence that takes a real brand (Stripe) from URL to a live URL - using **only commands the paying user would run.** No `init-demo`, no `--demo` flag, no `DEMO_MODE` conditional.

## The five-command production sequence

```bash
# 1. Pull brand signals from a real URL
npx @booga/vbrand pull https://stripe.com

# 2. Fuse N candidate documents into one canonical vbrand.schema.json
npx @booga/vbrand fuse stripe-com.candidate.json -o vbrand.schema.json

# 3. Emit the brand assets (favicons, OG image, design tokens, DESIGN.md)
npx @booga/vbrand emit

# 4. Drop CI scaffolding files (workflow, Dockerfile, deploy manifest, secret-setter)
npx @booga/vbrand init-ci --forge=github

# 5. Deploy to a docker-compatible host (localhost socket by default; SSH for remote)
npx @booga/vbrand deploy --target=compose-ssh --host=unix:///var/run/docker.sock
```

After step 5: `http://localhost:8080` serves the brand-themed showcase site.

## What each command produces

- **pull**: writes `stripe-com.candidate.json` with cascade-filled voice + colors + favicons + logo evidence.
- **fuse**: merges candidates under umbrella-wins precedence into the canonical `vbrand.schema.json`.
- **emit**: writes `public/brand/{favicon-16,32,180,512.png, og.png, manifest.webmanifest, brand-tokens.css, swatches.json, DESIGN.md}`.
- **init-ci**: writes `.github/workflows/vbrand-deploy.yml`, `.gitlab-ci.yml`, `Dockerfile` (multi-stage nginx|bun), `.dockerignore`, `vbrand.deploy.json` (single source of truth manifest), `scripts/vbrand-set-secrets.sh` (read-stdin → forge CLI; vBrand process never sees secret values).
- **deploy**: renders `vbrand/.deploy/targets/compose-ssh/docker-compose.rendered.yml`, registers a Docker context, runs `docker compose pull && up -d`, appends to `vbrand/.deploy/history.jsonl`, prints the live URL.

## The standing rule

The demo IS the production flow. Every flag is a flag a paying user would type. Every file produced is a file a paying user gets. There is no `examples/demo`-only code path inside vBrand.

## Free-tier vs paid-tier

- **Free tier (this demo)**: vSsg static target + compose-ssh deploy + signed-registry-item HTTPS sync. Zero paid API.
- **Paid tier (0.3.1+)**: Payload-on-Next.js preset (`vbrand emit --preset=payload`) + Fly.io deploy (`--target=fly`) + AI authoring (`--with-ai`). User supplies their own OpenAI/Anthropic key; vBrand never sees it.

## Dev-loop preview

For local development of the showcase site (the React+Vite source that nginx serves):

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
