import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carica le variabili d'ambiente in base al mode (development/production)
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    // SU VERCEL: Usa sempre '/' come base.
    base: '/',
    define: {
      // Sostituisce la stringa 'process.env.API_KEY' con il valore reale durante la build
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    build: {
      // Aumenta la soglia del warning a 1600kb (così non ti rompe le scatole per warning innocui)
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Divide le librerie in file separati per velocizzare il caricamento
            'vendor-react': ['react', 'react-dom'],
            'vendor-ui': ['recharts', 'lucide-react'],
            'vendor-utils': ['jszip', 'file-saver'],
            'vendor-ai': ['@google/genai'],
          }
        }
      }
    }
  }
})