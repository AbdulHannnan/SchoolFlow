// Tailwind CSS v4 is wired up entirely through its PostCSS plugin.
// There is no `tailwind.config.js` - theme tokens live in `src/app/globals.css`
// (see the `@theme` block there).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
