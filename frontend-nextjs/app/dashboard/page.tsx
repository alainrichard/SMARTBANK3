'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { getAccounts, getMyTransactions, getCreditScore, getNotifications, getDashboardStats } from '@/lib/api';
import { ArrowRightLeft, CreditCard, Receipt, BarChart2, MessageSquare, Bell, FileText, TrendingUp, TrendingDown, MapPin, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';

function StatCard({ label, value, sub, accent, trend }: any) {
  return (
    <div className="stat-card">
      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{label}</p>
      <p className={clsx('font-display font-black text-3xl tracking-tight leading-none mb-1', accent)}>{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">{trend === 'up' ? <TrendingUp size={11} className="text-emerald-500" /> : trend === 'down' ? <TrendingDown size={11} className="text-red-500" /> : null}{sub}</p>}
    </div>
  );
}

function LocationBadge() {
  const [loc, setLoc] = useState<string | null>(null);
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
            const d = await r.json();
            setLoc(d.address?.city || d.address?.town || d.address?.county || 'Location detected');
          } catch { setLoc('Location detected'); }
        },
        () => setLoc(null)
      );
    }
  }, []);
  if (!loc) return null;
  return (
    <span className="location-badge"><MapPin size={11} />{loc}</span>
  );
}

function fmtNum(n: any) { return Number(n || 0).toLocaleString('en-RW'); }

function TxnRow({ txn, isAdmin }: any) {
  const statusClass: any = { completed: 'badge-green', flagged: 'badge-red', blocked: 'badge-red', pending: 'badge-amber' };
  return (
    <tr>
      <td><span className="font-mono text-xs text-slate-400">{txn.reference?.slice(0, 14) || '—'}</span></td>
      <td className="text-xs">{txn.sender_name || '—'}</td>
      <td className="text-xs">{txn.receiver_name || '—'}</td>
      <td><span className="font-mono font-semibold">{fmtNum(txn.amount)}</span> <span className="text-xs text-slate-400">RWF</span></td>
      <td><span className="badge badge-gray capitalize">{(txn.type || '').replace(/_/g, ' ')}</span></td>
      <td><span className={clsx('badge', statusClass[txn.status] || 'badge-gray')}>{txn.status || '—'}</span></td>
      {isAdmin && <td><div className="flex items-center gap-1.5"><div className="progress w-12"><div className="progress-bar" style={{ width: `${((txn.fraud_score || 0) * 100).toFixed(0)}%`, background: (txn.fraud_score || 0) > 0.6 ? '#ef4444' : (txn.fraud_score || 0) > 0.3 ? '#f59e0b' : '#10b981' }} /></div><span className="text-xs font-semibold">{txn.fraud_score != null ? `${((txn.fraud_score) * 100).toFixed(0)}%` : '—'}</span></div></td>}
      <td className="text-xs text-slate-400">{txn.created_at ? new Date(txn.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
    </tr>
  );
}

export default function DashboardPage() {
  const { user, lang } = useApp();
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [creditScore, setCreditScore] = useState<any>(null);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = ['super_admin', 'branch_manager', 'fraud_analyst', 'auditor'].includes(user?.role || '');
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('goodMorning', lang) : hour < 17 ? t('goodAfternoon', lang) : t('goodEvening', lang);

  useEffect(() => {
    (async () => {
      try {
        if (isAdmin) {
          const [txR, stR] = await Promise.all([
            fetch('/api/transactions/all?limit=8', { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }).then(r => r.json()),
            getDashboardStats(),
          ]);
          setTxns(txR?.data?.transactions || []);
          setAdminStats(stR.data?.data);
        } else {
          const [acR, txR, csR] = await Promise.all([getAccounts(), getMyTransactions({ limit: 5 }), getCreditScore()]);
          setAccounts(acR.data?.data?.accounts || []);
          setTxns(txR.data?.data?.transactions || []);
          setCreditScore(csR.data?.data);
        }
      } catch {}
      setLoading(false);
    })();
  }, [isAdmin]);

  if (user?.role === 'auditor' || user?.role === 'fraud_analyst' || user?.role === 'branch_manager' || user?.role === 'super_admin') {
    router.replace('/dashboard/admin'); return null;
  }

  if (loading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
    </div>
  );

  const totalBal = accounts.reduce((s: number, a: any) => s + parseFloat(a.balance || 0), 0);

  const quickActions = [
    { path: '/dashboard/transfer', icon: ArrowRightLeft, label: t('transfer', lang) },
    { path: '/dashboard/loans', icon: CreditCard, label: t('loans', lang) },
    { path: '/dashboard/bills', icon: Receipt, label: t('bills', lang) },
    { path: '/dashboard/analytics', icon: BarChart2, label: t('analytics', lang) },
    { path: '/dashboard/support', icon: MessageSquare, label: t('support', lang) },
    { path: '/dashboard/reports', icon: FileText, label: t('reports', lang) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-display font-bold text-2xl">{greet}, {user?.first_name}</h1>
            <LocationBadge />
          </div>
          <p className="text-slate-400 text-sm">{new Date().toLocaleDateString('en-RW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <Link href="/dashboard/transfer" className="btn-primary text-sm">{t('transfer', lang)}</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card lg:col-span-1 bg-slate-900 dark:bg-slate-800">
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">{t('totalBalance', lang)}</p>
          <p className="font-display font-black text-3xl text-white tracking-tight">{fmtNum(totalBal)}</p>
          <p className="text-xs text-white/40 mt-1">RWF &middot; {accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <StatCard label={t('transactions', lang)} value={txns.length} sub="Recent activity" />
        <StatCard label={t('activeAccounts', lang)} value={accounts.filter((a: any) => a.status === 'active').length} sub="Savings & checking" accent="text-teal-600" />
        <StatCard label={t('creditScore', lang)} value={creditScore?.credit_score || '—'} sub={creditScore?.risk_level ? `${creditScore.risk_level} risk` : 'Loading AI score...'} accent="text-brand-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Accounts */}
        <div className="card lg:col-span-1 space-y-3">
          <div className="section-title">
            <h2 className="font-display font-bold text-base">{t('activeAccounts', lang)}</h2>
            <Link href="/dashboard/transfer" className="btn-ghost btn-sm text-xs">+ Send</Link>
          </div>
          {accounts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No accounts found.</p>
          ) : accounts.map((a: any) => (
            <div key={a.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              <div>
                <p className="font-semibold text-sm capitalize">{a.account_type} Account</p>
                <p className="font-mono text-xs text-slate-400 mt-0.5">{a.account_number}</p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-base">{fmtNum(a.balance)} <span className="text-xs text-slate-400 font-normal font-body">RWF</span></p>
                <span className={clsx('badge mt-1', a.status === 'active' ? 'badge-green' : 'badge-red')}>{a.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="card lg:col-span-1">
          <div className="section-title"><h2 className="font-display font-bold text-base">{t('quickActions', lang)}</h2></div>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map(({ path, icon: Icon, label }) => (
              <Link key={path} href={path}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-all text-center">
                <Icon size={20} className="text-slate-500 dark:text-slate-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* AI Advice quick card */}
        <div className="card lg:col-span-1">
          <div className="section-title">
            <h2 className="font-display font-bold text-base">AI Advisor</h2>
            <Link href="/dashboard/analytics" className="btn-ghost btn-sm text-xs">Details</Link>
          </div>
          {creditScore ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Credit Score</span>
                  <span className="font-semibold">{creditScore.credit_score} / 850</span>
                </div>
                <div className="progress h-2.5 rounded-full">
                  <div className="progress-bar rounded-full" style={{ width: `${((creditScore.credit_score - 300) / 550) * 100}%`, background: 'linear-gradient(90deg,#ef4444,#f59e0b,#10b981)' }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>Poor 300</span><span>Good 700</span><span>850</span></div>
              </div>
              {creditScore.recommendation && (
                <div className="alert-info text-xs">{creditScore.recommendation}</div>
              )}
              {creditScore.max_loan_amount && (
                <p className="text-xs text-slate-500">Max loan: <strong>{fmtNum(creditScore.max_loan_amount)} RWF</strong></p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-slate-400 text-sm">
              <BarChart2 size={32} className="mb-2 opacity-30" />
              <p>AI scoring unavailable</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="section-title">
          <h2 className="font-display font-bold text-base">{t('recentTransactions', lang)}</h2>
          <Link href="/dashboard/transactions" className="btn-ghost btn-sm text-xs">View all &rarr;</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('reference', lang)}</th><th>{t('from', lang)}</th><th>{t('to', lang)}</th>
              <th>{t('amount', lang)}</th><th>{t('type', lang)}</th><th>{t('status', lang)}</th>
              <th>{t('date', lang)}</th>
            </tr></thead>
            <tbody>
              {txns.length === 0 ? <tr><td colSpan={7} className="text-center text-slate-400 py-8">{t('noTransactions', lang)}</td></tr>
                : txns.map((txn: any) => <TxnRow key={txn.id} txn={txn} isAdmin={false} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
