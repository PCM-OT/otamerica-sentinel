import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * O `define` que existia aqui injetava GEMINI_API_KEY no bundle do cliente:
 *
 *     'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY)
 *
 * Qualquer visitante poderia lê-la no JavaScript baixado. Hoje nada no
 * cliente referencia essa variável — a chave é usada só no servidor, em
 * api/gemini.ts, que lê process.env.GEMINI_API_KEY no runtime da Vercel.
 * Mantê-la aqui era um vazamento esperando uma linha de código para
 * acontecer, então foi removida.
 */
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
