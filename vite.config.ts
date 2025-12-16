import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carica le variabili d'ambiente in base al mode (development/production)
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    base: mode === 'production' ? '/LookLabAI/' : '/',
    define: {
      // Sostituisce la stringa 'process.env.API_KEY' con il valore reale o una stringa vuota
      // Questo avviene durante la build/serve di Vite.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    }
  }
})