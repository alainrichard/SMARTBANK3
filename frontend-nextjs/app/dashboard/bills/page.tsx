'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { getBillers, getAccounts, payBill } from '@/lib/api';
import { CheckCircle } from 'lucide-react';
import clsx from 'clsx';

function fmtNum(n: any) { return Number(n||0).toLocaleString('en-RW'); }

export default function BillsPage() {
  const { lang } = useApp();
  const [billers, setBillers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [accId, setAccId] = useState('');
  const [ref, setRef] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    Promise.all([getBillers(), getAccounts()]).then(([b, a]) => {
      setBillers(b.data.data.billers || []);
      const accs = a.data.data.accounts || [];
      setAccounts(accs);
      if (accs.length) setAccId(accs[0].id);
    }).catch(() => {});
  }, []);

  const doPay = async () => {
    if (!selected) { toast.error('Select a service'); return; }
    if (!ref.trim()) { toast.error('Customer reference is required'); return; }
    if (parseFloat(amount) < 100) { toast.error('Minimum 100 RWF'); return; }
    setLoading(true); setResult('');
    try {
      const { data } = await payBill({ account_id: accId, biller_code: selected.code, biller_name: selected.name, customer_ref: ref, amount: parseFloat(amount) });
      if (data.success) { setResult(`Payment successful! Ref: ${data.data.receipt.reference}`); setRef(''); setAmount(''); }
      else toast.error(data.message || 'Failed');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Payment failed'); }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="topbar"><div><h1 className="font-display font-bold text-2xl">{t('bills', lang)}</h1><p className="text-slate-400 text-sm">Utilities, mobile, taxes and more</p></div></div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h3 className="font-display font-bold text-sm mb-3">Select Service</h3>
          <div className="grid grid-cols-2 gap-2">
            {billers.map((b: any) => (
              <button key={b.code} onClick={() => setSelected(b)}
                className={clsx('p-3 rounded-xl border text-left transition-all', selected?.code === b.code ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10' : 'border-ink-200 dark:border-ink-700 hover:border-brand-300')}>
                <p className="font-semibold text-sm">{b.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{b.category}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 className="font-display font-bold text-base mb-4">Payment Details</h3>
          {result && <div className="alert-success mb-4 flex items-center gap-2"><CheckCircle size={15}/>{result}</div>}
          {selected ? <div className="bg-brand-50 dark:bg-brand-900/10 rounded-xl p-3 mb-4 text-sm font-semibold">{selected.name} selected</div> : <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 mb-4 text-sm text-slate-400 border border-dashed">Select a service</div>}
          <div className="space-y-3">
            <div><label className="label">Pay From</label>
              <select className="input" value={accId} onChange={e=>setAccId(e.target.value)}>
                {accounts.map((a:any)=><option key={a.id} value={a.id}>{a.account_type} — {a.account_number} ({fmtNum(a.balance)} RWF)</option>)}
              </select>
            </div>
            <div><label className="label">Customer Ref / Meter No.</label><input className="input" placeholder="e.g. 0160123456" value={ref} onChange={e=>setRef(e.target.value)}/></div>
            <div><label className="label">Amount (RWF)</label><input className="input" type="number" placeholder="e.g. 5,000" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
            <button onClick={doPay} disabled={loading||!selected} className="btn-primary w-full py-3 justify-center">
              {loading?<><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"/>Processing...</>:'Pay Bill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
