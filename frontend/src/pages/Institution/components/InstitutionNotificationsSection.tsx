import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import Card from '../../../components/common/Card';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import PaginationControls from '../../../components/common/PaginationControls';
import RecordDetailsDrawer from '../../../components/common/RecordDetailsDrawer';
import { NotificationTarget, OutboundNotification } from '../types';
import { formatDateTime } from '../utils';

interface InstitutionNotificationsSectionProps {
  notificationTarget: NotificationTarget;
  notificationTitle: string;
  notificationMessage: string;
  pendingCount: number;
  pendingStudentCount: number;
  suspendedStudentCount: number;
  notifications: OutboundNotification[];
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
  isSubmitting,
  onTargetChange,
  onTitleChange,
  onMessageChange,
  onSubmit,
}: InstitutionNotificationsSectionProps) {
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
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

  useEffect(() => {
    setCurrentPage(1);
  }, [notifications.length]);

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
