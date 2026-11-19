import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { messAdminDevApi } from './vite-mess-admin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), messAdminDevApi()],
})
