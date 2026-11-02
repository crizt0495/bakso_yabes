import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Palet Bakso Yabes: hijau tua, hijau muda, putih, krem
        brand: {
          50: "#f0f7f2",
          100: "#dcefe1",
          200: "#bbdfc6",
          300: "#8ec8a0",
          400: "#5caa76",
          500: "#3d8f59",
          600: "#2e7246",
          700: "#265c39", // hijau tua utama
          800: "#1f4a2f",
          900: "#1a3d27",
          950: "#0e221a",
        },
        cream: {
          DEFAULT: "#faf6ee",
          dark: "#f0e9d9",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(16 34 26 / 0.08), 0 1px 2px -1px rgb(16 34 26 / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
