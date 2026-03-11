
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#1754cf",
        "primary-dark": "#103d96",
        "background-light": "#f6f6f8",
        "background-dark": "#111621",
        "surface-dark": "#1a1f2b",
        "surface-highlight": "#252b3b",
        "text-secondary": "#9da6b8",
        "success": "#0bda5e",
        "gold": "#D4AF37",
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"]
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
