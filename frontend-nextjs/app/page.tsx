'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';

export default function Home() {
  const { user, loading } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/dashboard' : '/auth/login');
    }
  }, [user, loading, router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-400 rounded-xl flex items-center justify-center">
          <span className="font-display font-bold text-xl text-ink-900">S</span>
        </div>
        <div className="w-8 h-8 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    </div>
  );
}
