'use client';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { getMyLoans, getCreditScore, getAllLoans, reviewLoan } from '@/lib/api';
import {
  CreditCard, Plus, X, CheckCircle, XCircle, Upload, FileText,
  AlertTriangle, TrendingUp, ChevronDown, Info, Trash2,
  Eye, ThumbsUp, ThumbsDown, MessageSquare, Send, User, Camera,
  DollarSign, Shield,
} from 'lucide-react';
import clsx from 'clsx';

function fmtNum(n: any) { return Number(n || 0).toLocaleString('en-RW'); }

const COLLATERAL_THRESHOLD = 5_000_000;

const DOC_SLOTS = [
  { key: 'id_document',      label: 'National ID / Passport',       required: true,  desc: 'Clear photo of both sides' },
  { key: 'income_proof',     label: 'Income Proof / Pay Slip',       required: true,  desc: 'Last 3 months payslips or bank statement' },
  { key: 'business_plan',    label: 'Business Plan / Purpose Letter', required: false, desc: 'Required for business/agricultural loans' },
  { key: 'collateral_doc',   label: 'Collateral Document',           required: false, desc: 'Land title, vehicle logbook, etc.' },
];

function DocUploadSlot({ slot, file, onUpload, onRemove }: {
  slot: typeof DOC_SLOTS[0];
  file: File | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onUpload(f);
  };

  return (
    <div
      className={clsx('doc-upload-card', file && 'has-file')}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => !file && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])}
      />

      {file ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
            <CheckCircle size={20} className="text-emerald-600" />
          </div>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 text-center leading-tight max-w-full truncate px-2">
            {file.name}
          </p>
          <p className="text-[11px] text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 mt-1"
          >
            <Trash2 size={11} /> Remove
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
            <Upload size={18} className="text-slate-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-center leading-tight">
              {slot.label}
              {slot.required && <span className="text-red-500 ml-0.5">*</span>}
            </p>
            <p className="text-[11px] text-slate-400 text-center mt-0.5">{slot.desc}</p>
          </div>
          <p className="text-[11px] text-blue-500 font-medium">Click or drop file</p>
          <p className="text-[10px] text-slate-400">PDF, JPG, PNG — max 10MB</p>
        </div>
      )}
    </div>
  );
}

function LoanModal({ onClose, onSuccess, creditScore }: any) {
  const { lang } = useApp();
  const [step, setStep] = useState(1); // 1=details, 2=documents, 3=review
  const [form, setForm] = useState({
    loan_type: 'personal',
    principal_amount: '',
    duration_months: '12',
    purpose: '',
    collateral: '',
  });
  const [docs, setDocs] = useState<Record<string, File | null>>({
    id_document: null, income_proof: null, business_plan: null, collateral_doc: null,
  });
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<any>(null);

  const amount = parseFloat(form.principal_amount || '0');
  const needsCollateral = amount >= COLLATERAL_THRESHOLD;

  const getEstimate = () => {
    if (!amount || !form.duration_months) return null;
    const rates: Record<string, number> = { personal: 0.12, business: 0.18, agricultural: 0.15, education: 0.11, mortgage: 0.10 };
    const rate = (rates[form.loan_type] || 0.18) / 12;
    const n = parseInt(form.duration_months);
    const monthly = rate > 0 ? (amount * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1) : amount / n;
    return { monthly: Math.round(monthly), total: Math.round(monthly * n), rate: rates[form.loan_type] * 100 };
  };

  const liveEstimate = getEstimate();

  const validateStep1 = () => {
    if (!form.principal_amount || amount < 50000) { toast.error('Minimum loan amount is 50,000 RWF'); return false; }
    if (!form.duration_months) { toast.error('Duration is required'); return false; }
    if (!form.loan_type) { toast.error('Loan type is required'); return false; }
    if (!form.purpose.trim()) { toast.error('Purpose is required'); return false; }
    if (needsCollateral && !form.collateral.trim()) { toast.error('Collateral description required for loans above 5,000,000 RWF'); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!docs.id_document) { toast.error('National ID / Passport document is required'); return false; }
    if (!docs.income_proof) { toast.error('Income proof document is required'); return false; }
    return true;
  };

  const submit = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('loan_type', form.loan_type);
      fd.append('principal_amount', form.principal_amount);
      fd.append('duration_months', form.duration_months);
      fd.append('purpose', form.purpose);
      if (form.collateral) fd.append('collateral', form.collateral);
      // Append each document separately with its own key
      Object.entries(docs).forEach(([key, file]) => {
        if (file) fd.append(key, file);
      });

      const r = await fetch('/api/loans/apply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: fd,
      });
      const d = await r.json();
      if (d.success) {
        toast.success('Loan application submitted! Email sent.');
        onSuccess();
        onClose();
      } else {
        toast.error(d.message || 'Submission failed');
      }
    } catch { toast.error('Submission failed'); }
    setLoading(false);
  };

  const progressPct = (step / 3) * 100;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 560 }}>
        {/* Header */}
        <div className="flex justify-between items-start px-6 pt-6 pb-4">
          <div>
            <h2 className="font-display font-bold text-xl">{t('applyLoan', lang)}</h2>
            <p className="text-sm text-slate-400 mt-0.5">Step {step} of 3 — {['Loan Details', 'Upload Documents', 'Review & Submit'][step - 1]}</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon"><X size={18} /></button>
        </div>

        {/* Progress bar */}
        <div className="px-6 mb-5">
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            {['Details', 'Documents', 'Review'].map((label, i) => (
              <span key={label} className={clsx('text-[11px] font-medium', step > i ? 'text-blue-600' : 'text-slate-400')}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* ── Step 1: Loan Details ── */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-up">
              {creditScore && (
                <div className={clsx('p-3 rounded-xl border text-sm',
                  creditScore.credit_score >= 700 ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300'
                  : creditScore.credit_score >= 550 ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                  : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
                )}>
                  <p className="font-semibold">AI Credit Score: {creditScore.credit_score}</p>
                  <p className="text-xs mt-0.5">{creditScore.risk_level} risk &mdash; {creditScore.recommendation}</p>
                </div>
              )}

              <div className="field">
                <label className="label">Loan Type *</label>
                <select className="input" value={form.loan_type} onChange={e => setForm(f => ({ ...f, loan_type: e.target.value }))}>
                  <option value="personal">Personal Loan (12% p.a.)</option>
                  <option value="business">Business Loan (18% p.a.)</option>
                  <option value="agricultural">Agricultural Loan (15% p.a.)</option>
                  <option value="education">Education Loan (11% p.a.)</option>
                  <option value="mortgage">Mortgage (10% p.a.)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label className="label">Amount (RWF) * <span className="text-slate-400 font-normal normal-case">min 50,000</span></label>
                  <input className="input" type="number" placeholder="e.g. 500,000" min="50000" value={form.principal_amount}
                    onChange={e => setForm(f => ({ ...f, principal_amount: e.target.value }))} />
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {[100000, 500000, 1000000, 5000000].map(v => (
                      <button key={v} type="button" onClick={() => setForm(f => ({ ...f, principal_amount: String(v) }))}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        {fmtNum(v)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label className="label">Duration *</label>
                  <select className="input" value={form.duration_months} onChange={e => setForm(f => ({ ...f, duration_months: e.target.value }))}>
                    {[3, 6, 12, 18, 24, 36, 48, 60].map(m => (
                      <option key={m} value={m}>{m} months {m >= 12 ? `(${m / 12}yr${m > 12 ? 's' : ''})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live AI estimate */}
              {liveEstimate && amount >= 50000 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-semibold text-primary-700 dark:text-blue-300 mb-1.5 flex items-center gap-1.5">
                    <TrendingUp size={13} /> AI Payment Estimate
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-lg font-bold font-display text-primary-700 dark:text-blue-300">{liveEstimate.rate}%</p><p className="text-[10px] text-slate-400">Interest p.a.</p></div>
                    <div><p className="text-lg font-bold font-display text-primary-700 dark:text-blue-300">{fmtNum(liveEstimate.monthly)}</p><p className="text-[10px] text-slate-400">Monthly (RWF)</p></div>
                    <div><p className="text-lg font-bold font-display text-primary-700 dark:text-blue-300">{fmtNum(liveEstimate.total)}</p><p className="text-[10px] text-slate-400">Total (RWF)</p></div>
                  </div>
                </div>
              )}

              <div className="field">
                <label className="label">Purpose *</label>
                <textarea className="input h-20 resize-none" placeholder="Describe the purpose of this loan in detail..."
                  value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
              </div>

              {needsCollateral && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Collateral Required (amount exceeds 5,000,000 RWF)
                  </p>
                  <textarea className="input h-16 resize-none text-xs" placeholder="Describe your collateral: e.g. Land title LR/KGL/0001 — Plot 123, Gasabo District, valued at 20,000,000 RWF"
                    value={form.collateral} onChange={e => setForm(f => ({ ...f, collateral: e.target.value }))} />
                </div>
              )}

              <button onClick={() => validateStep1() && setStep(2)} className="btn-primary w-full">
                Continue to Documents <ChevronDown size={16} className="-rotate-90" />
              </button>
            </div>
          )}

          {/* ── Step 2: Documents ── */}
          {step === 2 && (
            <div className="animate-fade-up">
              <div className="alert-info mb-5 text-xs">
                <Info size={14} className="flex-shrink-0 mt-0.5" />
                <span>Upload each document <strong>separately</strong>. Maximum 10MB per file. Accepted formats: PDF, JPG, PNG.</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {DOC_SLOTS.map(slot => (
                  <DocUploadSlot
                    key={slot.key}
                    slot={slot}
                    file={docs[slot.key]}
                    onUpload={file => setDocs(d => ({ ...d, [slot.key]: file }))}
                    onRemove={() => setDocs(d => ({ ...d, [slot.key]: null }))}
                  />
                ))}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mb-5 text-xs text-slate-500">
                <p className="font-semibold mb-1">Documents uploaded: {Object.values(docs).filter(Boolean).length} / {DOC_SLOTS.length}</p>
                <p>Required: National ID and Income Proof. Optional: Business Plan, Collateral Document.</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
                <button onClick={() => validateStep2() && setStep(3)} className="btn-primary flex-1">
                  Review Application <ChevronDown size={16} className="-rotate-90" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Review & Submit ── */}
          {step === 3 && (
            <div className="animate-fade-up">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Loan Summary</p>
                <div className="space-y-2">
                  {[
                    ['Loan Type', form.loan_type.charAt(0).toUpperCase() + form.loan_type.slice(1)],
                    ['Amount', `${fmtNum(form.principal_amount)} RWF`],
                    ['Duration', `${form.duration_months} months`],
                    ...(liveEstimate ? [
                      ['Monthly Payment', `${fmtNum(liveEstimate.monthly)} RWF`],
                      ['Total Repayable', `${fmtNum(liveEstimate.total)} RWF`],
                    ] : []),
                    ...(needsCollateral ? [['Collateral', form.collateral.slice(0, 60) + '...']] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Uploaded Documents</p>
                <div className="space-y-2">
                  {DOC_SLOTS.map(slot => (
                    <div key={slot.key} className="flex items-center gap-2.5 text-sm">
                      {docs[slot.key]
                        ? <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                        : <X size={14} className="text-slate-300 flex-shrink-0" />}
                      <span className={docs[slot.key] ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                        {slot.label}
                      </span>
                      {docs[slot.key] && <span className="text-xs text-slate-400 ml-auto">{docs[slot.key]?.name.slice(0, 20)}...</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="alert-warning mb-4 text-xs">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                <span>By submitting, you confirm all provided information is accurate. False information may result in application rejection.</span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1">Back</button>
                <button onClick={submit} disabled={loading} className="btn-primary flex-1">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />Submitting...</>
                    : <>Submit Application <CheckCircle size={15} /></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Loan Review Modal (Admin) ────────────────────────────────
function LoanReviewModal({ loan, onClose, onAction }: { loan: any; onClose: () => void; onAction: () => void }) {
  const [action, setAction] = useState<'approved' | 'rejected' | 'request_info' | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const token = () => localStorage.getItem('access_token') || '';

  const submit = async () => {
    if (!action) return;
    if ((action === 'rejected' || action === 'request_info') && !notes.trim()) {
      toast.error('Please provide a reason or instructions');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/loans/' + loan.id + '/review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
        body: JSON.stringify({ status: action, notes }),
      });
      const d = await r.json();
      if (d.success) {
        const msgs: Record<string, string> = {
          approved: 'Loan approved! Customer notified.',
          rejected: 'Loan rejected. Customer notified.',
          request_info: 'Customer has been asked to provide more information.',
        };
        toast.success(msgs[action]);
        onAction();
        onClose();
      } else {
        toast.error(d.message || 'Failed');
      }
    } catch {
      toast.error('Network error. Please try again.');
    }
    setBusy(false);
  };

  const BASE = 'http://localhost:5000';
  const isImage = (url: string) => url && /\.(jpg|jpeg|png|webp)$/i.test(url);

  const ACTIONS = [
    {
      id: 'approved' as const,
      label: 'Approve',
      desc: 'Approve loan and disburse funds to customer',
      icon: ThumbsUp,
      style: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
      textColor: 'text-emerald-700 dark:text-emerald-300',
      btnClass: 'btn-success',
    },
    {
      id: 'request_info' as const,
      label: 'Request Documents',
      desc: 'Ask customer to submit additional information',
      icon: MessageSquare,
      style: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
      textColor: 'text-amber-700 dark:text-amber-300',
      btnClass: 'btn-warning',
    },
    {
      id: 'rejected' as const,
      label: 'Reject',
      desc: 'Decline this loan application',
      icon: ThumbsDown,
      style: 'border-red-500 bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-700 dark:text-red-300',
      btnClass: 'btn-danger',
    },
  ];

  const docSlots = [
    { key: 'doc_id_document',    label: 'National ID / Passport',        icon: FileText },
    { key: 'doc_income_proof',   label: 'Income Proof / Pay Slip',        icon: FileText },
    { key: 'doc_business_plan',  label: 'Business Plan / Purpose Letter', icon: FileText },
    { key: 'doc_collateral_doc', label: 'Collateral Document',            icon: FileText },
  ];

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 760 }}>

        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
              Loan Application Review
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {loan.customer_name || 'Customer'} &mdash; {loan.loan_type} loan
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto" style={{ maxHeight: '72vh' }}>

          {/* Loan summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Amount',   fmtNum(loan.principal_amount) + ' RWF', '#1a4fa8'],
              ['Duration', loan.duration_months + ' months',        '#7c3aed'],
              ['Monthly',  fmtNum(loan.monthly_payment) + ' RWF',  '#059669'],
              ['AI Score', loan.ai_credit_score || '—',             parseFloat(loan.ai_credit_score) >= 700 ? '#059669' : parseFloat(loan.ai_credit_score) >= 550 ? '#d97706' : '#dc2626'],
            ].map(([label, val, color]: any) => (
              <div key={label} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                <p className="font-display font-bold text-lg" style={{ color }}>{val}</p>
              </div>
            ))}
          </div>

          {/* Customer + loan details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Customer</p>
              <div className="space-y-2">
                {[
                  [User, 'Name',   loan.customer_name || '—'],
                  [Mail2, 'Email', loan.email || '—'],
                  [Shield, 'AI Risk', loan.ai_risk_level || '—'],
                ].map(([Icon, label, val]: any) => (
                  <div key={label} className="flex items-start gap-2">
                    <Icon size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">{label}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 capitalize">{val}</p>
                    </div>
                  </div>
                ))}
                {loan.ai_recommendation && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-400 mb-1">AI Recommendation</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{loan.ai_recommendation}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Loan Details</p>
              <div className="space-y-2">
                {[
                  [DollarSign, 'Type',         loan.loan_type?.replace(/_/g, ' ')],
                  [DollarSign, 'Interest Rate', ((parseFloat(loan.interest_rate) || 0) * 100).toFixed(1) + '% p.a.'],
                  [DollarSign, 'Total Repayable', fmtNum(loan.total_repayable) + ' RWF'],
                  [DollarSign, 'Purpose',       loan.purpose || '—'],
                  [DollarSign, 'Collateral',    loan.collateral || '—'],
                ].map(([Icon, label, val]: any) => (
                  <div key={label} className="flex items-start gap-2">
                    <Icon size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">{label}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 capitalize">{val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Documents */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Submitted Documents
            </p>
            <div className="grid grid-cols-2 gap-3">
              {docSlots.map(({ key, label, icon: Icon }) => {
                const url = loan[key];
                const isPDF = url && url.endsWith('.pdf');
                return (
                  <div key={key}>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Icon size={11} />
                      {label}
                      {url
                        ? <span className="badge-green text-[10px]">Uploaded</span>
                        : <span className="badge-gray text-[10px]">Not uploaded</span>
                      }
                    </p>
                    {url ? (
                      isPDF ? (
                        <a href={BASE + url} target="_blank" rel="noopener"
                          className="flex items-center gap-2.5 p-3 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 transition-colors">
                          <FileText size={24} className="text-blue-500" />
                          <div>
                            <p className="font-semibold text-sm text-blue-700 dark:text-blue-300">View PDF</p>
                            <p className="text-xs text-slate-400">Click to open</p>
                          </div>
                        </a>
                      ) : (
                        <a href={BASE + url} target="_blank" rel="noopener">
                          <img src={BASE + url} alt={label}
                            className="w-full h-32 object-cover rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-blue-400 transition-colors cursor-zoom-in" />
                        </a>
                      )
                    ) : (
                      <div className="w-full h-32 bg-slate-100 dark:bg-slate-700 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                        <div className="text-center text-slate-400">
                          <Icon size={22} className="mx-auto mb-1 opacity-30" />
                          <p className="text-xs">Not submitted</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3 action cards */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Decision</p>
            <div className="grid grid-cols-3 gap-3">
              {ACTIONS.map(({ id, label, desc, icon: Icon, style, textColor }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setAction(action === id ? null : id); setNotes(''); }}
                  className={clsx(
                    'flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 text-center transition-all duration-150',
                    action === id
                      ? style
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600',
                  )}
                >
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                    action === id ? 'bg-white/60 dark:bg-black/20' : 'bg-slate-100 dark:bg-slate-700')}>
                    <Icon size={18} className={action === id ? textColor : 'text-slate-400'} />
                  </div>
                  <div>
                    <p className={clsx('font-semibold text-sm', action === id ? textColor : 'text-slate-700 dark:text-slate-300')}>
                      {label}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{desc}</p>
                  </div>
                  <div className={clsx('w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all',
                    action === id ? 'border-transparent bg-current' : 'border-slate-300 dark:border-slate-600')}>
                    {action === id && <CheckCircle size={12} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Notes textarea */}
          {(action === 'rejected' || action === 'request_info') && (
            <div className="animate-fade-up">
              <label className="label">
                {action === 'rejected' ? 'Rejection Reason *' : 'Required Documents / Instructions *'}
              </label>
              <textarea
                className="input h-24 resize-none"
                placeholder={
                  action === 'rejected'
                    ? 'e.g. Credit score does not meet minimum requirements. Insufficient income proof provided.'
                    : 'e.g. Please resubmit a clear copy of your National ID and last 3 months payslips.'
                }
                value={notes}
                onChange={e => setNotes(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">
                This will be emailed to {loan.email || 'the customer'}.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-3 border-t border-slate-100 dark:border-slate-700">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={submit}
            disabled={busy || !action || ((action === 'rejected' || action === 'request_info') && !notes.trim())}
            className={clsx(
              'flex-1',
              action === 'approved' ? 'btn-success'
                : action === 'request_info' ? 'btn-warning'
                : action === 'rejected' ? 'btn-danger'
                : 'btn-secondary'
            )}
          >
            {busy ? (
              <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
            ) : !action ? (
              'Select a decision above'
            ) : (
              <><Send size={15} />
                {action === 'approved' ? 'Approve Loan'
                  : action === 'request_info' ? 'Send Request'
                  : 'Reject Application'}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

// Helper icon (Mail not already imported under that name)
const Mail2 = ({ size, className }: any) => (
  <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
  </svg>
);


export default function LoansPage() {
  const { user, lang } = useApp();
  const [loans, setLoans] = useState<any[]>([]);
  const [creditScore, setCreditScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reviewLoanItem, setReviewLoanItem] = useState<any>(null);
  const isAdmin = ['super_admin', 'branch_manager'].includes(user?.role || '');

  const load = async () => {
    try {
      const [lR, csR] = await Promise.all([
        isAdmin ? getAllLoans() : getMyLoans(),
        !isAdmin ? getCreditScore() : Promise.resolve(null),
      ]);
      setLoans(lR.data?.data?.loans || []);
      if (csR) setCreditScore(csR.data?.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);



  const statusBadge = (s: string) => {
    const m: any = { approved: 'badge-green', rejected: 'badge-red', applied: 'badge-blue', disbursed: 'badge-teal', closed: 'badge-gray' };
    return m[s] || 'badge-amber';
  };

  if (loading) return (
    <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
  );

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="font-display font-bold text-xl">{t('loans', lang)}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{loans.length} application{loans.length !== 1 ? 's' : ''}</p>
        </div>
        {!isAdmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={16} /> {t('applyLoan', lang)}
          </button>
        )}
      </div>

      {!isAdmin && creditScore && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5">AI Credit Score</p>
            <p className="font-display font-black text-3xl text-primary-700 dark:text-blue-300">{creditScore.credit_score || '—'}</p>
            <p className="text-xs text-slate-400 mt-1">{creditScore.risk_level} risk</p>
          </div>
          {[['Personal', '12%'], ['Business', '18%'], ['Agricultural', '15%']].map(([type, rate]) => (
            <div key={type} className="stat-card text-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{type} Rate</p>
              <p className="font-display font-black text-2xl">{rate}</p>
              <p className="text-xs text-slate-400 mt-1">per annum</p>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-display font-bold text-base">{isAdmin ? 'All Loan Applications' : 'My Applications'}</h2>
          {isAdmin && (
            <div className="flex gap-1.5">
              {['All', 'applied', 'approved', 'rejected'].map((s, i) => (
                <button key={s} className={clsx('btn-sm', i === 0 ? 'btn-primary' : 'btn-secondary text-xs')}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
        {loans.length === 0 ? (
          <div className="text-center py-14 text-slate-400">
            <CreditCard size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No loan applications yet</p>
            {!isAdmin && <p className="text-sm mt-1">Apply for your first loan above</p>}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                {isAdmin && <th>Customer</th>}
                <th>Type</th><th>Amount (RWF)</th><th>Duration</th><th>Monthly (RWF)</th>
                <th>AI Score</th><th>Risk</th><th>Status</th><th>Date</th>
                {isAdmin && <th>Actions</th>}
              </tr></thead>
              <tbody>
                {loans.map((loan: any) => (
                  <tr key={loan.id}>
                    {isAdmin && (
                      <td>
                        <p className="font-semibold text-sm">{loan.customer_name || '—'}</p>
                        <p className="text-xs text-slate-400">{loan.email || '—'}</p>
                      </td>
                    )}
                    <td className="capitalize font-medium text-sm">{loan.loan_type}</td>
                    <td className="font-mono font-semibold text-sm">{fmtNum(loan.principal_amount)}</td>
                    <td className="text-sm">{loan.duration_months} mo.</td>
                    <td className="font-mono text-sm">{fmtNum(loan.monthly_payment)}</td>
                    <td className={clsx('font-bold text-sm',
                      parseFloat(loan.ai_credit_score) >= 700 ? 'text-emerald-600'
                      : parseFloat(loan.ai_credit_score) >= 550 ? 'text-amber-600' : 'text-red-600'
                    )}>
                      {loan.ai_credit_score || '—'}
                    </td>
                    <td>
                      <span className={clsx('badge', {
                        'badge-green': loan.ai_risk_level === 'low',
                        'badge-red': loan.ai_risk_level === 'high',
                        'badge-amber': loan.ai_risk_level === 'medium',
                      })}>
                        {loan.ai_risk_level || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={clsx('badge capitalize', statusBadge(loan.status))}>{loan.status}</span>
                    </td>
                    <td className="text-xs text-slate-400">
                      {loan.created_at ? new Date(loan.created_at).toLocaleDateString() : '—'}
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          onClick={() => setReviewLoanItem(loan)}
                          className="btn-secondary btn-sm flex items-center gap-1"
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <LoanModal onClose={() => setShowModal(false)} onSuccess={load} creditScore={creditScore} />}
      {reviewLoanItem && (
        <LoanReviewModal
          loan={reviewLoanItem}
          onClose={() => setReviewLoanItem(null)}
          onAction={load}
        />
      )}
    </div>
  );
}
