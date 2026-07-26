/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "oklch(0.08 0 0)",
        foreground: "oklch(1 0 0)",
        card: "oklch(0.18 0 0)",
        "card-foreground": "oklch(1 0 0)",
        elevated: "oklch(0.22 0 0)",
        primary: "oklch(1 0 0)",
        "primary-foreground": "oklch(0.08 0 0)",
        muted: "oklch(0.18 0 0)",
        "muted-foreground": "oklch(0.65 0 0)",
        accent: "oklch(0.25 0 0)",
        border: "oklch(1 0 0 / 8%)",
        silver: "oklch(0.85 0.005 250)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(ellipse at top, oklch(0.18 0 0) 0%, oklch(0.08 0 0) 60%)",
        "gradient-silver": "linear-gradient(135deg, oklch(0.95 0 0), oklch(0.7 0.005 250))",
      }
    },
  },
  plugins: [],
}
