import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef8ff",
          100: "#d9efff",
          200: "#badeff",
          300: "#8cc8ff",
          400: "#5eaefd",
          500: "#3b92f6",
          600: "#2773e0",
          700: "#1e5bc0",
          800: "#1f4a96",
          900: "#1e3f78"
        }
      }
    }
  },
  plugins: []
};

export default config;


