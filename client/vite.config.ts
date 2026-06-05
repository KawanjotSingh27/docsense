import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/documents': 'http://localhost:3000',
      '/query': 'http://localhost:3000'
    }
  }
})