import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  MoreHorizontal,
  Settings,
  Users,
} from 'lucide-react';
import Card from '../../../components/common/Card';
import PaginationControls from '../../../components/common/PaginationControls';
import Button from '../../../components/ui/Button';
import {
  AppNotification,
  getNotificationDisplayMessage,
} from '../../../services/notification.service';
import { formatDateTime } from '../../../utils/formatting';

interface AdminNotificationsSectionProps {
  notifications: AppNotification[];
  isLoading: boolean;
  isMarkingAllRead: boolean;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void | Promise<void>;
  onOpenUsers: (options?: { userId?: string | null }) => void;
  onOpenRiskReview: (options?: {
    riskEventId?: string | null;
    targetId?: string | null;
    actorId?: string | null;
  }) => void;
  onOpenNotificationsPage: () => void;
}

type ReadFilter = 'ALL' | 'UNREAD';

const parseMetadataString = (
  metadata: Record<string, unknown> | null,
  key: string,
): string | null => {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const getNotificationIcon = (notification: AppNotification) => {
  if (notification.type === 'SECURITY_ALERT') return AlertTriangle;
  if (notification.type === 'ACCOUNT_APPROVED' || notification.type === 'ACCOUNT_REJECTED') return Users;
  return Bell;
};

export default function AdminNotificationsSection({
  notifications,
  isLoading,
  isMarkingAllRead,
  onMarkAllRead,
  onMarkRead,
  onOpenUsers,
  onOpenRiskReview,
  onOpenNotificationsPage,
}: AdminNotificationsSectionProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [readFilter, setReadFilter] = useState<ReadFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pageSize = 8;

  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      if (readFilter === 'UNREAD' && item.read) return false;
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
  }, [filteredNotifications, safeCurrentPage]);

  const unreadCount = notifications.filter(item => !item.read).length;

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

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.read) {
      void onMarkRead(notification.id);
    }

    const riskEventId =
      parseMetadataString(notification.metadata, 'riskEventId') ||
      parseMetadataString(notification.metadata, 'eventId');
    const requestId = parseMetadataString(notification.metadata, 'requestId');
    const credentialId = parseMetadataString(notification.metadata, 'credentialId');
    const actorId = parseMetadataString(notification.metadata, 'actorId');
    const userId =
      parseMetadataString(notification.metadata, 'studentId') ||
      parseMetadataString(notification.metadata, 'processedById') ||
      parseMetadataString(notification.metadata, 'userId');
    const targetId =
      parseMetadataString(notification.metadata, 'targetId') ||
      credentialId ||
      requestId;

    if (notification.type === 'SECURITY_ALERT') {
      onOpenRiskReview({ riskEventId, targetId, actorId });
      return;
    }

    if (notification.type === 'ACCOUNT_APPROVED' || notification.type === 'ACCOUNT_REJECTED') {
      onOpenUsers({ userId });
      return;
    }

    if (riskEventId || targetId || actorId) {
      onOpenRiskReview({ riskEventId, targetId, actorId });
      return;
    }

    if (userId) {
      onOpenUsers({ userId });
      return;
    }

    onOpenNotificationsPage();
  };

  return (
    <Card className="w-full">
      <div className="mb-4 border-b border-neutral-200 pb-3">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-neutral-900">Notifications</p>
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
                      onMarkAllRead();
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
      </div>

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
        <div className="space-y-2">
          {[1, 2, 3].map(item => (
            <div key={item} className="h-24 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
          ))}
        </div>
      )}

      {!isLoading && filteredNotifications.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center text-sm text-neutral-500">
          No notifications found.
        </div>
      )}

      {!isLoading && filteredNotifications.length > 0 && (
        <div className="space-y-2">
          {pagedNotifications.map(notification => {
            const NotificationIcon = getNotificationIcon(notification);

            return (
              <article
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(notification)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleNotificationClick(notification);
                  }
                }}
                className={`cursor-pointer rounded-lg border px-4 py-3 transition hover:bg-neutral-50 ${
                  notification.read ? 'border-neutral-200 bg-white' : 'border-sky-200 bg-sky-50/50'
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{notification.title}</p>
                      {!notification.read && (
                        <span className="inline-flex h-2 w-2 rounded-full bg-sky-500" />
                      )}
                    </div>
                    <p className="text-sm text-neutral-600">
                      {getNotificationDisplayMessage(notification)}
                    </p>
                    <p className="text-xs text-neutral-500">{formatDateTime(notification.createdAt)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-500">
                  <NotificationIcon size={12} />
                  {notification.type.replace(/_/g, ' ')}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!isLoading && filteredNotifications.length > 0 && (
        <PaginationControls
          currentPage={safeCurrentPage}
          totalItems={filteredNotifications.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          itemLabel="notifications"
        />
      )}
    </Card>
  );
}