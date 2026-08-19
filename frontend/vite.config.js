import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveDevServerHost } from './src/lib/devServer.js'

// https://vite.dev/config/
// The dev/preview servers bind to 127.0.0.1 explicitly (see src/lib/devServer.js);
// serving on a LAN interface requires VITE_BIND + VITE_ENABLE_LAN_MODE=true.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const host = resolveDevServerHost(env)

  return {
    plugins: [react()],
    server: { host },
    preview: { host },
  }
})
