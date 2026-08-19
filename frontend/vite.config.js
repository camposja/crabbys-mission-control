import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveDevServerHost, loopbackGuardPlugin } from './src/lib/devServer.js'

// https://vite.dev/config/
// The dev/preview servers bind to 127.0.0.1 explicitly, and loopbackGuardPlugin
// re-checks the FINAL resolved config so a CLI `--host 0.0.0.0` cannot override
// it (see src/lib/devServer.js). Serving beyond loopback requires VITE_BIND plus
// VITE_ENABLE_LAN_MODE=true.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const host = resolveDevServerHost(env)

  return {
    plugins: [react(), loopbackGuardPlugin(env)],
    server: { host },
    preview: { host },
  }
})
