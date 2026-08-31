'use client';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { getUsers, updateUserStatus, verifyKYC } from '@/lib/api';
import {
  UserPlus, Search, CheckCircle, X, Eye, Shield,
  Camera, FileText, MapPin, User, Mail, Phone,
  CreditCard, Calendar, Clock,
} from 'lucide-react';
import clsx from 'clsx';

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#c9a84c', branch_manager: '#a855f7', fraud_analyst: '#ef4444',
  bank_staff: '#10b981', auditor: '#06b6d4', customer: '#3b5bdb',
};
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', branch_manager: 'Branch Manager',
  fraud_analyst: 'Fraud Analyst', bank_staff: 'Bank Staff',
  auditor: 'Auditor', customer: 'Customer',
};

// ─────────────────────────────────────────────────────────────
// VIEW USER MODAL
// ─────────────────────────────────────────────────────────────
function ViewUserModal({ user: initial, onClose, onAction }: any) {
  const { user: me } = useApp();
  const isAdmin = ['super_admin', 'branch_manager'].includes(me?.role || '');

  const [u, setU] = useState<any>(initial);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const token = () => localStorage.getItem('access_token') || '';

  // Load full user details (includes KYC docs + accounts)
  useEffect(() => {
    fetch('/api/admin/users/' + initial.id, {
      headers: { Authorization: 'Bearer ' + token() },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setU(d.data.user); })
      .catch(() => {});
  }, [initial.id]);

  const KYC_ITEMS = [
    'Photo matches ID document',
    'Face clearly visible & unobstructed',
    'ID is valid and not expired',
    'All text on ID is legible',
    'National ID number matches form',
    'Name matches ID document',
  ];

  const allChecked = KYC_ITEMS.every(k => checks[k]);

  const approveKYC = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/kyc/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token(),
        },
        body: JSON.stringify({ user_id: u.id }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success('KYC approved! Credentials sent to customer.');
        setU((p: any) => ({ ...p, kyc_verified: true }));
        onAction();
      } else {
        toast.error(d.message || 'Approval failed');
      }
    } catch {
      toast.error('Network error');
    }
    setBusy(false);
  };

  const toggleStatus = async () => {
    const next = u.status === 'active' ? 'suspended' : 'active';
    if (u.status === 'active') {
      const ok = window.confirm('Suspend ' + u.first_name + ' ' + u.last_name + '?\nThey will not be able to log in.');
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/admin/users/' + u.id + '/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token(),
        },
        body: JSON.stringify({ status: next }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success('Account ' + next);
        setU((p: any) => ({ ...p, status: next }));
        onAction();
      } else {
        toast.error(d.message || 'Failed');
      }
    } catch {
      toast.error('Network error');
    }
    setBusy(false);
  };

  const rc = ROLE_COLORS[u.role] || '#3b5bdb';
  const initials = ((u.first_name || '')[0] || '') + ((u.last_name || '')[0] || '');
  const hasPhoto = Boolean(u.kyc_passport_photo);
  const hasIdDoc = Boolean(u.kyc_id_document);
  const isPDF = hasIdDoc && String(u.kyc_id_document).endsWith('.pdf');

  return (
    <div
      className="modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box" style={{ maxWidth: 700 }}>

        {/* ── Header ── */}
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            {u.profile_photo ? (
              <img
                src={'http://localhost:5000' + u.profile_photo}
                alt=""
                className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
                style={{ background: rc + '22', color: rc }}
              >
                {initials.toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
                {u.first_name} {u.last_name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="badge text-[11px] font-semibold" style={{ background: rc + '22', color: rc }}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
                <span className={clsx('badge text-[11px]', u.status === 'active' ? 'badge-green' : 'badge-red')}>
                  {u.status}
                </span>
                <span className={clsx('badge text-[11px]', u.kyc_verified ? 'badge-teal' : 'badge-amber')}>
                  {u.kyc_verified ? '✓ KYC Verified' : 'KYC Pending'}
                </span>
                {u.branch_name && (
                  <span className="badge badge-blue text-[11px] flex items-center gap-1">
                    <MapPin size={9} /> {u.branch_name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto" style={{ maxHeight: '68vh' }}>

          {/* Personal info */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Personal Information
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {[
                  [User,       'Full Name',     u.first_name + ' ' + u.last_name],
                  [Mail,       'Email',          u.email],
                  [Phone,      'Phone',          u.phone || '—'],
                  [CreditCard, 'National ID',    u.national_id || '—'],
                  [Calendar,   'Date of Birth',  u.date_of_birth ? new Date(u.date_of_birth).toLocaleDateString() : '—'],
                  [MapPin,     'Branch',         u.branch_name || '—'],
                  [MapPin,     'Province',       u.province || '—'],
                  [MapPin,     'District',       u.district || '—'],
                  [MapPin,     'Sector',         u.sector || '—'],
                  [MapPin,     'Village',        u.village || '—'],
                  [Clock,      'Member Since',   u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'],
                  [Clock,      'Last Login',     u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'],
                ].map(([Icon, label, val]: any) => (
                  <div key={label as string} className="flex items-start gap-2">
                    <Icon size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">{label}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Accounts — customers only */}
          {u.role === 'customer' && u.accounts && u.accounts.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Bank Accounts
              </p>
              <div className="space-y-2">
                {u.accounts.map((acc: any) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700"
                  >
                    <div>
                      <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                        {acc.account_number}
                      </p>
                      <p className="text-xs text-slate-400 capitalize mt-0.5">
                        {acc.account_type} · {acc.currency}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {Number(acc.balance).toLocaleString('en-RW')} RWF
                      </p>
                      <span className={clsx('badge text-[10px]', acc.status === 'active' ? 'badge-green' : 'badge-red')}>
                        {acc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KYC Documents — customers only */}
          {u.role === 'customer' && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                KYC Documents
              </p>
              <div className="grid grid-cols-2 gap-3">

                {/* Passport photo */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                    <Camera size={12} />
                    Passport Photo
                    {hasPhoto
                      ? <span className="badge-green text-[10px]">Uploaded</span>
                      : <span className="badge-red text-[10px]">Missing</span>
                    }
                  </p>
                  {hasPhoto ? (
                    <a
                      href={'http://localhost:5000' + u.kyc_passport_photo}
                      target="_blank"
                      rel="noopener"
                    >
                      <img
                        src={'http://localhost:5000' + u.kyc_passport_photo}
                        alt="Passport"
                        className="w-full h-40 object-cover rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-blue-400 transition-colors cursor-zoom-in"
                      />
                    </a>
                  ) : (
                    <div className="w-full h-40 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600">
                      <div className="text-center text-slate-400">
                        <Camera size={28} className="mx-auto mb-1 opacity-30" />
                        <p className="text-xs">No photo uploaded</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ID document */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                    <FileText size={12} />
                    ID Document
                    {hasIdDoc
                      ? <span className="badge-green text-[10px]">Uploaded</span>
                      : <span className="badge-red text-[10px]">Missing</span>
                    }
                  </p>
                  {hasIdDoc ? (
                    isPDF ? (
                      <a
                        href={'http://localhost:5000' + u.kyc_id_document}
                        target="_blank"
                        rel="noopener"
                        className="flex items-center gap-3 p-4 h-40 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 transition-colors"
                      >
                        <FileText size={28} className="text-blue-500" />
                        <div>
                          <p className="font-semibold text-sm text-blue-700 dark:text-blue-300">
                            View PDF Document
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">Click to open</p>
                        </div>
                      </a>
                    ) : (
                      <a
                        href={'http://localhost:5000' + u.kyc_id_document}
                        target="_blank"
                        rel="noopener"
                      >
                        <img
                          src={'http://localhost:5000' + u.kyc_id_document}
                          alt="ID Document"
                          className="w-full h-40 object-cover rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-blue-400 transition-colors cursor-zoom-in"
                        />
                      </a>
                    )
                  ) : (
                    <div className="w-full h-40 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600">
                      <div className="text-center text-slate-400">
                        <FileText size={28} className="mx-auto mb-1 opacity-30" />
                        <p className="text-xs">No document uploaded</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* KYC checklist — admins reviewing unverified customers */}
          {isAdmin && u.role === 'customer' && !u.kyc_verified && (hasPhoto || hasIdDoc) && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Verification Checklist
              </p>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2.5">
                {KYC_ITEMS.map(item => (
                  <label key={item} className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => setChecks(prev => ({ ...prev, [item]: !prev[item] }))}
                      className={clsx(
                        'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
                        checks[item]
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-slate-300 dark:border-slate-600 group-hover:border-emerald-400',
                      )}
                    >
                      {checks[item] && <CheckCircle size={13} className="text-white" />}
                    </div>
                    <span className={clsx(
                      'text-sm',
                      checks[item]
                        ? 'text-slate-400 line-through'
                        : 'text-slate-600 dark:text-slate-400',
                    )}>
                      {item}
                    </span>
                  </label>
                ))}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <p className="text-xs text-slate-400">
                    {Object.values(checks).filter(Boolean).length} / {KYC_ITEMS.length} verified
                  </p>
                  {allChecked && (
                    <span className="badge-green text-xs">Ready to approve</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* KYC already verified */}
          {u.kyc_verified && (
            <div className="alert-success text-sm">
              <CheckCircle size={15} className="flex-shrink-0" />
              <span>Identity verified — this customer has completed KYC.</span>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="flex gap-3 px-6 pb-5 pt-3 border-t border-slate-100 dark:border-slate-700">
          <button onClick={onClose} className="btn-secondary flex-1">
            Close
          </button>
          {isAdmin && (
            <>
              {u.status === 'active' ? (
                <button
                  onClick={toggleStatus}
                  disabled={busy}
                  className="btn-danger flex-shrink-0"
                >
                  Suspend Account
                </button>
              ) : (
                <button
                  onClick={toggleStatus}
                  disabled={busy}
                  className="btn-success flex-shrink-0"
                >
                  Activate Account
                </button>
              )}
              {u.role === 'customer' && (
                u.kyc_verified ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 flex-shrink-0">
                    <CheckCircle size={14} /> KYC Verified
                  </span>
                ) : (
                  <button
                    onClick={approveKYC}
                    disabled={busy}
                    className="btn-primary flex-shrink-0"
                  >
                    {busy ? (
                      <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><Shield size={14} /> Approve KYC</>
                    )}
                  </button>
                )
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CREATE USER MODAL
// ─────────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onSuccess }: any) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    role: 'customer', password: '', national_id: '', date_of_birth: '',
  });
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [passportPreview, setPassportPreview] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState('');
  const [busy, setBusy] = useState(false);

  const passportRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const isCustomer = form.role === 'customer';

  const token = () => localStorage.getItem('access_token') || '';

  const submit = async () => {
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error('First name, last name and email are required');
      return;
    }
    if (isCustomer && !form.national_id) {
      toast.error('National ID is required for customers');
      return;
    }
    if (isCustomer && !passportFile) {
      toast.error('Passport photo is required for customers');
      return;
    }
    if (isCustomer && !idFile) {
      toast.error('ID document is required for customers');
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('first_name', form.first_name);
      fd.append('last_name', form.last_name);
      fd.append('email', form.email);
      fd.append('role', form.role);
      if (form.phone)         fd.append('phone', form.phone);
      if (form.national_id)   fd.append('national_id', form.national_id);
      if (form.date_of_birth) fd.append('date_of_birth', form.date_of_birth);
      if (form.password)      fd.append('password', form.password);
      if (passportFile)       fd.append('passport_photo', passportFile, passportFile.name);
      if (idFile)             fd.append('id_document', idFile, idFile.name);

      const r = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token() },
        body: fd,
      });
      const d = await r.json();
      if (d.success) {
        toast.success(isCustomer
          ? 'Customer account created. Credentials sent to ' + form.email
          : 'Staff account created. Password sent to ' + form.email
        );
        onSuccess();
        onClose();
      } else {
        toast.error(d.message || 'Failed to create account');
      }
    } catch {
      toast.error('Request failed. Check your connection.');
    }
    setBusy(false);
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: isCustomer ? 560 : 460 }}>

        <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
              {isCustomer ? 'Create Customer Account' : 'Add Staff Member'}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {isCustomer ? 'Photo and ID document required' : 'Temporary password will be emailed'}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="field">
            <label className="label">Role *</label>
            <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="customer">Customer</option>
              <option value="bank_staff">Bank Staff / Teller</option>
              <option value="branch_manager">Branch Manager</option>
              <option value="fraud_analyst">Fraud Analyst</option>
              <option value="auditor">Auditor</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label className="label">First Name *</label>
              <input className="input" placeholder="Jean" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Last Name *</label>
              <input className="input" placeholder="Habimana" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label className="label">Email *</label>
            <input className="input" type="email" placeholder="user@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label className="label">Phone</label>
              <input className="input" placeholder="+250788000000" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">National ID {isCustomer && <span className="text-red-500">*</span>}</label>
              <input className="input font-mono" placeholder="1199800000000001" maxLength={16} value={form.national_id} onChange={e => set('national_id', e.target.value)} />
            </div>
          </div>

          {isCustomer && (
            <div className="field">
              <label className="label">Date of Birth</label>
              <input className="input" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
            </div>
          )}

          {!isCustomer && (
            <div className="field">
              <label className="label">Password <span className="font-normal text-slate-400 normal-case">(blank = auto-generate)</span></label>
              <input className="input" type="password" placeholder="Min 8 characters" value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
          )}

          {isCustomer && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Required Documents
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Passport Photo *</label>
                  <input ref={passportRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setPassportFile(f); setPassportPreview(URL.createObjectURL(f)); } }} />
                  {!passportPreview ? (
                    <div className="doc-upload-card h-32 flex flex-col items-center justify-center gap-2"
                      onClick={() => passportRef.current?.click()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setPassportFile(f); setPassportPreview(URL.createObjectURL(f)); } }}
                      onDragOver={e => e.preventDefault()}>
                      <Camera size={22} className="text-slate-400" />
                      <p className="text-xs text-slate-500">Click or drop JPG/PNG</p>
                    </div>
                  ) : (
                    <div className="relative h-32 rounded-xl overflow-hidden border-2 border-emerald-400">
                      <img src={passportPreview} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => { setPassportFile(null); setPassportPreview(''); }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center">
                        <X size={11} />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">ID Document *</label>
                  <input ref={idRef} type="file" accept="image/*,.pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setIdFile(f); setIdPreview(URL.createObjectURL(f)); } }} />
                  {!idPreview ? (
                    <div className="doc-upload-card h-32 flex flex-col items-center justify-center gap-2"
                      onClick={() => idRef.current?.click()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setIdFile(f); setIdPreview(URL.createObjectURL(f)); } }}
                      onDragOver={e => e.preventDefault()}>
                      <FileText size={22} className="text-slate-400" />
                      <p className="text-xs text-slate-500">Click or drop JPG/PNG/PDF</p>
                    </div>
                  ) : (
                    <div className="relative h-32 rounded-xl overflow-hidden border-2 border-emerald-400">
                      {idFile?.type === 'application/pdf' ? (
                        <div className="w-full h-full bg-emerald-50 dark:bg-emerald-900/20 flex flex-col items-center justify-center">
                          <FileText size={24} className="text-emerald-500" />
                          <p className="text-xs text-emerald-600 mt-1">PDF uploaded</p>
                        </div>
                      ) : (
                        <img src={idPreview} alt="" className="w-full h-full object-cover" />
                      )}
                      <button onClick={() => { setIdFile(null); setIdPreview(''); }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center">
                        <X size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? (
              <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
            ) : (
              isCustomer ? 'Create Customer Account' : 'Create Staff Account'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// USERS PAGE
// ─────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user, lang } = useApp();
  const [users, setUsers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewUser, setViewUser] = useState<any>(null);

  const isAdmin = ['super_admin', 'branch_manager'].includes(user?.role || '');
  const isBranchMgr = user?.role === 'branch_manager';

  const load = async () => {
    try {
      const { data } = await getUsers();
      const list = data.data.users || [];
      setUsers(list);
      setFiltered(list);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let f = users;
    if (search) {
      const q = search.toLowerCase();
      f = f.filter((u: any) =>
        (u.first_name + ' ' + u.last_name + ' ' + u.email).toLowerCase().includes(q)
      );
    }
    if (roleFilter) f = f.filter((u: any) => u.role === roleFilter);
    setFiltered(f);
  }, [search, roleFilter, users]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      <div className="page-header">
        <div>
          <h1 className="font-display font-bold text-2xl">{t('users', lang)}</h1>
          <p className="text-slate-400 text-sm">
            {users.length} {isBranchMgr ? 'users in your branch' : 'total users'}
          </p>
          {isBranchMgr && (user as any)?.branch_name && (
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin size={12} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                {(user as any).branch_name} — branch scope only
              </span>
            </div>
          )}
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <UserPlus size={16} /> Add User / Staff
          </button>
        )}
      </div>

      <div className="card flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-44" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="badge-gray px-3 py-1.5 text-sm">{filtered.length} shown</span>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Status</th>
                <th>KYC</th>
                <th>Last Login</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u: any) => {
                const rc = ROLE_COLORS[u.role] || '#3b5bdb';
                const initials = ((u.first_name || '')[0] || '') + ((u.last_name || '')[0] || '');
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        {u.profile_photo ? (
                          <img src={'http://localhost:5000' + u.profile_photo} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: rc + '22', color: rc }}>
                            {initials.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                            {u.first_name} {u.last_name}
                          </p>
                          <p className="text-xs text-slate-400">{u.phone || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs text-slate-500 dark:text-slate-400">{u.email}</td>
                    <td>
                      <span className="badge text-[11px] font-semibold" style={{ background: rc + '22', color: rc }}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">{u.branch_name || '—'}</td>
                    <td>
                      <span className={clsx('badge', u.status === 'active' ? 'badge-green' : 'badge-red')}>
                        {u.status}
                      </span>
                    </td>
                    <td>
                      <span className={clsx('badge', u.kyc_verified ? 'badge-teal' : 'badge-amber')}>
                        {u.kyc_verified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <button
                        onClick={() => setViewUser(u)}
                        className="btn-secondary btn-sm"
                      >
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-10">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onSuccess={load} />
      )}

      {viewUser && (
        <ViewUserModal
          user={viewUser}
          onClose={() => setViewUser(null)}
          onAction={load}
        />
      )}

    </div>
  );
}
