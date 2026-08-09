import type { MatchedToken } from '../lib/shieldstral/score'

/**
 * The evidence panel: the raw token probabilities the score was derived from.
 *
 * Worth surfacing because the score is a normalisation over just these two
 * outcomes — if the model put most of its mass elsewhere, the yes/no split can
 * look confident while resting on very little. The absolute column makes that
 * visible.
 */
export function LogprobTable({ matched, sampledToken }: { matched: MatchedToken[]; sampledToken: string }) {
  const totalMass = matched.reduce((sum, token) => sum + token.probability, 0)

  return (
    <details className="border-t border-hairline pt-4">
      <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink-dim">
        Evidence — token probabilities
      </summary>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[26rem] text-[11px] tabular-nums">
          <thead>
            <tr className="text-left text-ink-faint">
              <th className="pb-2 pr-4 font-normal uppercase tracking-[0.14em]">Token</th>
              <th className="pb-2 pr-4 font-normal uppercase tracking-[0.14em]">Polarity</th>
              <th className="pb-2 pr-4 font-normal uppercase tracking-[0.14em]">Logprob</th>
              <th className="pb-2 font-normal uppercase tracking-[0.14em]">Probability</th>
            </tr>
          </thead>
          <tbody className="text-ink-dim">
            {matched.map((token, index) => (
              <tr key={`${token.token}-${index}`} className="border-t border-hairline/60">
                <td className="py-1.5 pr-4 text-ink">{JSON.stringify(token.token)}</td>
                <td className="py-1.5 pr-4">{token.polarity}</td>
                <td className="py-1.5 pr-4">{token.logprob.toFixed(4)}</td>
                <td className="py-1.5">{token.probability.toFixed(5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 max-w-prose text-[11px] leading-relaxed text-ink-faint">
        Sampled token <code className="text-ink-dim">{JSON.stringify(sampledToken)}</code>. These candidates hold{' '}
        <span className="text-ink-dim tabular-nums">{(totalMass * 100).toFixed(1)}%</span> of the model&rsquo;s total
        probability mass for this position; the score is a normalisation over them alone.
      </p>
    </details>
  )
}
