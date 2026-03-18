import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, Monitor, MoreVertical } from 'lucide-react';
import { AppNotification, getNotificationDisplayMessage } from '../../services/notification.service';
import { formatRelativeTimeCompact } from './notificationTime';

type ReadFilter = 'ALL' | 'UNREAD';

interface TopbarNotificationsPanelProps {
  notifications: AppNotification[];
  isLoading: boolean;
  isMarkingAllRead: boolean;
  unreadCount: number;
  onMarkAllRead: () => void | Promise<void>;
  onNotificationClick: (notification: AppNotification) => void;
  onSeeAll: () => void;
  getMessage?: (notification: AppNotification) => string;
}

export default function TopbarNotificationsPanel({
  notifications,
  isLoading,
  isMarkingAllRead,
  unreadCount,
  onMarkAllRead,
  onNotificationClick,
  onSeeAll,
  getMessage = getNotificationDisplayMessage,
}: TopbarNotificationsPanelProps) {
  const [readFilter, setReadFilter] = useState<ReadFilter>('ALL');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedButton = menuButtonRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);
      if (!clickedButton && !clickedMenu) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  const filteredNotifications = useMemo(
    () => notifications.filter(notification => (readFilter === 'UNREAD' ? !notification.read : true)),
    [notifications, readFilter],
  );

  const unreadNotifications = useMemo(
    () => filteredNotifications.filter(notification => !notification.read),
    [filteredNotifications],
  );
  const readNotifications = useMemo(
    () => filteredNotifications.filter(notification => notification.read),
    [filteredNotifications],
  );

  const visibleUnreadNotifications = useMemo(() => {
    if (readFilter === 'UNREAD') return unreadNotifications.slice(0, 8);
    return unreadNotifications.slice(0, 4);
  }, [readFilter, unreadNotifications]);

  const visibleReadNotifications = useMemo(() => {
    if (readFilter === 'UNREAD') return [];
    const remainingSlots = visibleUnreadNotifications.length > 0 ? 4 : 8;
    return readNotifications.slice(0, remainingSlots);
  }, [readFilter, readNotifications, visibleUnreadNotifications.length]);

  const visibleNotifications = useMemo(
    () => [...visibleUnreadNotifications, ...visibleReadNotifications],
    [visibleReadNotifications, visibleUnreadNotifications],
  );

  const renderNotificationRow = (notification: AppNotification) => (
    <button
      key={notification.id}
      type="button"
      onClick={() => onNotificationClick(notification)}
      className="w-full rounded-xl px-2 py-2 text-left transition hover:bg-neutral-50"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm text-neutral-700">
            <span className="font-semibold text-neutral-900">{notification.title}</span>{' '}
            {getMessage(notification)}
          </p>
          <p className="mt-1 text-xs text-neutral-500">{formatRelativeTimeCompact(notification.createdAt)}</p>
        </div>
        {!notification.read && (
          <span className="mt-2 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-error-500" />
        )}
      </div>
    </button>
  );

  return (
    <div className="max-h-full w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-xl">
      <div className="flex items-start justify-between px-4 pt-2.5">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-neutral-900">Notifications</h2>
        </div>
        <div className="relative">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsMenuOpen(previous => !previous)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Notification actions"
            aria-expanded={isMenuOpen}
          >
            <MoreVertical size={18} />
          </button>

          {isMenuOpen && (
            <div ref={menuRef} className="absolute right-0 top-10 z-20 w-56 max-w-[calc(100vw-2rem)]">
              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    void onMarkAllRead();
                    setIsMenuOpen(false);
                  }}
                  disabled={isMarkingAllRead || unreadCount === 0}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCheck size={15} />
                  {isMarkingAllRead ? 'Marking all as read...' : 'Mark all as read'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSeeAll();
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                >
                  <Monitor size={15} />
                  Open notifications
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 pt-1 pb-2">
        <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-1">
          <button
            type="button"
            onClick={() => setReadFilter('ALL')}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              readFilter === 'ALL'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setReadFilter('UNREAD')}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              readFilter === 'UNREAD'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'
            }`}
          >
            Unread
          </button>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-xs font-semibold text-neutral-600 underline decoration-neutral-300 underline-offset-4 transition-colors hover:text-neutral-900 hover:decoration-neutral-900"
        >
          See all
        </button>
      </div>

      <div className="px-4 py-2.5">
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-3"
              >
                <div className="h-5 w-2/3 animate-pulse rounded bg-neutral-200" />
                <div className="mt-3 h-4 w-full animate-pulse rounded bg-neutral-100" />
                <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              <Bell size={20} />
            </div>
            <p className="text-sm font-semibold text-neutral-900">No notifications</p>
            <p className="max-w-xs text-xs text-neutral-500">
              {readFilter === 'UNREAD'
                ? 'You have no unread notifications right now.'
                : 'New activity will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {readFilter === 'ALL' && visibleUnreadNotifications.length > 0 && (
              <section className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-neutral-900">New</h3>
                </div>
                <div className="space-y-0.5">
                  {visibleUnreadNotifications.map(notification => renderNotificationRow(notification))}
                </div>
              </section>
            )}

            {readFilter === 'ALL' && visibleReadNotifications.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="text-base font-semibold text-neutral-900">Earlier</h3>
                <div className="space-y-0.5">
                  {visibleReadNotifications.map(notification => renderNotificationRow(notification))}
                </div>
              </section>
            )}

            {readFilter === 'UNREAD' && (
              <section className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-neutral-900">Unread</h3>
                </div>
                <div className="space-y-0.5">
                  {visibleUnreadNotifications.map(notification => renderNotificationRow(notification))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
