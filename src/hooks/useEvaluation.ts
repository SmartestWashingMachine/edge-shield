import { useCallback, useRef, useState } from 'react'
import type { EvaluationInput } from '../lib/shieldstral/prompt'
import { scoreFromLogprobs, type ShieldScore } from '../lib/shieldstral/score'
import type { ShieldEngine } from '../lib/wllama/engine'

export interface EvaluationResult {
  score: ShieldScore
  sampledToken: string
  durationMs: number
  /** The exact input that produced this result, so the panel can't drift from the form. */
  input: EvaluationInput
}

export type EvaluationStatus = 'idle' | 'running' | 'done' | 'error'

export function useEvaluation(engine: ShieldEngine) {
  const [status, setStatus] = useState<EvaluationStatus>('idle')
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(
    async (input: EvaluationInput) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setStatus('running')
      setError(null)

      try {
        const raw = await engine.evaluate(input, controller.signal)
        // Scoring is deliberately done here, not in the engine: it is pure,
        // fully unit-tested, and identical for the real and fake engines.
        setResult({
          score: scoreFromLogprobs(raw.topLogprobs),
          sampledToken: raw.sampledToken,
          durationMs: raw.durationMs,
          input,
        })
        setStatus('done')
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      } finally {
        if (abortRef.current === controller) abortRef.current = null
      }
    },
    [engine],
  )

  const clear = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setResult(null)
    setError(null)
    setStatus('idle')
  }, [])

  return { status, result, error, run, clear }
}
