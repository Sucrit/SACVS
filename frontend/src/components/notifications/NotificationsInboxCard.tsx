import { motion } from 'framer-motion';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCheck, MoreHorizontal, Settings } from 'lucide-react';
import Card from '../common/Card';
import PaginationControls from '../common/PaginationControls';
import Button from '../ui/Button';
import LoadingCard from '../common/LoadingCard';
import EmptyState from '../ui/EmptyState';
import {
  AppNotification,
  getNotificationDisplayMessage,
} from '../../services/notification.service';
import { formatDateTime } from '../../utils/formatting';

type ReadFilter = 'ALL' | 'UNREAD';

interface NotificationsInboxCardProps {
  notifications: AppNotification[];
  isLoading: boolean;
  isMarkingAllRead: boolean;
  onMarkAllRead: () => void | Promise<void>;
  onNotificationClick: (notification: AppNotification) => void;
  title?: string;
  className?: string;
  pageSize?: number;
  itemLabel?: string;
  emptyMessage?: string;
  getMessage?: (notification: AppNotification) => string;
  renderTitleExtras?: (notification: AppNotification) => ReactNode;
  renderFooter?: (notification: AppNotification) => ReactNode;
  renderItemActions?: (notification: AppNotification) => ReactNode;
  headerActions?: ReactNode;
}

export default function NotificationsInboxCard({
  notifications,
  isLoading,
  isMarkingAllRead,
  onMarkAllRead,
  onNotificationClick,
  title = 'Notifications',
  className,
  pageSize = 8,
  itemLabel = 'notifications',
  emptyMessage = 'No notifications found.',
  getMessage = getNotificationDisplayMessage,
  renderTitleExtras,
  renderFooter,
  renderItemActions,
  headerActions,
}: NotificationsInboxCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [readFilter, setReadFilter] = useState<ReadFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      if (readFilter === 'UNREAD' && notification.read) return false;
      return true;
    });
  }, [notifications, readFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [readFilter, filteredNotifications.length]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedNotifications = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredNotifications.slice(start, start + pageSize);
  }, [filteredNotifications, pageSize, safeCurrentPage]);

  const unreadCount = notifications.filter(notification => !notification.read).length;

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

  const action = (
    <div className="flex items-center gap-2">
      {headerActions}
      <div className="relative">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setIsMenuOpen(previous => !previous)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Notification options"
          aria-expanded={isMenuOpen}
        >
          <MoreHorizontal size={18} />
        </button>
        {isMenuOpen && (
          <div ref={menuRef} className="absolute right-0 top-10 z-10 w-56 max-w-[calc(100vw-2rem)]">
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
              <Button
                type="button"
                variant="ghost"
                size="md"
                icon={<CheckCheck size={15} />}
                onClick={() => {
                  void onMarkAllRead();
                  setIsMenuOpen(false);
                }}
                disabled={unreadCount === 0}
                loading={isMarkingAllRead}
                className="w-full justify-start rounded-none px-3 font-semibold"
              >
                Mark all as read
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                icon={<Settings size={15} />}
                onClick={() => setIsMenuOpen(false)}
                className="w-full justify-start rounded-none px-3 font-semibold"
              >
                Notification settings
                <span className="ml-auto text-[10px] font-semibold text-neutral-400">N/a</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Card className={className} title={title} action={action}>
      <div className="mb-4 flex items-center">
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
      </div>

      {isLoading && (
        <div className="space-y-3">
          <LoadingCard rows={1} className="border-0 bg-transparent p-0 shadow-none" />
          <LoadingCard rows={1} className="border-0 bg-transparent p-0 shadow-none" />
          <LoadingCard rows={1} className="border-0 bg-transparent p-0 shadow-none" />
        </div>
      )}

      {!isLoading && filteredNotifications.length === 0 && (
        <EmptyState
          title=""
          description={emptyMessage}
          className="my-4 border-neutral-200"
        />
      )}

      {!isLoading && filteredNotifications.length > 0 && (
        <div className="space-y-2">
          {pagedNotifications.map((notification, index) => (
            <motion.article
              key={notification.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              role="button"
              tabIndex={0}
              onClick={() => onNotificationClick(notification)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onNotificationClick(notification);
                }
              }}
              className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-4 py-3 transition hover:bg-neutral-50"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-900">{notification.title}</p>
                    {!notification.read && (
                      <span className="inline-flex h-2 w-2 rounded-full bg-error-500" />
                    )}
                    {renderTitleExtras?.(notification)}
                  </div>
                  <p className="text-sm text-neutral-600">{getMessage(notification)}</p>
                  <p className="text-xs text-neutral-500">{formatDateTime(notification.createdAt)}</p>
                </div>
                {renderItemActions?.(notification)}
              </div>

              {renderFooter && (
                <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-500">
                  {renderFooter(notification)}
                </div>
              )}
            </motion.article>
          ))}
        </div>
      )}

      {!isLoading && filteredNotifications.length > 0 && (
        <PaginationControls
          currentPage={safeCurrentPage}
          totalItems={filteredNotifications.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          itemLabel={itemLabel}
        />
      )}
    </Card>
  );
}
