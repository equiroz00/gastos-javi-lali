
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/gastos-javi-lali/',  // ← debe coincidir con el nombre de tu repo en GitHub
})