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
        selected: {
          bg: 'var(--color-selected-bg)',
          text: 'var(--color-selected-text)',
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
        dataviz: {
          // Categorical palette — for chart series, ordered for max
          // perceptual distance. Aliases of accent-* / brand-grad-* so
          // a chart series visually matches its StatusTag counterpart.
          'cat-1': 'var(--dataviz-cat-1)',
          'cat-2': 'var(--dataviz-cat-2)',
          'cat-3': 'var(--dataviz-cat-3)',
          'cat-4': 'var(--dataviz-cat-4)',
          'cat-5': 'var(--dataviz-cat-5)',
          'cat-6': 'var(--dataviz-cat-6)',
          'cat-7': 'var(--dataviz-cat-7)',
          'cat-8': 'var(--dataviz-cat-8)',
          // Semantic — for values that mean something
          // (positive delta, regression, threshold breach).
          positive: 'var(--dataviz-positive)',
          negative: 'var(--dataviz-negative)',
          warning: 'var(--dataviz-warning)',
          neutral: 'var(--dataviz-neutral)',
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
