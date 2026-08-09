import type { EvaluationInput } from '../shieldstral/prompt'
import type { TokenLogprob } from '../shieldstral/score'
import { EngineError, type LoadOptions, type LoadedInfo, type RawEvaluation, type ShieldEngine } from './engine'

/**
 * A scriptable stand-in for WllamaEngine.
 *
 * The whole point of the ShieldEngine interface is that the UI can be driven
 * end-to-end without a 7.6 MB wasm binary or a 1.8 GB download, so the test
 * suite runs in milliseconds and never touches the network.
 */
export interface FakeEngineScript {
  /** Progress fractions (0–1) emitted during load. Empty simulates a cache hit. */
  progressSteps?: number[]
  totalBytes?: number
  loadedInfo?: Partial<LoadedInfo>
  /** Rejects `load()` with this message. */
  failLoadWith?: string
  /** Rejects `evaluate()` with this message. */
  failEvaluateWith?: string
  /** Candidates returned for the single output token. */
  topLogprobs?: TokenLogprob[]
  sampledToken?: string
}

const DEFAULT_TOP_LOGPROBS: TokenLogprob[] = [
  { token: 'no', logprob: Math.log(0.82) },
  { token: 'yes', logprob: Math.log(0.17) },
  { token: 'maybe', logprob: Math.log(0.01) },
]

export class FakeEngine implements ShieldEngine {
  loadCalls = 0
  evaluateCalls = 0
  lastInput: EvaluationInput | null = null

  private loaded = false
  private script: FakeEngineScript

  constructor(script: FakeEngineScript = {}) {
    this.script = script
  }

  /** Swap the script between calls, e.g. to make the next evaluation fail. */
  setScript(script: FakeEngineScript): void {
    this.script = script
  }

  isLoaded(): boolean {
    return this.loaded
  }

  async load({ onProgress, onInitialising, signal }: LoadOptions): Promise<LoadedInfo> {
    this.loadCalls += 1

    if (this.script.failLoadWith) {
      throw new EngineError(this.script.failLoadWith)
    }

    const total = this.script.totalBytes ?? 1_795_552_032
    for (const fraction of this.script.progressSteps ?? []) {
      if (signal?.aborted) throw new EngineError('Model download cancelled.')
      onProgress?.({ loaded: Math.round(total * fraction), total })
      // Yield so React can flush state between ticks, mirroring real progress.
      await Promise.resolve()
    }

    onInitialising?.()
    this.loaded = true

    return {
      multithread: true,
      threads: 4,
      contextSize: 4096,
      ...this.script.loadedInfo,
    }
  }

  async evaluate(input: EvaluationInput, signal?: AbortSignal): Promise<RawEvaluation> {
    this.evaluateCalls += 1
    this.lastInput = input

    if (!this.loaded) throw new EngineError('Model is not loaded yet.')
    if (signal?.aborted) throw new EngineError('Evaluation cancelled.')
    if (this.script.failEvaluateWith) throw new EngineError(this.script.failEvaluateWith)

    return {
      topLogprobs: this.script.topLogprobs ?? DEFAULT_TOP_LOGPROBS,
      sampledToken: this.script.sampledToken ?? 'no',
      durationMs: 42,
    }
  }

  async dispose(): Promise<void> {
    this.loaded = false
  }
}
