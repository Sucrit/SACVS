import { ReactNode, useMemo } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  FilePlus2,
  GraduationCap,
  ShieldCheck,
  UserCircle2,
} from 'lucide-react';
import Badge from '../../../components/common/Badge';
import Card from '../../../components/common/Card';
import { CredentialRequest } from '../../../services/credential.service';
import {
  AppNotification,
  getNotificationDisplayMessage,
} from '../../../services/notification.service';
import { User } from '../../../services/user.service';
import { formatDate, formatDateTime } from '../utils';

interface StudentHomeSectionProps {
  requests: Array<CredentialRequest & { _uiKey?: string }>;
  notifications: AppNotification[];
  institutionName?: string | null;
  user: User | null;
  isLoading: boolean;
  requestAction: ReactNode;
  cancelingRequestId?: string | null;
  onCancelRequest?: (requestId: string) => void;
  onOpenCredential: (credentialId: string) => void;
  onOpenRequest: (requestId: string) => void;
  onOpenRequestsPage: () => void;
  onOpenCredentialsPage: () => void;
  onOpenNotificationsPage: () => void;
  onOpenProfilePage: () => void;
}

type EventItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  target: 'request' | 'credential' | 'notifications';
  targetId?: string;
};

const parseMetadataString = (
  metadata: Record<string, unknown> | null,
  key: string,
): string | null => {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const sortByNewest = <T extends { createdAt: string }>(items: T[]) =>
  [...items].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return bTime - aTime;
  });

const isProfileFieldPresent = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return Boolean(value);
};

export default function StudentHomeSection({
  requests,
  notifications,
  institutionName,
  user,
  isLoading,
  requestAction,
  cancelingRequestId = null,
  onCancelRequest,
  onOpenCredential,
  onOpenRequest,
  onOpenRequestsPage,
  onOpenCredentialsPage,
  onOpenNotificationsPage,
  onOpenProfilePage,
}: StudentHomeSectionProps) {
  const recentEvents = useMemo<EventItem[]>(() => {
    const items = notifications
      .filter(notification => {
        if (notification.type === 'CREDENTIAL_ISSUED') return true;
        if (notification.type === 'CREDENTIAL_REVOKED') return true;
        if (notification.type === 'CREDENTIAL_REQUEST_UPDATE') {
          const nextStatus = parseMetadataString(notification.metadata, 'nextStatus');
          return nextStatus === 'APPROVED' || nextStatus === 'REJECTED';
        }
        return false;
      })
      .map(notification => {
        const requestId = parseMetadataString(notification.metadata, 'requestId');
        const credentialId = parseMetadataString(notification.metadata, 'credentialId');
        const target: EventItem['target'] = credentialId
          ? 'credential'
          : requestId
            ? 'request'
            : 'notifications';
        const targetId = credentialId || requestId || undefined;

        return {
          id: notification.id,
          title: notification.title,
          message: getNotificationDisplayMessage(notification, {
            institutionNameFallback: institutionName,
          }),
          createdAt: notification.createdAt,
          target,
          targetId,
        };
      });

    return sortByNewest(items).slice(0, 6);
  }, [notifications]);

  const activeRequests = useMemo(
    () =>
      sortByNewest(
        requests.filter(
          request =>
            request.status === 'PENDING' ||
            request.status === 'APPROVED' ||
            request.status === 'REJECTED' ||
            request.status === 'CANCELLED',
        ),
      ).slice(0, 5),
    [requests],
  );

  const attentionMessages = useMemo(() => {
    const messages: string[] = [];

    if (requests.some(request => request.status === 'REJECTED')) {
      messages.push('Your request was rejected: add details and resubmit.');
    }

    if (
      requests.some(
        request =>
          (request.deliveryMethod === 'PHYSICAL' || request.deliveryMethod === 'BOTH') &&
          (request.status === 'PENDING' || request.status === 'APPROVED' || request.status === 'COMPLETED'),
      )
    ) {
      messages.push(
        'You have a physical-delivery request: claim your credential at your university or institution registrar office.',
      );
    }

    if (!isProfileFieldPresent(user?.profile?.phone)) {
      messages.push('Profile missing phone number.');
    }

    return messages.slice(0, 3);
  }, [requests, user?.profile?.phone]);

  const profileCompleteness = useMemo(() => {
    const fields = [
      user?.firstName,
      user?.lastName,
      user?.email,
      user?.profile?.studentNumber,
      user?.profile?.phone,
      user?.profile?.courseOfStudy,
      user?.profile?.yearLevel,
      user?.profile?.department,
      user?.profile?.birthday,
      user?.profile?.sex,
      user?.profile?.guardianFullName,
      user?.profile?.guardianRelationship,
      user?.profile?.street,
      user?.profile?.barangay,
      user?.profile?.city,
      user?.profile?.province,
      user?.profile?.zipCode,
    ];
    const filled = fields.filter(isProfileFieldPresent).length;
    const total = fields.length;
    const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;
    return { filled, total, percentage };
  }, [
    user?.email,
    user?.firstName,
    user?.lastName,
    user?.profile?.barangay,
    user?.profile?.city,
    user?.profile?.courseOfStudy,
    user?.profile?.department,
    user?.profile?.birthday,
    user?.profile?.sex,
    user?.profile?.guardianFullName,
    user?.profile?.guardianRelationship,
    user?.profile?.phone,
    user?.profile?.province,
    user?.profile?.street,
    user?.profile?.studentNumber,
    user?.profile?.yearLevel,
    user?.profile?.zipCode,
  ]);

  const handleEventClick = (eventItem: EventItem) => {
    if (eventItem.target === 'credential' && eventItem.targetId) {
      onOpenCredential(eventItem.targetId);
      return;
    }
    if (eventItem.target === 'request' && eventItem.targetId) {
      onOpenRequest(eventItem.targetId);
      return;
    }
    onOpenNotificationsPage();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 xl:col-span-2" />
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="What’s New" className="xl:col-span-2">
          {recentEvents.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No recent events yet.
            </div>
          )}

          {recentEvents.length > 0 && (
            <div className="space-y-2">
              {recentEvents.map(eventItem => (
                <button
                  key={eventItem.id}
                  type="button"
                  onClick={() => handleEventClick(eventItem)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{eventItem.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{eventItem.message}</p>
                  <p className="mt-1.5 text-xs text-slate-500">{formatDateTime(eventItem.createdAt)}</p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Quick Actions">
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={onOpenRequestsPage}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FilePlus2 size={15} />
              New Credential Request
            </button>
            <button
              type="button"
              onClick={onOpenCredentialsPage}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ShieldCheck size={15} />
              Go to My Credentials
            </button>
            <button
              type="button"
              onClick={onOpenNotificationsPage}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Bell size={15} />
              Go to Notifications
            </button>
            <button
              type="button"
              onClick={onOpenProfilePage}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <UserCircle2 size={15} />
              Update Profile
            </button>
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="My Active Requests" className="xl:col-span-2" action={requestAction}>
          {activeRequests.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No requests yet. Create your first credential request.
            </div>
          )}

          {activeRequests.length > 0 && (
            <div className="space-y-2">
              {activeRequests.map(request => (
                <article
                  key={request.id}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="line-clamp-1 text-sm font-semibold text-slate-900">{request.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <Clock3 size={13} />
                        <span>{formatDate(request.createdAt)}</span>
                        <span className="text-slate-300">|</span>
                        <span>{request.type}</span>
                      </div>
                    </div>
                    <Badge status={request.status} />
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenRequest(request.id)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View Details
                    </button>
                    {request.status === 'PENDING' && onCancelRequest && (
                      <button
                        type="button"
                        onClick={() => onCancelRequest(request.id)}
                        disabled={cancelingRequestId === request.id}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {cancelingRequestId === request.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Attention">
            {attentionMessages.length === 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                <p className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  No urgent actions right now.
                </p>
              </div>
            )}
            {attentionMessages.length > 0 && (
              <div className="space-y-2">
                {attentionMessages.map(message => (
                  <div
                    key={message}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
                  >
                    <p className="flex items-start gap-2">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <span>{message}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Profile Completeness">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  {profileCompleteness.filled} of {profileCompleteness.total} fields
                </p>
                <p className="text-sm font-semibold text-slate-900">{profileCompleteness.percentage}%</p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all"
                  style={{ width: `${profileCompleteness.percentage}%` }}
                />
              </div>
              <button
                type="button"
                onClick={onOpenProfilePage}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <GraduationCap size={15} />
                Complete Profile
              </button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
