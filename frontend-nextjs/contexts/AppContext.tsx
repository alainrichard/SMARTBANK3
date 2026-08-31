'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getProfile, clearAuth } from '@/lib/api';
import type { Language } from '@/translations';

export interface User {
  id: string; first_name: string; last_name: string; email: string;
  role: string; status: string; kyc_verified: boolean; two_fa_enabled: boolean;
  phone?: string; address?: string; branch_name?: string; last_login_at?: string;
  last_login_ip?: string; profile_photo?: string; created_at?: string;
}

interface AppContextType {
  user: User | null; setUser: (u: User | null) => void;
  loading: boolean;
  lang: Language; setLang: (l: Language) => void;
  theme: 'light' | 'dark'; toggleTheme: () => void;
  refreshUser: () => Promise<void>;
  unreadCount: number; setUnreadCount: (n: number) => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Language>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [unreadCount, setUnreadCount] = useState(0);

  const setLang = (l: Language) => {
    setLangState(l);
    if (typeof window !== 'undefined') localStorage.setItem('sb_lang', l);
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sb_theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
  };

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await getProfile();
      if (data.success) {
        setUser(data.data.user);
        localStorage.setItem('sb_user', JSON.stringify(data.data.user));
      }
    } catch {
      // token invalid
    }
  }, []);

  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return null;
    return document.cookie.split(';').reduce((acc: any, c) => {
      const [k, v] = c.trim().split('=');
      acc[k.trim()] = v;
      return acc;
    }, {})[name] || null;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Restore lang
    const savedLang = localStorage.getItem('sb_lang') as Language;
    if (savedLang && ['en','fr','rw'].includes(savedLang)) setLangState(savedLang);
    // Restore theme
    const savedTheme = localStorage.getItem('sb_theme') as 'light' | 'dark';
    if (savedTheme === 'dark') {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
    // Restore auth
    const token = getCookie('access_token') || localStorage.getItem('access_token');
    if (token) {
      const cached = localStorage.getItem('sb_user');
      if (cached) { try { setUser(JSON.parse(cached)); } catch {} }
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  return (
    <AppContext.Provider value={{
      user, setUser, loading, lang, setLang,
      theme, toggleTheme, refreshUser,
      unreadCount, setUnreadCount,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
