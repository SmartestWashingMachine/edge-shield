/**
 * The single model this app runs.
 *
 * Q3_K_M is chosen for one hard reason: wllama loads each GGUF into a single
 * ArrayBuffer, which caps a non-split file at 2 GiB (2,147,483,648 B). The
 * Q4_K_M build of this model is 2,146,497,312 B — 986 KB under the ceiling,
 * which is not a margin worth betting a download on. Q3_K_M leaves ~350 MB.
 *
 * The trade-off is calibration: 3-bit quantisation shifts logits, so absolute
 * scores drift from the model card's published figures even when the ranking
 * holds. That is precisely why the threshold is a user-facing control.
 *
 * There is no official GGUF release; this is a community conversion.
 */
export const MODEL = {
  repo: 'octopusmegalopod/shieldstral-gguf-split',
  file: 'Shieldstral-Q3KM-00001-of-00004.gguf',
  /** Exact size from the HuggingFace API, used for progress before the first byte lands. */
  // ... sometimes I'm glad for vibe-coding. sometimes not.
  sizeBytes: 1_795_552_032,
} as const

/**
 * Context window. The model was trained to 32k, but KV cache is allocated up
 * front and this runs in a browser tab alongside 1.8 GB of weights, so 4k is
 * the pragmatic default — comfortably more than any single document a user
 * will paste into the form.
 */
export const N_CTX = 4096
export const N_BATCH = 512

/**
 * How many candidates to request for the single output token. The model card
 * specifies 20; we need `yes` and `no` to both be present, and 20 gives ample
 * headroom for a quantised model whose distribution is flatter than the
 * original's.
 */
export const TOP_LOGPROBS = 20
