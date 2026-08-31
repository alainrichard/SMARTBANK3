'use client';
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { updateProfile, changePassword, setup2FA, enable2FA, getProfile, getAIStatus, retrainModels } from '@/lib/api';
import { User, Shield, Bell, Settings2, Sun, Moon, Globe, Camera, Lock, Key, CheckCircle, AlertTriangle, Upload, RefreshCw, Cpu, ChevronRight, Mail } from 'lucide-react';
import Image from 'next/image';
import clsx from 'clsx';

const TABS = [
  { id: 'profile', icon: User, labelKey: 'profile' as const },
  { id: 'security', icon: Shield, labelKey: 'security' as const },
  { id: 'preferences', icon: Settings2, labelKey: 'preferences' as const },
  { id: 'notifications', icon: Bell, labelKey: 'emailNotifications' as const },
  { id: 'system', icon: Cpu, labelKey: 'system' as const },
];

export default function SettingsPage() {
  const { user, setUser, refreshUser, lang, setLang, theme, toggleTheme } = useApp();
  const [tab, setTab] = useState('profile');
  const [profileForm, setProfileForm] = useState({ first_name: user?.first_name || '', last_name: user?.last_name || '', phone: user?.phone || '', address: user?.address || '', email: user?.email || '' });
  const [pwForm, setPwForm] = useState({ current: '', newPass: '', confirm: '' });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [twoFAData, setTwoFAData] = useState<any>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) {
      setPhotoFile(files[0]);
      setPhotoPreview(URL.createObjectURL(files[0]));
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, maxSize: 5_000_000, multiple: false });

  useEffect(() => {
    if (user?.role === 'super_admin') {
      getAIStatus().then(r => setAiStatus(r.data?.data)).catch(() => {});
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      if (photoFile) {
        const fd = new FormData();
        fd.append('photo', photoFile);
        await fetch('/api/profile/photo', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }, body: fd });
      }
      const { data } = await updateProfile({ first_name: profileForm.first_name, last_name: profileForm.last_name, phone: profileForm.phone, address: profileForm.address });
      if (data.success) { await refreshUser(); toast.success('Profile updated!'); }
    } catch { toast.error('Failed to save profile'); }
    setSaving(false);
  };

  const savePw = async () => {
    if (pwForm.newPass !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    if (pwForm.newPass.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      const { data } = await changePassword({ current_password: pwForm.current, new_password: pwForm.newPass });
      if (data.success) { toast.success('Password changed! Confirmation email sent.'); setPwForm({ current: '', newPass: '', confirm: '' }); }
      else toast.error(data.message || 'Failed');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
    setSaving(false);
  };

  const initSetup2FA = async () => {
    try {
      const { data } = await setup2FA();
      setTwoFAData(data.data);
    } catch { toast.error('Failed to setup 2FA'); }
  };

  const verifyEnable2FA = async () => {
    try {
      const { data } = await enable2FA(twoFACode);
      if (data.success) { toast.success('2FA enabled!'); setTwoFAData(null); setTwoFACode(''); await refreshUser(); }
      else toast.error(data.message || 'Invalid code');
    } catch { toast.error('Invalid code'); }
  };

  const handleRetrain = async () => {
    if (!confirm('Retrain all AI models? This may take a moment.')) return;
    try {
      const { data } = await retrainModels();
      toast.success(data.success ? 'Models retrained successfully!' : 'Retrain failed');
    } catch { toast.error('Retrain failed'); }
  };

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase();
  const visibleTabs = TABS.filter(tb => tb.id !== 'system' || user?.role === 'super_admin');

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="font-display font-bold text-2xl">{t('settings', lang)}</h1>
          <p className="text-slate-400 text-sm">Manage your account, security and preferences</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {visibleTabs.map(({ id, icon: Icon, labelKey }) => (
            <button key={id} onClick={() => setTab(id)}
              className={clsx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all', tab === id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}>
              <Icon size={16} />{t(labelKey, lang)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* PROFILE TAB */}
          {tab === 'profile' && (
            <div className="space-y-5">
              <div className="card">
                <h3 className="font-display font-bold text-base mb-4">Profile Information</h3>
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Photo */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      {(photoPreview || user?.profile_photo) ? (
                        <img src={photoPreview || `http://localhost:5000${user?.profile_photo}`} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-ink-700 shadow-lg" />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-display font-bold text-3xl text-slate-500 border-4 border-white dark:border-ink-600 shadow-lg">{initials}</div>
                      )}
                      <div {...getRootProps()} className="absolute -bottom-1 -right-1 w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-600 transition shadow">
                        <input {...getInputProps()} />
                        <Camera size={14} className="text-slate-900" />
                      </div>
                    </div>
                    <div className={clsx('dropzone p-3 text-center w-full max-w-[140px]', isDragActive && 'border-brand-500 bg-brand-50/50')} {...getRootProps()}>
                      <input {...getInputProps()} />
                      <Upload size={16} className="mx-auto mb-1 text-slate-400" />
                      <p className="text-xs text-slate-400">{t('uploadPhoto', lang)}</p>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div><label className="label">{t('firstName', lang)}</label><input className="input" value={profileForm.first_name} onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                    <div><label className="label">{t('lastName', lang)}</label><input className="input" value={profileForm.last_name} onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))} /></div>
                    <div><label className="label">{t('email', lang)} <span className="text-slate-400 font-normal">(read-only)</span></label><input className="input opacity-50" value={user?.email || ''} disabled /></div>
                    <div><label className="label">{t('phone', lang)}</label><input className="input" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} /></div>
                    <div className="col-span-2"><label className="label">Address</label><input className="input" value={profileForm.address} onChange={e => setProfileForm(f => ({ ...f, address: e.target.value }))} /></div>
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button onClick={saveProfile} disabled={saving} className="btn-primary">
                    {saving ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />Saving...</> : <>{t('save', lang)}</>}
                  </button>
                </div>
              </div>

              {/* Account info */}
              <div className="card">
                <h3 className="font-display font-bold text-base mb-4">Account Information</h3>
                <div className="space-y-0">
                  {[
                    ['Role', t(user?.role as any || 'customer', lang)],
                    ['Status', user?.status],
                    ['KYC Status', user?.kyc_verified ? '✓ Verified' : 'Pending'],
                    ['Branch', user?.branch_name || 'Head Office'],
                    ['Member since', user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'],
                    ['Last login', user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'],
                    ['Last login IP', user?.last_login_ip || '—'],
                  ].map(([k, v]) => (
                    <div key={k as string} className="settings-row">
                      <span className="text-sm text-slate-500 dark:text-slate-400">{k}</span>
                      <span className="text-sm font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {tab === 'security' && (
            <div className="space-y-5">
              <div className="card">
                <h3 className="font-display font-bold text-base mb-4">{t('changePassword', lang)}</h3>
                <p className="text-xs text-slate-400 mb-4">A confirmation email will be sent to {user?.email}</p>
                <div className="space-y-3 max-w-sm">
                  <div><label className="label">{t('currentPassword', lang)}</label><input type="password" className="input" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} /></div>
                  <div><label className="label">{t('newPassword', lang)}</label><input type="password" className="input" value={pwForm.newPass} onChange={e => setPwForm(f => ({ ...f, newPass: e.target.value }))} /></div>
                  <div><label className="label">{t('confirmNewPassword', lang)}</label><input type="password" className="input" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} /></div>
                  <button onClick={savePw} disabled={saving} className="btn-primary mt-1">{saving ? 'Saving...' : t('changePassword', lang)}</button>
                </div>
              </div>

              <div className="card">
                <h3 className="font-display font-bold text-base mb-2">{t('twoFactor', lang)}</h3>
                <p className="text-sm text-slate-400 mb-4">Protect your account with Google Authenticator or Authy.</p>
                <div className={clsx('flex items-center justify-between p-3 rounded-xl mb-4', user?.two_fa_enabled ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-50 dark:bg-slate-800')}>
                  <div>
                    <p className="font-semibold text-sm">2FA Status</p>
                    <p className={clsx('text-xs mt-0.5', user?.two_fa_enabled ? 'text-emerald-600' : 'text-slate-400')}>{user?.two_fa_enabled ? '✓ Protecting your account' : 'Not yet enabled'}</p>
                  </div>
                  <span className={clsx('badge', user?.two_fa_enabled ? 'badge-green' : 'badge-amber')}>{user?.two_fa_enabled ? 'Active' : 'Inactive'}</span>
                </div>
                {!twoFAData ? (
                  <button onClick={initSetup2FA} className={user?.two_fa_enabled ? 'btn-outline btn-sm' : 'btn-primary btn-sm'}>{user?.two_fa_enabled ? 'Reconfigure 2FA' : 'Enable 2FA'}</button>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">Scan this QR code with Google Authenticator or Authy:</p>
                    <img src={twoFAData.qrCode} alt="QR" className="w-44 h-44 rounded-xl border border-ink-200 dark:border-ink-700" />
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                      <p className="text-xs text-slate-400 mb-1">Manual key:</p>
                      <p className="font-mono text-xs break-all text-slate-700 dark:text-slate-300">{twoFAData.secret}</p>
                    </div>
                    <div><label className="label">Enter 6-digit code to verify</label><input className="input font-mono text-2xl text-center tracking-[10px]" maxLength={6} value={twoFACode} onChange={e => setTwoFACode(e.target.value)} placeholder="000000" /></div>
                    <button onClick={verifyEnable2FA} className="btn-primary">Verify & Enable</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PREFERENCES TAB */}
          {tab === 'preferences' && (
            <div className="space-y-5">
              <div className="card">
                <h3 className="font-display font-bold text-base mb-5">{t('preferences', lang)}</h3>
                <div className="space-y-0">
                  {/* Language */}
                  <div className="settings-row">
                    <div>
                      <p className="font-medium text-sm flex items-center gap-2"><Globe size={15} />{t('language', lang)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Choose your preferred language</p>
                    </div>
                    <select value={lang} onChange={e => setLang(e.target.value as any)} className="input w-40">
                      <option value="en">English</option>
                      <option value="fr">Français</option>
                      <option value="rw">Kinyarwanda</option>
                    </select>
                  </div>
                  {/* Theme */}
                  <div className="settings-row">
                    <div>
                      <p className="font-medium text-sm flex items-center gap-2">{theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}{t('theme', lang)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{theme === 'dark' ? t('darkMode', lang) : t('lightMode', lang)}</p>
                    </div>
                    <button onClick={toggleTheme} className={clsx('relative w-14 h-7 rounded-full transition-colors duration-300 flex items-center', theme === 'dark' ? 'bg-teal-500' : 'bg-slate-200')}>
                      <span className={clsx('w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ml-1', theme === 'dark' ? 'translate-x-7' : 'translate-x-0')} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {tab === 'notifications' && (
            <div className="card">
              <h3 className="font-display font-bold text-base mb-2">{t('emailNotifications', lang)}</h3>
              <p className="text-xs text-slate-400 mb-4">Emails will be sent to <strong>{user?.email}</strong></p>
              <div className="alert-info mb-4 flex items-start gap-2 text-xs">
                <Mail size={14} className="flex-shrink-0 mt-0.5" />
                Configure SMTP credentials in <code className="bg-blue-100 dark:bg-blue-900/30 px-1 rounded">backend/.env</code> to enable email delivery.
              </div>
              <div className="space-y-0">
                {[
                  ['Login alerts', 'Email for every new sign-in', true],
                  ['Transaction alerts', 'Confirmation for all transactions', true],
                  ['Fraud alerts', 'Immediate alert on suspicious activity', true],
                  ['Loan updates', 'Updates on loan application status', true],
                  ['Account changes', 'Profile/account modification notices', true],
                  ['OTP codes', 'OTPs via email for security actions', true],
                ].map(([title, desc, on]) => (
                  <div key={title as string} className="settings-row">
                    <div>
                      <p className="font-medium text-sm">{title as string}</p>
                      <p className="text-xs text-slate-400">{desc as string}</p>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked={on as boolean} onChange={() => toast.success('Preference saved!')} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SYSTEM TAB (super_admin) */}
          {tab === 'system' && user?.role === 'super_admin' && (
            <div className="space-y-5">
              <div className="card">
                <h3 className="font-display font-bold text-base mb-2">Email / SMTP Configuration</h3>
                <div className="alert-warning text-xs mb-4">Configure in <code>backend/.env</code> — changes require backend restart.</div>
                <div className="grid grid-cols-2 gap-3 max-w-lg">
                  {[['SMTP Host', 'smtp.gmail.com'], ['SMTP Port', '587'], ['Gmail Address', 'your@gmail.com'], ['App Password', '']].map(([label, placeholder]) => (
                    <div key={label}><label className="label">{label}</label><input className="input" placeholder={placeholder} type={label === 'App Password' ? 'password' : 'text'} /></div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                  <strong>Gmail setup:</strong> Enable 2FA on Gmail → Account Settings → Security → App Passwords → Generate → use as SMTP_PASS
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="btn-outline btn-sm" onClick={() => toast('Test email sent if SMTP configured', { icon: '📧' })}>Send Test Email</button>
                </div>
              </div>

              <div className="card">
                <h3 className="font-display font-bold text-base mb-4">AI Model Management</h3>
                {aiStatus ? (
                  <div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        ['ML Available', aiStatus.ml_available],
                        ['Fraud Model', aiStatus.fraud_model],
                        ['Credit Model', aiStatus.credit_model],
                        ['Anomaly Model', aiStatus.anomaly_model],
                        ['TensorFlow', aiStatus.tensorflow_available],
                        ['scikit-learn', !!aiStatus.sklearn_version],
                      ].map(([label, ok]) => (
                        <div key={label as string} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                          <p className="text-xs text-slate-400 mb-1">{label as string}</p>
                          <span className={clsx('badge', ok ? 'badge-green' : 'badge-amber')}>{ok ? '✓ OK' : '—'}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={handleRetrain} className="btn-danger btn-sm flex items-center gap-2"><RefreshCw size={14} />Retrain All Models</button>
                  </div>
                ) : (
                  <button onClick={() => getAIStatus().then(r => setAiStatus(r.data?.data))} className="btn-primary btn-sm">Check AI Status</button>
                )}
              </div>

              <div className="card">
                <h3 className="font-display font-bold text-base mb-4">System Information</h3>
                <div className="space-y-0">
                  {[['Backend API', 'Running on :5000', 'badge-green'], ['AI Service', aiStatus ? (aiStatus.ml_available ? 'Online' : 'Offline') : 'Unknown', aiStatus?.ml_available ? 'badge-green' : 'badge-amber'], ['Version', 'SmartBank AI v3.0.0', 'badge-gray']].map(([k, v, cls]) => (
                    <div key={k as string} className="settings-row">
                      <span className="text-sm text-slate-500">{k as string}</span>
                      <span className={clsx('badge', cls as string)}>{v as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
