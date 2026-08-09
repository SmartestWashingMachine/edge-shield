import type { LoadState } from '../hooks/useModelLoader'
import { formatBytes, formatDuration, formatPercent, formatRate } from '../lib/format'
import { MODEL } from '../lib/wllama/model'
import { Button, ProgressBar } from './ui/primitives'

/**
 * Loading lives entirely in the header chrome so the main column stays purely
 * about evaluation. The button carries the one fact worth knowing up front —
 * the download size — and everything else is deferred to the status strip that
 * appears only once loading is underway.
 */
export function ModelButton({ state, onLoad }: { state: LoadState; onLoad: () => void }) {
  switch (state.phase) {
    case 'idle':
      return (
        <Button variant="primary" onClick={onLoad}>
          Load model ({formatBytes(MODEL.sizeBytes, 1)})
        </Button>
      )
    case 'error':
      return <Button onClick={onLoad}>Retry</Button>
    case 'ready':
      return null
    case 'downloading':
      return (
        <Button variant="primary" disabled>
          Loading {formatPercent(state.progress)}
        </Button>
      )
    default:
      return (
        <Button variant="primary" disabled>
          Loading…
        </Button>
      )
  }
}

/**
 * The strip carries the explanatory burden the button sheds.
 *
 * Downloading and instantiating look identical to a naive progress UI but feel
 * completely different: one reports bytes, the other reports nothing at all for
 * several seconds. Conflating them makes the app look frozen, so each gets its
 * own copy and its own bar treatment.
 */
export function ModelStatusStrip({ state, onCancel }: { state: LoadState; onCancel: () => void }) {
  if (state.phase === 'idle') return null

  return (
    <div className="border-b border-hairline bg-panel">
      {(state.phase === 'checking-cache' || state.phase === 'initialising') && (
        <ProgressBar value={0} indeterminate />
      )}
      {state.phase === 'downloading' && <ProgressBar value={state.progress} />}

      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-2.5 text-[11px]">
        {state.phase === 'checking-cache' && <span className="text-ink-dim">Checking local cache…</span>}

        {state.phase === 'downloading' && (
          <>
            <span className="text-ink-dim">Downloading model weights — cached in your browser, happens once</span>
            <span className="tabular-nums text-ink-faint">{formatBytes(state.loadedBytes)}</span>
            <span className="tabular-nums text-ink-faint">
              {state.rate === null ? 'measuring…' : formatRate(state.rate)}
            </span>
            <span className="tabular-nums text-ink-faint">
              {state.eta === null ? 'estimating…' : `${formatDuration(state.eta)} remaining`}
            </span>
            <Button variant="quiet" className="ml-auto !px-2 !py-0.5" onClick={onCancel}>
              Cancel
            </Button>
          </>
        )}

        {state.phase === 'initialising' && (
          <span className="text-ink-dim">
            Compiling WebAssembly and allocating context — no progress to report, usually 5–15 seconds
          </span>
        )}

        {state.phase === 'ready' && (
          <>
            <span className="uppercase tracking-[0.16em] text-ink-dim">Model ready</span>
            {state.info && (
              <>
                <span className="text-ink-faint">
                  {state.info.multithread
                    ? `${state.info.threads} threads`
                    : 'single thread — cross-origin isolation unavailable'}
                </span>
                <span className="tabular-nums text-ink-faint">{state.info.contextSize.toLocaleString()} ctx</span>
              </>
            )}
          </>
        )}

        {state.phase === 'error' && (
          <>
            <span className="text-flag">Model failed to load</span>
            <span className="text-ink-dim">{state.error ?? 'Unknown error.'}</span>
          </>
        )}
      </div>
    </div>
  )
}
