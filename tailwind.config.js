import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: {
          white: '#ffffff',
          cream: '#f5f1e8',
          'black-deep': '#0f172a',
          black: '#1a2335',
          turquoise: '#1a9e8f',
        },
        secondary: {
          'beige-light': '#f8f5ee',
          cream: '#f5f1e8',
          'beige-warm': '#efe3cd',
          'gray-dark': '#4b5563',
        },
        status: {
          success: '#22c55e',
          error: '#ef4444',
          disabled: '#9ca3af',
          premium: '#bba86b',
        },
        text: {
          primary: '#1a2335',
          secondary: '#4b5563',
          tertiary: '#6b7280',
          'on-dark': '#f8fafc',
        },
        border: {
          primary: '#d0d0c5',
          light: '#e5e7eb',
          dark: '#3b4c6e',
          footer: '#2e3a52',
        },
      },
      fontFamily: {
        heading: ['Instrument Serif', 'serif'],
        body: ['PT Serif', 'serif'],
        mono: ['Roboto Mono', 'ui-monospace', 'monospace'],
        button: ['Montserrat', 'sans-serif'],
        legal: ['Montserrat', 'sans-serif'],
      },
      boxShadow: {
        light: '0 24px 60px rgba(15, 23, 42, 0.08)',
        medium: '0 18px 40px rgba(15, 23, 42, 0.16)',
      },
      maxWidth: {
        container: '1440px',
      },
    },
  },
  plugins: [typography, forms],
};
