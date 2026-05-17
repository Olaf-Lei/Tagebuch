import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ['sql.js'] },
  base: '/tagebuch/',
  define: { __WEB_VERSION__: JSON.stringify(version) },
})
