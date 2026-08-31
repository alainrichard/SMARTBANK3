import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AppProvider } from '@/contexts/AppContext';
import '@/styles/globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['300','400','500','600','700','800'],
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['300','400','500','600','700'],
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400','500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SmartBank AI — Digital Banking Platform',
  description: 'Secure AI-powered digital banking with fraud detection, credit scoring, and real-time analytics',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="">
      <body className={`${outfit.variable} ${jakarta.variable} ${jetbrains.variable} font-body antialiased`}>
        <AppProvider>
          {children}
          <Toaster
            position="bottom-right"
            gutter={8}
            toastOptions={{
              duration: 4500,
              style: {
                fontFamily: 'var(--font-jakarta)',
                fontSize: '13px',
                fontWeight: '500',
                borderRadius: '14px',
                padding: '12px 16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              },
              success: {
                style: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
                iconTheme: { primary: '#16a34a', secondary: '#fff' },
              },
              error: {
                style: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
                iconTheme: { primary: '#dc2626', secondary: '#fff' },
              },
              loading: {
                style: { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' },
              },
            }}
          />
        </AppProvider>
      </body>
    </html>
  );
}
