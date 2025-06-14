/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      scrollbar: {
        none: {
          '::-webkit-scrollbar': {
            display: 'none',
          },
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
      },
      colors: {
        accent: '#01E733',
        'dark-3': '#0A0A0A',
        'dark-2': '#171717',
        'dark-1': '#262626',
        'gray-4': '#313131',
        'gray-3': '#454545',
        'gray-2': '#8B8B8B',
        'gray-1': '#D0D0D0',
        'dark-123' : 'rgba(38, 38, 38, 0.2)',
        white: '#FFFFFF',
      },
      fontFamily: {
        sf: ['"SF Pro Display"', 'sans-serif'],
      },
      animation: {
        'gradient-pulse': 'gradientPulse 12s ease-in-out infinite',
        'skeleton-loading': 'skeletonLoading 2.4s cubic-bezier(0.4, 0.0, 0.2, 1) infinite',
      },
      keyframes: {
        gradientPulse: {
          '0%, 100%': {
            transform: 'scale(1)',
            filter: 'brightness(170%)',
          },
          '50%': {
            transform: 'scale(1.2)',
            filter: 'brightness(100%)',
          },
        },
        skeletonLoading: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      backgroundImage: {
        'skeleton-gradient': 'linear-gradient(90deg, #1e1e1e 25%, #3a3a3a 50%, #1e1e1e 75%)',
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide'),
    function({ addComponents }) {
      addComponents({
        '.skeleton': {
          '@apply bg-skeleton-gradient bg-[length:200%_100%] animate-skeleton-loading rounded relative overflow-hidden': {},
        },
      })
    }
  ],
}
