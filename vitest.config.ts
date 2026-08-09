import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Tests never touch wllama, the network, or a real model — the UI is driven by
 * the injectable FakeEngine (src/lib/wllama/fake.ts), so the suite stays fast
 * and deterministic. The real 1.8 GB model is verified by hand.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // The default `forks` pool fails to hand off to its workers on this
    // machine (they time out before the first test is collected). Threads
    // start reliably and share the jsdom warm-up cost across files.
    pool: 'threads',
  },
})
