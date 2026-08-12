import { useState } from 'react'

import { AppShell } from './components/AppShell'
import { DocumentPanel, PolicyPanel } from './components/EvaluationForm'
import { ModelButton, ModelStatusStrip } from './components/ModelLoader'
import { ScenarioBar } from './components/ScenarioBar'
import { VerdictPanel } from './components/VerdictPanel'
import { Panel, PanelHeader } from './components/ui/primitives'
import { useEvaluation } from './hooks/useEvaluation'
import { useModelLoader } from './hooks/useModelLoader'
import { formatPercent } from './lib/format'
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

  const { state: loadState, load, cancel, clearAndReload } = useModelLoader(engine)
  const { status, result, error, run } = useEvaluation(engine)

  const [input, setInput] = useState(defaultEvaluationInput)
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)

  const ready = loadState.phase === 'ready'

  /**
   * One click gets you a score from a cold start: if the model isn't there yet,
   * fetch it and then run, rather than making the user press load, wait, and
   * press again.
   */
  const evaluate = async () => {
    if (ready || (await load())) {
      await run(input)
    }
  }

  return (
    <AppShell
      headerAction={<ModelButton state={loadState} onLoad={load} />}
      statusStrip={<ModelStatusStrip state={loadState} onCancel={cancel} onClearAndReload={clearAndReload} />}
    >
      <ScenarioBar value={input} onLoad={setInput} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* No self-start: both stretch to the row height so the two boxes line
            up, with Input's textarea absorbing the difference. */}
        <PolicyPanel value={input} onChange={setInput} />

        <DocumentPanel
          value={input}
          onChange={setInput}
          onSubmit={evaluate}
          busyLabel={busyLabelFor(loadState.phase, loadState.progress)}
          running={status === 'running'}
        />

        {/* Spans both columns at the 2-up breakpoint, then takes the third
            column and pins itself so a long document can't scroll it away. */}
        <div className="lg:col-span-2 xl:col-span-1">
          <div className="xl:sticky xl:top-6">
            {status === 'error' ? (
              <Panel>
                <PanelHeader title="Result" />
                <div className="px-5 py-6">
                  <p className="text-sm text-flag">Evaluation failed</p>
                  <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-ink-dim">{error}</p>
                </div>
              </Panel>
            ) : result ? (
              <VerdictPanel
                result={result}
                threshold={threshold}
                // Read from the input that produced this result, not the live
                // form — editing the query afterwards must not relabel a
                // verdict that was computed against the old one.
                polarity={polarityForQuery(result.input.query)}
                onThresholdChange={setThreshold}
              />
            ) : (
              <ResultPlaceholder ready={ready} running={status === 'running'} />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function busyLabelFor(phase: string, progress: number): string | null {
  switch (phase) {
    case 'checking-cache':
      return 'Preparing…'
    case 'downloading':
      return `Loading ${formatPercent(progress)}`
    case 'initialising':
      return 'Starting…'
    default:
      return null
  }
}

function ResultPlaceholder({ ready, running }: { ready: boolean; running: boolean }) {
  const message = running
    ? 'Running a single forward pass…'
    : ready
      ? 'Add a document and run an evaluation to see a score.'
      : 'Add a document and hit Evaluate — the model downloads on first use.'

  return (
    <Panel>
      <PanelHeader title="Result" />
      <div className="px-5 py-10">
        <p className="text-[13px] leading-relaxed text-ink-faint">{message}</p>
      </div>
    </Panel>
  )
}
