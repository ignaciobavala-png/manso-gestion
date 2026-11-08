import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// La app se sirve en /blur/ dentro del proyecto de Vercel de Gestión (el build
// raíz la copia a dist/blur). El dominio propio (blur.mansoclub.com.ar) es del
// mismo proyecto: un redirect por host en vercel.json manda cualquier ruta a
// /blur/..., así que `base` y el basename del router no cambian.
export default defineConfig({
  base: '/blur/',
  plugins: [react(), tailwindcss()],
})
