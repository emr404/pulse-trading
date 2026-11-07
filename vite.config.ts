import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = process.env.PORT || env.PORT || 3001
  const apiUrl = process.env.VITE_API_URL || env.VITE_API_URL
  const wsUrl = process.env.VITE_WS_URL || env.VITE_WS_URL
  if (mode === 'pages' && !apiUrl)
    throw new Error(
      'Set VITE_API_URL to your hosted backend HTTPS origin before building for Pages.',
    )
  if (apiUrl) {
    const url = new URL(apiUrl)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.pathname !== '/' || url.search || url.hash || url.username || url.password
    )
      throw new Error(
        'VITE_API_URL must be an HTTPS origin without a path, credentials or query.',
      )
  }
  if (wsUrl) {
    const url = new URL(wsUrl)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (
      (url.protocol !== 'wss:' && !(local && url.protocol === 'ws:')) ||
      url.username || url.password || url.hash
    )
      throw new Error('VITE_WS_URL must be a secure WebSocket URL without credentials.')
  }
  return {
    plugins: [vue(), tailwindcss()],
    base: mode === 'pages' ? './' : '/',
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': `http://127.0.0.1:${port}`,
        '/ws': { target: `ws://127.0.0.1:${port}`, ws: true },
      },
    },
  }
})
