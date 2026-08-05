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
