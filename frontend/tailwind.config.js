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
        // Amazon & Flipkart Enterprise Retail Palette
        background: "#0B1320",       // Crisp deep corporate navy
        surface: "#101B2E",          // Dark slate container
        "surface-card": "#16233B",   // Professional enterprise card
        "surface-elevated": "#1E3050",// Elevated dropdown/dialog
        border: "#263A5C",           // Slate border
        "border-light": "#3B527A",   // Active border highlight
        
        // Brand Primary: Flipkart Royal Blue
        primary: {
          DEFAULT: "#2874F0",
          foreground: "#FFFFFF",
          light: "#4387F6",
          dark: "#1A5DC8",
        },
        
        // Brand Accent: Amazon Prime Amber / Gold
        accent: {
          DEFAULT: "#FF9900",
          foreground: "#111827",
          light: "#FFB03A",
          dark: "#E68A00",
        },
        
        // Status Indicators
        success: {
          DEFAULT: "#10B981",        // Emerald
          light: "#34D399",
        },
        warning: {
          DEFAULT: "#F59E0B",        // Amber / Amazon Gold
          light: "#FBBF24",
        },
        danger: {
          DEFAULT: "#EF4444",        // Crimson
          light: "#F87171",
        },
      },
      fontFamily: {
        heading: ["'Space Grotesk'", "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
      },
      boxShadow: {
        retail: "0 4px 20px -2px rgba(11, 19, 32, 0.5)",
        card: "0 2px 8px 0 rgba(0, 0, 0, 0.25)",
        glow: "0 0 20px -3px rgba(40, 116, 240, 0.35)",     // Flipkart Blue Glow
        "glow-amber": "0 0 20px -3px rgba(255, 153, 0, 0.35)", // Amazon Amber Glow
        "glow-danger": "0 0 20px -3px rgba(239, 68, 68, 0.35)",
      },
    },
  },
  plugins: [],
};
