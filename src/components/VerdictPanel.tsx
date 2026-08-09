import { useId } from 'react'
import type { EvaluationResult } from '../hooks/useEvaluation'
import type { QueryPolarity } from '../lib/shieldstral/defaults'
import { resolveVerdict, type VerdictTone } from '../lib/shieldstral/score'
import { LogprobTable } from './LogprobTable'
import { Panel, PanelHeader } from './ui/primitives'

/** Full literal class names so Tailwind's scanner can see them. */
const TONE: Record<VerdictTone, { text: string; bg: string }> = {
  flag: { text: 'text-flag', bg: 'bg-flag' },
  pass: { text: 'text-pass', bg: 'bg-pass' },
  affirm: { text: 'text-affirm', bg: 'bg-affirm' },
  negate: { text: 'text-negate', bg: 'bg-negate' },
}

/**
 * The one place in the app permitted to use colour.
 *
 * Because every other surface is greyscale, the score bar and verdict chip are
 * the only saturated elements on screen — the eye lands on the answer without
 * being directed. Colour is never the sole carrier though: the verdict always
 * appears as text as well.
 */
export function VerdictPanel({
  result,
  threshold,
  polarity,
  onThresholdChange,
}: {
  result: EvaluationResult
  threshold: number
  /** null when the query was hand-edited, so its meaning is unknown. */
  polarity: QueryPolarity | null
  onThresholdChange: (next: number) => void
}) {
  const sliderId = useId()

  if (result.score.kind === 'indeterminate') {
    return (
      <Panel>
        <PanelHeader title="Result" />
        <div className="flex flex-col gap-3 px-5 py-6">
          <p className="text-sm text-unknown">Indeterminate</p>
          <p className="max-w-prose text-[13px] leading-relaxed text-ink-dim">{result.score.reason}</p>
          <p className="max-w-prose text-[11px] leading-relaxed text-ink-faint">
            No score is shown because none can be derived honestly. The model sampled{' '}
            <code className="text-ink-dim">{JSON.stringify(result.sampledToken)}</code>.
          </p>
        </div>
      </Panel>
    )
  }

  const { pYes, matched } = result.score
  const verdict = resolveVerdict(pYes, threshold, polarity)
  const tone = TONE[verdict.tone].text
  const barColour = TONE[verdict.tone].bg

  return (
    <Panel>
      <PanelHeader
        title="Result"
        aside={<span className="text-[11px] text-ink-faint tabular-nums">{Math.round(result.durationMs)} ms</span>}
      />

      <div className="flex flex-col gap-6 px-5 py-6">
        <div className="flex items-end justify-between gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">P(yes) =</span>
            <span className={`text-5xl leading-none tabular-nums ${tone}`}>{pYes.toFixed(3)}</span>
          </div>
          {/* role=status so the verdict is announced when it appears, and so
              it has one unambiguous identity rather than being loose text. */}
          <div
            role="status"
            className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] ${tone} border-current`}
          >
            {verdict.label}
          </div>
        </div>

        <ScoreBar pYes={pYes} threshold={threshold} barColour={barColour} />

        {polarity !== 'safety' && (
          <p className="text-[11px] leading-relaxed text-ink-faint">
            {polarity === 'neutral'
              ? 'This query asks about behaviour rather than safety, so the answer reads as a plain yes or no.'
              : 'Custom query — what “yes” means here isn’t known, so the answer reads as a plain yes or no rather than a safety verdict.'}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor={sliderId} className="text-[11px] uppercase tracking-[0.16em] text-ink-dim">
              Decision threshold
            </label>
            <span className="text-[11px] text-ink tabular-nums">{threshold.toFixed(2)}</span>
          </div>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={threshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Adjusting the threshold re-reads the same result. It does not re-run the model.
          </p>
        </div>

        <LogprobTable matched={matched} sampledToken={result.sampledToken} />
      </div>
    </Panel>
  )
}

function ScoreBar({ pYes, threshold, barColour }: { pYes: number; threshold: number; barColour: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-2.5 w-full bg-raised">
        <div className={`h-full transition-[width] duration-200 ease-out ${barColour}`} style={{ width: `${pYes * 100}%` }} />
        {/* Threshold marker: shows how far the score sits from the boundary,
            which matters more than the absolute number on a quantised build. */}
        <div
          className="absolute top-[-4px] bottom-[-4px] w-px bg-ink"
          style={{ left: `${threshold * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-ink-faint">
        <span>0.0 = no</span>
        <span>1.0 = yes</span>
      </div>
    </div>
  )
}
