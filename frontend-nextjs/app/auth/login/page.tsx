'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, ArrowRight, Shield, Mail,
  AlertCircle, Lock, User, Sun, Moon, RefreshCw,
  CheckCircle, Clock, UserPlus,
} from 'lucide-react';
import { setAuth, forgotPassword } from '@/lib/api';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import clsx from 'clsx';

type Step = 'credentials' | 'otp' | 'forgot' | 'forgot_done';

export default function LoginPage() {
  const { setUser, lang, setLang, theme, toggleTheme } = useApp();
  const router = useRouter();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const timerRef = useRef<any>(null);

  // Countdown timer for OTP resend
  const startTimer = () => {
    setOtpTimer(60);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Step 1: Submit credentials → backend validates and sends OTP
  const handleCredentials = async () => {
    const em = email.trim();
    const pw = password;
    if (!em || !pw) { setError('Email and password are required'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, password: pw }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const msg = data.message || '';
        if (res.status === 429) setError('Too many attempts. Wait 15 minutes.');
        else if (res.status === 423) setError('Account locked. Try again later.');
        else if (res.status === 403) setError('Account suspended. Contact your branch.');
        else if (res.status === 401) setError(t('invalidCredentials', lang));
        else if (!navigator.onLine) setError('No internet connection.');
        else setError(msg || t('invalidCredentials', lang));
        return;
      }

      // Credentials valid — OTP has been sent
      setOtpEmail(em);
      setOtpDigits(['', '', '', '', '', '']);
      if (data._dev_otp) {
        setDevOtp(data._dev_otp);
        toast.success('Dev mode: OTP is ' + data._dev_otp, { duration: 10000 });
      } else {
        toast.success('OTP sent to ' + em.replace(/(.{2}).*(@.*)/, '$1***$2'), { duration: 6000 });
      }
      startTimer();
      setStep('otp');

    } catch {
      setError('Cannot connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP → complete login
  const handleVerifyOTP = async (digits?: string[]) => {
    const code = (digits || otpDigits).join('');
    if (code.length < 6) { setError('Enter the complete 6-digit OTP'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail, otp: code }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Invalid or expired OTP');
        // Clear digits on wrong OTP
        setOtpDigits(['', '', '', '', '', '']);
        document.getElementById('otp-0')?.focus();
        return;
      }

      // Login complete
      finalizeLogin(data.data);

    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const finalizeLogin = (tokenData: any) => {
    setAuth(tokenData.accessToken, tokenData.refreshToken);
    setUser(tokenData.user);
    localStorage.setItem('sb_user', JSON.stringify(tokenData.user));
    toast.success('Welcome back, ' + tokenData.user.first_name + '!');
    router.push('/dashboard');
  };

  // Resend OTP
  const handleResend = async () => {
    if (otpTimer > 0) return;
    setError('');
    try {
      const res = await fetch('/api/auth/resend-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail }),
      });
      const data = await res.json();
      if (data._dev_otp) {
        setDevOtp(data._dev_otp);
        toast.success('New OTP: ' + data._dev_otp, { duration: 10000 });
      } else {
        toast.success('New OTP sent to your email');
      }
      setOtpDigits(['', '', '', '', '', '']);
      startTimer();
      document.getElementById('otp-0')?.focus();
    } catch {
      toast.error('Failed to resend. Try again.');
    }
  };

  // OTP input handlers
  const handleOtpInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[idx] = digit;
    setOtpDigits(next);
    if (digit && idx < 5) {
      (document.getElementById('otp-' + (idx + 1)) as HTMLInputElement)?.focus();
    }
    // Auto-submit when all 6 filled
    if (digit && idx === 5 && next.every(d => d)) {
      setTimeout(() => handleVerifyOTP(next), 80);
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      (document.getElementById('otp-' + (idx - 1)) as HTMLInputElement)?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const digits = text.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtpDigits(digits);
    const focusIdx = Math.min(text.length, 5);
    (document.getElementById('otp-' + focusIdx) as HTMLInputElement)?.focus();
    if (text.length === 6) {
      setTimeout(() => handleVerifyOTP(digits), 80);
    }
  };

  // Forgot password
  const handleForgot = async () => {
    if (!forgotEmail.trim()) { setError('Enter your email'); return; }
    setForgotLoading(true);
    setError('');
    try {
      await forgotPassword(forgotEmail.trim());
      setStep('forgot_done');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed. Check your email address.');
    }
    setForgotLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left hero ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 px-14 py-12"
        style={{ background: '#1a4fa8' }}
      >
        <div>
          <div className="flex items-center gap-3 mb-14">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="font-display font-black text-[15px] text-blue-700">SB</span>
            </div>
            <span className="font-display font-bold text-lg text-white">SmartBank AI</span>
          </div>

          <h1 className="font-display font-bold text-[40px] text-white leading-[1.1] mb-5">
            Intelligent<br />Digital Banking<br />
            <span style={{ color: '#fbbf24' }}>for Rwanda</span>
          </h1>
          <p className="text-white/55 text-[15px] leading-relaxed max-w-sm mb-10">
            Secure AI-powered banking with real-time fraud detection, smart credit scoring, and instant notifications.
          </p>

          {/* Register CTA */}
          <div className="bg-white/10 border border-white/20 rounded-2xl p-6">
            <p className="text-white font-display font-bold text-lg mb-1">
              New to SmartBank AI?
            </p>
            <p className="text-white/60 text-sm mb-4 leading-relaxed">
              Want to open an account with us? Register online and our team will review your application within 1–2 business days.
            </p>
            <Link
              href="/auth/register"
              className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl font-semibold text-sm transition-all duration-150"
              style={{ background: '#fbbf24', color: '#1a1a1a' }}
            >
              <UserPlus size={16} />
              Click here to Register
            </Link>
            <p className="text-white/35 text-xs text-center mt-3">
              Free · No hidden fees · Verified in 48h
            </p>
          </div>
        </div>
        <p className="text-white/25 text-xs">
          &copy; {new Date().getFullYear()} SmartBank AI &mdash; Kigali, Rwanda
        </p>
      </div>

      {/* ── Right auth panel ── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
        {/* Controls */}
        <div className="flex justify-end items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <select
            value={lang}
            onChange={e => setLang(e.target.value as any)}
            className="input w-auto text-xs px-2.5 py-1.5 rounded-lg"
          >
            <option value="en">🇬🇧 English</option>
            <option value="fr">🇫🇷 Français</option>
            <option value="rw">🇷🇼 Kinyarwanda</option>
          </select>
          <button onClick={toggleTheme} className="btn-secondary btn-icon" title="Toggle theme">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">

            {/* Mobile brand */}
            <div className="flex lg:hidden items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#1a4fa8' }}>
                <span className="font-display font-black text-sm text-white">SB</span>
              </div>
              <span className="font-display font-bold text-base text-slate-900 dark:text-white">SmartBank AI</span>
            </div>

            {/* ════ CREDENTIALS ════ */}
            {step === 'credentials' && (
              <div className="animate-fade-up">
                <h2 className="font-display font-bold text-2xl text-slate-900 dark:text-white mb-1">
                  {t('welcomeBack', lang)}
                </h2>
                <p className="text-slate-400 text-sm mb-5">{t('signInDesc', lang)}</p>

                {/* Role selection cards */}
                <div className="mb-5">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
                    Select your account type
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { role: 'customer',       label: 'Customer',        color: '#1a4fa8', bg: '#eff6ff', initials: 'C' },
                      { role: 'bank_staff',     label: 'Bank Teller',     color: '#059669', bg: '#f0fdf4', initials: 'T' },
                      { role: 'branch_manager', label: 'Branch Manager',  color: '#7c3aed', bg: '#f5f3ff', initials: 'M' },
                      { role: 'fraud_analyst',  label: 'Fraud Analyst',   color: '#dc2626', bg: '#fef2f2', initials: 'F' },
                      { role: 'auditor',        label: 'Auditor',         color: '#0891b2', bg: '#f0f9ff', initials: 'A' },
                      { role: 'super_admin',    label: 'Super Admin',     color: '#d97706', bg: '#fffbeb', initials: 'S' },
                    ].map(({ role, label, color, bg, initials }) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(prev => prev === role ? '' : role)}
                        className={clsx(
                          'flex flex-col items-center gap-2 py-3 px-2 rounded-xl border-2 transition-all duration-150 text-center',
                          selectedRole === role
                            ? 'border-2 shadow-sm scale-[1.03]'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                        )}
                        style={selectedRole === role
                          ? { borderColor: color, background: bg }
                          : {}}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 transition-transform"
                          style={{ background: color }}
                        >
                          {initials}
                        </div>
                        <p className={clsx(
                          'text-[11px] font-semibold leading-tight',
                          selectedRole === role ? 'font-bold' : 'text-slate-600 dark:text-slate-400',
                        )}
                          style={selectedRole === role ? { color } : {}}
                        >
                          {label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={e => { e.preventDefault(); handleCredentials(); }} className="space-y-4">
                  <div className="field">
                    <label className="label">{t('email', lang)}</label>
                    <div className="relative">
                      <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="input pl-10"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="label">{t('password', lang)}</label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="input pl-10 pr-11"
                        type={showPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="alert-error animate-fade-up">
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="btn-primary w-full btn-lg">
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      <>{t('signIn', lang)} <ArrowRight size={16} /></>
                    )}
                  </button>
                </form>

                <div className="flex items-center justify-between mt-4">
                  <Link href="/auth/register" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                    {t('createAccount', lang)} &rarr;
                  </Link>
                  <button
                    onClick={() => { setStep('forgot'); setError(''); setForgotEmail(email); }}
                    className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {t('forgotPassword', lang)}
                  </button>
                </div>


              </div>
            )}

            {/* ════ OTP VERIFICATION ════ */}
            {step === 'otp' && (
              <div className="animate-fade-up">
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 mx-auto" style={{ background: '#1a4fa81a' }}>
                  <Mail size={30} style={{ color: '#1a4fa8' }} />
                </div>

                <h2 className="font-display font-bold text-2xl text-slate-900 dark:text-white mb-2 text-center">
                  Check Your Email
                </h2>
                <p className="text-slate-400 text-sm text-center mb-1">
                  We sent a 6-digit OTP to
                </p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm text-center mb-6">
                  {otpEmail}
                </p>

                {/* Dev OTP hint */}
                {devOtp && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-center">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      Dev mode — OTP: <span className="font-mono font-black text-lg tracking-[0.2em]">{devOtp}</span>
                    </p>
                  </div>
                )}

                {/* 6-digit OTP boxes */}
                <div className="flex gap-2 justify-center mb-5" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      id={'otp-' + idx}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpInput(idx, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(idx, e)}
                      autoFocus={idx === 0}
                      className={clsx(
                        'w-12 h-14 text-center text-2xl font-bold font-mono rounded-xl border-2 outline-none transition-all',
                        'bg-white dark:bg-slate-800',
                        digit
                          ? 'border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white',
                        'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
                      )}
                    />
                  ))}
                </div>

                {error && (
                  <div className="alert-error mb-4 animate-fade-up">
                    <AlertCircle size={15} className="flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  onClick={() => handleVerifyOTP()}
                  disabled={loading || otpDigits.some(d => !d)}
                  className="btn-primary w-full btn-lg mb-4"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <><CheckCircle size={16} /> Verify &amp; Sign In</>
                  )}
                </button>

                {/* Resend + timer */}
                <div className="text-center">
                  {otpTimer > 0 ? (
                    <p className="text-sm text-slate-400 flex items-center justify-center gap-1.5">
                      <Clock size={13} />
                      Resend in {otpTimer}s
                    </p>
                  ) : (
                    <button
                      onClick={handleResend}
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 mx-auto"
                    >
                      <RefreshCw size={13} /> Resend OTP
                    </button>
                  )}
                </div>

                <div className="mt-5 text-center">
                  <button
                    onClick={() => { setStep('credentials'); setError(''); setOtpDigits(['', '', '', '', '', '']); setDevOtp(''); }}
                    className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    &larr; Back to login
                  </button>
                </div>

                <div className="mt-5 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                    <strong>OTP expires in 10 minutes.</strong> Check your spam folder if you don&apos;t see it.
                    Never share this code with anyone.
                  </p>
                </div>
              </div>
            )}

            {/* ════ FORGOT PASSWORD ════ */}
            {step === 'forgot' && (
              <div className="animate-fade-up">
                <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-5">
                  <Lock size={26} className="text-amber-600" />
                </div>
                <h2 className="font-display font-bold text-2xl text-slate-900 dark:text-white mb-1">
                  Reset Password
                </h2>
                <p className="text-slate-400 text-sm mb-6">
                  Enter your email to receive a password reset OTP
                </p>

                <div className="field mb-4">
                  <label className="label">{t('email', lang)}</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input pl-10"
                      type="email"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="alert-error mb-4">
                    <AlertCircle size={15} className="flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button onClick={handleForgot} disabled={forgotLoading} className="btn-primary w-full btn-lg mb-4">
                  {forgotLoading ? (
                    <><div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" /> Sending...</>
                  ) : (
                    <>Send Reset OTP <ArrowRight size={16} /></>
                  )}
                </button>

                <button
                  onClick={() => { setStep('credentials'); setError(''); }}
                  className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 w-full text-center"
                >
                  &larr; Back to login
                </button>
              </div>
            )}

            {/* ════ FORGOT DONE ════ */}
            {step === 'forgot_done' && (
              <div className="text-center animate-fade-up">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Mail size={28} className="text-emerald-500" />
                </div>
                <h2 className="font-display font-bold text-2xl text-slate-900 dark:text-white mb-2">
                  Check Your Email
                </h2>
                <p className="text-slate-400 text-sm mb-6">
                  Reset OTP sent to <strong className="text-slate-700 dark:text-slate-300">{forgotEmail}</strong>
                </p>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 mb-5">
                  Check your spam folder if you don&apos;t see it within a few minutes.
                </div>
                <button onClick={() => { setStep('credentials'); setError(''); }} className="btn-primary w-full btn-lg">
                  Back to Login
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
