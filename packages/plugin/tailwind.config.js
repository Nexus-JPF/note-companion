/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './**/*.{js,jsx,ts,tsx}',
    '!./node_modules/**/*',
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--background-modifier-border)",
        input: "var(--background-modifier-form-field)",
        ring: "var(--background-modifier-border-focus)",
        background: "var(--background-primary)",
        foreground: "var(--text-normal)",
        primary: {
          DEFAULT: "var(--interactive-accent)",
          foreground: "var(--text-on-accent)",
        },
        secondary: {
          DEFAULT: "var(--background-secondary)",
          foreground: "var(--text-normal)",
        },
        muted: {
          DEFAULT: "var(--background-secondary)",
          foreground: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--interactive-accent)",
          foreground: "var(--text-on-accent)",
        },
        destructive: {
          DEFAULT: "var(--text-error)",
          foreground: "var(--text-on-accent)",
        },
      },
    },
  },
  plugins: [],
  corePlugins: {
    container: false,
    preflight: false,
    displayContents: false,
  },
  // Tailwind's content scanner matches `.contents` inside TS (e.g. `section?.contents`).
  // `!visible` is the only remaining `!important` utility the Obsidian CSS scan flags.
  blocklist: ["contents", "!visible"],
}
