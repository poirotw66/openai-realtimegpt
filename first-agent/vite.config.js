import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws/gemini-live': { target: 'ws://localhost:8001', ws: true, rewrite: (path) => path.replace(/^\/ws\/gemini-live/, '/ws') },
    },
  },
})
