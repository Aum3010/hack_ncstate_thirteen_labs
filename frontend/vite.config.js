import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In Docker: use VITE_API_PROXY_TARGET (http://backend:5000) so /api goes to backend container
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
