'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { getMyTransactions, getAllTransactions } from '@/lib/api';
import { Search, Filter } from 'lucide-react';
import clsx from 'clsx';

function fmtNum(n: any) { return Number(n||0).toLocaleString('en-RW'); }

export default function TransactionsPage() {
  const { user, lang } = useApp();
  const [txns, setTxns] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [typeF, setTypeF] = useState('');
  const [statusF, setStatusF] = useState('');
  const [flagOnly, setFlagOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const isAdmin = ['super_admin','branch_manager','fraud_analyst','auditor'].includes(user?.role||'');

  useEffect(() => {
    (async () => {
      try {
        const { data } = isAdmin ? await getAllTransactions({ limit:100 }) : await getMyTransactions({ limit:100 });
        setTxns(data.data.transactions || []);
        setFiltered(data.data.transactions || []);
      } catch {}
      setLoading(false);
    })();
  }, [isAdmin]);

  useEffect(() => {
    let f = txns;
    if (typeF) f = f.filter((t:any) => t.type === typeF);
    if (statusF) f = f.filter((t:any) => t.status === statusF);
    if (flagOnly) f = f.filter((t:any) => t.is_flagged || t.status === 'flagged');
    setFiltered(f);
  }, [typeF, statusF, flagOnly, txns]);

  if (loading) return <div className="space-y-3">{[...Array(5)].map((_,i)=><div key={i} className="skeleton h-14 rounded-xl"/>)}</div>;

  return (
    <div className="space-y-5">
      <div className="topbar">
        <div><h1 className="font-display font-bold text-2xl">{t('transactions', lang)}</h1><p className="text-slate-400 text-sm">{txns.length} records</p></div>
      </div>
      <div className="card flex flex-wrap gap-3 items-center">
        <select className="input w-40" value={typeF} onChange={e=>{setTypeF(e.target.value)}}>
          <option value="">All Types</option>
          {['transfer','deposit','withdrawal','bill_payment'].map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
        </select>
        <select className="input w-40" value={statusF} onChange={e=>setStatusF(e.target.value)}>
          <option value="">All Status</option>
          {['completed','flagged','pending','blocked'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        {isAdmin && <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={flagOnly} onChange={e=>setFlagOnly(e.target.checked)} className="rounded" />Flagged only</label>}
        <span className="badge-gray px-3 py-1.5 text-sm">{filtered.length} results</span>
      </div>
      <div className="card overflow-hidden p-0">
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('reference',lang)}</th><th>{t('from',lang)}</th><th>{t('to',lang)}</th><th>{t('amount',lang)}</th><th>{t('type',lang)}</th><th>{t('status',lang)}</th>{isAdmin&&<th>AI Score</th>}<th>{t('date',lang)}</th></tr></thead>
            <tbody>
              {filtered.map((tx:any)=>(
                <tr key={tx.id}>
                  <td><span className="font-mono text-xs text-slate-400">{tx.reference?.slice(0,16)||'—'}</span></td>
                  <td className="text-xs">{tx.sender_name||'—'}</td>
                  <td className="text-xs">{tx.receiver_name||'—'}</td>
                  <td><span className="font-mono font-semibold">{fmtNum(tx.amount)}</span> <span className="text-xs text-slate-400">RWF</span></td>
                  <td><span className="badge badge-gray capitalize text-xs">{(tx.type||'').replace(/_/g,' ')}</span></td>
                  <td><span className={clsx('badge text-xs',{'badge-green':tx.status==='completed','badge-red':tx.status==='flagged'||tx.is_flagged,'badge-amber':tx.status==='pending','badge-gray':!tx.status})}>{tx.status||'—'}</span></td>
                  {isAdmin&&<td className="text-xs">{tx.fraud_score!=null?`${(tx.fraud_score*100).toFixed(0)}%`:'—'}</td>}
                  <td className="text-xs text-slate-400">{tx.created_at?new Date(tx.created_at).toLocaleDateString():''}</td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={8} className="text-center text-slate-400 py-8">{t('noTransactions',lang)}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
