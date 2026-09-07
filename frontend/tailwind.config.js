/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          black: '#0B0B0A',
          'black-subtle': '#11110F',
          'black-card': '#161614',
          'black-border': '#262522',
          cream: '#F6F1E8',
          'cream-soft': '#FAF6F0',
          'cream-dark': '#EDE6D8',
          white: '#FCFBF8',
          border: '#E7E0D4',
          'border-dark': '#2B2A27',
          text: '#171614',
          muted: '#77736B',
          gold: '#B5965A',
          'gold-dark': '#967941',
          'gold-soft': '#F1E8D7',
          'gold-light': '#F9F5EC',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Playfair Display', 'Instrument Serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

