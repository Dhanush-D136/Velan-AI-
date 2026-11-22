/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        accent: {
          violet: '#7C3AED',
          cyan: '#06B6D4',
          pink: '#EC4899',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#EF4444',
          blue: '#3B82F6',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          soft: '#F8FAFC',
          muted: '#F1F5F9',
        },
        content: {
          DEFAULT: '#0F172A',
          secondary: '#64748B',
          muted: '#94A3B8',
        },
        border: {
          DEFAULT: '#E2E8F0',
          dark: '#CBD5E1',
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        'modal': '28px',
      },
      boxShadow: {
        glass: '0 10px 30px -12px rgba(99, 102, 241, 0.18)',
        'glass-hover': '0 16px 36px -10px rgba(99, 102, 241, 0.28)',
        subtle: '0 4px 20px -4px rgba(15, 23, 42, 0.06)',
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 45%, #EC4899 100%)',
        'admin-gradient': 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
        'faculty-gradient': 'linear-gradient(135deg, #0D9488 0%, #10B981 100%)',
        'student-gradient': 'linear-gradient(135deg, #2563EB 0%, #06B6D4 100%)',
      },
      animation: {
        'radar-pulse': 'radar-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'float-slow': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'radar-pulse': {
          '0%': { transform: 'scale(0.8)', opacity: '0.9' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};
