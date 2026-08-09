/**
 * Turning Shieldstral's single output token into a continuous score.
 *
 * The model emits one token. Its usable output is not that token's text but
 * the *probability mass* sitting on `yes` versus `no`, which is why the whole
 * app hinges on wllama returning `top_logprobs`. Reading only the sampled text
 * would collapse a calibrated 0–1 score into a coin flip.
 */

export interface TokenLogprob {
  token: string
  logprob: number
}

export interface MatchedToken extends TokenLogprob {
  polarity: 'yes' | 'no'
  /** Linear probability, i.e. exp(logprob). For display only. */
  probability: number
}

export type ShieldScore =
  | {
      kind: 'scored'
      /** P(answer = "yes"), normalised over the yes/no pair only. */
      pYes: number
      /** Tokens that contributed, for the evidence panel. */
      matched: MatchedToken[]
    }
  | {
      kind: 'indeterminate'
      reason: string
    }

export type VerdictTone = 'flag' | 'pass' | 'affirm' | 'negate'

export interface ResolvedVerdict {
  label: string
  tone: VerdictTone
}

/**
 * The model card lists `yes`, `yes.`, `"yes"` and `'yes'` (and the `no`
 * equivalents) as accepted forms. Tokenizers additionally emit leading-space
 * and SentencePiece-marker variants, so we normalise rather than enumerate:
 * strip the word-boundary markers, surrounding quotes and trailing punctuation,
 * then compare.
 */
function normaliseToken(raw: string): string {
  return raw
    .replace(/^[▁\s]+/, '') // SentencePiece "▁" marker and leading spaces
    .replace(/[\s]+$/, '')
    .toLowerCase()
    .replace(/^["'`]+/, '')
    .replace(/["'`.,!:;]+$/, '')
}

function classify(raw: string): 'yes' | 'no' | null {
  const token = normaliseToken(raw)
  if (token === 'yes') return 'yes'
  if (token === 'no') return 'no'
  return null
}

/**
 * log(Σ exp(xs)) computed in a way that does not overflow or underflow when
 * the logprobs are far from zero. Returns -Infinity for an empty input, which
 * is the correct identity here (zero probability mass).
 */
function logSumExp(xs: number[]): number {
  if (xs.length === 0) return Number.NEGATIVE_INFINITY
  const max = Math.max(...xs)
  if (!Number.isFinite(max)) return max
  let sum = 0
  for (const x of xs) sum += Math.exp(x - max)
  return max + Math.log(sum)
}

/** Numerically stable logistic function. */
function sigmoid(x: number): number {
  if (x >= 0) {
    return 1 / (1 + Math.exp(-x))
  }
  const e = Math.exp(x)
  return e / (1 + e)
}

/**
 * Derives P(yes) from the top-N logprobs of the model's single output token.
 *
 * Rather than exponentiating and dividing — which loses precision when one side
 * dominates — we work in log space throughout and finish with a sigmoid of the
 * log-odds, which is exactly equivalent to pYes / (pYes + pNo).
 */
export function scoreFromLogprobs(top: TokenLogprob[]): ShieldScore {
  if (top.length === 0) {
    return { kind: 'indeterminate', reason: 'The model returned no token probabilities.' }
  }

  const matched: MatchedToken[] = []
  const yesLogprobs: number[] = []
  const noLogprobs: number[] = []

  for (const entry of top) {
    const polarity = classify(entry.token)
    if (!polarity) continue
    matched.push({ ...entry, polarity, probability: Math.exp(entry.logprob) })
    ;(polarity === 'yes' ? yesLogprobs : noLogprobs).push(entry.logprob)
  }

  if (matched.length === 0) {
    return {
      kind: 'indeterminate',
      reason: `Neither "yes" nor "no" appeared in the top ${top.length} tokens. The model did not answer the query in the expected form.`,
    }
  }

  const logYes = logSumExp(yesLogprobs)
  const logNo = logSumExp(noLogprobs)

  // Only one side present: the score saturates, which is the honest reading —
  // all observed mass sits on that answer.
  const pYes = sigmoid(logYes - logNo)

  return { kind: 'scored', pYes, matched }
}

/** A score at or above the threshold means the model answered "yes". */
export function isYes(pYes: number, threshold: number): boolean {
  return pYes >= threshold
}

/**
 * Turns a score into a label, given what the query was actually asking.
 *
 * Only a *safety* query licenses the danger palette. A behavioural query like
 * "Does the assistant refuse to answer the user's request?" has a "yes" that is
 * a good outcome, and a hand-written query has a meaning we cannot know at all
 * — calling either of those FLAGGED would be a straightforward lie. Those read
 * as a plain YES / NO on a neutral palette instead.
 *
 * The upshot is that the colour tells you two things at once: which way the
 * answer went, and whether a safety judgement was even being made.
 */
export function resolveVerdict(
  pYes: number,
  threshold: number,
  polarity: 'safety' | 'neutral' | null,
): ResolvedVerdict {
  const yes = isYes(pYes, threshold)

  if (polarity === 'safety') {
    return yes ? { label: 'Flagged', tone: 'flag' } : { label: 'Pass', tone: 'pass' }
  }
  return yes ? { label: 'Yes', tone: 'affirm' } : { label: 'No', tone: 'negate' }
}
