'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { sendChatMessage, getChatSessions } from '@/lib/api';
import {
  Send, Bot, RefreshCw, MessageSquare, Phone, Mail,
  ChevronDown, CreditCard, ArrowRightLeft, Shield,
  TrendingUp, Receipt, HelpCircle,
} from 'lucide-react';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  time: Date;
  engine?: string;
}

const QUICK_PROMPTS: Record<string, { label: string; icon: any }[]> = {
  en: [
    { label: 'What is my account balance?',        icon: TrendingUp },
    { label: 'How do I apply for a loan?',          icon: CreditCard },
    { label: 'How do I transfer money?',            icon: ArrowRightLeft },
    { label: 'How do I pay my electricity bill?',   icon: Receipt },
    { label: 'My account is blocked — what do I do?', icon: Shield },
    { label: 'What are the loan interest rates?',   icon: HelpCircle },
  ],
  fr: [
    { label: 'Quel est mon solde ?',                icon: TrendingUp },
    { label: 'Comment demander un prêt ?',          icon: CreditCard },
    { label: 'Comment effectuer un virement ?',     icon: ArrowRightLeft },
    { label: 'Comment payer ma facture d\'eau ?',   icon: Receipt },
    { label: 'Mon compte est bloqué — que faire ?', icon: Shield },
    { label: 'Quels sont les taux d\'intérêt ?',    icon: HelpCircle },
  ],
  rw: [
    { label: 'Ingano y\'amafaranga yanjye ni ite?', icon: TrendingUp },
    { label: 'Nsaba inguzanyo gute?',               icon: CreditCard },
    { label: 'Ohereza amafaranga gute?',            icon: ArrowRightLeft },
    { label: 'Kwishyura fagitire ya RECO gute?',    icon: Receipt },
    { label: 'Konti yanjye ifunzwe — nkore iki?',   icon: Shield },
    { label: 'Inyungu z\'inguzanyo ni ite?',        icon: HelpCircle },
  ],
};

function getWelcome(name: string, lang: string): string {
  const n = name || 'there';
  const msgs: Record<string, string> = {
    en:  `Hello ${n}! I'm **SmartBot**, your AI banking assistant.\n\nI can help you with:\n- Account balance and transactions\n- Loan applications (min 50,000 RWF)\n- Money transfers and bill payments\n- Fraud detection and account security\n- Financial advice and credit score\n\nHow can I assist you today?`,
    fr:  `Bonjour ${n}! Je suis **SmartBot**, votre assistant bancaire IA.\n\nJe peux vous aider avec:\n- Solde et transactions\n- Demande de prêt (min 50 000 RWF)\n- Virements et paiements de factures\n- Sécurité et détection de fraude\n- Conseils financiers\n\nComment puis-je vous aider?`,
    rw:  `Muraho ${n}! Ndi **SmartBot**, umufasha wawe wa banki.\n\nNshobora gufasha na:\n- Amafaranga no gukurikirana imicungire\n- Gusaba inguzanyo (ntarengwa 50,000 RWF)\n- Kohereza amafaranga no kwishyura\n- Kurinda uburiganya n'umutekano\n- Inama z'imari\n\nNshaka gufasha gute?`,
  };
  return msgs[lang] || msgs.en;
}

// Render markdown-lite: **bold**, \n → <br>, - item → bullet
function renderMessage(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<span class="flex items-start gap-1.5 mt-0.5"><span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 opacity-60"></span><span>$1</span></span>')
    .replace(/^\d+\. (.+)$/gm, '<span class="flex items-start gap-1.5 mt-0.5"><span class="font-bold opacity-60 flex-shrink-0 text-[11px] mt-0.5">·</span><span>$1</span></span>')
    .replace(/\n/g, '<br/>');
}

export default function SupportPage() {
  const { user, lang } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: getWelcome(user?.first_name || 'there', lang), time: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessions, setSessions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    getChatSessions().then(r => setSessions(r.data?.data?.sessions || [])).catch(() => {});
  }, []);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: msg, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/chatbot/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ message: msg, session_id: sessionId }),
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();

      if (data.success && data.data?.message) {
        setSessionId(data.data.session_id);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.data.message,
          time: new Date(),
          engine: data.data.engine,
        }]);
      } else {
        throw new Error(data.message || 'Empty response');
      }
    } catch (err: any) {
      console.error('[SmartBot] error:', err);
      // Show a helpful error — not just "connection issue"
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I could not reach the server right now. Please make sure the **backend is running** on port 5000, then try again.\n\nFor urgent help: **+250 780 000 001** or email **support@smartbank.rw**',
        time: new Date(),
      }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const resetChat = () => {
    setMessages([{ role: 'assistant', content: getWelcome(user?.first_name || 'there', lang), time: new Date() }]);
    setSessionId(undefined);
    setInput('');
  };

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase();
  const prompts = QUICK_PROMPTS[lang] || QUICK_PROMPTS.en;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl">{t('support', lang)}</h1>
          <p className="text-slate-400 text-sm mt-0.5">AI-powered banking assistant — available 24/7</p>
        </div>
        <div className="flex gap-2">
          {sessions.length > 0 && (
            <button onClick={() => setShowHistory(!showHistory)} className="btn-secondary btn-sm">
              <MessageSquare size={13} /> History
              <ChevronDown size={12} className={clsx('transition-transform', showHistory && 'rotate-180')} />
            </button>
          )}
          <button onClick={resetChat} className="btn-secondary btn-sm">
            <RefreshCw size={13} /> New Chat
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_260px] gap-4">
        {/* ── Main chat window ── */}
        <div className="card flex flex-col" style={{ height: 580 }}>
          {/* Chat header */}
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
            <div className="relative">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#1a4fa8' }}>
                <Bot size={18} className="text-white" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800" />
            </div>
            <div>
              <p className="font-semibold text-sm">SmartBot Assistant</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                Online — Powered by SmartBank AI
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={chatRef} className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
            {messages.map((msg, i) => (
              <div key={i} className={clsx('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                {/* Avatar */}
                <div className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'text-white'
                )}
                  style={msg.role === 'assistant' ? { background: '#1a4fa8' } : {}}>
                  {msg.role === 'user' ? initials : <Bot size={14} />}
                </div>

                {/* Bubble */}
                <div className={clsx(
                  'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-sm',
                )}>
                  <div
                    className="space-y-0.5"
                    dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }}
                  />
                  <p className={clsx(
                    'text-[10px] mt-1.5',
                    msg.role === 'user' ? 'text-white/50 text-right' : 'text-slate-400',
                  )}>
                    {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.engine === 'claude' && (
                      <span className="ml-1.5 opacity-60">· Claude AI</span>
                    )}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#1a4fa8' }}>
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.18}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
            <form
              onSubmit={e => { e.preventDefault(); sendMessage(); }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                className="input flex-1 text-sm"
                placeholder={lang === 'fr' ? 'Tapez votre message...' : lang === 'rw' ? 'Andika ubutumwa bwawe...' : 'Type your message...'}
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="btn-primary px-4 flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-3">
          {/* Quick questions */}
          <div className="card">
            <p className="font-display font-semibold text-sm mb-3">
              {lang === 'fr' ? 'Questions rapides' : lang === 'rw' ? 'Ibibazo byihuse' : 'Quick Questions'}
            </p>
            <div className="space-y-1.5">
              {prompts.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => sendMessage(label)}
                  disabled={loading}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700 text-left text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 hover:text-primary-700 dark:hover:text-primary-400 transition-all disabled:opacity-50"
                >
                  <Icon size={13} className="flex-shrink-0 text-blue-500" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Chat history */}
          {showHistory && sessions.length > 0 && (
            <div className="card">
              <p className="font-display font-semibold text-sm mb-3">Chat History</p>
              <div className="space-y-1">
                {sessions.slice(0, 8).map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => { setSessionId(s.id); setShowHistory(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                  >
                    <MessageSquare size={11} className="flex-shrink-0 text-slate-400" />
                    <span className="truncate">{s.title || 'Chat'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Emergency contact */}
          <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <p className="font-display font-semibold text-sm text-primary-800 dark:text-blue-300 mb-2.5">
              {lang === 'fr' ? 'Aide urgente' : lang === 'rw' ? 'Ubufasha bwihutirwa' : 'Need Urgent Help?'}
            </p>
            <a href="tel:+250780000001" className="flex items-center gap-2.5 text-sm font-semibold text-primary-700 dark:text-blue-300 mb-2 hover:underline">
              <Phone size={14} /> +250 780 000 001
            </a>
            <a href="mailto:support@smartbank.rw" className="flex items-center gap-2.5 text-xs text-blue-600 dark:text-blue-400 hover:underline">
              <Mail size={12} /> support@smartbank.rw
            </a>
            <p className="text-[11px] text-blue-500 mt-2">Available 24/7 for emergencies</p>
          </div>
        </div>
      </div>
    </div>
  );
}
