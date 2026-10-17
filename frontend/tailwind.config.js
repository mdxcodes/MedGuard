export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0f172a', deep: '#020617', soft: '#1e293b' },
        teal: { DEFAULT: '#14b8a6', soft: '#5eead4', muted: '#ccfbf1' },
        slate: { light: '#f1f5f9', soft: '#334155' },
        surface: '#f8fafc',
      },
      fontFamily: {
        sans: ['Inter','ui-sans-serif','system-ui','sans-serif'],
        serif: ['Instrument Serif','Georgia','serif'],
        mono: ['IBM Plex Mono','ui-monospace','monospace'],
      },
    }
  },
  plugins: [],
};
