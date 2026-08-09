import { SCENARIOS } from '../lib/shieldstral/defaults'
import type { EvaluationInput } from '../lib/shieldstral/prompt'

/**
 * Loads a complete Instruct + Query + Document triple in one go.
 *
 * The individual preset lists let you vary one field at a time; this exists for
 * the cases where all three have to agree to mean anything — most importantly
 * the paper's contrastive pair, where the same document flips from yes to no
 * purely because the query changed. Each scenario states the expected answer,
 * so a wrong result is obvious without knowing the paper.
 */
export function ScenarioBar({
  value,
  onLoad,
}: {
  value: EvaluationInput
  onLoad: (input: EvaluationInput) => void
}) {
  const active = SCENARIOS.find(
    (scenario) =>
      scenario.input.instruct === value.instruct &&
      scenario.input.query === value.query &&
      scenario.input.document === value.document,
  )

  return (
    <div className="flex flex-col gap-2 border border-hairline bg-panel px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label htmlFor="scenario" className="text-[11px] uppercase tracking-[0.16em] text-ink-dim">
          Scenario
        </label>
        <select
          id="scenario"
          className="max-w-full cursor-pointer truncate border border-hairline bg-raised px-2 py-1 text-[11px] text-ink-dim focus:outline-none"
          value={active?.id ?? '__custom'}
          onChange={(event) => {
            const scenario = SCENARIOS.find((s) => s.id === event.target.value)
            if (scenario) onLoad(scenario.input)
          }}
        >
          {SCENARIOS.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.label}
            </option>
          ))}
          <option value="__custom" disabled>
            Load a scenario…
          </option>
        </select>

        {active && (
          // Greyscale on purpose: this is the expected answer, not the model's.
          // Colouring it would put a second verdict-looking signal on screen.
          <span className="text-[11px] text-ink-faint">
            expected <span className="text-ink-dim">{active.expect}</span>
          </span>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-ink-faint">
        {active?.note ?? 'Fills all three fields at once with a matched example from the Shieldstral paper.'}
      </p>
    </div>
  )
}
