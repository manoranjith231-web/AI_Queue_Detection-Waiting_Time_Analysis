/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#070B14",
        surface: "#0D1322",
        "surface-card": "#131B2E",
        "surface-elevated": "#1A253D",
        border: "#23304E",
        primary: {
          DEFAULT: "#06B6D4", // Electric cyan
          foreground: "#070B14",
          light: "#22D3EE",
          dark: "#0891B2",
        },
        accent: {
          DEFAULT: "#8B5CF6", // Cyber violet
          foreground: "#FFFFFF",
          light: "#A78BFA",
          dark: "#7C3AED",
        },
        success: {
          DEFAULT: "#10B981", // Emerald
          light: "#34D399",
        },
        warning: {
          DEFAULT: "#F59E0B", // Amber
          light: "#FBBF24",
        },
        danger: {
          DEFAULT: "#EF4444", // Rose/Crimson
          light: "#F87171",
        },
      },
      fontFamily: {
        heading: ["'Space Grotesk'", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        glow: "0 0 25px -5px rgba(6, 182, 212, 0.35)",
        "glow-accent": "0 0 25px -5px rgba(139, 92, 246, 0.35)",
        "glow-danger": "0 0 25px -5px rgba(239, 68, 68, 0.35)",
      },
    },
  },
  plugins: [],
};
