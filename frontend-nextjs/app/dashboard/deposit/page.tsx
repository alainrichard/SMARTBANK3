'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '@/contexts/AppContext';
import { deposit, verifyAccount } from '@/lib/api';
import { CheckCircle, Search, PlusCircle } from 'lucide-react';

function fmtNum(n: any) { return Number(n||0).toLocaleString('en-RW'); }

export default function DepositPage() {
  const { lang } = useApp();
  const [accNum, setAccNum] = useState('');
  const [verified, setVerified] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState('');

  const doVerify = async () => {
    if (!accNum.trim()) return;
    setVerifying(true); setVerified(null);
    try {
      const { data } = await verifyAccount(accNum.trim());
      if (data.success) setVerified(data.data.account);
      else { setVerified(false); toast.error('Account not found'); }
    } catch { setVerified(false); toast.error('Account not found'); }
    setVerifying(false);
  };

  const doDeposit = async () => {
    if (!accNum || parseFloat(amount) < 100) { toast.error('Account number and amount (min 100 RWF) required'); return; }
    setLoading(true); setResult('');
    try {
      const { data } = await deposit({ account_number: accNum, amount: parseFloat(amount), description: desc || 'Cash deposit' });
      if (data.success) {
        setResult(`Deposit of ${fmtNum(amount)} RWF processed. Reference: ${data.data.transaction.reference}. Email sent to account holder.`);
        setAccNum(''); setAmount(''); setDesc(''); setVerified(null);
        toast.success('Deposit processed successfully!');
      } else toast.error(data.message || 'Failed');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Deposit failed'); }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="font-display font-bold text-2xl">Process Deposit</h1><p className="text-slate-400 text-sm mt-0.5">Credit customer accounts instantly</p></div>
      </div>

      <div className="max-w-lg">
        <div className="card">
          {result && <div className="alert-success mb-5"><CheckCircle size={16} className="flex-shrink-0"/>{result}</div>}

          <div className="field mb-4">
            <label className="label">Customer Account Number</label>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="e.g. 1000000001" value={accNum} onChange={e=>{setAccNum(e.target.value);setVerified(null);}} onBlur={doVerify}/>
              <button onClick={doVerify} disabled={verifying} className="btn-secondary px-4">
                {verifying ? <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin"/> : <Search size={16}/>}
              </button>
            </div>
            {verified && <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1"><CheckCircle size={12}/>{verified.account_name} — {verified.account_type}</p>}
            {verified === false && <p className="text-xs text-red-500 mt-1.5">Account not found</p>}
          </div>

          <div className="field mb-4">
            <label className="label">Amount (RWF, min 100)</label>
            <input className="input" type="number" min="100" placeholder="Enter deposit amount" value={amount} onChange={e=>setAmount(e.target.value)}/>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[10000,50000,100000,200000,500000].map(a=>(
                <button key={a} onClick={()=>setAmount(String(a))} className="btn-secondary btn-sm text-xs">{fmtNum(a)}</button>
              ))}
            </div>
          </div>

          <div className="field mb-5">
            <label className="label">Description</label>
            <input className="input" placeholder="Cash deposit" value={desc} onChange={e=>setDesc(e.target.value)}/>
          </div>

          <button onClick={doDeposit} disabled={loading} className="btn-primary w-full btn-lg">
            {loading ? <><div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin"/>Processing...</> : <><PlusCircle size={16}/>Process Deposit</>}
          </button>
        </div>
      </div>
    </div>
  );
}
