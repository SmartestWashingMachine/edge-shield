import type { EvaluationInput } from '../shieldstral/prompt'
import type { TokenLogprob } from '../shieldstral/score'

/**
 * The seam between the app and wllama.
 *
 * Everything above this interface is pure and testable; everything below it is
 * a 7.6 MB WebAssembly binary and a 1.8 GB download. Tests inject `FakeEngine`
 * and never load either.
 */
export interface ShieldEngine {
  load(options: LoadOptions): Promise<LoadedInfo>
  evaluate(input: EvaluationInput, signal?: AbortSignal): Promise<RawEvaluation>
  isLoaded(): boolean
  dispose(): Promise<void>
}

export interface DownloadProgress {
  loaded: number
  total: number
}

export interface LoadOptions {
  onProgress?: (progress: DownloadProgress) => void
  /** Fired once the download finishes and wllama begins wasm/context setup. */
  onInitialising?: () => void
  signal?: AbortSignal
}

export interface LoadedInfo {
  multithread: boolean
  threads: number
  contextSize: number
}

export interface RawEvaluation {
  /** Candidates for the single generated token. */
  topLogprobs: TokenLogprob[]
  /** The token the model actually sampled, for the evidence panel. */
  sampledToken: string
  /** Wall-clock duration of the forward pass, in milliseconds. */
  durationMs: number
}

export class EngineError extends Error {
  override readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'EngineError'
    this.cause = cause
  }
}
