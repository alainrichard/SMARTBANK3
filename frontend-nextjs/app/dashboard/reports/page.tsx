'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { getMyTransactions, getAllTransactions, getAccounts, getCreditScore } from '@/lib/api';
import { exportToExcel, exportToPDF, exportToWord } from '@/lib/exports';
import { FileSpreadsheet, FileText, File, Printer, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import clsx from 'clsx';

function fmtNum(n: any) { return Number(n || 0).toLocaleString('en-RW'); }

const COLORS = ['#3b5bdb', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];

export default function ReportsPage() {
  const { user, lang } = useApp();
  const [txns, setTxns] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditScore, setCreditScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');

  const isAdmin = ['super_admin', 'branch_manager', 'fraud_analyst', 'auditor'].includes(user?.role || '');

  useEffect(() => {
    (async () => {
      try {
        const [txR, acR] = await Promise.all([
          isAdmin ? getAllTransactions({ limit: 500 }) : getMyTransactions({ limit: 500 }),
          getAccounts(),
        ]);
        setTxns(txR.data?.data?.transactions || []);
        setAccounts(acR.data?.data?.accounts || []);
        if (!isAdmin) {
          const csR = await getCreditScore();
          setCreditScore(csR.data?.data);
        }
      } catch {}
      setLoading(false);
    })();
  }, [isAdmin]);

  const completed = txns.filter(t => t.status === 'completed');
  const flagged = txns.filter(t => t.is_flagged || t.status === 'flagged');
  const pending = txns.filter(t => t.status === 'pending');
  const totalVol = completed.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const totalBal = accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);

  // Type breakdown for chart
  const byType: Record<string, number> = {};
  txns.forEach(tx => { byType[tx.type] = (byType[tx.type] || 0) + 1; });
  const typeData = Object.entries(byType).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

  // Status pie
  const statusData = [
    { name: 'Completed', value: completed.length },
    { name: 'Flagged', value: flagged.length },
    { name: 'Pending', value: pending.length },
  ].filter(d => d.value > 0);

  const doExcelExport = async () => {
    setExporting('excel');
    try {
      const rows = txns.map(tx => ({
        Reference: tx.reference || '—',
        From: tx.sender_name || '—',
        To: tx.receiver_name || '—',
        Amount_RWF: Number(tx.amount || 0),
        Type: tx.type || '—',
        Status: tx.status || '—',
        'AI Score': tx.fraud_score != null ? `${(tx.fraud_score * 100).toFixed(0)}%` : '—',
        Date: tx.created_at ? new Date(tx.created_at).toLocaleString() : '—',
      }));
      await exportToExcel(rows, `SmartBank_Transactions_${new Date().toISOString().slice(0, 10)}`, 'Transactions');
      toast.success('Excel exported!');
    } catch { toast.error('Export failed'); }
    setExporting('');
  };

  const doPDFExport = async () => {
    setExporting('pdf');
    try {
      const cols = ['Reference', 'From', 'To', 'Amount (RWF)', 'Type', 'Status', 'Date'];
      const rows = txns.slice(0, 200).map(tx => [
        tx.reference?.slice(0, 16) || '—',
        tx.sender_name || '—',
        tx.receiver_name || '—',
        fmtNum(tx.amount),
        (tx.type || '').replace(/_/g, ' '),
        tx.status || '—',
        tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—',
      ]);
      await exportToPDF('Transaction Report', cols, rows, `SmartBank_Report_${new Date().toISOString().slice(0, 10)}`);
      toast.success('PDF exported!');
    } catch { toast.error('Export failed'); }
    setExporting('');
  };

  const doWordExport = async () => {
    setExporting('word');
    try {
      const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } = await import('docx');
      const summaryRows = [
        new Paragraph({ children: [new TextRun({ text: `Report Date: ${new Date().toLocaleString()}`, size: 20, color: '7B88A8' })] }),
        new Paragraph({ children: [new TextRun({ text: `Total Transactions: ${txns.length}`, bold: true, size: 22 })] }),
        new Paragraph({ children: [new TextRun({ text: `Total Volume: ${fmtNum(totalVol)} RWF`, bold: true, size: 22 })] }),
        new Paragraph({ children: [new TextRun({ text: `Completed: ${completed.length} | Flagged: ${flagged.length} | Pending: ${pending.length}`, size: 20 })] }),
        new Paragraph({ text: '' }),
      ];
      await exportToWord('Transaction Report', summaryRows, `SmartBank_Report_${new Date().toISOString().slice(0, 10)}`);
      toast.success('Word document exported!');
    } catch { toast.error('Export failed'); }
    setExporting('');
  };

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="font-display font-bold text-2xl">{t('reports', lang)}</h1>
          <p className="text-slate-400 text-sm">Generated {new Date().toLocaleDateString('en-RW', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={doExcelExport} disabled={!!exporting} className="btn-success btn-sm flex items-center gap-1.5">
            <FileSpreadsheet size={14} />{exporting === 'excel' ? 'Exporting...' : t('exportExcel', lang)}
          </button>
          <button onClick={doPDFExport} disabled={!!exporting} className="btn-danger btn-sm flex items-center gap-1.5">
            <FileText size={14} />{exporting === 'pdf' ? 'Exporting...' : t('exportPDF', lang)}
          </button>
          <button onClick={doWordExport} disabled={!!exporting} className="btn-primary btn-sm flex items-center gap-1.5">
            <File size={14} />{exporting === 'word' ? 'Exporting...' : t('exportWord', lang)}
          </button>
          <button onClick={() => window.print()} className="btn-outline btn-sm flex items-center gap-1.5">
            <Printer size={14} />{t('print', lang)}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {!isAdmin && (
          <div className="stat-card bg-slate-900 dark:bg-slate-800 text-center">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Balance</p>
            <p className="font-display font-black text-2xl text-white">{fmtNum(totalBal)}</p>
            <p className="text-xs text-white/40 mt-1">RWF</p>
          </div>
        )}
        <div className="stat-card text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Transactions</p>
          <p className="font-display font-black text-3xl text-blue-600">{txns.length}</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Volume</p>
          <p className="font-display font-black text-2xl text-teal-600">{fmtNum(totalVol)}</p>
          <p className="text-xs text-slate-400">RWF</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Flagged</p>
          <p className="font-display font-black text-3xl text-red-600">{flagged.length}</p>
        </div>
        {!isAdmin && creditScore && (
          <div className="stat-card text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Credit Score</p>
            <p className="font-display font-black text-3xl text-brand-600">{creditScore.credit_score || '—'}</p>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-display font-bold text-base mb-4">Transactions by Type</h3>
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeData} margin={{ left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 text-sm text-center py-8">No data</p>}
        </div>

        <div className="card">
          <h3 className="font-display font-bold text-base mb-4">Status Distribution</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {statusData.map((_, i) => <Cell key={i} fill={['#10b981', '#ef4444', '#f59e0b'][i % 3]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 text-sm text-center py-8">No data</p>}
        </div>
      </div>

      {/* Completion rate */}
      <div className="card">
        <h3 className="font-display font-bold text-base mb-4">Summary</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            ['Completed', completed.length, 'text-emerald-600', <CheckCircle key="c" size={16} className="text-emerald-500" />],
            ['Flagged', flagged.length, 'text-red-600', <AlertTriangle key="f" size={16} className="text-red-500" />],
            ['Pending', pending.length, 'text-amber-600', null],
            ['Success Rate', txns.length ? `${((completed.length / txns.length) * 100).toFixed(0)}%` : '—', 'text-blue-600', null],
          ].map(([label, val, color, icon]) => (
            <div key={label as string} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
              {icon}
              <div><p className={clsx('font-display font-black text-xl', color as string)}>{val as any}</p><p className="text-xs text-slate-400 mt-0.5">{label as string}</p></div>
            </div>
          ))}
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Completion rate</span><span className="font-semibold">{txns.length ? ((completed.length / txns.length) * 100).toFixed(0) : 0}%</span></div>
          <div className="progress h-3 rounded-full"><div className="progress-bar rounded-full bg-emerald-500" style={{ width: `${txns.length ? (completed.length / txns.length) * 100 : 0}%` }} /></div>
        </div>
      </div>

      {/* Transactions table */}
      <div className="card" id="print-area">
        <div className="section-title">
          <h3 className="font-display font-bold text-base">Transaction Details (latest 50)</h3>
          <span className="badge-gray">{txns.length} total</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>{t('reference', lang)}</th><th>{t('from', lang)}</th><th>{t('to', lang)}</th>
              <th>{t('amount', lang)}</th><th>{t('type', lang)}</th><th>{t('status', lang)}</th>
              {isAdmin && <th>AI Score</th>}
              <th>{t('date', lang)}</th>
            </tr></thead>
            <tbody>
              {txns.slice(0, 50).map((tx: any) => (
                <tr key={tx.id}>
                  <td><span className="font-mono text-xs text-slate-400">{tx.reference?.slice(0, 16) || '—'}</span></td>
                  <td className="text-xs">{tx.sender_name || '—'}</td>
                  <td className="text-xs">{tx.receiver_name || '—'}</td>
                  <td><span className="font-mono font-semibold text-sm">{fmtNum(tx.amount)}</span> <span className="text-xs text-slate-400">RWF</span></td>
                  <td><span className="badge badge-gray capitalize text-xs">{(tx.type || '').replace(/_/g, ' ')}</span></td>
                  <td><span className={clsx('badge text-xs', { 'badge-green': tx.status === 'completed', 'badge-red': tx.status === 'flagged' || tx.is_flagged, 'badge-amber': tx.status === 'pending', 'badge-gray': !tx.status })}>{tx.status || '—'}</span></td>
                  {isAdmin && <td className="text-xs">{tx.fraud_score != null ? `${(tx.fraud_score * 100).toFixed(0)}%` : '—'}</td>}
                  <td className="text-xs text-slate-400">{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {txns.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-8">{t('noTransactions', lang)}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@media print { .topbar button { display:none!important } }`}</style>
    </div>
  );
}
