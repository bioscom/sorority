/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',         // App Router files
    './components/**/*.{js,ts,jsx,tsx}',  // Your components
    './src/**/*.{js,ts,jsx,tsx}',         // Optional if you use src/
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

