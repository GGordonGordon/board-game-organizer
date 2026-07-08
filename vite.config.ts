import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // manifold-3d is an Emscripten/WASM module; pre-bundling breaks its wasm loading
    exclude: ['manifold-3d'],
  },
})
