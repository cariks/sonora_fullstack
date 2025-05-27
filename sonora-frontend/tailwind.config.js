/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sf: ['"SF Pro Display"', 'sans-serif']
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide')
  ],
}

