'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { getFraudCases, updateFraudCase, freezeAccount, getFraudStats } from '@/lib/api';
import { AlertTriangle, Shield, CheckCircle, XCircle, Lock, Eye, TrendingUp, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import clsx from 'clsx';

function fmtNum(n: any) { return Number(n||0).toLocaleString('en-RW'); }

function RiskScore({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const cls = score >= 0.8 ? 'risk-pill-critical' : score >= 0.65 ? 'risk-pill-high' : score >= 0.4 ? 'risk-pill-medium' : 'risk-pill-low';
  const label = score >= 0.8 ? 'Critical' : score >= 0.65 ? 'High' : score >= 0.4 ? 'Medium' : 'Low';
  return (
    <div className="flex items-center gap-2">
      <div className="progress w-16">
        <div className="progress-bar" style={{ width:`${pct}%`, background: score>=0.65?'#dc2626':score>=0.4?'#f59e0b':'#10b981' }} />
      </div>
      <span className={clsx('risk-pill text-xs', cls)}>{pct}% {label}</span>
    </div>
  );
}

export default function FraudPage() {
  const { lang } = useApp();
  const [cases, setCases] = useState<any[]>([]);
  const [flaggedTxns, setFlaggedTxns] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cases');

  const load = async () => {
    try {
      const [cR, sR] = await Promise.all([
        getFraudCases({ limit: 50 }),
        getFraudStats(),
      ]);
      setCases(cR.data?.data?.cases || []);
      setStats(sR.data?.data || {});

      // Also get flagged transactions
      const txR = await fetch('/api/transactions/all?is_flagged=true&limit=50', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
      });
      const txD = await txR.json();
      setFlaggedTxns(txD?.data?.transactions || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resolveCase = async (id: string, status: string) => {
    const notes = status === 'resolved_fraud' ? prompt('Resolution notes (optional):') || undefined : undefined;
    try {
      const { data } = await updateFraudCase(id, { status, resolution_notes: notes });
      if (data.success) { toast.success('Case updated'); load(); }
      else toast.error(data.message || 'Failed');
    } catch { toast.error('Failed'); }
  };

  const handleFreeze = async (accountId: string) => {
    if (!confirm('Freeze this account? The customer will be notified.')) return;
    try {
      const { data } = await freezeAccount({ account_id: accountId, reason: 'Fraud investigation' });
      if (data.success) { toast.success('Account frozen. Customer notified.'); load(); }
      else toast.error(data.message || 'Failed');
    } catch { toast.error('Failed'); }
  };

  const openCases = cases.filter(c => c.status === 'open');
  const resolvedCases = cases.filter(c => c.status !== 'open');
  const avgScore = cases.length ? (cases.reduce((s, c) => s + parseFloat(c.ai_score || 0), 0) / cases.length * 100).toFixed(0) : '—';

  const fraudColors = ['#dc2626','#10b981','#f59e0b','#2563eb','#7c3aed'];

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_,i)=><div key={i} className="skeleton h-24 rounded-2xl"/>)}</div>;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="font-display font-bold text-2xl">Fraud Detection Center</h1>
          <p className="text-slate-400 text-sm mt-0.5">AI-powered real-time fraud monitoring</p>
        </div>
        <span className="flex items-center gap-2 badge-red px-3 py-1.5">
          <AlertTriangle size={13} />
          {openCases.length} open case{openCases.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card bg-[#0d1426] text-white">
          <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-2">Open Cases</p>
          <p className="font-display font-black text-3xl text-red-400">{openCases.length}</p>
          <p className="text-xs text-white/30 mt-1">Require attention</p>
        </div>
        <div className="stat-card">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Flagged Txns</p>
          <p className="font-display font-black text-3xl">{flaggedTxns.length}</p>
          <p className="text-xs text-slate-400 mt-1">Under review</p>
        </div>
        <div className="stat-card bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Resolved</p>
          <p className="font-display font-black text-3xl text-emerald-600">{resolvedCases.length}</p>
          <p className="text-xs text-emerald-500 mt-1">Cases closed</p>
        </div>
        <div className="stat-card">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Avg AI Score</p>
          <p className="font-display font-black text-3xl">{avgScore}{cases.length ? '%' : ''}</p>
          <p className="text-xs text-slate-400 mt-1">Risk level</p>
        </div>
      </div>

      {/* Chart + Stats */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="section-title">
            <h2 className="font-display font-bold text-base">Cases by Status</h2>
          </div>
          {(stats.by_status || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.by_status} margin={{ left:-20 }}>
                <XAxis dataKey="status" tick={{ fontSize:11 }} />
                <YAxis tick={{ fontSize:11 }} />
                <Tooltip contentStyle={{ borderRadius:10, fontSize:12, border:'1px solid #e5e7eb' }} />
                <Bar dataKey="count" radius={[6,6,0,0]}>
                  {(stats.by_status||[]).map((_:any,i:number)=><Cell key={i} fill={fraudColors[i%fraudColors.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 text-sm text-center py-8">No data available</p>}
        </div>
        <div className="card">
          <div className="section-title"><h2 className="font-display font-bold text-base">Severity Breakdown</h2></div>
          <div className="space-y-3">
            {(stats.by_severity || []).map((s: any) => (
              <div key={s.severity} className="flex items-center gap-3">
                <span className={clsx('badge w-20 justify-center text-xs capitalize',
                  s.severity === 'critical' ? 'badge-red' : s.severity === 'high' ? 'badge-amber' : 'badge-gray'
                )}>{s.severity}</span>
                <div className="flex-1 progress h-2">
                  <div className="progress-bar" style={{ width:`${(s.count/Math.max(1,...(stats.by_severity||[]).map((x:any)=>x.count)))*100}%`, background: s.severity==='critical'?'#dc2626':s.severity==='high'?'#f59e0b':'#6b7280' }} />
                </div>
                <span className="text-sm font-semibold w-8 text-right">{s.count}</span>
              </div>
            ))}
            {!(stats.by_severity||[]).length && <p className="text-slate-400 text-sm text-center py-4">No data</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar w-fit">
        {[['cases','Fraud Cases'],['flagged','Flagged Transactions']].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)} className={clsx('tab-item',activeTab===id&&'active')}>{label}</button>
        ))}
      </div>

      {/* Cases table */}
      {activeTab === 'cases' && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-display font-bold text-base">Fraud Cases</h2>
          </div>
          {cases.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-400">
              <Shield size={40} className="mb-3 opacity-20" />
              <p className="font-medium">No fraud cases recorded</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Customer</th><th>Account</th><th>Amount</th><th>AI Score</th>
                  <th>Severity</th><th>Status</th><th>Reason</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {cases.map((c: any) => (
                    <tr key={c.id}>
                      <td>
                        <p className="font-semibold text-sm">{c.customer_name || '—'}</p>
                        <p className="text-xs text-slate-400">{c.customer_email || '—'}</p>
                      </td>
                      <td><span className="font-mono text-xs">{c.account_number || '—'}</span></td>
                      <td><span className="font-mono font-semibold">{fmtNum(c.amount)}</span> <span className="text-xs text-slate-400">RWF</span></td>
                      <td><RiskScore score={parseFloat(c.ai_score) || 0} /></td>
                      <td>
                        <span className={clsx('badge',{'badge-red':c.severity==='critical'||c.severity==='high','badge-amber':c.severity==='medium','badge-gray':!c.severity})} style={{textTransform:'capitalize'}}>
                          {c.severity || '—'}
                        </span>
                      </td>
                      <td>
                        <span className={clsx('badge capitalize',{'badge-red':c.status==='open','badge-green':c.status.includes('resolved'),'badge-gray':!c.status})}>
                          {(c.status||'—').replace(/_/g,' ')}
                        </span>
                      </td>
                      <td>
                        <p className="text-xs text-slate-400 max-w-[150px] truncate" title={(c.ai_reason||[]).join(', ')}>
                          {(c.ai_reason||[]).slice(0,2).join(', ') || '—'}
                        </p>
                      </td>
                      <td>
                        {c.status === 'open' ? (
                          <div className="flex gap-1.5 flex-wrap">
                            <button onClick={()=>resolveCase(c.id,'resolved_fraud')} className="btn-danger btn-sm">
                              <XCircle size={12} /> Fraud
                            </button>
                            <button onClick={()=>resolveCase(c.id,'resolved_false_positive')} className="btn-success btn-sm">
                              <CheckCircle size={12} /> Clear
                            </button>
                            {c.account_id && (
                              <button onClick={()=>handleFreeze(c.account_id)} className="btn btn-sm border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400">
                                <Lock size={12} /> Freeze
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 capitalize">{(c.status||'').replace(/_/g,' ')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Flagged transactions */}
      {activeTab === 'flagged' && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-display font-bold text-base">Flagged Transactions ({flaggedTxns.length})</h2>
          </div>
          {flaggedTxns.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-400">
              <Activity size={40} className="mb-3 opacity-20" />
              <p className="font-medium">No flagged transactions</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Reference</th><th>From</th><th>To</th><th>Amount</th><th>AI Score</th><th>Date</th>
                </tr></thead>
                <tbody>
                  {flaggedTxns.map((tx: any) => (
                    <tr key={tx.id}>
                      <td><span className="font-mono text-xs text-slate-400">{tx.reference?.slice(0,16)||'—'}</span></td>
                      <td className="text-sm">{tx.sender_name||'—'}</td>
                      <td className="text-sm">{tx.receiver_name||'—'}</td>
                      <td><span className="font-mono font-semibold">{fmtNum(tx.amount)}</span> <span className="text-xs text-slate-400">RWF</span></td>
                      <td><RiskScore score={parseFloat(tx.fraud_score)||0} /></td>
                      <td className="text-xs text-slate-400">{tx.created_at?new Date(tx.created_at).toLocaleDateString():''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
