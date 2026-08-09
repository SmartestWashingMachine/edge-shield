import type { ButtonHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

/**
 * Shared primitives. Everything here is strictly greyscale — colour in this
 * app is reserved for the verdict alone.
 */

export function Button({
  variant = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'quiet' }) {
  const base =
    'px-4 py-2 text-xs uppercase tracking-[0.14em] border transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed'
  const variants = {
    default: 'border-hairline-strong text-ink-dim hover:text-ink hover:border-ink-faint',
    primary: 'border-ink bg-ink text-void hover:bg-ink-dim hover:border-ink-dim font-medium',
    quiet: 'border-transparent text-ink-faint hover:text-ink-dim',
  }
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  action,
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={htmlFor} className="text-[11px] uppercase tracking-[0.16em] text-ink-dim">
          {label}
        </label>
        {action}
      </div>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  )
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full resize-y border border-hairline bg-panel px-3 py-2.5 text-[13px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-hairline-strong focus:outline-none ${className}`}
      {...props}
    />
  )
}

export function ProgressBar({ value, indeterminate = false }: { value: number; indeterminate?: boolean }) {
  const pct = Math.min(100, Math.max(0, value * 100))
  return (
    <div
      className="h-1 w-full overflow-hidden bg-raised"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
    >
      {indeterminate ? (
        <div className="h-full w-1/3 animate-[shift_1.4s_ease-in-out_infinite] bg-ink-faint" />
      ) : (
        <div className="h-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
      )}
    </div>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`border border-hairline bg-panel ${className}`}>{children}</section>
}

export function PanelHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3">
      <h2 className="text-[11px] uppercase tracking-[0.18em] text-ink-dim">{title}</h2>
      {aside}
    </header>
  )
}
