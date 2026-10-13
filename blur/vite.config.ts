import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// La app se sirve en /blur/ dentro del proyecto de Vercel de Gestión (el build
// raíz la copia a dist/blur). Cuando tenga dominio propio se agrega al mismo proyecto.
export default defineConfig({
  base: '/blur/',
  plugins: [react(), tailwindcss()],
})
