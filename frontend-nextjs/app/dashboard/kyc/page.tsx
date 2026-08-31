'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '@/contexts/AppContext';
import {
  CheckCircle, XCircle, Eye, User, Mail, Phone, CreditCard,
  Calendar, Camera, FileText, Clock, X, ThumbsUp, ThumbsDown,
  MessageSquare, Send, AlertTriangle, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-RW', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Review modal with 3 actions ───────────────────────────────
function KYCReviewModal({ app, onClose, onAction }: { app: any; onClose: () => void; onAction: () => void }) {
  const [action, setAction] = useState<'approve' | 'request_info' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!action) return;
    if ((action === 'reject' || action === 'request_info') && !reason.trim()) {
      toast.error('Please provide a reason or instructions');
      return;
    }

    setLoading(true);
    try {
      const endpoint = action === 'approve'
        ? '/api/admin/kyc/approve'
        : '/api/admin/kyc/reject';

      const body: Record<string, string> = { user_id: app.id };
      if (action === 'request_info') body.reject_reason = `ACTION REQUIRED: ${reason}`;
      if (action === 'reject')       body.reject_reason = reason;

      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(body),
      });
      const d = await r.json();

      if (d.success) {
        const msgs: Record<string, string> = {
          approve:      'Application approved! Credentials sent to customer.',
          request_info: 'Customer has been notified to update their information.',
          reject:       'Application rejected. Customer notified by email.',
        };
        toast.success(msgs[action]);
        onAction();
        onClose();
      } else {
        toast.error(d.message || 'Action failed');
      }
    } catch {
      toast.error('Request failed. Please try again.');
    }
    setLoading(false);
  };

  const ACTIONS = [
    {
      id: 'approve' as const,
      label: 'Approve',
      desc: 'Documents verified — activate account and send credentials',
      icon: ThumbsUp,
      selectedStyle: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
      selectedText: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
    },
    {
      id: 'request_info' as const,
      label: 'Request Changes',
      desc: 'Ask the customer to update or resubmit information',
      icon: MessageSquare,
      selectedStyle: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
      selectedText: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
    },
    {
      id: 'reject' as const,
      label: 'Reject',
      desc: 'Documents invalid or information does not match',
      icon: ThumbsDown,
      selectedStyle: 'border-red-500 bg-red-50 dark:bg-red-900/20',
      selectedText: 'text-red-700 dark:text-red-300',
      dot: 'bg-red-500',
    },
  ];

  const selected = ACTIONS.find(a => a.id === action);

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 700 }}>

        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
              KYC Application Review
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {app.first_name} {app.last_name} &mdash; {app.email}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Two-column: applicant info + documents */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left: personal info */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Applicant</p>
              <div className="space-y-2">
                {[
                  [User,       'Name',         `${app.first_name} ${app.last_name}`],
                  [Mail,       'Email',         app.email],
                  [Phone,      'Phone',         app.phone || '—'],
                  [CreditCard, 'National ID',   app.national_id || '—'],
                  [Calendar,   'Date of Birth', app.date_of_birth ? new Date(app.date_of_birth).toLocaleDateString() : '—'],
                  [Clock,      'Applied',       fmtDate(app.created_at)],
                ].map(([Icon, label, val]: any) => (
                  <div key={label} className="flex items-start gap-2">
                    <Icon size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">{label}</p>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: documents */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Documents</p>

              <p className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1.5">
                <Camera size={11} /> Passport Photo
              </p>
              {app.kyc_passport_photo ? (
                <a href={`http://localhost:5000${app.kyc_passport_photo}`} target="_blank" rel="noopener">
                  <img
                    src={`http://localhost:5000${app.kyc_passport_photo}`}
                    alt="Passport"
                    className="w-full h-28 object-cover rounded-lg border border-slate-200 dark:border-slate-600 hover:border-blue-400 transition-colors cursor-zoom-in mb-3"
                  />
                </a>
              ) : (
                <div className="w-full h-28 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center mb-3">
                  <Camera size={24} className="text-slate-400" />
                </div>
              )}

              <p className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1.5">
                <FileText size={11} /> ID Document
              </p>
              {app.kyc_id_document ? (
                app.kyc_id_document.endsWith('.pdf') ? (
                  <a
                    href={`http://localhost:5000${app.kyc_id_document}`}
                    target="_blank" rel="noopener"
                    className="flex items-center gap-2.5 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 hover:border-blue-400 transition-colors"
                  >
                    <FileText size={18} className="text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">View ID Document</p>
                      <p className="text-[11px] text-slate-400">PDF — click to open</p>
                    </div>
                  </a>
                ) : (
                  <a href={`http://localhost:5000${app.kyc_id_document}`} target="_blank" rel="noopener">
                    <img
                      src={`http://localhost:5000${app.kyc_id_document}`}
                      alt="ID Document"
                      className="w-full h-28 object-cover rounded-lg border border-slate-200 dark:border-slate-600 hover:border-blue-400 transition-colors cursor-zoom-in"
                    />
                  </a>
                )
              ) : (
                <div className="w-full h-28 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                  <FileText size={24} className="text-slate-400" />
                </div>
              )}
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Verification Checklist</p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-6">
              {[
                'Photo matches ID document',
                'Face clearly visible & unobstructed',
                'ID is valid and not expired',
                'All text on ID is legible',
                'National ID number matches form',
                'Name matches ID document',
              ].map(item => (
                <label key={item} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                  <input type="checkbox" className="rounded border-slate-300 text-blue-600" />
                  {item}
                </label>
              ))}
            </div>
          </div>

          {/* ── 3 Action selector ─────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Decision</p>
            <div className="grid grid-cols-3 gap-3">
              {ACTIONS.map(({ id, label, desc, icon: Icon, selectedStyle, selectedText, dot }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setAction(action === id ? null : id); setReason(''); }}
                  className={clsx(
                    'flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 text-center transition-all duration-150',
                    action === id
                      ? selectedStyle
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800',
                  )}
                >
                  <div className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                    action === id ? 'bg-white/70 dark:bg-black/20' : 'bg-slate-100 dark:bg-slate-700',
                  )}>
                    <Icon size={18} className={action === id ? selectedText : 'text-slate-400'} />
                  </div>
                  <div>
                    <p className={clsx(
                      'font-semibold text-sm',
                      action === id ? selectedText : 'text-slate-700 dark:text-slate-300',
                    )}>
                      {label}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{desc}</p>
                  </div>
                  {/* Selection indicator */}
                  <div className={clsx(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all',
                    action === id ? `border-transparent ${dot}` : 'border-slate-300 dark:border-slate-600',
                  )}>
                    {action === id && <CheckCircle size={12} className="text-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Reason / instruction textarea — shows only when needed */}
          {(action === 'reject' || action === 'request_info') && (
            <div className="animate-fade-up">
              <label className="label">
                {action === 'reject' ? 'Rejection Reason *' : 'Instructions for Customer *'}
              </label>
              <textarea
                className="input h-24 resize-none"
                placeholder={
                  action === 'reject'
                    ? 'e.g. The ID document is blurry and unreadable. The name on the ID does not match the provided information.'
                    : 'e.g. Please re-take your passport photo with better lighting and a plain white background. Make sure your full face is visible.'
                }
                value={reason}
                onChange={e => setReason(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1">
                This message will be emailed to <strong>{app.email}</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={
              loading ||
              !action ||
              ((action === 'reject' || action === 'request_info') && !reason.trim())
            }
            className={clsx(
              'flex-1',
              action === 'approve'
                ? 'btn-success'
                : action === 'request_info'
                ? 'btn-warning'
                : action === 'reject'
                ? 'btn-danger'
                : 'btn-secondary',
            )}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : !action ? (
              'Select a decision above'
            ) : (
              <>
                <Send size={15} />
                {action === 'approve'
                  ? 'Approve & Send Credentials'
                  : action === 'request_info'
                  ? 'Send Request to Customer'
                  : 'Reject Application'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── KYC Applications page ─────────────────────────────────────
export default function KYCPage() {
  const { lang } = useApp();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/kyc/pending', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      const d = await r.json();
      setApplications(d.data?.applications || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="font-display font-bold text-xl">KYC Applications</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {applications.length} application{applications.length !== 1 ? 's' : ''} pending review
          </p>
        </div>
        <button onClick={load} className="btn-secondary btn-sm">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {applications.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle size={48} className="mx-auto mb-4 text-emerald-400 opacity-60" />
          <p className="font-display font-bold text-lg text-slate-700 dark:text-slate-300">All caught up!</p>
          <p className="text-slate-400 text-sm mt-1">No pending KYC applications at this time.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>National ID</th>
                  <th>Documents</th>
                  <th>Applied</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app: any) => (
                  <tr key={app.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-400 flex-shrink-0">
                          {app.first_name?.[0]}{app.last_name?.[0]}
                        </div>
                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                          {app.first_name} {app.last_name}
                        </p>
                      </div>
                    </td>
                    <td className="text-xs text-slate-500 dark:text-slate-400">{app.email}</td>
                    <td className="text-xs text-slate-500 dark:text-slate-400">{app.phone || '—'}</td>
                    <td>
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {app.national_id || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('badge text-[10px]', app.kyc_passport_photo ? 'badge-green' : 'badge-red')}>
                          {app.kyc_passport_photo ? <><CheckCircle size={10} /> Photo</> : 'No Photo'}
                        </span>
                        <span className={clsx('badge text-[10px]', app.kyc_id_document ? 'badge-green' : 'badge-red')}>
                          {app.kyc_id_document ? <><CheckCircle size={10} /> ID</> : 'No ID'}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs text-slate-400">{fmtDate(app.created_at)}</td>
                    <td>
                      <button
                        onClick={() => setSelected(app)}
                        className="btn-primary btn-sm"
                      >
                        <Eye size={13} /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <KYCReviewModal
          app={selected}
          onClose={() => setSelected(null)}
          onAction={load}
        />
      )}
    </div>
  );
}
