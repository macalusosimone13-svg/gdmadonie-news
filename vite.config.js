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
  ],
  build: {
    rollupOptions: {
      output: {
        // Le librerie di base (React, router, Supabase) in un file a parte:
        // cambiano di rado, quindi dopo ogni aggiornamento del sito il
        // browser dei visitatori riscarica solo il codice nostro.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return 'vendor-react';
          if (id.includes('node_modules/@supabase/')) return 'vendor-supabase';
        },
      },
    },
  },
});
