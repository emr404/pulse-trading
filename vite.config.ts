import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = process.env.PORT || env.PORT || 3001
  return {
    plugins: [vue(), tailwindcss()],
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
