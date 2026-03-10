import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  MoreHorizontal,
  Settings,
} from 'lucide-react';
import Card from '../../../components/common/Card';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import {
  AppNotification,
  getNotificationDisplayMessage,
} from '../../../services/notification.service';
import { formatDateTime } from '../utils';

interface StudentNotificationsSectionProps {
  notifications: AppNotification[];
  institutionName?: string | null;
  isLoading: boolean;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void | Promise<void>;
  onOpenCredential: (credentialId: string) => void;
  onOpenRequest: (requestId: string) => void;
  onOpenNotificationsPage: () => void;
  isMarkingAllRead: boolean;
}

type ReadFilter = 'ALL' | 'UNREAD';

const getMetadataEvent = (metadata: Record<string, unknown> | null): string | null => {
  if (!metadata) return null;
  const value = metadata.event;
  return typeof value === 'string' ? value : null;
};

const parseMetadataString = (
  metadata: Record<string, unknown> | null,
  key: string,
): string | null => {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const isCredentialReissued = (notification: AppNotification): boolean => {
  const metadataEvent = getMetadataEvent(notification.metadata);
  if (metadataEvent === 'REISSUED') return true;
  return /credential re-issued/i.test(notification.title) || /re-issued/i.test(notification.message);
};

export default function StudentNotificationsSection({
  notifications,
  institutionName,
  isLoading,
  onMarkAllRead,
  onMarkRead,
  onOpenCredential,
  onOpenRequest,
  onOpenNotificationsPage,
  isMarkingAllRead,
}: StudentNotificationsSectionProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [readFilter, setReadFilter] = useState<ReadFilter>('ALL');
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      if (readFilter === 'UNREAD' && item.read) return false;
      return true;
    });
  }, [notifications, readFilter]);

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

    const credentialId = parseMetadataString(notification.metadata, 'credentialId');
    if (credentialId) {
      onOpenCredential(credentialId);
      return;
    }

    const requestId = parseMetadataString(notification.metadata, 'requestId');
    if (requestId) {
      onOpenRequest(requestId);
      return;
    }

    onOpenNotificationsPage();
  };

  return (
    <Card className="mx-auto w-full max-w-3xl">
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
                  <button
                    type="button"
                    onClick={() => {
                      onMarkAllRead();
                      setIsMenuOpen(false);
                    }}
                    disabled={unreadCount === 0 || isMarkingAllRead}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCheck size={15} />
                    {isMarkingAllRead ? <ButtonLoadingContent label="Marking" /> : 'Mark all as read'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    <Settings size={15} />
                    Notification settings
                    <span className="ml-auto text-[10px] font-semibold  text-neutral-400">
                      N/a
                    </span>
                  </button>
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
          {filteredNotifications.map(notification => {
            const isReissued = isCredentialReissued(notification);
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
                className={`rounded-lg border px-4 py-3 ${
                  notification.read ? 'border-neutral-200 bg-white' : 'border-sky-200 bg-sky-50/50'
                } cursor-pointer transition hover:bg-neutral-50`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{notification.title}</p>
                      {!notification.read && (
                        <span className="inline-flex h-2 w-2 rounded-full bg-sky-500" />
                      )}
                      {isReissued && (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold r text-emerald-700">
                          Credential re-issued
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600">
                      {getNotificationDisplayMessage(notification, {
                        institutionNameFallback: institutionName,
                      })}
                    </p>
                    <p className="text-xs text-neutral-500">{formatDateTime(notification.createdAt)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-medium  text-neutral-500">
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
