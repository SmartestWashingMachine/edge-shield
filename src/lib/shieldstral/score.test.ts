import { describe, expect, it } from 'vitest'
import { isYes, resolveVerdict, scoreFromLogprobs, type TokenLogprob } from './score'

/** Build a logprob entry from a linear probability, as the model would report it. */
const p = (token: string, probability: number): TokenLogprob => ({ token, logprob: Math.log(probability) })

function expectScored(result: ReturnType<typeof scoreFromLogprobs>) {
  if (result.kind !== 'scored') throw new Error(`expected a score, got: ${result.reason}`)
  return result
}

describe('scoreFromLogprobs', () => {
  it('normalises over the yes/no pair, ignoring other mass', () => {
    // 0.3 / (0.3 + 0.1) = 0.75, regardless of the 0.6 sitting elsewhere.
    const result = expectScored(scoreFromLogprobs([p('yes', 0.3), p('no', 0.1), p('maybe', 0.6)]))
    expect(result.pYes).toBeCloseTo(0.75, 10)
  })

  it('is symmetric', () => {
    const result = expectScored(scoreFromLogprobs([p('yes', 0.1), p('no', 0.3)]))
    expect(result.pYes).toBeCloseTo(0.25, 10)
  })

  describe('token variants', () => {
    // The model card lists yes / yes. / "yes" / 'yes' as accepted forms, and
    // tokenizers add leading-space and SentencePiece-marker variants on top.
    const yesForms = ['yes', 'Yes', 'YES', ' yes', '▁yes', 'yes.', '"yes"', "'yes'", 'yes,', ' Yes.']
    const noForms = ['no', 'No', 'NO', ' no', '▁no', 'no.', '"no"', "'no'", 'no,', ' No.']

    it.each(yesForms)('treats %j as yes', (token) => {
      const result = expectScored(scoreFromLogprobs([{ token, logprob: Math.log(0.9) }, p('no', 0.1)]))
      expect(result.pYes).toBeCloseTo(0.9, 10)
    })

    it.each(noForms)('treats %j as no', (token) => {
      const result = expectScored(scoreFromLogprobs([{ token, logprob: Math.log(0.9) }, p('yes', 0.1)]))
      expect(result.pYes).toBeCloseTo(0.1, 10)
    })

    it('does not match tokens that merely contain yes or no', () => {
      const result = scoreFromLogprobs([p('yesterday', 0.5), p('nothing', 0.4), p('know', 0.1)])
      expect(result.kind).toBe('indeterminate')
    })
  })

  it('sums duplicate variants of the same polarity', () => {
    // "yes" and " Yes." are distinct vocabulary entries; their mass must combine.
    const result = expectScored(scoreFromLogprobs([p('yes', 0.3), p(' Yes.', 0.3), p('no', 0.2)]))
    expect(result.pYes).toBeCloseTo(0.75, 10)
  })

  it('saturates to 1 when only yes is present', () => {
    const result = expectScored(scoreFromLogprobs([p('yes', 0.99), p('perhaps', 0.01)]))
    expect(result.pYes).toBe(1)
  })

  it('saturates to 0 when only no is present', () => {
    const result = expectScored(scoreFromLogprobs([p('no', 0.99), p('perhaps', 0.01)]))
    expect(result.pYes).toBe(0)
  })

  it('stays stable when logprobs are extreme', () => {
    // exp(-800) underflows to 0; working in log space must survive it.
    const result = expectScored(scoreFromLogprobs([
      { token: 'yes', logprob: -800 },
      { token: 'no', logprob: -805 },
    ]))
    expect(Number.isFinite(result.pYes)).toBe(true)
    expect(result.pYes).toBeCloseTo(1 / (1 + Math.exp(-5)), 10)
  })

  it('returns 0.5 for a perfect tie', () => {
    const result = expectScored(scoreFromLogprobs([p('yes', 0.4), p('no', 0.4)]))
    expect(result.pYes).toBeCloseTo(0.5, 10)
  })

  it('reports which tokens contributed', () => {
    const result = expectScored(scoreFromLogprobs([p('yes', 0.6), p('junk', 0.2), p('no', 0.2)]))
    expect(result.matched).toHaveLength(2)
    expect(result.matched.map((m) => m.polarity)).toEqual(['yes', 'no'])
    expect(result.matched[0].probability).toBeCloseTo(0.6, 10)
  })

  describe('indeterminate', () => {
    it('when neither polarity appears', () => {
      const result = scoreFromLogprobs([p('maybe', 0.5), p('unsure', 0.5)])
      expect(result.kind).toBe('indeterminate')
      if (result.kind === 'indeterminate') expect(result.reason).toContain('top 2')
    })

    it('when there are no candidates at all', () => {
      expect(scoreFromLogprobs([]).kind).toBe('indeterminate')
    })
  })
})

describe('isYes', () => {
  it('treats the threshold itself as yes', () => {
    expect(isYes(0.5, 0.5)).toBe(true)
    expect(isYes(0.49, 0.5)).toBe(false)
  })

  it('respects a moved threshold', () => {
    expect(isYes(0.4, 0.3)).toBe(true)
    expect(isYes(0.4, 0.9)).toBe(false)
  })
})

describe('resolveVerdict', () => {
  it('uses the danger palette for safety queries', () => {
    expect(resolveVerdict(0.8, 0.5, 'safety')).toEqual({ label: 'Flagged', tone: 'flag' })
    expect(resolveVerdict(0.2, 0.5, 'safety')).toEqual({ label: 'Pass', tone: 'pass' })
  })

  it('reads behavioural queries as a plain yes/no', () => {
    // "Does the assistant refuse to answer?" — yes is a *good* outcome here, so
    // calling it FLAGGED would invert the meaning.
    expect(resolveVerdict(0.8, 0.5, 'neutral')).toEqual({ label: 'Yes', tone: 'affirm' })
    expect(resolveVerdict(0.2, 0.5, 'neutral')).toEqual({ label: 'No', tone: 'negate' })
  })

  it('never claims a safety verdict for a hand-written query', () => {
    expect(resolveVerdict(0.99, 0.5, null)).toEqual({ label: 'Yes', tone: 'affirm' })
    expect(resolveVerdict(0.01, 0.5, null)).toEqual({ label: 'No', tone: 'negate' })
  })

  it('follows the threshold', () => {
    expect(resolveVerdict(0.4, 0.3, 'safety').label).toBe('Flagged')
    expect(resolveVerdict(0.4, 0.9, 'safety').label).toBe('Pass')
  })
})
