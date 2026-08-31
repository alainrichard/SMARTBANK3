'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { clearAuth, logout, getNotifications } from '@/lib/api';
import {
  LayoutDashboard, ArrowRightLeft, List, CreditCard, Receipt,
  BarChart2, MessageSquare, Bell, FileText, Settings, Users,
  AlertTriangle, GitBranch, ClipboardList, LogOut, PlusCircle,
  Sun, Moon, Globe, ChevronDown, Menu, X, User, ChevronRight, UserCheck,
} from 'lucide-react';
import clsx from 'clsx';

// NSS-style: exactly as in the screenshot
const SIDEBAR_COLOR = '#1a4fa8'; // matches NSS blue

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#d97706', branch_manager: '#7c3aed', fraud_analyst: '#dc2626',
  bank_staff: '#059669', auditor: '#0891b2', customer: '#1a4fa8',
};

interface NavItem { path: string; icon: any; key: string; section?: string; special?: boolean; }

const NAV: Record<string, NavItem[]> = {
  customer: [
    { path: '/dashboard',              icon: LayoutDashboard, key: 'dashboard',      section: 'Main' },
    { path: '/dashboard/transfer',     icon: ArrowRightLeft,  key: 'transfer' },
    { path: '/dashboard/transactions', icon: List,            key: 'transactions' },
    { path: '/dashboard/loans',        icon: CreditCard,      key: 'loans' },
    { path: '/dashboard/bills',        icon: Receipt,         key: 'bills' },
    { path: '/dashboard/analytics',    icon: BarChart2,       key: 'analytics',     section: 'Insights' },
    { path: '/dashboard/support',      icon: MessageSquare,   key: 'support' },
    { path: '/dashboard/notifications',icon: Bell,            key: 'notifications' },
    { path: '/dashboard/reports',      icon: FileText,        key: 'reports',        section: 'Account' },
    { path: '/dashboard/settings',     icon: Settings,        key: 'settings' },
  ],
  bank_staff: [
    { path: '/dashboard',              icon: LayoutDashboard, key: 'dashboard',     section: 'Main' },
    { path: '/dashboard/deposit',      icon: PlusCircle,      key: 'deposit' },
    { path: '/dashboard/transactions', icon: List,            key: 'transactions' },
    { path: '/dashboard/users',        icon: Users,           key: 'users' },
    { path: '/dashboard/support',      icon: MessageSquare,   key: 'support',        section: 'Tools' },
    { path: '/dashboard/notifications',icon: Bell,            key: 'notifications' },
    { path: '/dashboard/reports',      icon: FileText,        key: 'reports',        section: 'Account' },
    { path: '/dashboard/settings',     icon: Settings,        key: 'settings' },
  ],
  branch_manager: [
    { path: '/dashboard/admin',        icon: LayoutDashboard, key: 'admin',          section: 'Main' },
    { path: '/dashboard/transactions', icon: List,            key: 'transactions' },
    { path: '/dashboard/users',        icon: Users,           key: 'users' },
    { path: '/dashboard/loans',        icon: CreditCard,      key: 'loans' },
    { path: '/dashboard/fraud',        icon: AlertTriangle,   key: 'fraud',           section: 'Operations' },
    { path: '/dashboard/kyc',          icon: UserCheck,       key: 'kycReview',       special: true },
    { path: '/dashboard/branches',     icon: GitBranch,       key: 'branches' },
    { path: '/dashboard/support',      icon: MessageSquare,   key: 'support',         section: 'Tools' },
    { path: '/dashboard/notifications',icon: Bell,            key: 'notifications' },
    { path: '/dashboard/reports',      icon: FileText,        key: 'reports',         section: 'Account' },
    { path: '/dashboard/settings',     icon: Settings,        key: 'settings' },
  ],
  fraud_analyst: [
    { path: '/dashboard/admin',        icon: LayoutDashboard, key: 'admin',           section: 'Main' },
    { path: '/dashboard/fraud',        icon: AlertTriangle,   key: 'fraud' },
    { path: '/dashboard/transactions', icon: List,            key: 'transactions' },
    { path: '/dashboard/support',      icon: MessageSquare,   key: 'support',         section: 'Tools' },
    { path: '/dashboard/notifications',icon: Bell,            key: 'notifications' },
    { path: '/dashboard/reports',      icon: FileText,        key: 'reports',         section: 'Account' },
    { path: '/dashboard/settings',     icon: Settings,        key: 'settings' },
  ],
  auditor: [
    { path: '/dashboard/admin',        icon: LayoutDashboard, key: 'admin',           section: 'Main' },
    { path: '/dashboard/transactions', icon: List,            key: 'transactions' },
    { path: '/dashboard/audit',        icon: ClipboardList,   key: 'audit' },
    { path: '/dashboard/support',      icon: MessageSquare,   key: 'support',         section: 'Tools' },
    { path: '/dashboard/notifications',icon: Bell,            key: 'notifications' },
    { path: '/dashboard/reports',      icon: FileText,        key: 'reports',         section: 'Account' },
    { path: '/dashboard/settings',     icon: Settings,        key: 'settings' },
  ],
  super_admin: [
    { path: '/dashboard/admin',        icon: LayoutDashboard, key: 'admin',           section: 'Main' },
    { path: '/dashboard/transactions', icon: List,            key: 'transactions' },
    { path: '/dashboard/users',        icon: Users,           key: 'users' },
    { path: '/dashboard/loans',        icon: CreditCard,      key: 'loans' },
    { path: '/dashboard/fraud',        icon: AlertTriangle,   key: 'fraud',           section: 'Operations' },
    { path: '/dashboard/kyc',          icon: UserCheck,       key: 'kycReview',       special: true },
    { path: '/dashboard/branches',     icon: GitBranch,       key: 'branches' },
    { path: '/dashboard/audit',        icon: ClipboardList,   key: 'audit' },
    { path: '/dashboard/support',      icon: MessageSquare,   key: 'support',         section: 'Tools' },
    { path: '/dashboard/notifications',icon: Bell,            key: 'notifications' },
    { path: '/dashboard/reports',      icon: FileText,        key: 'reports',         section: 'Account' },
    { path: '/dashboard/settings',     icon: Settings,        key: 'settings' },
  ],
};

const LANG_LABELS: Record<string, string> = { en: 'English', fr: 'Français', rw: 'Kinyarwanda' };
const LANG_FLAGS: Record<string, string> = { en: '🇬🇧', fr: '🇫🇷', rw: '🇷🇼' };
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Administrator', branch_manager: 'Branch Manager',
  fraud_analyst: 'Fraud Analyst', bank_staff: 'Bank Teller',
  auditor: 'Auditor', customer: 'Customer',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, lang, setLang, theme, toggleTheme, unreadCount, setUnreadCount } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      try {
        const { data } = await getNotifications();
        const n = data?.data?.notifications || [];
        setUnreadCount(n.filter((x: any) => !x.is_read).length);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [user, setUnreadCount]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    try { await logout(); } catch {}
    clearAuth();
    router.push('/auth/login');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: SIDEBAR_COLOR }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <span className="font-display font-black text-lg text-primary-600">S</span>
          </div>
          <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const navItems = NAV[user.role] || NAV.customer;
  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
  const roleColor = ROLE_COLORS[user.role] || '#1a4fa8';

  const SidebarInner = ({ mobile = false }) => (
    <div className="flex flex-col h-full" style={{ background: SIDEBAR_COLOR }}>
      {/* Logo row — matches NSS: icon + name */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="font-display font-black text-sm text-primary-600">SB</span>
          </div>
          <span className="font-display font-bold text-[15px] text-white tracking-tight">SmartBank</span>
        </div>
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="text-white/60 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.path ||
            (item.path !== '/dashboard' && item.path !== '/dashboard/admin' && pathname.startsWith(item.path));
          const prevItem = navItems[i - 1];
          const showSection = item.section && item.section !== prevItem?.section;

          return (
            <div key={item.path}>
              {showSection && (
                <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest px-5 pt-4 pb-1.5">
                  {item.section}
                </p>
              )}
              <Link
                href={item.path}
                onClick={() => mobile && setMobileOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer select-none',
                  isActive
                    ? 'bg-white text-primary-600 font-semibold shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10',
                )}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1">{t(item.key as any, lang)}</span>
                {item.key === 'notifications' && unreadCount > 0 && (
                  <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Bottom logout */}
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
          <LogOut size={16} />
          {t('logout', lang)}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Desktop sidebar — NSS style */}
      <aside className="hidden lg:block w-[230px] fixed inset-y-0 left-0 z-30 shadow-sidebar no-print">
        <SidebarInner />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[230px] shadow-sidebar overflow-y-auto">
            <SidebarInner mobile />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 lg:ml-[230px] flex flex-col min-h-screen">
        {/* NSS-style top header — white bar, right-aligned controls */}
        <header
          className="fixed top-0 left-0 right-0 lg:left-[230px] z-20 flex items-center h-14 px-5 gap-3 no-print"
          style={{
            background: 'var(--header-bg)',
            borderBottom: '1px solid var(--header-border)',
            boxShadow: '0 2px 8px rgba(0,0,0,.06)',
          }}
        >
          <button onClick={() => setMobileOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-700 mr-auto">
            <Menu size={22} />
          </button>

          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2 mr-auto">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: SIDEBAR_COLOR }}>
              <span className="font-display font-black text-xs text-white">SB</span>
            </div>
            <span className="font-display font-semibold text-sm text-slate-900 dark:text-white">SmartBank</span>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {/* Language — NSS style with flag */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="header-btn"
              >
                <span className="text-base">{LANG_FLAGS[lang]}</span>
                <span className="hidden sm:inline text-[13px]">{LANG_LABELS[lang]}</span>
                <ChevronDown size={13} className={clsx('transition-transform text-slate-400', langOpen && 'rotate-180')} />
              </button>
              {langOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-modal overflow-hidden z-50">
                  {[['en', 'English', '🇬🇧'], ['fr', 'Français', '🇫🇷'], ['rw', 'Kinyarwanda', '🇷🇼']].map(([code, label, flag]) => (
                    <button
                      key={code}
                      onClick={() => { setLang(code as any); setLangOpen(false); }}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors',
                        lang === code ? 'text-primary-600 font-semibold' : 'text-slate-600 dark:text-slate-300',
                      )}
                    >
                      <span>{flag}</span>{label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theme toggle — NSS style: just moon/sun icon */}
            <button onClick={toggleTheme} className="header-btn btn-icon" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
              {theme === 'dark' ? <Sun size={17} className="text-slate-500" /> : <Moon size={17} className="text-slate-500" />}
            </button>

            {/* Notifications bell with badge — NSS style */}
            <Link href="/dashboard/notifications" className="header-btn btn-icon relative">
              <Bell size={18} className="text-slate-500" />
              {unreadCount > 0 && (
                <span className="notif-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </Link>

            {/* User avatar + name — NSS style: avatar + "Super Administrator" */}
            <div ref={userRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="header-btn gap-2 pl-2"
              >
                {user.profile_photo ? (
                  <img src={`http://localhost:5000${user.profile_photo}`} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: roleColor }}
                  >
                    {initials}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-tight">{ROLE_LABELS[user.role] || user.role}</p>
                </div>
                <ChevronDown size={13} className={clsx('text-slate-400 transition-transform', userMenuOpen && 'rotate-180')} />
              </button>

              {userMenuOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-modal overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user.first_name} {user.last_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
                  </div>
                  <Link href="/dashboard/settings" onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <Settings size={15} /> Profile & Settings
                  </Link>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-t border-slate-100 dark:border-slate-700">
                    <LogOut size={15} /> {t('logout', lang)}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 mt-14 p-5 lg:p-6 animate-fade-up">
          {children}
        </main>
      </div>
    </div>
  );
}
