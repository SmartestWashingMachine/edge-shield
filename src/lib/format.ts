/** Display helpers for the model loader's throughput readout. */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/** Decimal (SI) units, matching how download sizes are normally quoted. */
export function formatBytes(bytes: number, fractionDigits = 2): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1000) return `${Math.round(bytes)} B`

  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000
    unit += 1
  }
  return `${value.toFixed(fractionDigits)} ${UNITS[unit]}`
}

export function formatRate(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '—'
  return `${formatBytes(bytesPerSecond, 1)}/s`
}

/** Compact duration: "8s", "2m 04s", "1h 12m". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'

  const total = Math.round(seconds)
  if (total < 60) return `${total}s`

  const minutes = Math.floor(total / 60)
  if (minutes < 60) {
    return `${minutes}m ${String(total % 60).padStart(2, '0')}s`
  }
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

/** 0–1 fraction as an integer percentage string. */
export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return '—'
  const clamped = Math.min(1, Math.max(0, fraction))
  return `${Math.round(clamped * 100)}%`
}
