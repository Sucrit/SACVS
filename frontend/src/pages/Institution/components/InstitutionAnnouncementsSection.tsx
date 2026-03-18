import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import Card from '../../../components/common/Card';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import PaginationControls from '../../../components/common/PaginationControls';
import Modal from '../../../components/ui/Modal';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Textarea from '../../../components/ui/Textarea';
import { NotificationTarget, OutboundNotification } from '../types';
import { formatDateTime } from '../utils';

interface InstitutionAnnouncementsSectionProps {
  notificationTarget: NotificationTarget;
  notificationTitle: string;
  notificationMessage: string;
  notifications: OutboundNotification[];
  isSubmitting: boolean;
  onTargetChange: (target: NotificationTarget) => void;
  onTitleChange: (title: string) => void;
  onMessageChange: (message: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
}

export default function InstitutionAnnouncementsSection({
  notificationTarget,
  notificationTitle,
  notificationMessage,
  notifications,
  isSubmitting,
  onTargetChange,
  onTitleChange,
  onMessageChange,
  onSubmit,
}: InstitutionAnnouncementsSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const pageSize = 10;

  const totalPages = Math.max(1, Math.ceil(notifications.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedNotifications = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return notifications.slice(start, start + pageSize);
  }, [notifications, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [notifications.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    const submitted = await onSubmit(event);
    if (submitted) {
      setIsComposeModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Announcements"
        action={
          <button
            type="button"
            onClick={() => setIsComposeModalOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
          >
            <Bell size={14} />
            Notify Students
          </button>
        }
      >
        <div className="overflow-x-auto rounded-lg border border-neutral-200 pb-[10px]">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
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
                    No announcements sent yet.
                  </td>
                </tr>
              )}
              {pagedNotifications.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="hover:bg-neutral-50/70"
                >
                  <td className="px-4 py-3 text-sm text-neutral-700">{item.target}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-neutral-900">{item.title}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{item.message}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{item.recipientCount}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{item.createdByName || item.createdByEmail}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{formatDateTime(item.createdAt)}</td>
                </motion.tr>
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
            itemLabel="announcements"
          />
        )}
      </Card>

      <Modal
        open={isComposeModalOpen}
        onClose={() => setIsComposeModalOpen(false)}
        title="Send Announcement to Students"
        description="Compose a message and choose which students should receive it."
        size="lg"
      >
        <form className="space-y-4" onSubmit={event => void handleSubmit(event)}>
          <Select
            label="Recipients"
            value={notificationTarget}
            onChange={event => onTargetChange(event.target.value as NotificationTarget)}
            className="h-11 bg-neutral-50"
          >
            <option value="ALL">All active students</option>
            <option value="APPROVED_ONLY">Approved students only</option>
          </Select>
          <Input
            label="Announcement title"
            value={notificationTitle}
            onChange={event => onTitleChange(event.target.value)}
            placeholder="Announcement title"
            required
            className="h-11 bg-neutral-50"
          />
          <Textarea
            label="Announcement message"
            value={notificationMessage}
            onChange={event => onMessageChange(event.target.value)}
            rows={6}
            placeholder="Place announcement message here..."
            required
            className="bg-neutral-50"
          />
          <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={() => setIsComposeModalOpen(false)}
              className="inline-flex h-10 items-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Bell size={14} />
              {isSubmitting ? <ButtonLoadingContent label="Sending" /> : 'Send Announcement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
