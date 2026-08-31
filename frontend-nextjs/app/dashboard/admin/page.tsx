'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { getDashboardStats, getFraudStats } from '@/lib/api';
import { Users, List, AlertTriangle, CreditCard, GitBranch, ClipboardList, FileText, CheckCircle, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import clsx from 'clsx';

function fmtNum(n: any) { return Number(n || 0).toLocaleString('en-RW'); }

export default function AdminDashboard() {
  const { user, lang } = useApp();
  const [stats, setStats] = useState<any>(null);
  const [fraudStats, setFraudStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sR, fR] = await Promise.all([getDashboardStats(), getFraudStats()]);
        setStats(sR.data?.data);
        setFraudStats(fR.data?.data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>;

  const s = stats || {};
  const fraudColors = ['#ef4444', '#10b981', '#f59e0b', '#3b5bdb'];
  const fraudByStatus = fraudStats?.by_status || [];

  const quickLinks = [
    { path: '/dashboard/users', icon: Users, label: t('users', lang), color: 'text-blue-600' },
    { path: '/dashboard/fraud', icon: AlertTriangle, label: t('fraud', lang), color: 'text-red-600' },
    { path: '/dashboard/loans', icon: CreditCard, label: t('loans', lang), color: 'text-brand-600' },
    { path: '/dashboard/branches', icon: GitBranch, label: t('branches', lang), color: 'text-purple-600' },
    { path: '/dashboard/audit', icon: ClipboardList, label: t('audit', lang), color: 'text-teal-600' },
    { path: '/dashboard/reports', icon: FileText, label: t('reports', lang), color: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="font-display font-bold text-2xl">Admin Dashboard</h1>
          <p className="text-slate-400 text-sm">{new Date().toLocaleDateString('en-RW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <span className="badge-green flex items-center gap-1.5 px-3 py-1.5 text-sm">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-dot" />System Online
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card bg-slate-900 dark:bg-slate-800">
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Customers</p>
          <p className="font-display font-black text-3xl text-white">{fmtNum(s.customers?.total)}</p>
          <p className="text-xs text-white/40 mt-1">+{s.customers?.new_month || 0} this month</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Transactions (30d)</p>
          <p className="font-display font-black text-3xl">{fmtNum(s.transactions?.total)}</p>
          <p className="text-xs text-slate-400 mt-1">{fmtNum(s.transactions?.volume)} RWF volume</p>
        </div>
        <div className="stat-card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Open Fraud Cases</p>
          <p className="font-display font-black text-3xl text-red-600">{fmtNum(s.fraud?.open)}</p>
          <p className="text-xs text-red-400 mt-1">{s.transactions?.flagged || 0} flagged txns</p>
        </div>
        <div className="stat-card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">Pending Loans</p>
          <p className="font-display font-black text-3xl text-amber-600">{fmtNum(s.loans?.pending)}</p>
          <p className="text-xs text-amber-500 mt-1">awaiting review</p>
        </div>
      </div>

      {/* Second row stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <p className="font-display font-black text-2xl text-brand-600">{s.branches?.active || 0}</p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Active Branches</p>
        </div>
        <div className="stat-card text-center">
          <p className="font-display font-black text-2xl text-emerald-600">{s.loans?.approved || 0}</p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Approved Loans</p>
        </div>
        <div className="stat-card text-center">
          <p className="font-display font-black text-2xl text-teal-600">{s.customers?.kyc_verified || 0}</p>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">KYC Verified</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Fraud chart */}
        <div className="card">
          <div className="section-title">
            <h2 className="font-display font-bold text-base">Fraud Cases by Status</h2>
            <Link href="/dashboard/fraud" className="btn-ghost btn-sm text-xs">View all &rarr;</Link>
          </div>
          {fraudByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={fraudByStatus} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {fraudByStatus.map((_: any, i: number) => <Cell key={i} fill={fraudColors[i % fraudColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No fraud data</div>
          )}
        </div>

        {/* Quick links */}
        <div className="card">
          <div className="section-title"><h2 className="font-display font-bold text-base">Quick Navigation</h2></div>
          <div className="grid grid-cols-2 gap-2">
            {quickLinks.map(({ path, icon: Icon, label, color }) => (
              <Link key={path} href={path}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-slate-700 transition-all">
                <Icon size={18} className={color} />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Additional info */}
      {s.customers?.kyc_verified !== undefined && (
        <div className="card">
          <div className="section-title"><h2 className="font-display font-bold text-base">System Overview</h2></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            {[
              ['KYC Verified', s.customers?.kyc_verified, 'text-teal-600'],
              ['Total Loans', s.loans?.total, 'text-blue-600'],
              ['Loan Disbursed', `${fmtNum(s.loans?.disbursed_total)} RWF`, 'text-brand-600'],
              ['Flagged Txns', s.transactions?.flagged, 'text-red-600'],
            ].map(([label, val, color]) => (
              <div key={label as string} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <p className={`font-display font-black text-2xl ${color}`}>{val}</p>
                <p className="text-xs text-slate-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
