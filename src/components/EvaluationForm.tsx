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
}: {
  value: EvaluationInput
  onChange: (next: EvaluationInput) => void
}) {
  const instructId = useId()
  const queryId = useId()

  return (
    <Panel>
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
  disabled,
  running,
}: {
  value: EvaluationInput
  onChange: (next: EvaluationInput) => void
  onSubmit: () => void
  disabled: boolean
  running: boolean
}) {
  const documentId = useId()
  const canSubmit = !disabled && !running && isEvaluable(value)

  return (
    <Panel>
      <PanelHeader title="Document" />
      <form
        className="flex flex-col gap-5 px-5 py-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSubmit) onSubmit()
        }}
      >
        <Field
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
            value={value.document}
            onChange={(e) => onChange({ ...value, document: e.target.value })}
            placeholder="Paste the text to classify…"
          />
        </Field>

        <div className="flex items-center gap-4">
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {running ? 'Evaluating…' : 'Evaluate'}
          </Button>
          {disabled && <span className="text-[11px] text-ink-faint">Load the model first</span>}
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
