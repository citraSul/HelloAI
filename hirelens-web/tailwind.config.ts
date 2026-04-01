import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        background: "#0B0F14",
        foreground: "#E5E7EB",
        surface: "#111827",
        card: {
          DEFAULT: "#0F172A",
          foreground: "#E5E7EB",
        },
        muted: {
          DEFAULT: "#1F2937",
          foreground: "#9CA3AF",
        },
        border: {
          DEFAULT: "#1F2937",
          hover: "#374151",
        },
        primary: {
          DEFAULT: "#6366F1",
          foreground: "#FFFFFF",
        },
        "primary-hover": "#818CF8",
        score: {
          success: "#22C55E",
          warning: "#F59E0B",
          danger: "#EF4444",
          impact: "#8B5CF6",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#E5E7EB",
        },
        label: "#6B7280",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.28)",
        "brand-soft": "0 0 32px rgba(99, 102, 241, 0.12)",
      },
      borderRadius: {
        xl: "16px",
        "2xl": "16px",
        lg: "12px",
        md: "10px",
        sm: "8px",
      },
      transitionDuration: {
        DEFAULT: "200ms",
        fast: "150ms",
        smooth: "250ms",
      },
      spacing: {
        section: "28px",
      },
    },
  },
  plugins: [],
};

export default config;
