'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Camera, Upload, CheckCircle, AlertCircle, ArrowLeft, ArrowRight,
  RefreshCw, User, Mail, Phone, CreditCard, Calendar, MapPin,
  X, Shield, Info, FileText, Clock,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import clsx from 'clsx';

const RW_PROVINCES = [
  'Kigali',
  'Northern Province',
  'Southern Province',
  'Eastern Province',
  'Western Province',
];

const RW_DISTRICTS: Record<string, string[]> = {
  'Kigali': ['Gasabo', 'Kicukiro', 'Nyarugenge'],
  'Northern Province': ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo'],
  'Southern Province': ['Gisagara', 'Huye', 'Kamonyi', 'Muhanga', 'Nyamagabe', 'Nyanza', 'Nyaruguru', 'Ruhango'],
  'Eastern Province': ['Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Rwamagana'],
  'Western Province': ['Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke', 'Rubavu', 'Rutsiro', 'Rusizi'],
};

type Step = 'info' | 'address' | 'photo' | 'document' | 'review' | 'submitted';

const STEPS: Step[] = ['info', 'address', 'photo', 'document', 'review', 'submitted'];
const STEP_LABELS = ['Personal Info', 'Address & Branch', 'Passport Photo', 'ID Document', 'Review'];

export default function RegisterPage() {
  const { lang } = useApp();
  const [step, setStep] = useState<Step>('info');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    national_id: '',
    date_of_birth: '',
    province: '',
    district: '',
    sector: '',
    village: '',
    address: '',
  });
  // Static fallback branches — always available even if API fails
  const STATIC_BRANCHES = [
    { id: 'hq001',  name: 'Head Office',       district: 'Gasabo',     province: 'Kigali',            address: 'KG 7 Avenue, Kigali',    phone: '+250 788 000 001' },
    { id: 'kgl001', name: 'Kigali City Branch', district: 'Nyarugenge', province: 'Kigali',            address: 'KN 5 Road, Nyarugenge',   phone: '+250 788 000 002' },
    { id: 'kic001', name: 'Kicukiro Branch',    district: 'Kicukiro',   province: 'Kigali',            address: 'KK 15 Road, Kicukiro',    phone: '+250 788 000 003' },
    { id: 'msz001', name: 'Musanze Branch',     district: 'Musanze',    province: 'Northern Province', address: 'Main Street, Musanze',     phone: '+250 788 000 004' },
    { id: 'hye001', name: 'Huye Branch',        district: 'Huye',       province: 'Southern Province', address: 'NR3 Road, Huye',          phone: '+250 788 000 005' },
    { id: 'rbv001', name: 'Rubavu Branch',      district: 'Rubavu',     province: 'Western Province',  address: 'Lake Road, Gisenyi',       phone: '+250 788 000 006' },
    { id: 'rwm001', name: 'Rwamagana Branch',   district: 'Rwamagana',  province: 'Eastern Province',  address: 'Main Road, Rwamagana',     phone: '+250 788 000 007' },
    { id: 'gis001', name: 'Gisagara Branch',    district: 'Gisagara',   province: 'Southern Province', address: 'NR1 Road, Gisagara',       phone: '+250 788 000 008' },
    { id: 'nyg001', name: 'Nyagatare Branch',   district: 'Nyagatare',  province: 'Eastern Province',  address: 'Main Street, Nyagatare',   phone: '+250 788 000 009' },
    { id: 'ruh001', name: 'Ruhango Branch',     district: 'Ruhango',    province: 'Southern Province', address: 'NR2 Road, Ruhango',        phone: '+250 788 000 010' },
    { id: 'kro001', name: 'Karongi Branch',     district: 'Karongi',    province: 'Western Province',  address: 'Lake Kivu Road, Karongi',  phone: '+250 788 000 011' },
    { id: 'ngo001', name: 'Ngoma Branch',       district: 'Ngoma',      province: 'Eastern Province',  address: 'NR3 Road, Ngoma',          phone: '+250 788 000 012' },
  ];

  const [branches, setBranches] = useState<any[]>(STATIC_BRANCHES);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Photo state
  const [passportBlob, setPassportBlob] = useState<Blob | null>(null);
  const [passportPreview, setPassportPreview] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Document state
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState('');
  const idInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);

  // Load branches from API and merge with static fallback
  useEffect(() => {
    fetch('/api/branches')
      .then(r => r.json())
      .then(d => {
        const apiBranches = d.data?.branches || [];
        if (apiBranches.length > 0) setBranches(apiBranches);
        // else keep the static fallback already set
      })
      .catch(() => { /* keep static fallback */ });
  }, []);

  // Auto-select nearest branch when district changes
  useEffect(() => {
    if (!form.district) return;
    const sorted = [...branches].sort((a, b) => {
      const aExact = a.district === form.district;
      const bExact = b.district === form.district;
      const aProv = a.province === form.province;
      const bProv = b.province === form.province;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      if (aProv && !bProv) return -1;
      if (!aProv && bProv) return 1;
      return 0;
    });
    if (sorted.length > 0) setSelectedBranch(sorted[0].id);
  }, [form.district, form.province, branches]);

  const setField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  // ── Camera ──────────────────────────────────────────────────
  const startCamera = async (facingMode = facing) => {
    try {
      stopCamera();
      setCameraError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera access denied. Please allow camera in your browser settings.');
      } else {
        setCameraError('Camera not available. Please check your device.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const flipCamera = () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    startCamera(next);
  };

  const capturePhoto = () => {
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          takeSnapshot();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) {
        setPassportBlob(blob);
        setPassportPreview(canvas.toDataURL('image/jpeg', 0.9));
        stopCamera();
        toast.success('Photo captured!');
      }
    }, 'image/jpeg', 0.9);
  };

  const retakePhoto = () => {
    setPassportBlob(null);
    setPassportPreview('');
    startCamera();
  };

  // Start/stop camera with step changes
  useEffect(() => {
    if (step === 'photo' && !passportPreview) {
      startCamera();
    } else if (step !== 'photo') {
      stopCamera();
    }
    return () => stopCamera();
  }, [step]);

  // ── ID document ─────────────────────────────────────────────
  const handleIdFile = (file: File) => {
    setIdFile(file);
    setIdPreview(URL.createObjectURL(file));
  };

  // ── Validation ───────────────────────────────────────────────
  const validateInfo = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = 'First name is required';
    if (!form.last_name.trim()) e.last_name = 'Last name is required';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    if (!form.national_id.trim()) e.national_id = 'National ID is required';
    if (!form.date_of_birth) e.date_of_birth = 'Date of birth is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateAddress = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.province) e.province = 'Select your province';
    if (!form.district) e.district = 'Select your district';
    if (!form.sector.trim()) e.sector = 'Enter your sector';
    if (!form.village.trim()) e.village = 'Enter your village';
    // Branch is optional — customer can update it later
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────
  const submit = async () => {
    if (!passportBlob || !idFile) {
      toast.error('Both passport photo and ID document are required');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      fd.append('preferred_branch_id', selectedBranch);
      fd.append('passport_photo', passportBlob, 'passport.jpg');
      fd.append('id_document', idFile, idFile.name);

      const r = await fetch('/api/auth/register', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.success) {
        setStep('submitted');
      } else {
        toast.error(d.message || 'Submission failed');
      }
    } catch {
      toast.error('Network error. Please try again.');
    }
    setSubmitting(false);
  };

  const stepIdx = STEPS.indexOf(step);
  const progressPct = (stepIdx / 4) * 100;
  const districts = form.province ? (RW_DISTRICTS[form.province] || []) : [];

  return (
    <div className="min-h-screen flex">
      {/* Left sidebar */}
      <div
        className="hidden lg:flex flex-col w-80 flex-shrink-0 px-10 py-12"
        style={{ background: '#1a4fa8' }}
      >
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <span className="font-display font-black text-sm text-blue-700">SB</span>
          </div>
          <span className="font-display font-bold text-base text-white">SmartBank AI</span>
        </div>

        <h2 className="font-display font-bold text-2xl text-white mb-2 leading-tight">Open Your Account</h2>
        <p className="text-white/55 text-sm mb-10 leading-relaxed">
          Complete all steps. Reviewed by our KYC team within 1–2 business days.
        </p>

        <div className="space-y-1">
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                stepIdx === i ? 'bg-white/15' : stepIdx > i ? 'opacity-60' : 'opacity-35',
              )}
            >
              <div
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  stepIdx > i ? 'bg-emerald-400 text-white'
                    : stepIdx === i ? 'bg-white text-blue-700'
                    : 'bg-white/20 text-white',
                )}
              >
                {stepIdx > i ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={clsx('text-sm', stepIdx === i ? 'text-white font-semibold' : 'text-white/70')}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-10">
          <div className="bg-white/10 border border-white/15 rounded-xl p-4">
            <Shield size={15} className="text-white/60 mb-2" />
            <p className="text-xs text-white/60 leading-relaxed">
              Documents are encrypted and only accessible to authorized KYC staff for identity verification.
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 dark:border-slate-800">
          <Link
            href="/auth/login"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Login
          </Link>
          <span className="text-xs text-slate-400">Step {Math.min(stepIdx + 1, 4)} of 4</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: '#1a4fa8' }}
          />
        </div>

        <div className="flex-1 flex items-start justify-center p-6 lg:p-10">
          <div className="w-full max-w-xl">

            {/* ════════ STEP 1: Personal Information ════════ */}
            {step === 'info' && (
              <div className="space-y-5 animate-fade-up">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <User size={18} className="text-blue-700 dark:text-blue-400" />
                  </div>
                  <div>
                    <h1 className="font-display font-bold text-xl text-slate-900 dark:text-white">Personal Information</h1>
                    <p className="text-slate-400 text-sm">Enter details exactly as on your National ID</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label className="label">First Name *</label>
                    <input
                      className={clsx('input', errors.first_name && 'input-error')}
                      placeholder="Jean"
                      value={form.first_name}
                      onChange={e => setField('first_name', e.target.value)}
                    />
                    {errors.first_name && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.first_name}</p>}
                  </div>
                  <div className="field">
                    <label className="label">Last Name *</label>
                    <input
                      className={clsx('input', errors.last_name && 'input-error')}
                      placeholder="Habimana"
                      value={form.last_name}
                      onChange={e => setField('last_name', e.target.value)}
                    />
                    {errors.last_name && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.last_name}</p>}
                  </div>
                </div>

                <div className="field">
                  <label className="label">Email Address *</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className={clsx('input pl-9', errors.email && 'input-error')}
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={e => setField('email', e.target.value)}
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.email}</p>}
                  <p className="text-xs text-slate-400 mt-1">Approval credentials will be sent to this email</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label className="label">Phone Number *</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className={clsx('input pl-9', errors.phone && 'input-error')}
                        placeholder="+250788000000"
                        value={form.phone}
                        onChange={e => setField('phone', e.target.value)}
                      />
                    </div>
                    {errors.phone && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.phone}</p>}
                  </div>
                  <div className="field">
                    <label className="label">Date of Birth *</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className={clsx('input pl-9', errors.date_of_birth && 'input-error')}
                        type="date"
                        value={form.date_of_birth}
                        onChange={e => setField('date_of_birth', e.target.value)}
                      />
                    </div>
                    {errors.date_of_birth && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.date_of_birth}</p>}
                  </div>
                </div>

                <div className="field">
                  <label className="label">National ID Number *</label>
                  <div className="relative">
                    <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className={clsx('input pl-9 font-mono tracking-wider', errors.national_id && 'input-error')}
                      placeholder="1199800000000001"
                      maxLength={16}
                      value={form.national_id}
                      onChange={e => setField('national_id', e.target.value)}
                    />
                  </div>
                  {errors.national_id && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.national_id}</p>}
                </div>

                <div className="alert-info text-xs">
                  <Info size={13} className="flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>No password required now.</strong> After KYC approval you will receive a unique account number
                    and a one-time temporary password by email.
                  </span>
                </div>

                <button onClick={() => validateInfo() && setStep('address')} className="btn-primary w-full btn-lg">
                  Continue — Enter Address <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* ════════ STEP 2: Address & Branch ════════ */}
            {step === 'address' && (
              <div className="space-y-4 animate-fade-up">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <MapPin size={18} className="text-blue-700 dark:text-blue-400" />
                  </div>
                  <div>
                    <h1 className="font-display font-bold text-xl text-slate-900 dark:text-white">Address & Branch</h1>
                    <p className="text-slate-400 text-sm">Your Rwanda address and preferred branch</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label className="label">Province *</label>
                    <select
                      className={clsx('input', errors.province && 'input-error')}
                      value={form.province}
                      onChange={e => { setField('province', e.target.value); setField('district', ''); }}
                    >
                      <option value="">Select Province</option>
                      {RW_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {errors.province && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.province}</p>}
                  </div>
                  <div className="field">
                    <label className="label">District *</label>
                    <select
                      className={clsx('input', errors.district && 'input-error')}
                      value={form.district}
                      onChange={e => setField('district', e.target.value)}
                      disabled={!form.province}
                    >
                      <option value="">Select District</option>
                      {districts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {errors.district && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.district}</p>}
                  </div>
                  <div className="field">
                    <label className="label">Sector *</label>
                    <input
                      className={clsx('input', errors.sector && 'input-error')}
                      placeholder="e.g. Kimironko"
                      value={form.sector}
                      onChange={e => setField('sector', e.target.value)}
                    />
                    {errors.sector && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.sector}</p>}
                  </div>
                  <div className="field">
                    <label className="label">Village *</label>
                    <input
                      className={clsx('input', errors.village && 'input-error')}
                      placeholder="e.g. Urugwiro"
                      value={form.village}
                      onChange={e => setField('village', e.target.value)}
                    />
                    {errors.village && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.village}</p>}
                  </div>
                </div>

                <div className="field">
                  <label className="label">Street Address (Optional)</label>
                  <input
                    className="input"
                    placeholder="House No., Street Name"
                    value={form.address}
                    onChange={e => setField('address', e.target.value)}
                  />
                </div>

                {/* Branch selection */}
                <div className="field">
                  <label className="label">
                    Preferred Branch
                    <span className="ml-1.5 text-[11px] text-slate-400 font-normal normal-case tracking-normal">(optional)</span>
                  </label>

                  {/* Smart description based on selection state */}
                  {form.district ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
                      <MapPin size={11} className="text-emerald-500" />
                      Showing branches nearest to <strong>{form.district}</strong> first
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mb-2.5">
                      Select your district above to see nearest branches
                    </p>
                  )}

                  {/* Sorted branches — nearest first */}
                  {(() => {
                    // Sort: exact district match first, then same province, then rest
                    const sorted = [...branches].sort((a, b) => {
                      const aExact = a.district === form.district;
                      const bExact = b.district === form.district;
                      const aProv = a.province === form.province;
                      const bProv = b.province === form.province;
                      if (aExact && !bExact) return -1;
                      if (!aExact && bExact) return 1;
                      if (aProv && !bProv) return -1;
                      if (!aProv && bProv) return 1;
                      return a.name.localeCompare(b.name);
                    });

                    const nearestId = sorted[0]?.id;

                    return (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                        {sorted.map((b, idx) => {
                          const isExact = b.district === form.district;
                          const isSameProv = !isExact && b.province === form.province;
                          const isSelected = selectedBranch === b.id;

                          return (
                            <label
                              key={b.id}
                              className={clsx(
                                'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                                isSelected
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/15'
                                  : isExact
                                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-900/10 hover:border-emerald-400'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-blue-300',
                              )}
                            >
                              <input
                                type="radio"
                                name="branch"
                                value={b.id}
                                checked={isSelected}
                                onChange={() => setSelectedBranch(b.id)}
                                className="sr-only"
                              />
                              {/* Radio indicator */}
                              <div
                                className={clsx(
                                  'w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all',
                                  isSelected ? 'border-blue-500 bg-blue-500' : isExact ? 'border-emerald-400' : 'border-slate-300',
                                )}
                              >
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full m-auto mt-px" />}
                              </div>

                              {/* Branch info */}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{b.name}</p>
                                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                  <MapPin size={10} />
                                  {b.district || b.location}
                                  {b.province ? ` · ${b.province}` : ''}
                                </p>
                                {b.address && <p className="text-xs text-slate-400">{b.address}</p>}
                                {b.phone && <p className="text-xs text-slate-400">{b.phone}</p>}
                              </div>

                              {/* Badges */}
                              <div className="flex flex-col gap-1 flex-shrink-0">
                                {isExact && (
                                  <span className="badge-green text-[10px]">Nearest</span>
                                )}
                                {isSameProv && !isExact && (
                                  <span className="badge-blue text-[10px]">Same Province</span>
                                )}
                                {idx === 0 && !isExact && form.district && (
                                  <span className="badge-amber text-[10px]">Closest</span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Skip option */}
                  {!selectedBranch && (
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      You can select a branch later in your account settings
                    </p>
                  )}
                  {selectedBranch && (
                    <button
                      type="button"
                      onClick={() => setSelectedBranch('')}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-1.5 underline"
                    >
                      Clear selection
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep('info')} className="btn-secondary flex-1">
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button onClick={() => validateAddress() && setStep('photo')} className="btn-primary flex-1 btn-lg">
                    Take Passport Photo <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* ════════ STEP 3: Live Camera ════════ */}
            {step === 'photo' && (
              <div className="space-y-4 animate-fade-up">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <Camera size={18} className="text-blue-700 dark:text-blue-400" />
                  </div>
                  <div>
                    <h1 className="font-display font-bold text-xl text-slate-900 dark:text-white">Live Passport Photo</h1>
                    <p className="text-slate-400 text-sm">Must be live — no uploads or screenshots accepted</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Good Lighting', 'Face a bright light source'],
                    ['Look Straight', 'Eyes open, facing camera'],
                    ['Plain Background', 'White or light wall'],
                  ].map(([title, desc]) => (
                    <div key={title} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>

                {!passportPreview ? (
                  <div className="space-y-3">
                    {cameraError && (
                      <div className="alert-error">
                        <AlertCircle size={15} className="flex-shrink-0" />
                        <span>{cameraError}</span>
                      </div>
                    )}
                    <div
                      className="relative bg-slate-900 rounded-2xl overflow-hidden"
                      style={{ aspectRatio: '4/3' }}
                    >
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        style={facing === 'user' ? { transform: 'scaleX(-1)' } : {}}
                        muted
                        playsInline
                        autoPlay
                      />
                      <canvas ref={canvasRef} className="hidden" />

                      {cameraActive && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div
                            className="w-44 h-56 border-2 border-white/60 rounded-full"
                            style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}
                          />
                          <p className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-xs">
                            Centre your face in the oval
                          </p>
                        </div>
                      )}

                      {countdown > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                            <span className="font-display font-black text-5xl text-white">{countdown}</span>
                          </div>
                        </div>
                      )}

                      {!cameraActive && !cameraError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                          <div className="text-center text-slate-500">
                            <Camera size={36} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Camera loading...</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {cameraActive && (
                        <button onClick={flipCamera} className="btn-secondary btn-icon">
                          <RefreshCw size={15} />
                        </button>
                      )}
                      {!cameraActive && (
                        <button onClick={() => startCamera()} className="btn-primary flex-1 btn-lg">
                          <Camera size={17} /> Start Camera
                        </button>
                      )}
                      {cameraActive && (
                        <button
                          onClick={capturePhoto}
                          disabled={countdown > 0}
                          className="btn-primary flex-1 btn-lg"
                        >
                          <Camera size={17} />
                          {countdown > 0 ? `Capturing in ${countdown}...` : 'Capture Photo'}
                        </button>
                      )}
                      {cameraError && (
                        <button onClick={() => startCamera()} className="btn-primary flex-1">
                          <RefreshCw size={15} /> Retry
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <img
                        src={passportPreview}
                        alt="Passport"
                        className="w-full rounded-2xl border-4 border-emerald-400 object-cover"
                        style={{ aspectRatio: '4/3' }}
                      />
                      <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                        <CheckCircle size={12} /> Photo Captured
                      </div>
                    </div>
                    <div className="ai-card-success text-xs">
                      <CheckCircle size={13} className="flex-shrink-0 mt-0.5" />
                      <span>Photo looks good? Make sure your face is clearly visible, well-lit, and eyes are open.</span>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={retakePhoto} className="btn-secondary flex-1">
                        <RefreshCw size={14} /> Retake
                      </button>
                      <button onClick={() => setStep('document')} className="btn-primary flex-1">
                        Use This Photo <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                <button onClick={() => setStep('address')} className="btn-ghost w-full text-sm">
                  <ArrowLeft size={14} /> Back
                </button>
              </div>
            )}

            {/* ════════ STEP 4: ID Document Upload ════════ */}
            {step === 'document' && (
              <div className="space-y-4 animate-fade-up">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <FileText size={18} className="text-blue-700 dark:text-blue-400" />
                  </div>
                  <div>
                    <h1 className="font-display font-bold text-xl text-slate-900 dark:text-white">Upload ID Document</h1>
                    <p className="text-slate-400 text-sm">National ID (both sides) or Passport data page</p>
                  </div>
                </div>

                <input
                  ref={idInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleIdFile(e.target.files[0]); }}
                />

                {!idPreview ? (
                  <div
                    className="dropzone py-12"
                    onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleIdFile(e.dataTransfer.files[0]); }}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => idInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                        <Upload size={28} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Drag & drop or click to browse</p>
                        <p className="text-sm text-slate-400 mb-2">National ID (front + back) or Passport</p>
                        <div className="flex gap-1.5 justify-center">
                          {['JPG', 'PNG', 'PDF', 'max 15MB'].map(f => (
                            <span key={f} className="badge-gray text-[10px]">{f}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {idFile?.type === 'application/pdf' ? (
                      <div className="flex items-center gap-4 p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border-2 border-emerald-400">
                        <FileText size={32} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{idFile.name}</p>
                          <p className="text-xs text-slate-400">{(idFile.size / 1024).toFixed(0)} KB · PDF Document</p>
                        </div>
                        <CheckCircle size={20} className="text-emerald-500 flex-shrink-0" />
                      </div>
                    ) : (
                      <div className="relative rounded-xl overflow-hidden border-2 border-emerald-400">
                        <img src={idPreview} alt="ID Document" className="w-full object-cover max-h-64" />
                        <div className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                          <CheckCircle size={12} /> Uploaded
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => { setIdFile(null); setIdPreview(''); }}
                      className="w-full mt-2 btn-ghost text-sm text-red-500 hover:text-red-700"
                    >
                      <X size={13} /> Remove &amp; upload different document
                    </button>
                  </div>
                )}

                <div className="alert-info text-xs">
                  <Shield size={13} className="flex-shrink-0 mt-0.5" />
                  <span>Your ID is encrypted and only viewed by authorized bank staff for identity verification.</span>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep('photo')} className="btn-secondary flex-1">
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button
                    onClick={() => { if (!idFile) { toast.error('Please upload your ID document'); return; } setStep('review'); }}
                    className="btn-primary flex-1 btn-lg"
                  >
                    Review Application <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* ════════ STEP 5: Review ════════ */}
            {step === 'review' && (
              <div className="space-y-4 animate-fade-up">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <CheckCircle size={18} className="text-blue-700 dark:text-blue-400" />
                  </div>
                  <div>
                    <h1 className="font-display font-bold text-xl text-slate-900 dark:text-white">Review &amp; Submit</h1>
                    <p className="text-slate-400 text-sm">Confirm all details before submitting</p>
                  </div>
                </div>

                <div className="card">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Personal Information</p>
                  {[
                    ['Full Name', `${form.first_name} ${form.last_name}`],
                    ['Email', form.email],
                    ['Phone', form.phone],
                    ['National ID', form.national_id],
                    ['Date of Birth', form.date_of_birth ? new Date(form.date_of_birth).toLocaleDateString() : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-none">
                      <span className="text-slate-400">{k}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{v}</span>
                    </div>
                  ))}
                  <button onClick={() => setStep('info')} className="btn-ghost btn-sm mt-2 text-xs text-blue-600 dark:text-blue-400">
                    Edit
                  </button>
                </div>

                <div className="card">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Address &amp; Branch</p>
                  {[
                    ['Province', form.province],
                    ['District', form.district],
                    ['Sector', form.sector],
                    ['Village', form.village],
                    ['Branch', branches.find(b => b.id === selectedBranch)?.name || '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-none">
                      <span className="text-slate-400">{k}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{v}</span>
                    </div>
                  ))}
                  <button onClick={() => setStep('address')} className="btn-ghost btn-sm mt-2 text-xs text-blue-600 dark:text-blue-400">
                    Edit
                  </button>
                </div>

                <div className="card">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Documents</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-2">Passport Photo</p>
                      {passportPreview ? (
                        <div className="relative">
                          <img src={passportPreview} alt="Passport" className="w-full h-28 object-cover rounded-xl border-2 border-emerald-400" />
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <CheckCircle size={12} className="text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-28 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                          <Camera size={20} className="text-slate-300" />
                        </div>
                      )}
                      <button onClick={() => setStep('photo')} className="text-[11px] text-blue-600 dark:text-blue-400 mt-1.5">Retake</button>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-2">ID Document</p>
                      {idPreview && idFile?.type !== 'application/pdf' ? (
                        <div className="relative">
                          <img src={idPreview} alt="ID" className="w-full h-28 object-cover rounded-xl border-2 border-emerald-400" />
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <CheckCircle size={12} className="text-white" />
                          </div>
                        </div>
                      ) : idFile ? (
                        <div className="w-full h-28 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border-2 border-emerald-400 flex flex-col items-center justify-center">
                          <FileText size={20} className="text-emerald-500" />
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">PDF</p>
                        </div>
                      ) : (
                        <div className="w-full h-28 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                          <FileText size={20} className="text-slate-300" />
                        </div>
                      )}
                      <button onClick={() => setStep('document')} className="text-[11px] text-blue-600 dark:text-blue-400 mt-1.5">Replace</button>
                    </div>
                  </div>
                </div>

                <div className="alert-warning text-xs">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>By submitting you confirm all information is accurate. False information will result in rejection.</span>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep('document')} className="btn-secondary flex-1">
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button onClick={submit} disabled={submitting} className="btn-primary flex-1 btn-lg">
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <><CheckCircle size={15} /> Submit Application</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ════════ SUBMITTED ════════ */}
            {step === 'submitted' && (
              <div className="text-center py-8 animate-fade-up">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle size={40} className="text-emerald-500" />
                </div>
                <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-white mb-2">Application Submitted!</h1>
                <p className="text-slate-400 text-sm mb-6">
                  Your application is under review. Expect a response within 1–2 business days.
                </p>

                <div className="card text-left mb-5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">What Happens Next</p>
                  {[
                    [Clock, 'Branch Review (1–2 days)', 'Your assigned branch manager verifies your documents'],
                    [Mail, 'Email Notification', `Approval status sent to ${form.email}`],
                    [CreditCard, 'Account Credentials', 'If approved: unique account number + one-time password'],
                    [Shield, 'First Login', 'Log in with temp credentials and set your permanent password'],
                  ].map(([IconComp, title, desc]: any) => (
                    <div key={title} className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-none">
                      <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconComp size={14} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="alert-warning text-xs mb-5">
                  <Info size={13} className="flex-shrink-0 mt-0.5" />
                  <span>
                    Watch <strong>{form.email}</strong> (including spam folder) for your one-time login credentials.
                  </span>
                </div>

                <Link href="/auth/login" className="btn-primary w-full btn-lg justify-center">
                  Back to Login
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
