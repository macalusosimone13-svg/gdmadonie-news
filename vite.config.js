import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Nota: il plugin @base44/vite-plugin (HMR/analytics specifici del loro
// sandbox) è stato rimosso qui perché non serve fuori da Base44 e potrebbe
// provare a connettersi a servizi non disponibili in questo ambiente. Il
// plugin però configurava anche l'alias "@/" -> "src/" usato in tutto il
// codice: va ricreato qui a mano, altrimenti la build fallisce.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
  ]
});
