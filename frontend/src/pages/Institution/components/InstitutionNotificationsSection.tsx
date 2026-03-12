import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, MoreHorizontal, Settings } from 'lucide-react';
import Card from '../../../components/common/Card';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import PaginationControls from '../../../components/common/PaginationControls';
import Button from '../../../components/ui/Button';
import { NotificationTarget, OutboundNotification } from '../types';
import { AppNotification, getNotificationDisplayMessage } from '../../../services/notification.service';
import { formatDateTime } from '../utils';

type ReadFilter = 'ALL' | 'UNREAD';

interface InstitutionNotificationsSectionProps {
  notificationTarget: NotificationTarget;
  notificationTitle: string;
  notificationMessage: string;
  pendingCount: number;
  pendingStudentCount: number;
  suspendedStudentCount: number;
  notifications: OutboundNotification[];
  inboundNotifications: AppNotification[];
  isLoadingInboundNotifications: boolean;
  isMarkingAllNotificationsRead: boolean;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  isSubmitting: boolean;
  onTargetChange: (target: NotificationTarget) => void;
  onTitleChange: (title: string) => void;
  onMessageChange: (message: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenCredential: (credentialId: string) => void;
  onOpenRequest: (requestId: string) => void;
  onOpenNotificationsPage: () => void;
}

const parseMetadataString = (
  metadata: Record<string, unknown> | null,
  key: string,
): string | null => {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

export default function InstitutionNotificationsSection({
  notificationTarget,
  notificationTitle,
  notificationMessage,
  pendingCount,
  pendingStudentCount,
  suspendedStudentCount,
  notifications,
  inboundNotifications,
  isLoadingInboundNotifications,
  isMarkingAllNotificationsRead,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  isSubmitting,
  onTargetChange,
  onTitleChange,
  onMessageChange,
  onSubmit,
  onOpenCredential,
  onOpenRequest,
  onOpenNotificationsPage,
}: InstitutionNotificationsSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [isInboxMenuOpen, setIsInboxMenuOpen] = useState(false);
  const [readFilter, setReadFilter] = useState<ReadFilter>('ALL');
  const [inboundPage, setInboundPage] = useState(1);
  const inboundPageSize = 5;
  const inboxMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const inboxMenuRef = useRef<HTMLDivElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(notifications.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedNotifications = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return notifications.slice(start, start + pageSize);
  }, [notifications, safeCurrentPage]);

  const filteredInboundNotifications = useMemo(() => {
    return inboundNotifications.filter(notification => {
      if (readFilter === 'UNREAD' && notification.read) return false;
      return true;
    });
  }, [inboundNotifications, readFilter]);

  const totalInboundPages = Math.max(1, Math.ceil(filteredInboundNotifications.length / inboundPageSize));
  const safeInboundPage = Math.min(inboundPage, totalInboundPages);
  const pagedInboundNotifications = useMemo(() => {
    const start = (safeInboundPage - 1) * inboundPageSize;
    return filteredInboundNotifications.slice(start, start + inboundPageSize);
  }, [filteredInboundNotifications, safeInboundPage]);

  const unreadInboundCount = inboundNotifications.filter(n => !n.read).length;

  useEffect(() => {
    setCurrentPage(1);
  }, [notifications.length]);
  
  useEffect(() => {
    setInboundPage(1);
  }, [filteredInboundNotifications.length, readFilter]);

  useEffect(() => {
    if (!isInboxMenuOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedButton = inboxMenuButtonRef.current?.contains(target);
      const clickedMenu = inboxMenuRef.current?.contains(target);
      if (!clickedButton && !clickedMenu) {
        setIsInboxMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsInboxMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isInboxMenuOpen]);

  const handleInboxNotificationOpen = (notification: AppNotification) => {
    if (!notification.read) {
      onMarkNotificationRead(notification.id);
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Send Notification to Students">
          <form className="space-y-3" onSubmit={onSubmit}>
            <select
              value={notificationTarget}
              onChange={event => onTargetChange(event.target.value as NotificationTarget)}
              className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
            >
              <option value="ALL">All students</option>
              <option value="APPROVED_ONLY">Approved students only</option>
              <option value="SUSPENDED_ONLY">Suspended students only</option>
            </select>
            <input
              value={notificationTitle}
              onChange={event => onTitleChange(event.target.value)}
              placeholder="Notification title"
              className="h-10 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
            />
            <textarea
              value={notificationMessage}
              onChange={event => onMessageChange(event.target.value)}
              rows={4}
              placeholder="Notification message"
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none"
            />
            <button type="submit" disabled={isSubmitting} className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60">
              <Bell size={14} />
              {isSubmitting ? <ButtonLoadingContent label="Sending" /> : 'Send Notification'}
            </button>
          </form>
        </Card>

        <Card title="System Alerts">
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="font-semibold text-neutral-900">Pending request queue</p>
              <p className="mt-1 text-neutral-600">{pendingCount} requests need action.</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="font-semibold text-neutral-900">Pending student reviews</p>
              <p className="mt-1 text-neutral-600">{pendingStudentCount} students await institution review.</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <p className="font-semibold text-neutral-900">Suspended accounts</p>
              <p className="mt-1 text-neutral-600">{suspendedStudentCount} students suspended.</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="w-full">
        <div className="mb-4 border-b border-neutral-200 pb-3">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-neutral-900">Notifications</p>
            <div className="relative">
              <button
                ref={inboxMenuButtonRef}
                type="button"
                onClick={() => setIsInboxMenuOpen(previous => !previous)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Notification options"
                aria-expanded={isInboxMenuOpen}
              >
                <MoreHorizontal size={18} />
              </button>
              {isInboxMenuOpen && (
                <div ref={inboxMenuRef} className="absolute right-0 top-10 z-10 w-56 max-w-[calc(100vw-2rem)]">
                  <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      icon={<CheckCheck size={15} />}
                      onClick={() => {
                        onMarkAllNotificationsRead();
                        setIsInboxMenuOpen(false);
                      }}
                      disabled={unreadInboundCount === 0}
                      loading={isMarkingAllNotificationsRead}
                      className="w-full justify-start rounded-none px-3 font-semibold"
                    >
                      Mark all as read
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      icon={<Settings size={15} />}
                      onClick={() => setIsInboxMenuOpen(false)}
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

        {isLoadingInboundNotifications && (
          <div className="space-y-2">
            {[1, 2, 3].map(item => (
              <div key={item} className="h-24 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
            ))}
          </div>
        )}

        {!isLoadingInboundNotifications && filteredInboundNotifications.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center text-sm text-neutral-500">
            No notifications found.
          </div>
        )}

        {!isLoadingInboundNotifications && filteredInboundNotifications.length > 0 && (
          <div className="space-y-2">
            {pagedInboundNotifications.map(notification => (
              <article
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => handleInboxNotificationOpen(notification)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleInboxNotificationOpen(notification);
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
                    <p className="text-sm text-neutral-600">{getNotificationDisplayMessage(notification)}</p>
                    <p className="text-xs text-neutral-500">{formatDateTime(notification.createdAt)}</p>
                  </div>
                  {!notification.read && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={event => {
                        event.stopPropagation();
                        onMarkNotificationRead(notification.id);
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-500">
                  <Bell size={12} />
                  {notification.type.replace(/_/g, ' ')}
                </div>
              </article>
            ))}
          </div>
        )}

        {!isLoadingInboundNotifications && filteredInboundNotifications.length > 0 && (
          <PaginationControls
            currentPage={safeInboundPage}
            totalItems={filteredInboundNotifications.length}
            pageSize={inboundPageSize}
            onPageChange={setInboundPage}
            itemLabel="received notifications"
          />
        )}
      </Card>

      <Card title="Notification Activity Log">
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 text-xs font-semibold  text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Recipients</th>
                  <th className="px-4 py-3">Sent By</th>
                  <th className="px-4 py-3">Queued At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
              {notifications.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral-500">
                    No notifications sent yet.
                  </td>
                </tr>
              )}
              {pagedNotifications.map(item => (
                <tr
                  key={item.id}
                  className="hover:bg-neutral-50/70"
                >
                  <td className="px-4 py-3 text-sm text-neutral-700">{item.target}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-neutral-900">{item.title}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{item.message}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{item.recipientCount}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{item.createdByName || item.createdByEmail}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{formatDateTime(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {notifications.length > 0 && (
          <PaginationControls
            currentPage={safeCurrentPage}
            totalItems={notifications.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            itemLabel="notifications"
          />
        )}
      </Card>
    </div>
  );
}
