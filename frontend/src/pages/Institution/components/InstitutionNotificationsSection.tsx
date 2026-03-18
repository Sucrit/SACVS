import NotificationsInboxCard from '../../../components/notifications/NotificationsInboxCard';
import { AppNotification, getNotificationDisplayMessage } from '../../../services/notification.service';
import { resolveInstitutionNotificationDestination } from '../notificationDestination';

interface InstitutionNotificationsSectionProps {
  inboundNotifications: AppNotification[];
  isLoadingInboundNotifications: boolean;
  isMarkingAllNotificationsRead: boolean;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onOpenCredential: (credentialId: string) => void;
  onOpenRequest: (requestId: string) => void;
  onOpenNotificationsPage: () => void;
}

export default function InstitutionNotificationsSection({
  inboundNotifications,
  isLoadingInboundNotifications,
  isMarkingAllNotificationsRead,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onOpenCredential,
  onOpenRequest,
  onOpenNotificationsPage,
}: InstitutionNotificationsSectionProps) {
  const handleInboxNotificationOpen = (notification: AppNotification) => {
    if (!notification.read) {
      onMarkNotificationRead(notification.id);
    }

    const destination = resolveInstitutionNotificationDestination(notification);
    if (destination.kind === 'credential') {
      onOpenCredential(destination.credentialId);
      return;
    }
    if (destination.kind === 'request') {
      onOpenRequest(destination.requestId);
      return;
    }
    onOpenNotificationsPage();
  };

  return (
    <NotificationsInboxCard
      className="w-full"
      notifications={inboundNotifications}
      isLoading={isLoadingInboundNotifications}
      isMarkingAllRead={isMarkingAllNotificationsRead}
      onMarkAllRead={onMarkAllNotificationsRead}
      onNotificationClick={handleInboxNotificationOpen}
      pageSize={8}
      itemLabel="received notifications"
      getMessage={getNotificationDisplayMessage}
    />
  );
}
