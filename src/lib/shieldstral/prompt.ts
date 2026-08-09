/**
 * Prompt construction for Shieldstral-1.0-3B.
 *
 * Shieldstral is not a chat model. It is a single-forward-pass classifier: it
 * consumes a fixed system message plus a three-part user message and emits
 * exactly one token, `yes` or `no`. The structure below is taken verbatim from
 * the model card and must not drift — the model was trained on these exact
 * angle-bracket labels.
 */

export const SHIELDSTRAL_SYSTEM_PROMPT =
  'Judge whether the Document meets the requirements based on the Query and the Instruction provided. Note that the answer can only be "yes" or "no".'

export interface EvaluationInput {
  /** High-level framing: what kind of evaluation this is, and how strict. */
  instruct: string
  /** A single yes/no question asked about the document. */
  query: string
  /** The content under evaluation. */
  document: string
}

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

/**
 * Builds the message pair sent to the model.
 *
 * Field values are trimmed but otherwise passed through untouched — the
 * document is user content under evaluation, never instructions to follow, so
 * we deliberately do no escaping, rewriting or injection-filtering here. The
 * model is the thing being asked to judge it.
 */
export function buildMessages(input: EvaluationInput): ChatMessage[] {
  const instruct = input.instruct.trim()
  const query = input.query.trim()
  const document = input.document.trim()

  return [
    { role: 'system', content: SHIELDSTRAL_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `<Instruct>: ${instruct}\n\n<Query>: ${query}\n\n<Document>: ${document}`,
    },
  ]
}

/** Whether the form holds enough to run an evaluation. */
export function isEvaluable(input: EvaluationInput): boolean {
  return input.instruct.trim().length > 0 && input.query.trim().length > 0 && input.document.trim().length > 0
}
