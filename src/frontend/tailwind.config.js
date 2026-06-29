/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        school: {
          royal: 'var(--color-royal)',
          navy: 'var(--color-navy)',
          gold: 'var(--color-gold)',
          green: 'var(--color-green)',
          bg: 'var(--color-bg)',
          surface: 'var(--color-surface)',
          text: 'var(--color-text)',
          muted: 'var(--color-muted)',
          border: 'var(--color-border)',
        },
      },
      fontFamily: {
        sans: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '16px',
        pill: '9999px',
      },
      boxShadow: {
        soft: '0 4px 24px -4px rgba(15, 23, 42, 0.08)',
        'soft-lg': '0 12px 40px -8px rgba(15, 23, 42, 0.12)',
        glow: '0 0 32px -4px rgba(245, 158, 11, 0.45)',
        royal: '0 8px 30px -6px rgba(37, 99, 235, 0.35)',
        luxury: '0 24px 60px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255,255,255,0.06)',
      },
      keyframes: {
        orb: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(20px, -16px) scale(1.08)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' },
        },
      },
      animation: {
        orb: 'orb 10s ease-in-out infinite',
        shimmer: 'shimmer 6s linear infinite',
      },
      transitionDuration: {
        DEFAULT: '300ms',
      },
    },
  },
  plugins: [],
}
