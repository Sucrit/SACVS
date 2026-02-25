import { ReactNode, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  GraduationCap,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import Badge from '../../../components/common/Badge';
import Card from '../../../components/common/Card';
import { Credential, CredentialRequest } from '../../../services/credential.service';
import {
  AppNotification,
  getNotificationDisplayMessage,
} from '../../../services/notification.service';
import { User } from '../../../services/user.service';
import { formatDate, formatDateTime, getCredentialFileUrl } from '../utils';

interface StudentHomeSectionProps {
  credentials: Credential[];
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
  onOpenNotificationsPage: () => void;
  onOpenProfilePage: () => void;
}

type RecentUpdateItem = {
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
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
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

const formatCredentialTypeLabel = (value: string | null | undefined) => {
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map(part => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ');
};

const copyText = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Ignore clipboard failures silently for non-secure contexts.
  }
};

export default function StudentHomeSection({
  credentials,
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
  onOpenNotificationsPage,
  onOpenProfilePage,
}: StudentHomeSectionProps) {
  const mostRecentCredential = useMemo(() => {
    if (credentials.length === 0) return null;

    const toTimestamp = (value: string | null | undefined) => {
      if (!value) return 0;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };

    return [...credentials].sort((a, b) => {
      const aTime = toTimestamp(a.issuedDate || a.createdAt);
      const bTime = toTimestamp(b.issuedDate || b.createdAt);
      return bTime - aTime;
    })[0];
  }, [credentials]);

  const latestCredentialFileUrl = useMemo(
    () => getCredentialFileUrl(mostRecentCredential?.storageKey ?? null),
    [mostRecentCredential?.storageKey],
  );

  const summaryCounts = useMemo(() => {
    const pendingRequests = requests.filter(request => request.status === 'PENDING').length;
    const needsAction = requests.filter(
      request => request.status === 'REJECTED' || request.status === 'CANCELLED',
    ).length;
    const unreadNotifications = notifications.filter(notification => !notification.read).length;

    const readyCredentials = notifications.filter(notification => {
      if (notification.read) return false;
      if (notification.type !== 'CREDENTIAL_ISSUED') return false;
      const event = parseMetadataString(notification.metadata, 'event');
      return !event || event === 'ISSUED' || event === 'REISSUED';
    }).length;

    return { pendingRequests, readyCredentials, unreadNotifications, needsAction };
  }, [notifications, requests]);

  const recentUpdates = useMemo<RecentUpdateItem[]>(() => {
    return sortByNewest(
      notifications
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
          const target: RecentUpdateItem['target'] = credentialId
            ? 'credential'
            : requestId
              ? 'request'
              : 'notifications';

          return {
            id: notification.id,
            title: notification.title,
            message: getNotificationDisplayMessage(notification, {
              institutionNameFallback: institutionName,
            }),
            createdAt: notification.createdAt,
            target,
            targetId: credentialId || requestId || undefined,
          };
        }),
    ).slice(0, 3);
  }, [institutionName, notifications]);

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
      ).slice(0, 3),
    [requests],
  );

  const actionNeededMessages = useMemo(() => {
    const messages: string[] = [];

    if (requests.some(request => request.status === 'REJECTED')) {
      messages.push('Your request was rejected. Update details and submit a new request.');
    }

    if (
      requests.some(
        request =>
          (request.deliveryMethod === 'PHYSICAL' || request.deliveryMethod === 'BOTH') &&
          (request.status === 'PENDING' ||
            request.status === 'APPROVED' ||
            request.status === 'COMPLETED'),
      )
    ) {
      messages.push(
        'Physical delivery selected. Claim credentials at your university or institution registrar office.',
      );
    }

    if (!isProfileFieldPresent(user?.profile?.phone)) {
      messages.push('Add your phone number to complete your profile details.');
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
    user?.profile?.birthday,
    user?.profile?.city,
    user?.profile?.courseOfStudy,
    user?.profile?.department,
    user?.profile?.guardianFullName,
    user?.profile?.guardianRelationship,
    user?.profile?.phone,
    user?.profile?.province,
    user?.profile?.sex,
    user?.profile?.street,
    user?.profile?.studentNumber,
    user?.profile?.yearLevel,
    user?.profile?.zipCode,
  ]);

  const handleRecentUpdateClick = (item: RecentUpdateItem) => {
    if (item.target === 'credential' && item.targetId) {
      onOpenCredential(item.targetId);
      return;
    }
    if (item.target === 'request' && item.targetId) {
      onOpenRequest(item.targetId);
      return;
    }
    onOpenNotificationsPage();
  };

  const handleShareLatestCredential = async () => {
    if (!mostRecentCredential || !latestCredentialFileUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: mostRecentCredential.title,
          text: `Credential: ${mostRecentCredential.title}`,
          url: latestCredentialFileUrl,
        });
        return;
      } catch {
        // Fall through to clipboard for unsupported/cancelled share dialogs.
      }
    }

    await copyText(latestCredentialFileUrl);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={`summary-skeleton-${idx}`}
              className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 xl:col-span-2" />
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Pending Requests</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{summaryCounts.pendingRequests}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Ready Credentials</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{summaryCounts.readyCredentials}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Unread Notifications</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{summaryCounts.unreadNotifications}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Needs Action</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{summaryCounts.needsAction}</p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Most Recent Credential" className="xl:col-span-2">
          {!mostRecentCredential && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No credentials yet.
            </div>
          )}

          {mostRecentCredential && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => onOpenCredential(mostRecentCredential.id)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <p className="line-clamp-1 text-sm font-semibold text-slate-900">{mostRecentCredential.title}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span>{formatCredentialTypeLabel(mostRecentCredential.type)}</span>
                  <span className="text-slate-300">|</span>
                  <span>{formatDateTime(mostRecentCredential.issuedDate || mostRecentCredential.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-xs font-medium text-slate-700">
                  Status: {mostRecentCredential.status}
                </p>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenCredential(mostRecentCredential.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ShieldCheck size={13} />
                  Open Credential
                </button>
                {latestCredentialFileUrl && (
                  <a
                    href={latestCredentialFileUrl}
                    download={mostRecentCredential.filename || `${mostRecentCredential.title}.pdf`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download size={13} />
                    Download
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void handleShareLatestCredential()}
                  disabled={!latestCredentialFileUrl}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Share2 size={13} />
                  Share
                </button>
              </div>
            </div>
          )}
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
                <article key={request.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
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
          {actionNeededMessages.length > 0 && (
            <Card title="Action Needed">
              <div className="space-y-2">
                {actionNeededMessages.map(message => (
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
            </Card>
          )}

          <Card title="Recent Updates (Since Last Login)">
            {recentUpdates.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No recent updates.
              </div>
            )}
            {recentUpdates.length > 0 && (
              <div className="space-y-2">
                {recentUpdates.map(update => (
                  <button
                    key={update.id}
                    type="button"
                    onClick={() => handleRecentUpdateClick(update)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <p className="line-clamp-1 text-sm font-semibold text-slate-900">{update.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{update.message}</p>
                    <p className="mt-1.5 text-xs text-slate-500">{formatDateTime(update.createdAt)}</p>
                  </button>
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
              {profileCompleteness.percentage >= 100 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                  <p className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    Profile is complete.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenProfilePage}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <GraduationCap size={15} />
                  Complete Profile
                </button>
              )}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
