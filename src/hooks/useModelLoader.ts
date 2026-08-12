import { useCallback, useRef, useState } from 'react'
import type { LoadedInfo, ShieldEngine } from '../lib/wllama/engine'

export type LoadPhase = 'idle' | 'checking-cache' | 'downloading' | 'initialising' | 'ready' | 'error'

export interface LoadState {
  phase: LoadPhase
  /** 0–1, only meaningful during `downloading`. */
  progress: number
  loadedBytes: number
  totalBytes: number
  /** Bytes/second over a rolling window, or null before enough samples. */
  rate: number | null
  /** Seconds remaining, or null when not estimable. */
  eta: number | null
  info: LoadedInfo | null
  error: string | null
}

const INITIAL: LoadState = {
  phase: 'idle',
  progress: 0,
  loadedBytes: 0,
  totalBytes: 0,
  rate: null,
  eta: null,
  info: null,
  error: null,
}

interface Sample {
  at: number
  loaded: number
}

/** Rolling window for rate estimation. Long enough to be stable, short enough to react. */
const WINDOW_MS = 5000

export function useModelLoader(engine: ShieldEngine) {
  const [state, setState] = useState<LoadState>(INITIAL)
  const samplesRef = useRef<Sample[]>([])
  const abortRef = useRef<AbortController | null>(null)

  /** Resolves true once the model is usable, so callers can chain work onto it. */
  const load = useCallback(async (): Promise<boolean> => {
    if (engine.isLoaded()) return true

    samplesRef.current = []
    const controller = new AbortController()
    abortRef.current = controller

    // wllama consults its cache before issuing any request, so the gap before
    // the first progress event is exactly "checking cache". On a repeat visit
    // it stays here briefly and then jumps straight to initialising, which is
    // why the UI must not render a stuck 0% bar during this phase.
    setState({ ...INITIAL, phase: 'checking-cache' })

    try {
      const info = await engine.load({
        signal: controller.signal,
        onProgress: ({ loaded, total }) => {
          const now = Date.now()
          const samples = samplesRef.current
          samples.push({ at: now, loaded })
          while (samples.length > 2 && now - samples[0].at > WINDOW_MS) {
            samples.shift()
          }

          const oldest = samples[0]
          const elapsedSec = (now - oldest.at) / 1000
          const rate = elapsedSec > 0.5 ? (loaded - oldest.loaded) / elapsedSec : null
          const remaining = Math.max(0, total - loaded)

          setState((prev) => ({
            ...prev,
            phase: 'downloading',
            progress: total > 0 ? loaded / total : 0,
            loadedBytes: loaded,
            totalBytes: total,
            rate,
            eta: rate && rate > 0 ? remaining / rate : null,
          }))
        },
        onInitialising: () => {
          setState((prev) => ({ ...prev, phase: 'initialising', progress: 1, rate: null, eta: null }))
        },
      })

      setState((prev) => ({ ...prev, phase: 'ready', progress: 1, rate: null, eta: null, info, error: null }))
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setState({ ...INITIAL, phase: 'error', error: message })
      return false
    } finally {
      abortRef.current = null
    }
  }, [engine])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    setState(INITIAL)
  }, [])

  return { state, load, cancel, reset }
}
