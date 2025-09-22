/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pink: {
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
        },
        purple: {
          500: '#a855f7',
          600: '#9333ea',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/line-clamp'),
  ],
}

