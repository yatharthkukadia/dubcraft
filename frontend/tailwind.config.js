/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#09090B',
        foreground: '#FAFAFA',
        card: '#121214',
        'card-foreground': '#FAFAFA',
        primary: '#FF4500',
        'primary-foreground': '#FFFFFF',
        border: '#27272A',
        accent: '#27272A',
        'accent-foreground': '#FAFAFA',
        muted: '#18181B',
        'muted-foreground': '#A1A1AA',
      },
      fontFamily: {
        heading: ['Cabinet Grotesk', 'sans-serif'],
        body: ['IBM Plex Sans', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
