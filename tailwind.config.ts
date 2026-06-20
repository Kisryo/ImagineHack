import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        compass: { ink: "#0B1B2B", accent: "#1F6FEB", soft: "#F4F7FB" }
      }
    }
  },
  plugins: []
} satisfies Config;
