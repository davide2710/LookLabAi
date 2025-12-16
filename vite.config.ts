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
    }
  }
})