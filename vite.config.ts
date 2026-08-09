import { defineConfig, type Plugin, type ViteDevServer, type PreviewServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * wllama runs llama.cpp in WebAssembly and uses SharedArrayBuffer for its
 * multi-threaded backend. SharedArrayBuffer is only exposed to cross-origin
 * isolated documents, which requires both of these headers.
 *
 * Without them the app still works, but silently drops to a single thread —
 * roughly an order of magnitude slower. We apply them to the preview server as
 * well as dev; wllama's own example only covers dev, so `vite preview` there
 * quietly loses multi-threading.
 *
 * Note that COEP: require-corp still permits cross-origin *CORS-mode* fetches,
 * which is how the model is downloaded from huggingface.co (it sends
 * `Access-Control-Allow-Origin: *`). If that ever breaks, `credentialless` is
 * the more permissive fallback.
 */
function crossOriginIsolation(): Plugin {
  const applyHeaders = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      next()
    })
  }

  return {
    name: 'edge-shield:cross-origin-isolation',
    configureServer: applyHeaders,
    configurePreviewServer: applyHeaders,
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), crossOriginIsolation()],
})
