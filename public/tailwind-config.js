/**
 * Tema do Tailwind. Carregado DEPOIS de cdn.tailwindcss.com, que é quem cria
 * o objeto `tailwind`.
 *
 * A guarda existe porque o CDN é um ponto único de falha fora do nosso
 * controle: firewall corporativo, bloqueio de rede ou indisponibilidade do
 * CDN faziam este arquivo estourar "ReferenceError: tailwind is not defined"
 * e derrubar o restante do script da página. Sem o CDN o app fica sem estilo
 * de qualquer forma, mas ao menos continua funcionando.
 */
if (typeof tailwind === 'undefined') {
  console.warn('Tailwind não carregou do CDN; a página será exibida sem estilo.');
} else {
        tailwind.config = {
          theme: {
            extend: {
              colors: {
                brand: {
                  primary: '#3b82f6',
                  secondary: '#2563eb',
                },
                sentinel: {
                  bg: '#0b1121',
                  card: 'rgba(17, 24, 39, 0.92)',
                }
              },
              fontFamily: {
                sans: ['Space Grotesk', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
              },
              animation: {
                'shine': 'shine 2s infinite',
              },
              keyframes: {
                shine: {
                  '0%': { left: '-100%' },
                  '100%': { left: '200%' },
                }
              }
            }
          }
        }
}
