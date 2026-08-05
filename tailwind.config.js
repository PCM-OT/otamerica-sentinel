/**
 * Tema do Sentinel — o mesmo que antes vivia no <script> do Play CDN.
 *
 * Agora o CSS é gerado no build. Motivos: o CDN era ponto único de falha
 * fora do nosso controle (firewall da fábrica, indisponibilidade), obrigava
 * `style-src 'unsafe-inline'` na CSP porque injeta <style> em runtime, e
 * fazia o navegador compilar as classes a cada visita.
 */
export default {
  content: ['./index.html', './index.tsx', './App.tsx', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { primary: '#3b82f6', secondary: '#2563eb' },
        sentinel: { bg: '#0b1121', card: 'rgba(17, 24, 39, 0.92)' },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: { shine: 'shine 2s infinite' },
      keyframes: {
        shine: { '0%': { left: '-100%' }, '100%': { left: '200%' } },
      },
    },
  },
  plugins: [],
};
