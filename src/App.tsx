import { useState } from 'react'

import { AppShell } from './components/AppShell'
import { DocumentPanel, PolicyPanel } from './components/EvaluationForm'
import { ModelButton, ModelStatusStrip } from './components/ModelLoader'
import { ScenarioBar } from './components/ScenarioBar'
import { VerdictPanel } from './components/VerdictPanel'
import { Panel, PanelHeader } from './components/ui/primitives'
import { useEvaluation } from './hooks/useEvaluation'
import { useModelLoader } from './hooks/useModelLoader'
import { DEFAULT_THRESHOLD, defaultEvaluationInput, polarityForQuery } from './lib/shieldstral/defaults'
import type { ShieldEngine } from './lib/wllama/engine'
import { WllamaEngine } from './lib/wllama/wllamaEngine'

/**
 * The engine is injected rather than constructed inline so the test suite can
 * drive the whole app through FakeEngine — no wasm, no 1.8 GB download.
 *
 * It must be created once and kept stable for the component's lifetime: loading
 * and evaluating happen on the same instance, so a fresh engine per render
 * would report "not loaded" the moment the status update repaints.
 */
export default function App({ createEngine = () => new WllamaEngine() }: { createEngine?: () => ShieldEngine }) {
  const [engine] = useState(() => createEngine())

  const { state: loadState, load, cancel } = useModelLoader(engine)
  const { status, result, error, run } = useEvaluation(engine)

  const [input, setInput] = useState(defaultEvaluationInput)
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)

  const ready = loadState.phase === 'ready'

  return (
    <AppShell
      headerAction={<ModelButton state={loadState} onLoad={load} />}
      statusStrip={<ModelStatusStrip state={loadState} onCancel={cancel} />}
    >
      <ScenarioBar value={input} onLoad={setInput} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        <PolicyPanel value={input} onChange={setInput} />

        <div className="flex flex-col gap-6">
          <DocumentPanel
            value={input}
            onChange={setInput}
            onSubmit={() => run(input)}
            disabled={!ready}
            running={status === 'running'}
          />
          {status === 'error' && (
            <Panel>
              <PanelHeader title="Result" />
              <div className="px-5 py-6">
                <p className="text-sm text-flag">Evaluation failed</p>
                <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-ink-dim">{error}</p>
              </div>
            </Panel>
          )}

          {result && status !== 'error' && (
            <VerdictPanel
              result={result}
              threshold={threshold}
              // Read from the input that produced this result, not the live
              // form — editing the query afterwards must not relabel a verdict
              // that was computed against the old one.
              polarity={polarityForQuery(result.input.query)}
              onThresholdChange={setThreshold}
            />
          )}

          {!result && status !== 'error' && <ResultPlaceholder ready={ready} running={status === 'running'} />}
        </div>
      </div>
    </AppShell>
  )
}

function ResultPlaceholder({ ready, running }: { ready: boolean; running: boolean }) {
  const message = running
    ? 'Running a single forward pass…'
    : ready
      ? 'Fill in the document and run an evaluation to see a score.'
      : 'Load the model to begin.'

  return (
    <Panel>
      <PanelHeader title="Result" />
      <div className="px-5 py-10">
        <p className="text-[13px] text-ink-faint">{message}</p>
      </div>
    </Panel>
  )
}
