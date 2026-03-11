import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import Card from '../../../components/common/Card';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import PaginationControls from '../../../components/common/PaginationControls';
import RecordDetailsDrawer from '../../../components/common/RecordDetailsDrawer';
import { NotificationTarget, OutboundNotification } from '../types';
import { AppNotification, getNotificationDisplayMessage } from '../../../services/notification.service';
import { formatDateTime } from '../utils';

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
}

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
}: InstitutionNotificationsSectionProps) {
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  const [inboundPage, setInboundPage] = useState(1);
  const inboundPageSize = 5;

  const selectedNotification = useMemo(
    () => notifications.find(notification => notification.id === selectedNotificationId) || null,
    [notifications, selectedNotificationId],
  );
  
  const totalPages = Math.max(1, Math.ceil(notifications.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedNotifications = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return notifications.slice(start, start + pageSize);
  }, [notifications, safeCurrentPage]);

  const totalInboundPages = Math.max(1, Math.ceil(inboundNotifications.length / inboundPageSize));
  const safeInboundPage = Math.min(inboundPage, totalInboundPages);
  const pagedInboundNotifications = useMemo(() => {
    const start = (safeInboundPage - 1) * inboundPageSize;
    return inboundNotifications.slice(start, start + inboundPageSize);
  }, [inboundNotifications, safeInboundPage]);

  const unreadInboundCount = inboundNotifications.filter(n => !n.read).length;

  useEffect(() => {
    setCurrentPage(1);
  }, [notifications.length]);
  
  useEffect(() => {
    setInboundPage(1);
  }, [inboundNotifications.length]);

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

      <Card>
        <div className="mb-4 flex items-center justify-between border-b border-neutral-200 pb-4">
          <p className="font-semibold text-neutral-900">Institution Inbox</p>
          {unreadInboundCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllNotificationsRead}
              disabled={isMarkingAllNotificationsRead}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
            >
              <CheckCheck size={16} />
              Mark all as read
            </button>
          )}
        </div>
        
        <div className="space-y-3">
          {inboundNotifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-neutral-500">
              {isLoadingInboundNotifications ? 'Loading notifications...' : 'No notifications received.'}
            </div>
          ) : (
            pagedInboundNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`relative flex items-start gap-3 rounded-xl border p-4 transition ${
                  notification.read ? 'border-neutral-200 bg-white' : 'border-neutral-300 bg-neutral-50 shadow-sm'
                }`}
              >
                {!notification.read && (
                  <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-blue-500 shadow-sm ring-2 ring-white" />
                )}
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <p className={`text-sm ${notification.read ? 'font-medium text-neutral-700' : 'font-semibold text-neutral-900'}`}>
                      {notification.title}
                    </p>
                    <span className="shrink-0 text-xs text-neutral-500">{formatDateTime(notification.createdAt)}</span>
                  </div>
                  <p className="text-sm text-neutral-600">{getNotificationDisplayMessage(notification)}</p>
                </div>
                {!notification.read && (
                  <button
                    type="button"
                    onClick={() => onMarkNotificationRead(notification.id)}
                    className="shrink-0 rounded bg-white px-2 py-1 text-xs font-semibold text-neutral-600 shadow-sm ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {inboundNotifications.length > 0 && (
          <div className="mt-4">
            <PaginationControls
              currentPage={safeInboundPage}
              totalItems={inboundNotifications.length}
              pageSize={inboundPageSize}
              onPageChange={setInboundPage}
              itemLabel="received notifications"
            />
          </div>
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
                  className="cursor-pointer hover:bg-neutral-50/70"
                  onClick={() => setSelectedNotificationId(item.id)}
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

      <RecordDetailsDrawer
        open={selectedNotification !== null}
        onClose={() => setSelectedNotificationId(null)}
        title={selectedNotification?.title || 'Notification Details'}
        description="Notification activity details"
        sections={selectedNotification ? [
          {
            title: 'Notification',
            fields: [
              { label: 'Target', value: selectedNotification.target },
              { label: 'Recipients', value: String(selectedNotification.recipientCount) },
              { label: 'Sent By', value: selectedNotification.createdByName || selectedNotification.createdByEmail },
              { label: 'Queued At', value: formatDateTime(selectedNotification.createdAt) },
              { label: 'Title', value: selectedNotification.title },
              { label: 'Message', value: selectedNotification.message },
            ],
          },
        ] : []}
      />
    </div>
  );
}
