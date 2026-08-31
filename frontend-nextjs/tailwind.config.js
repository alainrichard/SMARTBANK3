/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}','./components/**/*.{js,ts,jsx,tsx,mdx}','./lib/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-outfit)','system-ui','sans-serif'],
        body: ['var(--font-jakarta)','system-ui','sans-serif'],
        mono: ['var(--font-jetbrains)','ui-monospace','monospace'],
      },
      colors: {
        // NSS-style blue sidebar
        nss: {
          50: '#eef2fb', 100: '#d6e0f5', 200: '#adc2eb',
          300: '#84a3e1', 400: '#5b85d7', 500: '#3267cd',
          600: '#1a4fa8', 700: '#153e84', 800: '#102e62',
          900: '#0b1f41',
        },
        primary: {
          50:'#eef2fb',100:'#d6e0f5',200:'#adc2eb',300:'#84a3e1',
          400:'#5b85d7',500:'#1a4fa8',600:'#153e84',700:'#102e62',
          800:'#0b1f41',900:'#071530',
        },
        gold: {
          50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',
          400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',
          800:'#92400e',900:'#78350f',
        },
        surface: {
          0:'#ffffff',50:'#f0f4fa',100:'#e8edf8',200:'#d5ddf0',
          300:'#b8c5de',400:'#8a9bbf',500:'#5d6f9a',600:'#3d5078',
          700:'#2b3a5e',800:'#1a2540',900:'#0d1426',
        },
      },
      borderRadius: { '2xl':'1rem','3xl':'1.5rem','4xl':'2rem' },
      boxShadow: {
        'card':'0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.05)',
        'card-hover':'0 4px 12px rgba(0,0,0,.1),0 12px 32px rgba(0,0,0,.08)',
        'sidebar':'4px 0 24px rgba(0,0,0,.18)',
        'modal':'0 24px 64px rgba(0,0,0,.22)',
        'header':'0 2px 8px rgba(0,0,0,.08)',
      },
      animation: {
        'fade-up':'fadeUp .3s ease both',
        'fade-in':'fadeIn .2s ease both',
        'slide-right':'slideRight .25s ease both',
        'pulse-ring':'pulseRing 2s ease infinite',
      },
      keyframes: {
        fadeUp:{from:{opacity:'0',transform:'translateY(14px)'},to:{opacity:'1',transform:'translateY(0)'}},
        fadeIn:{from:{opacity:'0'},to:{opacity:'1'}},
        slideRight:{from:{opacity:'0',transform:'translateX(-12px)'},to:{opacity:'1',transform:'translateX(0)'}},
        pulseRing:{'0%,100%':{opacity:'1'},'50%':{opacity:'.3'}},
      },
    },
  },
  plugins: [],
};
