import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FakeEngine } from '../lib/wllama/fake'
import { useModelLoader } from './useModelLoader'

describe('useModelLoader', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useModelLoader(new FakeEngine()))
    expect(result.current.state.phase).toBe('idle')
    expect(result.current.state.progress).toBe(0)
  })

  it('walks through downloading to ready', async () => {
    const engine = new FakeEngine({ progressSteps: [0.25, 0.5, 1], totalBytes: 1000 })
    const { result } = renderHook(() => useModelLoader(engine))

    await act(async () => {
      await result.current.load()
    })

    await waitFor(() => expect(result.current.state.phase).toBe('ready'))
    expect(result.current.state.progress).toBe(1)
    expect(result.current.state.info).toEqual({ multithread: true, threads: 4, contextSize: 4096 })
    expect(result.current.state.error).toBeNull()
  })

  it('tracks bytes and fraction during download', async () => {
    const engine = new FakeEngine({ progressSteps: [0.4], totalBytes: 2000 })
    const seen: number[] = []

    const { result } = renderHook(() => useModelLoader(engine))
    await act(async () => {
      const promise = result.current.load()
      seen.push(result.current.state.progress)
      await promise
    })

    await waitFor(() => expect(result.current.state.phase).toBe('ready'))
    expect(result.current.state.totalBytes).toBe(2000)
    expect(result.current.state.loadedBytes).toBe(800)
  })

  it('reaches ready without a download when the model is already cached', async () => {
    // No progress events at all — wllama serves straight from the Cache API.
    // The UI must not sit on a stuck 0% bar in this case.
    const engine = new FakeEngine({ progressSteps: [] })
    const { result } = renderHook(() => useModelLoader(engine))

    await act(async () => {
      await result.current.load()
    })

    await waitFor(() => expect(result.current.state.phase).toBe('ready'))
    expect(result.current.state.loadedBytes).toBe(0)
  })

  it('surfaces load failures', async () => {
    const engine = new FakeEngine({ failLoadWith: 'unknown model architecture' })
    const { result } = renderHook(() => useModelLoader(engine))

    await act(async () => {
      await result.current.load()
    })

    await waitFor(() => expect(result.current.state.phase).toBe('error'))
    expect(result.current.state.error).toBe('unknown model architecture')
    expect(result.current.state.info).toBeNull()
  })

  it('reports single-thread mode when cross-origin isolation is unavailable', async () => {
    const engine = new FakeEngine({ loadedInfo: { multithread: false, threads: 1 } })
    const { result } = renderHook(() => useModelLoader(engine))

    await act(async () => {
      await result.current.load()
    })

    await waitFor(() => expect(result.current.state.info?.multithread).toBe(false))
  })

  it('does not reload an already-loaded engine', async () => {
    const engine = new FakeEngine()
    const { result } = renderHook(() => useModelLoader(engine))

    await act(async () => {
      await result.current.load()
    })
    await act(async () => {
      await result.current.load()
    })

    expect(engine.loadCalls).toBe(1)
  })

  it('resets back to idle', async () => {
    const engine = new FakeEngine()
    const { result } = renderHook(() => useModelLoader(engine))

    await act(async () => {
      await result.current.load()
    })
    act(() => {
      result.current.reset()
    })

    expect(result.current.state.phase).toBe('idle')
  })
})
