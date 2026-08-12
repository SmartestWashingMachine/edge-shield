// Imported from the prebuilt ESM bundle rather than the bare package name:
// `@wllama/wllama`'s entrypoint resolves to raw TypeScript source, which drags
// node_modules into our own `tsc` run (and trips this project's
// `erasableSyntaxOnly`). The built bundle ships its own .d.ts alongside.
import { CacheManager, Wllama } from '@wllama/wllama/esm/index.js'
import wasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url'

import type { EvaluationInput } from '../shieldstral/prompt'
import { buildMessages } from '../shieldstral/prompt'
import type { TokenLogprob } from '../shieldstral/score'
import { MODEL, N_BATCH, N_CTX, TOP_LOGPROBS } from './model'
import { EngineError, type LoadOptions, type LoadedInfo, type RawEvaluation, type ShieldEngine } from './engine'

/**
 * The real engine: llama.cpp compiled to WebAssembly, running Shieldstral
 * entirely in the tab.
 *
 * Nothing in here is exercised by the test suite — see FakeEngine. Keeping the
 * logic out of this file (prompt building and scoring both live in pure
 * modules) is deliberate, so the untested surface stays as thin as possible.
 */
export class WllamaEngine implements ShieldEngine {
  private wllama: Wllama | null = null
  private loaded = false

  isLoaded(): boolean {
    return this.loaded
  }

  async load({ onProgress, onInitialising, signal }: LoadOptions): Promise<LoadedInfo> {
    if (this.loaded) throw new EngineError('Model is already loaded.')

    const wllama = new Wllama({ default: wasmUrl }, { parallelDownloads: 5, }) // 4 files in Q3_K_M... annoying...
    this.wllama = wllama

    let sawFinalByte = false
    try {
      await wllama.loadModelFromHF(
        { repo: MODEL.repo, file: MODEL.file },
        {
          signal,
          progressCallback: ({ loaded, total }) => {
            onProgress?.({ loaded, total })
            // The download finishing is our only cue that wllama has moved on
            // to instantiating the wasm module and allocating the KV cache —
            // a multi-second, progress-free phase the UI must announce.
            if (!sawFinalByte && total > 0 && loaded >= total) {
              sawFinalByte = true
              onInitialising?.()
            }
          },
          n_ctx: N_CTX,
          n_batch: N_BATCH,
          // Use the chat template embedded in the GGUF rather than guessing at
          // Shieldstral's formatting.
          jinja: true,
        },
      )
    } catch (error) {
      this.wllama = null
      throw new EngineError(describeLoadFailure(error), error)
    }

    if (!sawFinalByte) onInitialising?.()
    this.loaded = true

    // Logged rather than surfaced: if the community GGUF turns out to be a bad
    // conversion, the architecture and chat template are the first things
    // you'd want to see in the console.
    const info = wllama.getLoadedContextInfo()
    console.info('[edge-shield] model loaded', {
      architecture: info.metadata['general.architecture'],
      contextTrain: info.n_ctx_train,
      vocab: info.n_vocab,
      chatTemplate: wllama.getChatTemplate()?.slice(0, 400),
    })

    return {
      multithread: wllama.isMultithread(),
      threads: wllama.getNumThreads(),
      contextSize: info.n_ctx,
    }
  }

  async evaluate(input: EvaluationInput, signal?: AbortSignal): Promise<RawEvaluation> {
    const wllama = this.wllama
    if (!wllama || !this.loaded) throw new EngineError('Model is not loaded yet.')

    const startedAt = performance.now()
    let response
    try {
      response = await wllama.createChatCompletion({
        messages: buildMessages(input),
        // Shieldstral answers in exactly one token; anything more is waste.
        max_tokens: 1,
        temperature: 0,
        logprobs: true,
        top_logprobs: TOP_LOGPROBS,
        abortSignal: signal,
      })
    } catch (error) {
      throw new EngineError('Inference failed. See the browser console for details.', error)
    }

    const choice = response.choices[0]
    const first = choice?.logprobs?.content?.[0]

    if (!first) {
      throw new EngineError(
        'The model returned no token probabilities. Without logprobs a continuous score cannot be derived.',
      )
    }

    const topLogprobs: TokenLogprob[] = (first.top_logprobs ?? []).map((entry) => ({
      token: entry.token,
      logprob: entry.logprob,
    }))

    return {
      topLogprobs,
      sampledToken: first.token,
      durationMs: performance.now() - startedAt,
    }
  }

  async dispose(): Promise<void> {
    this.loaded = false
    const wllama = this.wllama
    this.wllama = null
    if (wllama) await wllama.exit()
  }

  /**
   * Wipes every cached model file and its metadata.
   *
   * wllama writes each shard's metadata only after the bytes land, so an
   * interrupted download leaves an orphaned partial file with no metadata.
   * Retrying then treats that file as complete and never re-downloads it, and
   * `ModelManager.getModels()` throws "Model file not found" because the shard
   * cannot be matched by `originalURL`. Clearing the cache is the only way out.
   *
   * `CacheManager` needs no wasm or worker, so this works even after a `load()`
   * that failed and nulled out `this.wllama`.
   */
  async clearModelCache(): Promise<void> {
    await new CacheManager().clear()
  }
}

function describeLoadFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (/abort/i.test(message)) return 'Model download cancelled.'
  if (/security error when calling getdirectory|not able to map the requested directory/i.test(message)) {
    return 'Model caching is unavailable in this browser window. Private browsing and Tor block it. Open the site in a normal window in Chrome, Edge, or Firefox.'
  }
  if (/model file not found/i.test(message)) {
    return 'The model cache is incomplete after an interrupted download. Click "Clear cache and retry" to start fresh.'
  }
  if (/quota|storage/i.test(message)) {
    return 'Not enough browser storage to cache the model. Free up disk space and try again.'
  }
  if (/memory|allocat/i.test(message)) {
    return 'Ran out of memory loading the model. Close other tabs and try again.'
  }
  if (/unknown model architecture|unsupported/i.test(message)) {
    return `This build of llama.cpp could not load the model: ${message}`
  }
  return `Failed to load the model: ${message}`
}
