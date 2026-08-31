'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import {
  getAdvancedCredit, getCustomerBehavior, getFinancialPlanning,
  getSpendingAnalysis, getFinancialAdvice,
} from '@/lib/api';
import {
  Brain, TrendingUp, TrendingDown, Shield, AlertTriangle, CheckCircle,
  Info, Zap, Target, PieChart as PieIcon, BarChart2, Lock,
  Activity, DollarSign, Star, ArrowUpRight,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar,
} from 'recharts';
import clsx from 'clsx';

function fmtRWF(n: any) { return `${Number(n || 0).toLocaleString('en-RW')} RWF`; }
function fmtNum(n: any) { return Number(n || 0).toLocaleString('en-RW'); }

const CHART_COLORS = ['#1a4fa8', '#7c3aed', '#db2777', '#d97706', '#059669', '#0891b2', '#dc2626'];

function ScoreGauge({ score, max = 100, label, color }: any) {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{score}</span>
      </div>
      <div className="progress h-2">
        <div className="progress-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const cls = score >= 0.7 ? 'risk-high' : score >= 0.4 ? 'risk-medium' : 'risk-low';
  const label = score >= 0.7 ? 'High' : score >= 0.4 ? 'Medium' : 'Low';
  return (
    <div className="flex items-center gap-2">
      <span className={cls}>{pct}% — {label} Risk</span>
      <div className="flex-1 progress h-1.5">
        <div
          className="progress-bar"
          style={{
            width: `${pct}%`,
            background: score >= 0.7 ? '#dc2626' : score >= 0.4 ? '#d97706' : '#059669',
          }}
        />
      </div>
    </div>
  );
}

const TABS = [
  { id: 'overview',    label: 'Overview',       icon: BarChart2 },
  { id: 'credit',      label: 'Credit Scoring',  icon: TrendingUp },
  { id: 'behavior',    label: 'Behavior',        icon: Activity },
  { id: 'planning',    label: 'Financial Plan',  icon: Target },
  { id: 'compliance',  label: 'Compliance',      icon: Lock },
];

export default function AnalyticsPage() {
  const { lang } = useApp();
  const [activeTab, setActiveTab] = useState('overview');
  const [credit, setCredit] = useState<any>(null);
  const [behavior, setBehavior] = useState<any>(null);
  const [planning, setPlanning] = useState<any>(null);
  const [spending, setSpending] = useState<any>(null);
  const [advice, setAdvice] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getAdvancedCredit(),
      getCustomerBehavior(),
      getFinancialPlanning(),
      getSpendingAnalysis(),
      getFinancialAdvice(),
    ]).then(([cr, bh, pl, sp, ad]) => {
      if (cr.status === 'fulfilled') setCredit(cr.value.data?.data);
      if (bh.status === 'fulfilled') setBehavior(bh.value.data?.data);
      if (pl.status === 'fulfilled') setPlanning(pl.value.data?.data);
      if (sp.status === 'fulfilled') setSpending(sp.value.data?.data);
      if (ad.status === 'fulfilled') setAdvice(ad.value.data?.data?.advice || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  const score = credit?.credit_score || 0;
  const risk = credit?.risk_level || 'unknown';
  const scoreColor = score >= 700 ? '#059669' : score >= 550 ? '#d97706' : '#dc2626';
  const scoreLabel = score >= 750 ? 'Excellent' : score >= 700 ? 'Very Good' : score >= 650 ? 'Good' : score >= 550 ? 'Fair' : 'Poor';
  const cats = spending?.categories || [];
  const factors = credit?.factor_scores || {};

  // Radar data for credit factors
  const radarData = Object.entries(factors).map(([key, val]) => ({
    factor: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    score: val as number,
    fullMark: 100,
  }));

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="font-display font-bold text-xl flex items-center gap-2">
            <Brain size={20} className="text-blue-700 dark:text-blue-400" />
            AI Financial Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Advanced credit scoring · Behavioral analytics · Financial planning · Compliance
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-800">
          <Zap size={12} /> Live AI Analysis
        </span>
      </div>

      {/* Tab navigation */}
      <div className="tab-bar w-full overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx('tab-item flex items-center gap-1.5 whitespace-nowrap', activeTab === tab.id && 'active')}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══ OVERVIEW ═══════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-5 animate-fade-up">
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Credit Score</p>
                <TrendingUp size={15} style={{ color: scoreColor }} />
              </div>
              <p className="font-display font-black text-3xl leading-none" style={{ color: scoreColor }}>{score || '—'}</p>
              <p className="text-xs text-slate-400 mt-1">{scoreLabel} · out of 850</p>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Health Score</p>
                <Star size={15} className="text-amber-500" />
              </div>
              <p className="font-display font-black text-3xl leading-none text-amber-600 dark:text-amber-400">
                {behavior?.health_score || planning?.financial_score || '—'}
              </p>
              <p className="text-xs text-slate-400 mt-1">out of 100</p>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Customer Tier</p>
                <Shield size={15} className="text-blue-600 dark:text-blue-400" />
              </div>
              <p className="font-display font-bold text-lg leading-tight text-blue-700 dark:text-blue-400">
                {behavior?.segment_label || 'Analyzing...'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Based on behavior</p>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Max Loan</p>
                <DollarSign size={15} className="text-emerald-600" />
              </div>
              <p className="font-display font-bold text-base text-emerald-700 dark:text-emerald-400 leading-tight">
                {credit?.max_loan_amount ? fmtRWF(credit.max_loan_amount) : '—'}
              </p>
              <p className="text-xs text-slate-400 mt-1">{credit?.recommended_rate ? `${(credit.recommended_rate * 100).toFixed(0)}% p.a.` : ''}</p>
            </div>
          </div>

          {/* Risk meters */}
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="card">
              <p className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
                <Shield size={15} className="text-blue-600 dark:text-blue-400" /> AI Risk Assessment
              </p>
              <div className="space-y-3">
                {[
                  ['Fraud Risk', credit?.fraud_risk || 0.05],
                  ['AML Risk', credit?.aml_risk || 0.03],
                  ['Behavioral Risk', credit?.behavioral_risk || 0.08],
                ].map(([label, val]: any) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 dark:text-slate-400">{label}</span>
                      <RiskBadge score={val} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-3">Powered by RandomForest + IsolationForest · Updated per transaction</p>
            </div>

            <div className="card">
              <p className="font-display font-semibold text-sm mb-4">Spending by Category</p>
              {cats.length > 0 ? (
                <div className="flex gap-4">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={cats} cx="50%" cy="50%" innerRadius={36} outerRadius={60} dataKey="amount" paddingAngle={3}>
                        {cats.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [fmtRWF(v)]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {cats.slice(0, 5).map((c: any, i: number) => (
                      <div key={c.category} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-slate-600 dark:text-slate-400 flex-1 truncate">{c.category}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{c.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <PieIcon size={28} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Make transactions to see spending breakdown</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Advice cards */}
          {advice.length > 0 && (
            <div className="card">
              <p className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
                <Brain size={15} className="text-blue-600 dark:text-blue-400" /> AI Recommendations
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {advice.map((a: any, i: number) => (
                  <div
                    key={i}
                    className={clsx(
                      'p-3.5 rounded-xl border text-sm',
                      a.priority === 'high'
                        ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-200'
                        : a.priority === 'medium'
                        ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-200'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-200',
                    )}
                  >
                    <p className="flex items-center gap-1.5 font-semibold text-xs mb-1 uppercase tracking-wide opacity-70">
                      {a.priority === 'high' ? <AlertTriangle size={11} /> : a.priority === 'medium' ? <Info size={11} /> : <CheckCircle size={11} />}
                      {a.type} · {a.priority}
                    </p>
                    <p className="text-sm leading-relaxed">{a.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ ADVANCED CREDIT SCORING ══════════════════════════════ */}
      {activeTab === 'credit' && (
        <div className="space-y-5 animate-fade-up">
          <div className="ai-card-info text-xs">
            <Brain size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>Advanced Credit Scoring Algorithm</strong> — incorporates 7 behavioral data sources:
              transaction history, balance patterns, deposit regularity, fraud incidents, loan performance,
              account age, and transaction velocity.
            </span>
          </div>

          <div className="grid lg:grid-cols-5 gap-5">
            {/* Score display */}
            <div className="lg:col-span-2 card flex flex-col items-center justify-center py-6">
              <div className="relative w-36 h-36 mb-4">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke={scoreColor} strokeWidth="10"
                    strokeDasharray={`${((score - 300) / 550) * 314} 314`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display font-black text-3xl" style={{ color: scoreColor }}>{score || '—'}</span>
                  <span className="text-[11px] text-slate-400">/ 850</span>
                </div>
              </div>
              <span className="font-display font-bold text-lg" style={{ color: scoreColor }}>{scoreLabel}</span>
              <span className={clsx('badge mt-2', risk === 'low' ? 'badge-green' : risk === 'high' ? 'badge-red' : 'badge-amber')}>
                {risk} risk
              </span>
              <p className="text-xs text-slate-400 mt-3 text-center">{credit?.recommendation}</p>
            </div>

            {/* Factor scores radar */}
            <div className="lg:col-span-3 card">
              <p className="font-display font-semibold text-sm mb-3">Credit Factor Analysis</p>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="factor" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar dataKey="score" stroke="#1a4fa8" fill="#1a4fa8" fillOpacity={0.2} dot={{ r: 3, fill: '#1a4fa8' }} />
                    <Tooltip formatter={(v: any) => [`${v.toFixed(0)}/100`]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-10 text-slate-400 text-sm">Factor data unavailable</div>
              )}
            </div>
          </div>

          {/* Individual factor breakdown */}
          <div className="card">
            <p className="font-display font-semibold text-sm mb-4">Score Factor Breakdown</p>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
              {Object.entries(factors).map(([key, val]: any) => {
                const color = val >= 80 ? '#059669' : val >= 60 ? '#d97706' : '#dc2626';
                return (
                  <ScoreGauge
                    key={key}
                    label={key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    score={Math.round(val)}
                    color={color}
                  />
                );
              })}
            </div>
          </div>

          {/* Data sources */}
          <div className="card">
            <p className="font-display font-semibold text-sm mb-3">Data Sources Used</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {(credit?.data_sources || ['transaction_history', 'balance_history', 'behavioral_patterns', 'loan_history']).map((src: string) => (
                <div key={src} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 capitalize">{src.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Model: {credit?.model || 'rule_based'} · Generated: {credit?.generated_at ? new Date(credit.generated_at).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>
      )}

      {/* ══ CUSTOMER BEHAVIOR ANALYTICS ═══════════════════════ */}
      {activeTab === 'behavior' && (
        <div className="space-y-5 animate-fade-up">
          <div className="ai-card-info text-xs">
            <Activity size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>Customer Behavior Analytics</strong> — personalizes products and financial advice
              based on your unique spending patterns, transaction velocity, and usage preferences.
            </span>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            {/* Segment */}
            <div className="card text-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Customer Segment</p>
              <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ background: behavior?.segment === 'premium' ? '#fef3c7' : behavior?.segment === 'standard' ? '#dbeafe' : '#f0fdf4' }}>
                <Star size={28} className={behavior?.segment === 'premium' ? 'text-amber-500' : 'text-blue-500'} />
              </div>
              <p className="font-display font-bold text-lg text-slate-900 dark:text-white">{behavior?.segment_label || 'Analyzing...'}</p>
              <p className="text-xs text-slate-400 mt-1">Health score: {behavior?.health_score || '—'}/100</p>
            </div>

            {/* Behavioral insights */}
            <div className="card lg:col-span-2">
              <p className="font-display font-semibold text-sm mb-4">Behavioral Insights</p>
              {behavior?.behavioral_insights ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Peak Hour', `${behavior.behavioral_insights.peak_activity_hour}:00`],
                    ['Avg Transaction', fmtRWF(behavior.behavioral_insights.avg_transaction_amount)],
                    ['Txns (90 days)', behavior.behavioral_insights.total_transactions_90d],
                    ['Bill Payments', behavior.behavioral_insights.bill_payments_90d],
                    ['Transfers Made', behavior.behavioral_insights.transfers_90d],
                    ['Preferred Product', behavior.behavioral_insights.preferred_product?.replace(/_/g, ' ')],
                  ].map(([k, v]) => (
                    <div key={k as string} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <p className="text-[11px] text-slate-400 mb-1">{k as string}</p>
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 capitalize">{v as string}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-6">Make more transactions to generate behavioral insights</p>
              )}
            </div>
          </div>

          {/* Product recommendations */}
          {(behavior?.product_recommendations || []).length > 0 && (
            <div className="card">
              <p className="font-display font-semibold text-sm mb-4">Personalized Product Recommendations</p>
              <div className="space-y-3">
                {behavior.product_recommendations.map((rec: any, i: number) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ArrowUpRight size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{rec.product}</p>
                        <span className={clsx('badge text-[10px]', rec.priority === 'high' ? 'badge-red' : rec.priority === 'medium' ? 'badge-amber' : 'badge-green')}>
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{rec.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financial status */}
          {behavior?.financial_planning && (
            <div className="card">
              <p className="font-display font-semibold text-sm mb-4">Financial Health Status</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Emergency Fund', behavior.financial_planning.emergency_fund_status, behavior.financial_planning.emergency_fund_status === 'adequate' ? 'badge-green' : 'badge-red'],
                  ['Investment Readiness', behavior.financial_planning.investment_readiness, behavior.financial_planning.investment_readiness === 'ready' ? 'badge-green' : 'badge-amber'],
                  ['Monthly Savings Target', fmtRWF(behavior.financial_planning.recommended_monthly_savings), 'badge-blue'],
                ].map(([label, val, cls]) => (
                  <div key={label as string} className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <p className="text-[11px] text-slate-400 mb-2">{label as string}</p>
                    <span className={cls as string}>{(val as string).replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ FINANCIAL PLANNING TOOLS ══════════════════════════ */}
      {activeTab === 'planning' && (
        <div className="space-y-5 animate-fade-up">
          <div className="ai-card-info text-xs">
            <Target size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>Financial Planning Tools</strong> — AI-powered budget management, investment
              recommendations, savings goals, and stress testing for your financial resilience.
            </span>
          </div>

          {/* Monthly estimates */}
          {planning?.monthly_estimates && (
            <div className="card">
              <p className="font-display font-semibold text-sm mb-4">Monthly Financial Overview</p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  ['Estimated Income', planning.monthly_estimates.income, 'text-emerald-700 dark:text-emerald-400'],
                  ['Estimated Expenses', planning.monthly_estimates.expenses, 'text-red-600 dark:text-red-400'],
                  ['Savings Rate', `${planning.monthly_estimates.savings_rate}%`, 'text-blue-700 dark:text-blue-400'],
                ].map(([label, val, color]) => (
                  <div key={label as string} className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">{label as string}</p>
                    <p className={clsx('font-display font-bold text-lg', color as string)}>
                      {typeof val === 'number' ? fmtRWF(val) : val as string}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 50/30/20 Budget Plan */}
          {planning?.budget_plan_50_30_20 && (
            <div className="card">
              <p className="font-display font-semibold text-sm mb-4">Recommended Budget (50/30/20 Rule)</p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  ['Needs (50%)', planning.budget_plan_50_30_20.needs, '#1a4fa8', 'Housing, food, transport, utilities'],
                  ['Wants (30%)', planning.budget_plan_50_30_20.wants, '#7c3aed', 'Entertainment, dining, hobbies'],
                  ['Savings (20%)', planning.budget_plan_50_30_20.savings, '#059669', 'Emergency fund, investments, goals'],
                ].map(([label, val, color, desc]) => (
                  <div key={label as string} className="p-4 rounded-xl border-2" style={{ borderColor: `${color}40`, background: `${color}08` }}>
                    <p className="text-xs font-bold mb-1" style={{ color }}>{label as string}</p>
                    <p className="font-display font-black text-xl" style={{ color }}>{fmtRWF(val)}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{desc as string}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Savings Goals */}
          {(planning?.savings_goals || []).length > 0 && (
            <div className="card">
              <p className="font-display font-semibold text-sm mb-4">Savings Goals</p>
              <div className="space-y-4">
                {planning.savings_goals.map((goal: any, i: number) => {
                  const pct = Math.min(100, (goal.current / goal.target) * 100);
                  return (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{goal.goal}</span>
                        <span className="text-xs text-slate-400">{fmtRWF(goal.current)} / {fmtRWF(goal.target)}</span>
                      </div>
                      <div className="progress h-2.5 rounded-full mb-1">
                        <div
                          className="progress-bar rounded-full"
                          style={{ width: `${pct}%`, background: pct >= 100 ? '#059669' : pct >= 50 ? '#d97706' : '#1a4fa8' }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {pct >= 100 ? 'Goal reached!' : `${pct.toFixed(0)}% complete · ~${goal.months_to_reach} months remaining`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Investment options */}
          {(planning?.investment_options || []).length > 0 && (
            <div className="card">
              <p className="font-display font-semibold text-sm mb-4">Suitable Investment Options</p>
              <div className="space-y-2">
                {planning.investment_options.map((inv: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{inv.name}</p>
                        <span className="badge-blue text-[10px]">{inv.rate}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{inv.reason} · Min: {fmtRWF(inv.min)}</p>
                    </div>
                    <span className={inv.risk === 'very_low' || inv.risk === 'low' ? 'risk-low' : inv.risk === 'high' ? 'risk-high' : 'risk-medium'}>
                      {inv.risk.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stress tests */}
          {(planning?.stress_tests || []).length > 0 && (
            <div className="card">
              <p className="font-display font-semibold text-sm mb-4">Stress Test Scenarios</p>
              <div className="space-y-3">
                {planning.stress_tests.map((test: any, i: number) => (
                  <div key={i} className={clsx(
                    'flex items-center gap-4 p-3 rounded-xl border',
                    test.impact === 'high' || test.status === 'critical'
                      ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50'
                      : test.impact === 'medium' || test.status === 'warning'
                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50'
                      : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50',
                  )}>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{test.scenario}</p>
                      {test.buffer_months && <p className="text-xs text-slate-400 mt-0.5">Buffer: {test.buffer_months} months of expenses</p>}
                    </div>
                    <span className={test.impact === 'high' || test.status === 'critical' ? 'risk-high' : test.impact === 'medium' ? 'risk-medium' : 'risk-low'}>
                      {test.impact || test.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ COMPLIANCE ════════════════════════════════════════ */}
      {activeTab === 'compliance' && (
        <div className="space-y-5 animate-fade-up">
          <div className="ai-card-info text-xs">
            <Lock size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>Regulatory Compliance Engine</strong> — continuously monitors for AML (Anti-Money Laundering),
              CTR (Currency Transaction Reporting), structuring detection, and real-time sanctions screening.
            </span>
          </div>

          <div className="card">
            <p className="font-display font-semibold text-sm mb-5">Compliance Status</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              {[
                ['KYC Status', 'Verified', '#059669'],
                ['AML Risk', `${((credit?.aml_risk || 0.03) * 100).toFixed(0)}%`, credit?.aml_risk > 0.3 ? '#dc2626' : '#059669'],
                ['CTR Threshold', '10,000,000 RWF', '#1a4fa8'],
                ['SAR Filed', 'None', '#059669'],
              ].map(([label, val, color]) => (
                <div key={label as string} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">{label as string}</p>
                  <p className="font-bold text-sm" style={{ color }}>{val as string}</p>
                </div>
              ))}
            </div>

            <p className="font-semibold text-xs text-slate-500 uppercase tracking-wide mb-3">Monitoring Controls</p>
            <div className="space-y-2">
              {[
                ['Transaction Monitoring', 'Real-time AI analysis of every transaction', true],
                ['Geo-anomaly Detection', 'Flags geographically impossible card usage patterns', true],
                ['Velocity Checks', 'Detects unusual transaction frequency spikes', true],
                ['Structuring Detection', 'Identifies amounts just below CTR threshold', true],
                ['Round-Amount Screening', 'Flags suspiciously round large amounts', true],
                ['Night-Transaction Monitoring', 'Tracks activity during unusual hours', true],
                ['PEP Screening', 'Politically Exposed Person cross-checking', false],
                ['Sanctions List (OFAC/EU)', 'International sanctions screening', false],
              ].map(([label, desc, active]) => (
                <div key={label as string} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div className={clsx(
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                    active ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-200 dark:bg-slate-700',
                  )}>
                    {active
                      ? <CheckCircle size={12} className="text-emerald-600 dark:text-emerald-400" />
                      : <div className="w-2 h-2 rounded-full bg-slate-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label as string}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{desc as string}</p>
                  </div>
                  <span className={clsx('text-[10px] font-semibold flex-shrink-0', active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}>
                    {active ? 'Active' : 'Planned'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <p className="font-display font-semibold text-sm mb-4">Predictive Compliance</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              AI automatically scans all transactions for regulatory risk and generates Suspicious Activity Reports (SAR)
              when risk score exceeds 0.60. Currency Transaction Reports (CTR) are auto-filed for amounts ≥ 10,000,000 RWF.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['SAR Threshold', '60% risk score', '#dc2626'],
                ['CTR Threshold', '≥ 10,000,000 RWF', '#d97706'],
                ['Review Window', 'Real-time', '#1a4fa8'],
                ['Regulatory Body', 'BNR (National Bank of Rwanda)', '#059669'],
              ].map(([label, val, color]) => (
                <div key={label as string} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-[11px] text-slate-400 mb-1">{label as string}</p>
                  <p className="text-sm font-semibold" style={{ color }}>{val as string}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
