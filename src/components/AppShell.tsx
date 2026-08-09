import type { ReactNode } from 'react'

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
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-5">
          <h1 className="text-sm uppercase tracking-[0.22em] text-ink">Edge Shield</h1>
          <div className="flex items-center gap-5">
            {headerAction}
          </div>
        </div>
      </header>

      {statusStrip}

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Shieldstral is a model by Mistral AI. I don&rsquo;t own it and this site isn&rsquo;t affiliated with them.
          </p>
        </div>
      </footer>
    </div>
  )
}
