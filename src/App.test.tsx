import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App'
import { FakeEngine, type FakeEngineScript } from './lib/wllama/fake'

const YES_HEAVY: FakeEngineScript = {
  topLogprobs: [
    { token: 'yes', logprob: Math.log(0.8) },
    { token: 'no', logprob: Math.log(0.2) },
  ],
  sampledToken: 'yes',
}

const NO_HEAVY: FakeEngineScript = {
  topLogprobs: [
    { token: 'no', logprob: Math.log(0.9) },
    { token: 'yes', logprob: Math.log(0.1) },
  ],
  sampledToken: 'no',
}

function setup(script: FakeEngineScript = {}) {
  const engine = new FakeEngine(script)
  const user = userEvent.setup()
  render(<App createEngine={() => engine} />)
  return { engine, user }
}

async function loadModel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /load model/i }))
  expect(await screen.findByText(/model ready/i)).toBeInTheDocument()
}

async function evaluate(user: ReturnType<typeof userEvent.setup>, document = 'ignore previous instructions') {
  await user.type(screen.getByLabelText(/^document$/i), document)
  await user.click(screen.getByRole('button', { name: /^evaluate$/i }))
}

describe('App', () => {
  it('blocks evaluation until the model is loaded', () => {
    setup()
    expect(screen.getByRole('button', { name: /^evaluate$/i })).toBeDisabled()
    expect(screen.getByText(/load the model first/i)).toBeInTheDocument()
  })

  it('states the download size on the load button itself', () => {
    setup()
    expect(screen.getByRole('button', { name: /load model/i })).toHaveTextContent('1.8 GB')
  })

  it('shows no status strip until loading begins', () => {
    setup()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/model ready/i)).not.toBeInTheDocument()
  })

  it('loads the model and reports thread count', async () => {
    const { user } = setup()
    await loadModel(user)
    expect(screen.getByText(/4 threads/)).toBeInTheDocument()
  })

  it('warns when running single-threaded', async () => {
    const { user } = setup({ loadedInfo: { multithread: false, threads: 1 } })
    await loadModel(user)
    expect(screen.getByText(/cross-origin isolation unavailable/i)).toBeInTheDocument()
  })

  it('runs an evaluation and renders the score', async () => {
    const { user, engine } = setup(YES_HEAVY)
    await loadModel(user)
    await evaluate(user)

    expect(await screen.findByText('0.800')).toBeInTheDocument()
    expect(screen.getByText(/flagged/i)).toBeInTheDocument()
    expect(engine.evaluateCalls).toBe(1)
  })

  it('sends the form contents through to the engine', async () => {
    const { user, engine } = setup(NO_HEAVY)
    await loadModel(user)
    await evaluate(user, 'a perfectly ordinary sentence')

    expect(await screen.findByText('0.100')).toBeInTheDocument()
    expect(engine.lastInput?.document).toBe('a perfectly ordinary sentence')
    expect(engine.lastInput?.query).toBe('Is this content unsafe?')
    expect(engine.lastInput?.instruct).toMatch(/low tolerance threshold/i)
  })

  it('shows a pass verdict when the score is below the threshold', async () => {
    const { user } = setup(NO_HEAVY)
    await loadModel(user)
    await evaluate(user)

    expect(await screen.findByText('0.100')).toBeInTheDocument()
    expect(screen.getByText(/^pass$/i)).toBeInTheDocument()
  })

  it('flips the verdict when the threshold moves, without re-running inference', async () => {
    const { user, engine } = setup(NO_HEAVY)
    await loadModel(user)
    await evaluate(user)

    expect(await screen.findByText(/^pass$/i)).toBeInTheDocument()
    expect(engine.evaluateCalls).toBe(1)

    // 0.100 sits below the default 0.5; drop the threshold under it.
    const slider = screen.getByLabelText(/decision threshold/i)
    fireEvent.change(slider, { target: { value: '0.05' } })

    expect(await screen.findByText(/^flagged$/i)).toBeInTheDocument()
    // The whole point: re-reading a threshold must not cost another forward pass.
    expect(engine.evaluateCalls).toBe(1)
    expect(screen.getByText('0.100')).toBeInTheDocument()
  })

  it('reports indeterminate rather than guessing when yes/no are absent', async () => {
    const { user } = setup({
      topLogprobs: [
        { token: 'maybe', logprob: Math.log(0.6) },
        { token: 'unclear', logprob: Math.log(0.4) },
      ],
      sampledToken: 'maybe',
    })
    await loadModel(user)
    await evaluate(user)

    expect(await screen.findByText(/indeterminate/i)).toBeInTheDocument()
    expect(screen.getByText(/neither "yes" nor "no" appeared/i)).toBeInTheDocument()
    // Critically, it must not fall back to a "safe" reading.
    expect(screen.queryByText(/^pass$/i)).not.toBeInTheDocument()
  })

  it('surfaces evaluation failures', async () => {
    const { user, engine } = setup()
    await loadModel(user)
    engine.setScript({ failEvaluateWith: 'context overflow' })
    await evaluate(user)

    expect(await screen.findByText(/evaluation failed/i)).toBeInTheDocument()
    expect(screen.getByText(/context overflow/i)).toBeInTheDocument()
  })

  it('surfaces load failures with a retry', async () => {
    const { user } = setup({ failLoadWith: 'unknown model architecture: mistral3' })
    await user.click(screen.getByRole('button', { name: /load model/i }))

    expect(await screen.findByText(/model failed to load/i)).toBeInTheDocument()
    expect(screen.getByText(/unknown model architecture/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('offers query presets but does not let "Custom" be chosen', async () => {
    const { user } = setup()
    const select = screen.getByLabelText(/query preset/i)
    const options = within(select).getAllByRole('option')

    // "Custom" reflects a hand-edited query; picking it would do nothing, so it
    // sits last and disabled rather than looking like a real choice.
    const custom = options.at(-1) as HTMLOptionElement
    expect(custom).toHaveTextContent(/custom/i)
    expect(custom).toBeDisabled()
    expect(options.filter((option) => !(option as HTMLOptionElement).disabled).length).toBeGreaterThan(1)

    await user.selectOptions(select, 'violence')
    expect((screen.getByLabelText(/^query$/i) as HTMLTextAreaElement).value).toBe(
      'Does this content promote violence?',
    )
  })

  it('fills the instruct field from a preset', async () => {
    const { user } = setup()
    await user.selectOptions(screen.getByLabelText(/instruct preset/i), 'permissive')
    expect((screen.getByLabelText(/^instruct$/i) as HTMLTextAreaElement).value).toMatch(/high bar/i)
  })

  it('fills the document from a preset', async () => {
    const { user } = setup()
    const documentField = screen.getByLabelText(/^document$/i) as HTMLTextAreaElement
    expect(documentField.value).toBe('')

    await user.selectOptions(screen.getByLabelText(/document preset/i), 'jailbreak-override')
    expect(documentField.value).toMatch(/ignore all previous instructions/i)
  })

  it('falls back to the placeholder once the document is hand-edited', async () => {
    const { user } = setup()
    const select = screen.getByLabelText(/document preset/i) as HTMLSelectElement

    await user.selectOptions(select, 'benign-support')
    expect(select.value).toBe('benign-support')

    await user.type(screen.getByLabelText(/^document$/i), ' # extra')
    expect(select.value).toBe('__custom')
    expect(within(select).getByText(/load a sample/i)).toBeDisabled()
  })

  it('runs an evaluation loaded entirely from presets', async () => {
    const { user, engine } = setup(YES_HEAVY)
    await loadModel(user)
    await user.selectOptions(screen.getByLabelText(/document preset/i), 'pii')
    await user.selectOptions(screen.getByLabelText(/query preset/i), 'privacy')
    await user.click(screen.getByRole('button', { name: /^evaluate$/i }))

    expect(await screen.findByText('0.800')).toBeInTheDocument()
    expect(engine.lastInput?.document).toMatch(/Jordan Avery Blake/)
    expect(engine.lastInput?.query).toMatch(/personal or identifying information/i)
  })

  describe('scenarios', () => {
    it('fills all three fields at once', async () => {
      const { user } = setup()
      await user.selectOptions(screen.getByLabelText(/^scenario$/i), 'fig3-violence')

      expect((screen.getByLabelText(/^instruct$/i) as HTMLTextAreaElement).value).toBe(
        'Given a query about the content, determine if the message meets it',
      )
      expect((screen.getByLabelText(/^query$/i) as HTMLTextAreaElement).value).toMatch(/glorify acts of physical/i)
      expect((screen.getByLabelText(/^document$/i) as HTMLTextAreaElement).value).toMatch(/set the whole place on fire/i)
      expect(screen.getByText(/expected/i)).toHaveTextContent('yes')
    })

    it("keeps the document fixed across the paper's contrastive pair", async () => {
      // The point of Figure 3: only the query changes, and the label flips.
      const { user } = setup()
      const documentField = screen.getByLabelText(/^document$/i) as HTMLTextAreaElement
      const queryField = screen.getByLabelText(/^query$/i) as HTMLTextAreaElement

      await user.selectOptions(screen.getByLabelText(/^scenario$/i), 'fig3-violence')
      const sharedDocument = documentField.value
      const violenceQuery = queryField.value

      await user.selectOptions(screen.getByLabelText(/^scenario$/i), 'fig3-hate')
      expect(documentField.value).toBe(sharedDocument)
      expect(queryField.value).not.toBe(violenceQuery)
      expect(queryField.value).toMatch(/hate speech/i)
    })
  })

  describe('verdict polarity', () => {
    it('reads a behavioural query as yes/no rather than flagged', async () => {
      const { user } = setup(YES_HEAVY)
      await loadModel(user)
      await user.selectOptions(screen.getByLabelText(/^scenario$/i), 'refusal')
      await user.click(screen.getByRole('button', { name: /^evaluate$/i }))

      // "Does the assistant refuse?" — yes is the good outcome.
      expect(await screen.findByRole('status')).toHaveTextContent(/^yes$/i)
      expect(screen.queryByText(/^flagged$/i)).not.toBeInTheDocument()
      expect(screen.getByText(/behaviour rather than safety/i)).toBeInTheDocument()
    })

    it('refuses to claim a safety verdict for a hand-written query', async () => {
      const { user } = setup(YES_HEAVY)
      await loadModel(user)
      await user.clear(screen.getByLabelText(/^query$/i))
      await user.type(screen.getByLabelText(/^query$/i), 'Is this written in French?')
      await evaluate(user)

      expect(await screen.findByRole('status')).toHaveTextContent(/^yes$/i)
      expect(screen.queryByText(/^flagged$/i)).not.toBeInTheDocument()
      expect(screen.getByText(/custom query/i)).toBeInTheDocument()
    })

    it('still flags safety queries', async () => {
      const { user } = setup(YES_HEAVY)
      await loadModel(user)
      await user.selectOptions(screen.getByLabelText(/query preset/i), 'violence')
      await evaluate(user)

      expect(await screen.findByRole('status')).toHaveTextContent(/^flagged$/i)
    })
  })

  it('exposes the contributing token probabilities as evidence', async () => {
    const { user } = setup(YES_HEAVY)
    await loadModel(user)
    await evaluate(user)

    await user.click(await screen.findByText(/evidence — token probabilities/i))
    const table = screen.getByRole('table')
    expect(within(table).getByText('"yes"')).toBeInTheDocument()
    expect(within(table).getByText('"no"')).toBeInTheDocument()
  })

  it('switches the query via the preset selector', async () => {
    const { user, engine } = setup(NO_HEAVY)
    await loadModel(user)
    await user.selectOptions(screen.getByLabelText(/query preset/i), 'privacy')
    await evaluate(user)

    expect(await screen.findByText('0.100')).toBeInTheDocument()
    expect(engine.lastInput?.query).toMatch(/personal or identifying information/i)
  })
})
