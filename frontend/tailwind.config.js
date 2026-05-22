/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          bg: '#F4F4F0',     /* Off-White / Pearl (printed-paper texture) */
          ink: '#111827',    /* Stark Black / Deep Slate for high-contrast reading */
          hero: '#043927',   /* Forest Night (primary navs, header panels, major CTAs) */
          sos: '#E55B13',    /* Signal Orange (strict crisis/SOS action triggers) */
          card: '#FFFFFF',   /* Pure White surfaces for content blocks */
        }
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],       /* Editorial headings, hero lines, titles */
        sans: ['Inter', 'sans-serif'],      /* High-legibility body, labels, settings forms */
        mono: ['Space Mono', 'monospace'],  /* GPS coordinates, telemetry feeds, ledger logs */
      },
      boxShadow: {
        'brutal': '4px 4px 0px 0px #111827', /* Flat brutalist shadow for premium card lifting */
      }
    },
  },
  plugins: [],
}
