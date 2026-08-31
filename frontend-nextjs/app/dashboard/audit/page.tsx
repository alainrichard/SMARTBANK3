'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { getAuditLogs } from '@/lib/api';
import { ClipboardList, Search, Download, Filter } from 'lucide-react';
import clsx from 'clsx';

const ACTION_COLORS: Record<string,string> = {
  login:'badge-blue', register:'badge-green', logout:'badge-gray', transfer:'badge-purple',
  deposit:'badge-teal', loan_apply:'badge-gold', loan_approved:'badge-green', loan_rejected:'badge-red',
  fraud_resolved_fraud:'badge-red', fraud_resolved_false_positive:'badge-green',
  account_frozen:'badge-red', account_frozen_unfrozen:'badge-green', password_change:'badge-amber',
  profile_update:'badge-gray', kyc_verified:'badge-teal',
};

export default function AuditPage() {
  const { lang } = useApp();
  const [logs, setLogs] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLogs({ limit: 200 }).then(r => {
      const l = r.data?.data?.logs || [];
      setLogs(l); setFiltered(l);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let f = logs;
    if (search) f = f.filter((l:any) => `${l.user_name||''} ${l.user_email||''} ${l.action||''} ${l.entity||''}`.toLowerCase().includes(search.toLowerCase()));
    if (actionFilter) f = f.filter((l:any) => l.action === actionFilter);
    setFiltered(f);
  }, [search, actionFilter, logs]);

  const uniqueActions = Array.from(new Set(logs.map((l:any) => l.action).filter(Boolean))).sort();

  if (loading) return <div className="space-y-3">{[...Array(8)].map((_,i)=><div key={i} className="skeleton h-12 rounded-xl"/>)}</div>;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="font-display font-bold text-2xl">{t('audit', lang)}</h1>
          <p className="text-slate-400 text-sm mt-0.5">Tamper-proof record of all system actions</p>
        </div>
        <span className="badge-gray px-3 py-1.5">{filtered.length} records</span>
      </div>

      <div className="card flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Search user, action, entity..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <select className="input w-48" value={actionFilter} onChange={e=>setActionFilter(e.target.value)}>
          <option value="">All Actions</option>
          {uniqueActions.map(a=><option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>User</th><th>Role</th><th>Action</th><th>Entity</th><th>IP Address</th><th>Timestamp</th>
            </tr></thead>
            <tbody>
              {filtered.map((log: any) => (
                <tr key={log.id}>
                  <td>
                    <p className="font-semibold text-sm">{log.user_name || 'System'}</p>
                    <p className="text-xs text-slate-400">{log.user_email || '—'}</p>
                  </td>
                  <td>
                    <span className="badge badge-gray text-[11px] capitalize">{(log.user_role||'—').replace(/_/g,' ')}</span>
                  </td>
                  <td>
                    <span className={clsx('badge text-[11px]', ACTION_COLORS[log.action] || 'badge-gray')}>
                      {(log.action||'—').replace(/_/g,' ')}
                    </span>
                  </td>
                  <td className="text-sm text-slate-500">{log.entity || '—'}</td>
                  <td><span className="font-mono text-xs text-slate-400">{log.ip_address || '—'}</span></td>
                  <td className="text-xs text-slate-400 whitespace-nowrap">
                    {log.created_at ? new Date(log.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-10">
                  <ClipboardList size={32} className="mx-auto mb-2 opacity-20" />
                  No audit logs found.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
