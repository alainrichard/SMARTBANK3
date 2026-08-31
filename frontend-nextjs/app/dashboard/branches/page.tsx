'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useApp } from '@/contexts/AppContext';
import { getBranches, createBranch, getUsers } from '@/lib/api';
import { GitBranch, Plus, MapPin, Users, Phone, Mail, X, UserCheck, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

const RW_PROVINCES = ['Kigali', 'Northern Province', 'Southern Province', 'Eastern Province', 'Western Province'];
const RW_DISTRICTS: Record<string, string[]> = {
  'Kigali': ['Gasabo', 'Kicukiro', 'Nyarugenge'],
  'Northern Province': ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo'],
  'Southern Province': ['Gisagara', 'Huye', 'Kamonyi', 'Muhanga', 'Nyamagabe', 'Nyanza', 'Nyaruguru', 'Ruhango'],
  'Eastern Province': ['Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Rwamagana'],
  'Western Province': ['Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke', 'Rubavu', 'Rutsiro', 'Rusizi'],
};

export default function BranchesPage() {
  const { user } = useApp();
  const [branches, setBranches] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [assignModal, setAssignModal] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '', province: '', district: '', location: '', address: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [selectedMgr, setSelectedMgr] = useState('');

  const load = async () => {
    const [bR, uR] = await Promise.all([
      getBranches().catch(() => ({ data: { data: { branches: [] } } })),
      getUsers({ role: 'branch_manager' }).catch(() => ({ data: { data: { users: [] } } })),
    ]);
    setBranches(bR.data?.data?.branches || []);
    setManagers((uR.data?.data?.users || []).filter((u: any) => u.role === 'branch_manager'));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.code || !form.province || !form.district) {
      toast.error('Name, code, province and district are required'); return;
    }
    setSaving(true);
    try {
      const { data } = await createBranch({ ...form, code: form.code.toUpperCase() });
      if (data.success) { toast.success('Branch created!'); setShowAdd(false); setForm({ name: '', code: '', province: '', district: '', location: '', address: '', phone: '', email: '' }); load(); }
      else toast.error(data.message || 'Failed');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    setSaving(false);
  };

  const assignManager = async () => {
    if (!selectedMgr) { toast.error('Select a manager'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/branches/assign-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: JSON.stringify({ branch_id: assignModal.id, manager_id: selectedMgr }),
      });
      const d = await r.json();
      if (d.success) { toast.success(d.message); setAssignModal(null); setSelectedMgr(''); load(); }
      else toast.error(d.message || 'Failed');
    } catch { toast.error('Failed'); }
    setSaving(false);
  };

  if (loading) return <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-48 rounded-xl" />)}</div>;

  const isAdmin = user?.role === 'super_admin';

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="font-display font-bold text-xl">Branch Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">{branches.length} branches across Rwanda</p></div>
        {isAdmin && <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={15} /> Add Branch</button>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((b: any) => {
          const mgr = managers.find(m => m.id === b.manager_id);
          return (
            <div key={b.id} className="card">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-display font-bold text-base text-slate-900 dark:text-white">{b.name}</p>
                  <p className="font-mono text-xs text-slate-400 mt-0.5">{b.code}</p>
                </div>
                <span className={clsx('badge', b.is_active ? 'badge-green' : 'badge-red')}>{b.is_active ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="space-y-2">
                {[
                  [MapPin, `${b.district || b.location || '—'}${b.province ? `, ${b.province}` : ''}`],
                  [Phone, b.phone || '—'],
                  [Mail, b.email || '—'],
                  [Users, `${b.staff_count || 0} staff · ${b.account_count || 0} accounts`],
                ].map(([Icon, val]: any) => (
                  <div key={val} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Icon size={13} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate">{val}</span>
                  </div>
                ))}
                {/* Manager */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <UserCheck size={13} className="text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {mgr ? `${mgr.first_name} ${mgr.last_name}` : 'No manager assigned'}
                    </span>
                  </div>
                  {isAdmin && (
                    <button onClick={() => { setAssignModal(b); setSelectedMgr(b.manager_id || ''); }}
                      className="btn-ghost btn-sm text-xs text-blue-600 dark:text-blue-400">
                      {mgr ? 'Change' : 'Assign'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Branch Modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal-box">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700">
              <div><h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">Add New Branch</h2>
                <p className="text-sm text-slate-400 mt-0.5">Create a new SmartBank branch</p></div>
              <button onClick={() => setShowAdd(false)} className="btn-ghost btn-icon"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              {[['name','Branch Name *','Musanze Branch'],['code','Branch Code *','MSZ002']].map(([k,l,p])=>(
                <div key={k} className="field"><label className="label">{l}</label><input className="input" placeholder={p} value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/></div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div className="field"><label className="label">Province *</label>
                  <select className="input" value={form.province} onChange={e=>setForm(f=>({...f,province:e.target.value,district:''}))}>
                    <option value="">Select</option>{RW_PROVINCES.map(p=><option key={p} value={p}>{p}</option>)}
                  </select></div>
                <div className="field"><label className="label">District *</label>
                  <select className="input" value={form.district} onChange={e=>setForm(f=>({...f,district:e.target.value}))} disabled={!form.province}>
                    <option value="">Select</option>{(RW_DISTRICTS[form.province]||[]).map(d=><option key={d} value={d}>{d}</option>)}
                  </select></div>
              </div>
              {[['address','Address','Street, City'],['phone','Phone','+250788000001'],['email','Email','branch@smartbank.rw']].map(([k,l,p])=>(
                <div key={k} className="field"><label className="label">{l}</label><input className="input" placeholder={p} value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}/></div>
              ))}
            </div>
            <div className="flex justify-end gap-2 px-6 pb-6">
              <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Branch'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Manager Modal */}
      {assignModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setAssignModal(null)}>
          <div className="modal-box" style={{ maxWidth: 460 }}>
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700">
              <div><h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">Assign Branch Manager</h2>
                <p className="text-sm text-slate-400 mt-0.5">{assignModal.name}</p></div>
              <button onClick={() => setAssignModal(null)} className="btn-ghost btn-icon"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">Select a branch manager to assign to this branch. They will only see data related to this branch.</p>
              <div className="space-y-2">
                {managers.length === 0 ? (
                  <p className="text-sm text-slate-400">No branch managers found. Create a staff member with the Branch Manager role first.</p>
                ) : managers.map((m: any) => (
                  <label key={m.id} className={clsx('flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                    selectedMgr === m.id ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300')}>
                    <input type="radio" name="mgr" value={m.id} checked={selectedMgr === m.id} onChange={() => setSelectedMgr(m.id)} className="sr-only"/>
                    <div className={clsx('w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',selectedMgr===m.id?'border-blue-500 bg-blue-500':'border-slate-300')}>
                      {selectedMgr===m.id&&<div className="w-2 h-2 bg-white rounded-full m-auto mt-[1px]"/>}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{m.first_name} {m.last_name}</p>
                      <p className="text-xs text-slate-400">{m.email} · {m.branch_name || 'Unassigned'}</p>
                    </div>
                    {m.branch_id === assignModal.id && <span className="badge-green text-[10px]">Current</span>}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 pb-6">
              <button onClick={() => setAssignModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={assignManager} disabled={saving || !selectedMgr} className="btn-primary">
                {saving ? 'Assigning...' : <><CheckCircle size={14}/>Assign Manager</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
