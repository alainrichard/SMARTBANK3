'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { getAccounts, verifyAccount, transfer } from '@/lib/api';
import {
  ArrowRightLeft, Search, CheckCircle, AlertTriangle, ChevronDown,
  User, Info, Shield, Zap,
} from 'lucide-react';
import clsx from 'clsx';

function fmtNum(n: any) { return Number(n || 0).toLocaleString('en-RW'); }

export default function TransferPage() {
  const { lang, user } = useApp();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fromAccId, setFromAccId] = useState('');
  const [to, setTo] = useState('');
  const [verified, setVerified] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    getAccounts()
      .then(r => {
        const accs = r.data?.data?.accounts || [];
        setAccounts(accs);
        if (accs.length) setFromAccId(accs[0].id);
      })
      .catch(() => {});
  }, []);

  const fromAccount = accounts.find(a => a.id === fromAccId);

  const doVerify = async () => {
    if (!to.trim()) return;
    setVerifying(true); setVerified(null); setConfirmed(false);
    try {
      const { data } = await verifyAccount(to.trim());
      if (data.success) {
        setVerified(data.data.account);
        toast.success('Account verified!');
      } else {
        setVerified(false);
        toast.error('Account not found');
      }
    } catch {
      setVerified(false);
      toast.error('Account not found');
    }
    setVerifying(false);
  };

  const doTransfer = async () => {
    if (!fromAccId) { toast.error('Select a source account'); return; }
    if (!to.trim()) { toast.error('Enter recipient account number'); return; }
    if (!verified) { toast.error('Verify the recipient account first'); return; }
    if (!confirmed) { toast.error('Please confirm the recipient details'); return; }
    if (!amount || parseFloat(amount) < 100) { toast.error('Minimum transfer is 100 RWF'); return; }
    if (fromAccount && parseFloat(amount) > parseFloat(fromAccount.balance)) {
      toast.error('Insufficient balance'); return;
    }

    setLoading(true); setResult(null);
    try {
      const { data } = await transfer({
        sender_account_id: fromAccId,
        receiver_account_number: to,
        amount: parseFloat(amount),
        description: desc || 'Transfer',
      });
      if (data.success) {
        setResult({
          ok: !data.data?.transaction?.is_flagged,
          flagged: data.data?.transaction?.is_flagged,
          score: data.data?.transaction?.fraud_score,
          ref: data.data?.transaction?.reference || data.data?.reference,
        });
        setTo(''); setAmount(''); setDesc(''); setVerified(null); setConfirmed(false);
        toast.success('Transfer processed successfully!');
      } else {
        toast.error(data.message || 'Transfer failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    }
    setLoading(false);
  };

  const isStaff = ['bank_staff', 'branch_manager', 'super_admin'].includes(user?.role || '');
  const amountNum = parseFloat(amount) || 0;
  const balance = parseFloat(fromAccount?.balance || '0');
  const isOverLimit = amountNum > balance;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="font-display font-bold text-xl">{t('transfer', lang)}</h1>
          <p className="text-slate-400 text-sm mt-0.5">Instant transfers · AI fraud screening active</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
          <Shield size={13} /> AI Protected
        </span>
      </div>

      {result && (
        <div className={clsx('animate-fade-up', result.ok ? 'alert-success' : 'alert-warning')}>
          {result.ok
            ? <><CheckCircle size={16} className="flex-shrink-0" /><span>Transfer successful! Reference: <strong className="font-mono">{result.ref}</strong>. Email sent to both parties.</span></>
            : <><AlertTriangle size={16} className="flex-shrink-0" /><span>Transfer flagged by AI (risk score: {((result.score || 0) * 100).toFixed(0)}%). Held for review. Reference: <strong className="font-mono">{result.ref}</strong>.</span></>
          }
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Left: accounts + info */}
        <div className="lg:col-span-2 space-y-4">
          {/* From account selector */}
          <div className="card">
            <p className="font-display font-semibold text-sm text-slate-700 dark:text-slate-300 mb-3">
              {isStaff ? 'Customer Source Account' : 'From Account'}
            </p>
            {accounts.length === 0 ? (
              <div className="alert-warning text-xs">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                <span>No active accounts found. {isStaff ? 'Ensure the customer has an active account.' : 'Your account may be pending KYC approval.'}</span>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map(a => (
                  <label
                    key={a.id}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                      fromAccId === a.id
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-300',
                    )}
                  >
                    <input type="radio" name="from_acc" value={a.id} checked={fromAccId === a.id}
                      onChange={() => setFromAccId(a.id)} className="sr-only" />
                    <div className={clsx(
                      'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',
                      fromAccId === a.id ? 'border-blue-500 bg-blue-500' : 'border-slate-300',
                    )}>
                      {fromAccId === a.id && <div className="w-2 h-2 bg-white rounded-full m-auto mt-[1px]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 capitalize">{a.account_type} Account</p>
                      <p className="font-mono text-xs text-slate-400 mt-0.5">{a.account_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-sm text-slate-800 dark:text-slate-200">{fmtNum(a.balance)}</p>
                      <p className="text-[10px] text-slate-400">RWF</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* AI fraud notice */}
          <div className="ai-card-info">
            <p className="font-semibold text-xs mb-1 flex items-center gap-1.5"><Zap size={12} /> AI Fraud Detection Active</p>
            <p className="text-xs opacity-80">Every transfer is scored by our RandomForest ML model. High-risk transactions are held for review and you'll be notified immediately.</p>
          </div>
        </div>

        {/* Right: transfer form */}
        <div className="lg:col-span-3">
          <div className="card space-y-4">
            <h2 className="font-display font-bold text-base">Transfer Details</h2>

            {/* Recipient */}
            <div className="field">
              <label className="label">Recipient Account Number *</label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="e.g. 1000000003"
                  value={to}
                  onChange={e => { setTo(e.target.value); setVerified(null); setConfirmed(false); }}
                  onBlur={doVerify}
                />
                <button onClick={doVerify} disabled={verifying || !to.trim()} className="btn-secondary px-4 flex-shrink-0">
                  {verifying
                    ? <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 dark:border-t-slate-300 rounded-full animate-spin" />
                    : <Search size={16} />}
                </button>
              </div>

              {/* Verified account confirmation card */}
              {verified && (
                <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl animate-fade-up">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                      <User size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-base text-slate-900 dark:text-white">{verified.account_name || verified.owner_name || '—'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">{verified.account_type} Account</p>
                      <p className="font-mono text-xs text-slate-400 mt-0.5">{verified.account_number}</p>
                      {verified.branch_name && (
                        <p className="text-xs text-slate-400 mt-0.5">Branch: {verified.branch_name}</p>
                      )}
                    </div>
                    <CheckCircle size={18} className="text-emerald-500 flex-shrink-0 mt-1" />
                  </div>

                  {/* Confirmation checkbox */}
                  <label className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={e => setConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      I confirm this is the correct recipient
                    </span>
                  </label>
                </div>
              )}

              {verified === false && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Account not found. Check the account number and try again.
                </p>
              )}
            </div>

            {/* Amount */}
            <div className="field">
              <label className="label">Amount (RWF) *</label>
              <input
                className={clsx('input', isOverLimit && amount ? 'input-error' : '')}
                type="number"
                placeholder="e.g. 50,000"
                min="100"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              {fromAccount && (
                <p className={clsx('text-xs mt-1', isOverLimit ? 'text-red-600 dark:text-red-400' : 'text-slate-400')}>
                  Available: <strong>{fmtNum(fromAccount.balance)} RWF</strong>
                  {isOverLimit && ' — Insufficient balance'}
                </p>
              )}
              {/* Quick amounts */}
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {[1000, 5000, 10000, 50000, 100000, 500000].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(String(v))}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-400 transition-colors font-medium"
                  >
                    {fmtNum(v)}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="field">
              <label className="label">Description (Optional)</label>
              <input className="input" placeholder="e.g. Rent payment, School fees..." value={desc} onChange={e => setDesc(e.target.value)} />
            </div>

            {/* Summary before send */}
            {verified && confirmed && amount && parseFloat(amount) >= 100 && !isOverLimit && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl animate-fade-up">
                <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">Transfer Summary</p>
                <div className="space-y-1.5 text-sm text-blue-800 dark:text-blue-200">
                  <div className="flex justify-between"><span>From</span><span className="font-mono text-xs">{fromAccount?.account_number}</span></div>
                  <div className="flex justify-between"><span>To</span><strong>{verified.account_name}</strong></div>
                  <div className="flex justify-between"><span>Amount</span><strong className="text-base">{fmtNum(amount)} RWF</strong></div>
                </div>
              </div>
            )}

            <button
              onClick={doTransfer}
              disabled={loading || !fromAccId || !verified || !confirmed || !amount || isOverLimit}
              className="btn-primary w-full btn-lg"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" /> Processing...</>
                : <><ArrowRightLeft size={16} /> Send {amount && parseFloat(amount) >= 100 ? fmtNum(amount) + ' RWF' : 'Money'}</>
              }
            </button>

            {(!verified && to) && (
              <p className="text-xs text-center text-slate-400">
                Click the search button or press Tab to verify the recipient account
              </p>
            )}
            {(verified && !confirmed) && (
              <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                Please confirm the recipient name above before sending
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
