import { describe, expect, it } from 'vitest'
import { formatBytes, formatDuration, formatPercent, formatRate } from './format'

describe('formatBytes', () => {
  it('uses decimal units', () => {
    expect(formatBytes(999)).toBe('999 B')
    expect(formatBytes(1000)).toBe('1.00 KB')
    expect(formatBytes(1_500_000)).toBe('1.50 MB')
  })

  it('reports the model size the way HuggingFace quotes it', () => {
    expect(formatBytes(1_795_552_032)).toBe('1.80 GB')
  })

  it('handles zero and rejects nonsense', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-1)).toBe('—')
    expect(formatBytes(Number.NaN)).toBe('—')
  })
})

describe('formatRate', () => {
  it('appends a per-second suffix', () => {
    expect(formatRate(2_400_000)).toBe('2.4 MB/s')
  })

  it('returns a dash when there is no measurement yet', () => {
    expect(formatRate(0)).toBe('—')
    expect(formatRate(Number.NaN)).toBe('—')
  })
})

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(8)).toBe('8s')
    expect(formatDuration(59)).toBe('59s')
    expect(formatDuration(124)).toBe('2m 04s')
    expect(formatDuration(3600)).toBe('1h 00m')
    expect(formatDuration(4320)).toBe('1h 12m')
  })

  it('rejects nonsense', () => {
    expect(formatDuration(-1)).toBe('—')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('formatPercent', () => {
  it('rounds to whole percentages', () => {
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(0.456)).toBe('46%')
    expect(formatPercent(1)).toBe('100%')
  })

  it('clamps out-of-range input', () => {
    expect(formatPercent(1.4)).toBe('100%')
    expect(formatPercent(-0.2)).toBe('0%')
  })
})
