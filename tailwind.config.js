/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#7652B9',
          pink: '#B46470',
          peach: '#CA9D8C',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          'fixed-dark': 'var(--color-fixed-dark-text)',
        },
        bg: {
          page: 'var(--color-bg-page)',
          message: 'var(--color-bg-message)',
          hover: 'var(--color-bg-hover)',
          sidebar: 'var(--color-sidebar-bg)',
          card: 'var(--color-card-panel-bg)',
        },
        input: {
          bg: 'var(--color-input-bg)',
          'bg-active': 'var(--color-input-bg-active)',
        },
        stroke: {
          outline: 'var(--color-stroke-outline)',
        },
        focus: {
          ring: 'var(--color-focus-ring)',
        },
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        accent: {
          blue: 'var(--color-accent-blue)',
          'blue-faint': 'var(--color-accent-blue-faint)',
          'blue-faint-hover': 'var(--color-accent-blue-faint-hover)',
          green: 'var(--color-accent-green)',
          'green-bg': 'var(--color-accent-green-bg)',
          red: 'var(--color-accent-red)',
          amber: 'var(--color-accent-amber)',
          orange: 'var(--color-accent-orange)',
          violet: 'var(--color-accent-violet)',
          neutral: 'var(--color-accent-neutral)',
        },
        tooltip: 'var(--color-tooltip-bg)',
        overlay: {
          loading: 'var(--color-overlay-loading)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '3rem',
      },
    },
  },
  plugins: [],
}
