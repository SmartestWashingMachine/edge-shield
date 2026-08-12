import { useId } from 'react'
import { DOCUMENT_PRESETS, INSTRUCT_PRESETS, QUERY_PRESETS } from '../lib/shieldstral/defaults'
import type { EvaluationInput } from '../lib/shieldstral/prompt'
import { isEvaluable } from '../lib/shieldstral/prompt'
import { Button, Field, Panel, PanelHeader, TextArea } from './ui/primitives'

/**
 * The form is split across both columns so nothing important sits below the
 * fold: the policy (what you're screening for) is configured once on the left,
 * while the document and its verdict — the parts you actually iterate on —
 * stack together on the right.
 */

export function PolicyPanel({
  value,
  onChange,
  className,
}: {
  value: EvaluationInput
  onChange: (next: EvaluationInput) => void
  className?: string
}) {
  const instructId = useId()
  const queryId = useId()

  return (
    <Panel className={className}>
      <PanelHeader title="Policy" />
      <div className="flex flex-col gap-6 px-5 py-5">
        <Field
          label="Instruct"
          htmlFor={instructId}
          hint="A persona plus a tolerance setting. The strictness wording is the main lever — it moves borderline scores more than anything else here."
          action={
            <PresetSelect
              ariaLabel="Instruct preset"
              options={INSTRUCT_PRESETS.map((p) => ({ id: p.id, label: p.label, value: p.instruct }))}
              current={value.instruct}
              onSelect={(instruct) => onChange({ ...value, instruct })}
            />
          }
        >
          <TextArea
            id={instructId}
            rows={5}
            value={value.instruct}
            onChange={(e) => onChange({ ...value, instruct: e.target.value })}
            placeholder="Describe the evaluation context…"
          />
        </Field>

        <Field
          label="Query"
          htmlFor={queryId}
          hint="One short yes/no question. Say “this content” rather than “the Document” — that is the phrasing the model was trained on."
          action={
            <PresetSelect
              ariaLabel="Query preset"
              options={QUERY_PRESETS.map((p) => ({ id: p.id, label: p.label, value: p.query }))}
              current={value.query}
              onSelect={(query) => onChange({ ...value, query })}
            />
          }
        >
          <TextArea
            id={queryId}
            rows={4}
            value={value.query}
            onChange={(e) => onChange({ ...value, query: e.target.value })}
            placeholder="Does the Document…?"
          />
        </Field>
      </div>
    </Panel>
  )
}

export function DocumentPanel({
  value,
  onChange,
  onSubmit,
  busyLabel,
  running,
  className,
}: {
  value: EvaluationInput
  onChange: (next: EvaluationInput) => void
  onSubmit: () => void | Promise<void>
  /**
   * Non-null while the model is loading, in which case it replaces the button
   * label. Evaluate stays clickable before the model exists — it loads first
   * and then runs, so getting a score is never a two-step affair.
   */
  busyLabel: string | null
  running: boolean
  className?: string
}) {
  const documentId = useId()
  const busy = busyLabel !== null || running
  const canSubmit = !busy && isEvaluable(value)

  return (
    // Stretches to match Policy's height in the same grid row, with the
    // textarea taking up the slack rather than leaving dead space at the bottom.
    <Panel className={`flex flex-col ${className ?? ''}`}>
      <PanelHeader title="Input" />
      <form
        className="flex flex-1 flex-col gap-5 px-5 py-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSubmit) onSubmit()
        }}
      >
        <Field
          className="min-h-0 flex-1"
          label="Document"
          htmlFor={documentId}
          hint="The content under evaluation. Never leaves this tab."
          action={
            <PresetSelect
              ariaLabel="Document preset"
              placeholder="Load a sample…"
              options={DOCUMENT_PRESETS.map((p) => ({ id: p.id, label: p.label, value: p.document }))}
              current={value.document}
              onSelect={(document) => onChange({ ...value, document })}
            />
          }
        >
          <TextArea
            id={documentId}
            rows={12}
            className="min-h-0 flex-1"
            value={value.document}
            onChange={(e) => onChange({ ...value, document: e.target.value })}
            placeholder="Paste the text to classify…"
          />
        </Field>

        <div className="flex items-center gap-4">
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {busyLabel ?? (running ? 'Evaluating…' : 'Evaluate')}
          </Button>
        </div>
      </form>
    </Panel>
  )
}

/**
 * A preset picker that reflects hand-edited state.
 *
 * The trailing option is disabled rather than absent: it still *displays* when
 * the field no longer matches any preset, but choosing it would do nothing, so
 * it is not offered as a real option.
 */
function PresetSelect({
  ariaLabel,
  options,
  current,
  onSelect,
  placeholder = 'Custom…',
}: {
  ariaLabel: string
  options: { id: string; label: string; value: string }[]
  current: string
  onSelect: (value: string) => void
  placeholder?: string
}) {
  const matched = options.find((option) => option.value === current)

  return (
    <select
      aria-label={ariaLabel}
      className="max-w-[13rem] cursor-pointer truncate border border-hairline bg-raised px-2 py-1 text-[11px] text-ink-dim focus:outline-none"
      value={matched?.id ?? '__custom'}
      onChange={(e) => {
        const option = options.find((o) => o.id === e.target.value)
        if (option) onSelect(option.value)
      }}
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
      <option value="__custom" disabled>
        {placeholder}
      </option>
    </select>
  )
}
