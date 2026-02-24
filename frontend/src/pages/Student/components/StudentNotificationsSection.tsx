import { useMemo, useState } from 'react';
import {
  Bell,
  CheckCheck,
  MailCheck,
  RefreshCcw,
  Search,
} from 'lucide-react';
import Card from '../../../components/common/Card';
import { AppNotification } from '../../../services/notification.service';
import { formatDateTime } from '../utils';

interface StudentNotificationsSectionProps {
  notifications: AppNotification[];
  isLoading: boolean;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  markingNotificationId: string | null;
  isMarkingAllRead: boolean;
}

type ReadFilter = 'ALL' | 'UNREAD' | 'READ';

const getMetadataEvent = (metadata: Record<string, unknown> | null): string | null => {
  if (!metadata) return null;
  const value = metadata.event;
  return typeof value === 'string' ? value : null;
};

const isCredentialReissued = (notification: AppNotification): boolean => {
  const metadataEvent = getMetadataEvent(notification.metadata);
  if (metadataEvent === 'REISSUED') return true;
  return /credential re-issued/i.test(notification.title) || /re-issued/i.test(notification.message);
};

export default function StudentNotificationsSection({
  notifications,
  isLoading,
  onRefresh,
  onMarkAllRead,
  onMarkRead,
  markingNotificationId,
  isMarkingAllRead,
}: StudentNotificationsSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('ALL');

  const filteredNotifications = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return notifications.filter(item => {
      if (readFilter === 'UNREAD' && item.read) return false;
      if (readFilter === 'READ' && !item.read) return false;
      if (!keyword) return true;
      const searchable = `${item.title} ${item.message} ${item.type}`.toLowerCase();
      return searchable.includes(keyword);
    });
  }, [notifications, readFilter, searchTerm]);

  const unreadCount = notifications.filter(item => !item.read).length;

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-xl">
          <div className="relative w-full">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search notifications..."
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-300"
            />
          </div>
          <select
            value={readFilter}
            onChange={event => setReadFilter(event.target.value as ReadFilter)}
            className="h-10 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-slate-300 sm:w-[140px]"
            aria-label="Filter notifications by read state"
          >
            <option value="ALL">All</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-10 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCcw size={14} />
            Reload
          </button>
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0 || isMarkingAllRead}
            className="inline-flex h-10 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck size={14} />
            {isMarkingAllRead ? 'Marking...' : 'Mark all read'}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(item => (
            <div key={item} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {!isLoading && filteredNotifications.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
          No notifications found.
        </div>
      )}

      {!isLoading && filteredNotifications.length > 0 && (
        <div className="space-y-2">
          {filteredNotifications.map(notification => {
            const isReissued = isCredentialReissued(notification);
            return (
              <article
                key={notification.id}
                className={`rounded-xl border px-4 py-3 ${
                  notification.read ? 'border-slate-200 bg-white' : 'border-sky-200 bg-sky-50/50'
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                      {!notification.read && (
                        <span className="inline-flex h-2 w-2 rounded-full bg-sky-500" />
                      )}
                      {isReissued && (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          Credential re-issued
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{notification.message}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(notification.createdAt)}</p>
                  </div>

                  {!notification.read && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(notification.id)}
                      disabled={markingNotificationId === notification.id}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MailCheck size={13} />
                      {markingNotificationId === notification.id ? 'Marking...' : 'Mark read'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                  <Bell size={12} />
                  {notification.type.replace(/_/g, ' ')}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Card>
  );
}
