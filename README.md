# Edge Shield

Browser-local content safety classification. Runs [Shieldstral-1.0-3B](https://huggingface.co/mistralai/Shieldstral-1.0-3B)
through [wllama](https://github.com/ngxson/wllama) (llama.cpp compiled to WebAssembly) entirely inside
the tab. No server, no API key, no telemetry — after the model is cached, the whole thing works offline
and nothing you evaluate leaves your machine.

## Requirements

**Node 20+** (the toolchain is Vite 8 / Tailwind v4 / Vitest 4). On this machine Node 24 lives outside
`PATH`, so activate it first:

```bash
export PATH="/c/Users/metal/Documents/nvm/node-v24.14.0-win-x64:$PATH"
```

## Commands

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

## How it works

Shieldstral is not a chat model — it is a single-forward-pass classifier. You give it three things:

| Field | Purpose |
|---|---|
| **Instruct** | Frames the evaluation and sets how strict it should be |
| **Query** | One yes/no question, phrased so "yes" is what you're screening for |
| **Document** | The content being judged |

The model emits exactly **one token**. Its useful output isn't that token's text but the probability
mass sitting on `yes` versus `no`, so the app requests `logprobs` with `top_logprobs: 20`, then
normalises the two sides into a continuous P(yes). Reading only the sampled text would collapse a
calibrated score into a coin flip.

Because `yes`/`no` may be tokenised several ways (`yes`, ` yes`, `▁yes`, `"yes"`, `Yes.`), matching is
done by normalisation rather than a fixed list, and same-polarity variants have their mass summed. The
maths runs in log space and finishes with a sigmoid of the log-odds — equivalent to `pYes / (pYes + pNo)`
but stable when one side dominates by hundreds of nats.

If neither `yes` nor `no` appears in the top 20, the app reports **indeterminate** rather than
defaulting to a "safe" reading.

### Threshold

The slider re-reads the existing result; it never re-runs inference. It matters because the shipped
build is **Q3_K_M**, and 3-bit quantisation shifts logits — ranking tends to survive while absolute
calibration drifts, so the correct cut-off for this build may not be 0.50.

### Model choice

`Abiray/Shieldstral-1.0-3B-GGUF` → `Shieldstral-1.0-3B-Q3_K_M.gguf` (1.80 GB), text-only; the ~840 MB
`mmproj` vision tower is never downloaded.

Q3_K_M is chosen for a hard reason: wllama loads each GGUF into a single `ArrayBuffer`, capping a
non-split file at 2 GiB. Q4_K_M of this model is 2,146,497,312 B — **986 KB** under the ceiling, which
is not a margin worth betting a download on. Q3_K_M leaves ~350 MB of headroom.

To go bigger, split the GGUF (`llama-gguf-split --split-max-size 512M`) — wllama loads all shards from
the first filename and fetches them in parallel, which removes the cap *and* speeds up the download.

There is no official GGUF release; this is a community conversion.

## Cross-origin isolation

wllama needs `SharedArrayBuffer` for multi-threaded inference, which browsers only expose to
cross-origin isolated documents. `vite.config.ts` sets `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` on **both** the dev and preview servers — wllama's own
example only covers dev, so `vite preview` there silently drops to a single thread.

**Deploying anywhere else means sending those two headers yourself.** Without them the app still runs,
just far slower; the ready strip tells you which mode you're in.

## Architecture

```
src/
  lib/shieldstral/    prompt construction, scoring, presets   ← pure, fully tested
  lib/wllama/         ShieldEngine interface, wllama impl, fake
  hooks/              load state machine, evaluation
  components/         UI
```

`ShieldEngine` is the seam. Everything above it is pure and unit-tested; below it is a 7.6 MB wasm
binary and a 1.8 GB download. Tests inject `FakeEngine` and touch neither, so the suite runs in ~4s
with no network. Scoring deliberately lives *outside* the engine so the real and fake paths share
identical, tested logic.

## Design

Monochrome with a single semantic axis. Every surface, border and label is greyscale; saturated colour
is reserved exclusively for the verdict, so the one thing the app exists to communicate is the only
thing on screen with a hue. Colour is never the sole carrier — the verdict is always text as well.
