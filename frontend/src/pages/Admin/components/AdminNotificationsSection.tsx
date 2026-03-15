import { type ReactNode } from 'react';
import NotificationsInboxCard from '../../../components/notifications/NotificationsInboxCard';
import {
  AppNotification,
  getNotificationDisplayMessage,
} from '../../../services/notification.service';
import { resolveAdminNotificationDestination } from '../notificationDestination';

interface AdminNotificationsSectionProps {
  notifications: AppNotification[];
  isLoading: boolean;
  isMarkingAllRead: boolean;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void | Promise<void>;
  onOpenUsers: (options?: {
    userId?: string | null;
    roleFilter?: 'INSTITUTION' | 'ADMIN' | 'STUDENT' | null;
    statusFilter?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | null;
  }) => void;
  onOpenRiskReview: (options?: {
    riskEventId?: string | null;
    targetId?: string | null;
    actorId?: string | null;
  }) => void;
  onOpenNotificationsPage: () => void;
}

const renderNotificationFooter = (notification: AppNotification): ReactNode => {
  return notification.type.replace(/_/g, ' ');
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
  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.read) {
      void onMarkRead(notification.id);
    }

    const destination = resolveAdminNotificationDestination(notification);
    if (destination.kind === 'risk') {
      onOpenRiskReview({
        riskEventId: destination.riskEventId,
        targetId: destination.targetId,
        actorId: destination.actorId,
      });
      return;
    }
    if (destination.kind === 'users') {
      onOpenUsers({
        userId: destination.userId,
        roleFilter: destination.roleFilter,
        statusFilter: destination.statusFilter,
      });
      return;
    }
    onOpenNotificationsPage();
  };

  return (
    <NotificationsInboxCard
      className="w-full"
      notifications={notifications}
      isLoading={isLoading}
      isMarkingAllRead={isMarkingAllRead}
      onMarkAllRead={onMarkAllRead}
      onNotificationClick={handleNotificationClick}
      getMessage={getNotificationDisplayMessage}
      renderFooter={renderNotificationFooter}
    />
  );
}
