export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: '#1d6ef2',
        navy: { 700: '#14428f', 800: '#0f3374', 900: '#0a2556' },
      },
      boxShadow: { card: '0 1px 2px rgba(15,23,42,.04), 0 6px 20px -6px rgba(15,23,42,.10)' },
    },
  },
  plugins: [],
}
