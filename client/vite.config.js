import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BASE = '/fotobooth'

export default defineConfig({
  base: `${BASE}/`,
  plugins: [react()],
  server: {
    proxy: {
      [`${BASE}/api`]:      { target: 'http://localhost:3000', changeOrigin: true },
      [`${BASE}/uploads`]:  { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io':         { target: 'http://localhost:3000', ws: true, changeOrigin: true }
    }
  },
  build: {
    outDir: '../public',
    emptyOutDir: true
  }
})
