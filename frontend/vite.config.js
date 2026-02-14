import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In Docker, frontend container must proxy to backend by service name (backend:5000)
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
