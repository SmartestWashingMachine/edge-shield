import type { ReactNode } from 'react'

/**
 * Shared width cap. Wide enough that the three working columns get real room on
 * a desktop, capped so the header wordmark and the far-right column don't drift
 * absurdly far apart on an ultrawide.
 */
const CONTAINER = 'mx-auto w-full max-w-[1600px] px-6'

export function AppShell({
  headerAction,
  statusStrip,
  children,
}: {
  headerAction?: ReactNode
  statusStrip?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-void">
      <header className="grid-backdrop border-b border-hairline">
        <div className={`${CONTAINER} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5`}>
          <h1 className="text-sm uppercase tracking-[0.22em] text-ink">Edge Shield</h1>
          <div className="flex items-center gap-5">{headerAction}</div>
        </div>
      </header>

      {statusStrip}

      <main className={`${CONTAINER} flex-1 py-8`}>{children}</main>

      <footer className="border-t border-hairline">
        <div className={`${CONTAINER} py-5`}>
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Shieldstral is a model by Mistral AI. I don&rsquo;t own it and this site isn&rsquo;t affiliated with them.
          </p>
        </div>
      </footer>
    </div>
  )
}

export { CONTAINER }
