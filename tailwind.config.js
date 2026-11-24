/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#090d14',
        panel: '#101722',
        line: '#202a38',
        muted: '#8290a4',
        accent: '#6ee7c0',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 32px rgba(110, 231, 192, 0.08)',
      },
    },
  },
  plugins: [],
}
