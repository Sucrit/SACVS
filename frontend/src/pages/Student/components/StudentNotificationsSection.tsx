import NotificationsInboxCard from '../../../components/notifications/NotificationsInboxCard';
import {
  AppNotification,
  getNotificationDisplayMessage,
} from '../../../services/notification.service';
import { getNotificationMetadataEvent } from '../../../components/notifications/notificationMetadata';
import { resolveStudentNotificationDestination } from '../notificationDestination';

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

const isCredentialReissued = (notification: AppNotification): boolean => {
  const metadataEvent = getNotificationMetadataEvent(notification);
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
  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.read) {
      void onMarkRead(notification.id);
    }

    const destination = resolveStudentNotificationDestination(notification);
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
      className="mx-auto w-full max-w-3xl"
      notifications={notifications}
      isLoading={isLoading}
      isMarkingAllRead={isMarkingAllRead}
      onMarkAllRead={onMarkAllRead}
      onNotificationClick={handleNotificationClick}
      getMessage={notification =>
        getNotificationDisplayMessage(notification, {
          institutionNameFallback: institutionName,
        })
      }
      renderTitleExtras={notification =>
        isCredentialReissued(notification) ? (
          <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-600">
            Credential re-issued
          </span>
        ) : null
      }
    />
  );
}
