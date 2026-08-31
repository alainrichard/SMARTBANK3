'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/translations';
import { getNotifications, markRead, markAllRead } from '@/lib/api';
import {
  Bell, ArrowRightLeft, CreditCard, AlertTriangle,
  LogIn, Info, CheckCircle, ChevronRight, Clock,
  UserCheck, Zap, Shield, Settings,
} from 'lucide-react';
import clsx from 'clsx';

// Map notification type to route, icon, colors
const NOTIF_CONFIG: Record<string, {
  icon: any;
  iconBg: string;
  iconColor: string;
  getRoute: (role: string) => string;
  label: string;
  urgent?: boolean;
}> = {
  transaction: {
    icon: ArrowRightLeft,
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    getRoute: () => '/dashboard/transactions',
    label: 'View Transaction',
  },
  loan_update: {
    icon: CreditCard,
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    getRoute: () => '/dashboard/loans',
    label: 'View Loans',
  },
  fraud_alert: {
    icon: AlertTriangle,
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    iconColor: 'text-red-600 dark:text-red-400',
    getRoute: (role) =>
      ['super_admin', 'branch_manager', 'fraud_analyst'].includes(role)
        ? '/dashboard/fraud'
        : '/dashboard/transactions',
    label: 'View Fraud Alert',
    urgent: true,
  },
  account_update: {
    icon: UserCheck,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    getRoute: (role) =>
      ['super_admin', 'branch_manager'].includes(role)
        ? '/dashboard/kyc'
        : '/dashboard',
    label: 'View Details',
  },
  login: {
    icon: LogIn,
    iconBg: 'bg-teal-100 dark:bg-teal-900/40',
    iconColor: 'text-teal-600 dark:text-teal-400',
    getRoute: () => '/dashboard/settings',
    label: 'Review Security',
  },
  system: {
    icon: Info,
    iconBg: 'bg-slate-100 dark:bg-slate-700',
    iconColor: 'text-slate-500 dark:text-slate-400',
    getRoute: () => '/dashboard',
    label: 'View',
  },
  otp: {
    icon: Shield,
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    getRoute: () => '/dashboard/settings',
    label: 'Security Settings',
  },
};

export default function NotificationsPage() {
  const { user, lang, setUnreadCount } = useApp();
  const router = useRouter();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = async () => {
    try {
      const { data } = await getNotifications();
      const n = data.data.notifications || [];
      setNotifs(n);
      setUnreadCount(n.filter((x: any) => !x.is_read).length);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleClick = async (notif: any) => {
    if (!notif.is_read) {
      await markRead(notif.id).catch(() => {});
      await load();
    }
    const config = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.system;
    router.push(config.getRoute(user?.role || ''));
  };

  const handleMarkAll = async () => {
    await markAllRead().catch(() => {});
    toast.success('All notifications marked as read');
    load();
  };

  const displayed = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs;
  const unreadCount = notifs.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="font-display font-bold text-xl">{t('notifications', lang)}</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} &middot; {notifs.length} total
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAll} className="btn-secondary btn-sm">
            <CheckCircle size={13} /> Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="tab-bar w-fit">
        {([
          ['all',    `All (${notifs.length})`],
          ['unread', `Unread (${unreadCount})`],
        ] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={clsx('tab-item px-6', filter === val && 'active')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {displayed.length === 0 ? (
        <div className="card text-center py-16">
          <Bell size={44} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="font-display font-semibold text-slate-500 dark:text-slate-400">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {filter === 'unread' ? 'Check back later or view all notifications' : 'Notifications will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((n: any) => {
            const config = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.system;
            const Icon = config.icon;
            const isUrgent = config.urgent && !n.is_read;

            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={clsx(
                  'group flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-150',
                  !n.is_read
                    ? isUrgent
                      ? 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/50 hover:bg-red-100/60 dark:hover:bg-red-900/25'
                      : 'bg-blue-50 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800/50 hover:bg-blue-100/60 dark:hover:bg-blue-900/25'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50',
                )}
                style={{ boxShadow: !n.is_read ? '0 1px 4px rgba(0,0,0,.06)' : 'none' }}
              >
                {/* Icon */}
                <div className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                  config.iconBg,
                )}>
                  <Icon size={18} className={config.iconColor} />
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className={clsx(
                        'text-sm truncate',
                        !n.is_read
                          ? 'font-semibold text-slate-900 dark:text-white'
                          : 'font-medium text-slate-700 dark:text-slate-300',
                      )}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                      {isUrgent && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          <Zap size={9} /> Urgent
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0 flex items-center gap-1">
                      <Clock size={10} />
                      {n.created_at
                        ? new Date(n.created_at).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>

                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {n.body}
                  </p>

                  {/* Action hint on hover */}
                  <div className="flex items-center gap-1 mt-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {config.label} <ChevronRight size={11} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
