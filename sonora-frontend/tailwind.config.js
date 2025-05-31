/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        accent: '#01E733',
        'dark-3': '#0A0A0A',
        'dark-2': '#171717',
        'dark-1': '#262626',
        'gray-4': '#313131',
        'gray-3': '#454545',
        'gray-2': '#8B8B8B',
        'gray-1': '#D0D0D0',
        white: '#FFFFFF',
      },
      fontFamily: {
        sf: ['"SF Pro Display"', 'sans-serif'],
      },
      animation: {
        'gradient-pulse': 'gradientPulse 15s ease-in-out infinite',
      },
      keyframes: {
        gradientPulse: {
          '0%, 100%': {
            transform: 'scale(1)',
            filter: 'brightness(160%)',
          },
          '50%': {
            transform: 'scale(1.1)',
            filter: 'brightness(100%)',
          },
        },
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide')
  ],
}
