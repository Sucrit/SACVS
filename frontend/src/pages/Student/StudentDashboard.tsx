import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import {
  Credential,
  CredentialRequest,
  CredentialService,
  CreateCredentialRequestPayload,
  CredentialType,
  DeliveryMethod,
} from '../../services/credential.service';
import { AppNotification, NotificationService } from '../../services/notification.service';
import { User, UserService } from '../../services/user.service';
import StudentCredentialsSection from './components/StudentCredentialsSection';
import StudentCredentialDetailsSection from './components/StudentCredentialDetailsSection';
import StudentRequestSection from './components/StudentRequestSection';
import StudentEmptyStateSection from './components/StudentEmptyStateSection';
import StudentRequestHistorySection from './components/StudentRequestHistorySection';
import StudentProfileSection from './components/StudentProfileSection';
import StudentNotificationsSection from './components/StudentNotificationsSection';
import { getApiErrorMessage, getStudentCredentialDetailId, getStudentSection } from './utils';
import { useLegacyAuth } from '../../auth/auth-context';

export default function StudentDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: sessionUser } = useLegacyAuth();
  const section = getStudentSection(location.pathname);
  const credentialDetailId = getStudentCredentialDetailId(location.pathname);
  const shouldLoadCredentials = section === 'credentials';
  const shouldLoadRequests = section === 'requests';
  const shouldLoadNotifications = section === 'notifications';
  const shouldLoadProfile = section === 'profile';

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [requestDetailsFromQueryId, setRequestDetailsFromQueryId] = useState<string | null>(null);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);

  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);
  const [animatedRequestIds, setAnimatedRequestIds] = useState<string[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requests, setRequests] = useState<Array<CredentialRequest & { _uiKey?: string }>>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [isMarkingAllNotificationsRead, setIsMarkingAllNotificationsRead] = useState(false);
  const [studentProfileUser, setStudentProfileUser] = useState<User | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfilePersonalInfo, setIsSavingProfilePersonalInfo] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState<CreateCredentialRequestPayload>({
    type: 'TRANSCRIPT',
    title: '',
    description: '',
    purpose: '',
    deliveryMethod: 'DIGITAL',
  });

  const sortRequestsByNewest = (
    items: Array<CredentialRequest & { _uiKey?: string }>,
  ): Array<CredentialRequest & { _uiKey?: string }> =>
    [...items].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });

  const loadCredentials = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsLoadingCredentials(true);
      setCredentialsError(null);
    }

    try {
      const data = await CredentialService.listMine();
      setCredentials(data);
      if (!silent) {
        setCredentialsError(null);
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
      if (!silent) {
        setCredentials([]);
        setCredentialsError('Unable to load credentials from the server.');
      }
    } finally {
      if (!silent) {
        setIsLoadingCredentials(false);
      }
    }
  }, []);

  const loadRequests = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsLoadingRequests(true);
      setRequestsError(null);
    }

    try {
      const data = await CredentialService.listRequests();
      setRequests(sortRequestsByNewest(data.map(item => ({ ...item, _uiKey: item.id }))));
      if (!silent) {
        setRequestsError(null);
      }
    } catch (error) {
      console.error('Failed to load requests:', error);
      if (!silent) {
        setRequests([]);
        setRequestsError('Unable to load requests from the server.');
      }
    } finally {
      if (!silent) {
        setIsLoadingRequests(false);
      }
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    setProfileError(null);
    try {
      const me = await UserService.getMe();
      setStudentProfileUser(me);
    } catch (error) {
      console.error('Failed to load student profile:', error);
      setStudentProfileUser(null);
      setProfileError('Unable to load profile information from the server.');
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  const loadNotifications = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsLoadingNotifications(true);
      setNotificationsError(null);
    }

    try {
      const data = await NotificationService.list({ page: 1, pageSize: 100 });
      setNotifications(data.items);
      if (!silent) {
        setNotificationsError(null);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
      if (!silent) {
        setNotifications([]);
        setNotificationsError(getApiErrorMessage(error) || 'Unable to load notifications from the server.');
      }
    } finally {
      if (!silent) {
        setIsLoadingNotifications(false);
      }
    }
  }, []);

  useEffect(() => {
    if (section === 'overview') {
      navigate('/student/credentials', { replace: true });
    }
  }, [navigate, section]);

  useEffect(() => {
    if (shouldLoadCredentials) {
      void loadCredentials();
    }
    if (shouldLoadRequests) {
      void loadRequests();
    }
    if (shouldLoadNotifications) {
      void loadNotifications();
    }
    if (shouldLoadProfile) {
      void loadProfile();
    }
  }, [loadCredentials, loadNotifications, loadProfile, loadRequests, shouldLoadCredentials, shouldLoadNotifications, shouldLoadProfile, shouldLoadRequests]);

  useEffect(() => {
    if (!shouldLoadCredentials && !shouldLoadRequests && !shouldLoadNotifications) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (shouldLoadCredentials) {
        void loadCredentials({ silent: true });
      }
      if (shouldLoadRequests) {
        void loadRequests({ silent: true });
      }
      if (shouldLoadNotifications) {
        void loadNotifications({ silent: true });
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [loadCredentials, loadNotifications, loadRequests, shouldLoadCredentials, shouldLoadNotifications, shouldLoadRequests]);

  useEffect(() => {
    if (!shouldLoadCredentials) return;

    if (credentials.length === 0) {
      setSelectedCredentialId(null);
      return;
    }

    if (credentialDetailId) {
      setSelectedCredentialId(credentialDetailId);
      return;
    }

    if (!selectedCredentialId || !credentials.some(credential => credential.id === selectedCredentialId)) {
      setSelectedCredentialId(credentials[0].id);
    }
  }, [credentialDetailId, credentials, selectedCredentialId, shouldLoadCredentials]);

  useEffect(() => {
    if (section !== 'requests') {
      return;
    }

    const params = new URLSearchParams(location.search);
    const requestId = params.get('requestId');
    if (!requestId || isLoadingRequests) {
      return;
    }

    let isCancelled = false;

    const openRequestDetailsFromQuery = async () => {
      let targetRequestId: string | null =
        requests.find(request => request.id === requestId)?.id ?? null;

      if (!targetRequestId) {
        try {
          const fetched = await CredentialService.getRequestById(requestId);
          if (!isCancelled && fetched) {
            targetRequestId = fetched.id;
            setRequests(previous => {
              if (previous.some(request => request.id === fetched.id)) {
                return previous;
              }
              return [{ ...fetched, _uiKey: fetched.id }, ...previous];
            });
          }
        } catch (error) {
          console.error('Failed to fetch request from notification deep-link:', error);
        }
      }

      if (!isCancelled && targetRequestId) {
        setRequestDetailsFromQueryId(targetRequestId);
      }

      if (!isCancelled) {
        params.delete('requestId');
        const nextSearch = params.toString();
        navigate(
          {
            pathname: '/student/requests',
            search: nextSearch ? `?${nextSearch}` : '',
          },
          { replace: true },
        );
      }
    };

    void openRequestDetailsFromQuery();

    return () => {
      isCancelled = true;
    };
  }, [isLoadingRequests, location.search, navigate, requests, section]);

  const selectedCredential = useMemo(
    () => credentials.find(credential => credential.id === (credentialDetailId || selectedCredentialId)) ?? null,
    [credentialDetailId, credentials, selectedCredentialId],
  );
  const institutionName = useMemo(
    () =>
      studentProfileUser?.institution?.institutionName ||
      sessionUser?.institution?.institutionName ||
      null,
    [sessionUser?.institution?.institutionName, studentProfileUser?.institution?.institutionName],
  );
  const isCredentialsEmptyPage = section === 'credentials' && !isLoadingCredentials && credentials.length === 0;

  const renderRequestAction = (buttonClassName?: string) => (
    <StudentRequestSection
      requestForm={requestForm}
      isSubmittingRequest={isSubmittingRequest}
      requestError={requestError}
      onSubmit={handleRequestSubmit}
      onTypeChange={(value: CredentialType) => setRequestForm(previous => ({ ...previous, type: value }))}
      onTitleChange={(value: string) => setRequestForm(previous => ({ ...previous, title: value }))}
      onPurposeChange={(value: string) => setRequestForm(previous => ({ ...previous, purpose: value }))}
      onDeliveryMethodChange={(value: DeliveryMethod) =>
        setRequestForm(previous => ({ ...previous, deliveryMethod: value }))
      }
      buttonClassName={buttonClassName}
    />
  );

  const handleRequestSubmit = async (event: FormEvent<HTMLFormElement>): Promise<boolean> => {
    event.preventDefault();
    setRequestError(null);
    setIsSubmittingRequest(true);

    try {
      const created = await CredentialService.createRequest({
        type: requestForm.type,
        title: requestForm.title.trim(),
        description: requestForm.description?.trim() || undefined,
        purpose: requestForm.purpose?.trim() || undefined,
        deliveryMethod: requestForm.deliveryMethod,
      });

      if (shouldLoadRequests) {
        setRequests(previous =>
          sortRequestsByNewest([
            { ...created, _uiKey: created.id },
            ...previous.filter(request => request.id !== created.id),
          ]),
        );
        setAnimatedRequestIds(previous =>
          previous.includes(created.id) ? previous : [created.id, ...previous],
        );
      }

      setRequestForm({
        type: 'TRANSCRIPT',
        title: '',
        description: '',
        purpose: '',
        deliveryMethod: 'DIGITAL',
      });

      window.setTimeout(() => {
        setAnimatedRequestIds(previous => previous.filter(id => id !== created.id));
      }, 900);

      return true;
    } catch (error) {
      console.error('Failed to submit credential request:', error);
      setRequestError(getApiErrorMessage(error) || 'Unable to submit your request to the backend.');
      return false;
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleCancelRequest = async (requestId: string): Promise<void> => {
    setRequestsError(null);
    setCancelingRequestId(requestId);

    const previousRequest = requests.find(request => request.id === requestId) || null;
    if (previousRequest) {
      const nowIso = new Date().toISOString();
      setRequests(previous =>
        sortRequestsByNewest(
          previous.map(request =>
            request.id === requestId
              ? {
                  ...request,
                  status: 'CANCELLED',
                  updatedAt: nowIso,
                }
              : request,
          ),
        ),
      );
      setAnimatedRequestIds(previous =>
        previous.includes(requestId) ? previous : [requestId, ...previous],
      );
    }

    try {
      const updated = await CredentialService.updateRequestStatus(requestId, 'CANCELLED');
      setRequests(previous =>
        sortRequestsByNewest(
          previous.map(request =>
            request.id === requestId
              ? {
                  ...updated,
                  _uiKey: request._uiKey || updated.id,
                }
              : request,
          ),
        ),
      );
      window.setTimeout(() => {
        setAnimatedRequestIds(previous => previous.filter(id => id !== requestId));
      }, 900);
    } catch (error) {
      console.error('Failed to cancel credential request:', error);
      if (previousRequest) {
        setRequests(previous =>
          sortRequestsByNewest(
            previous.map(request => (request.id === requestId ? previousRequest : request)),
          ),
        );
      }
      setAnimatedRequestIds(previous => previous.filter(id => id !== requestId));
      setRequestsError(getApiErrorMessage(error) || 'Unable to cancel request right now.');
    } finally {
      setCancelingRequestId(null);
    }
  };

  const handleViewIssuedCredential = (credentialId: string) => {
    navigate(`/student/credentials/${encodeURIComponent(credentialId)}`);
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    setNotificationsError(null);
    try {
      const updated = await NotificationService.markRead(notificationId, true);
      setNotifications(previous =>
        previous.map(item => (item.id === notificationId ? updated : item)),
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      setNotificationsError(getApiErrorMessage(error) || 'Unable to update notification state.');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setIsMarkingAllNotificationsRead(true);
    setNotificationsError(null);
    try {
      await NotificationService.markAllRead();
      setNotifications(previous => previous.map(item => ({ ...item, read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      setNotificationsError(getApiErrorMessage(error) || 'Unable to mark all notifications as read.');
    } finally {
      setIsMarkingAllNotificationsRead(false);
    }
  };

  const handleSaveStudentPersonalInfo = async (payload: {
    street?: string;
    barangay?: string;
    city?: string;
    province?: string;
    zipCode?: number;
    phone?: string | null;
    birthday?: string | null;
    sex?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | null;
    guardianFullName?: string | null;
    guardianRelationship?: string | null;
  }) => {
    if (!studentProfileUser?.profile) {
      throw new Error('Student profile is not available yet.');
    }

    setIsSavingProfilePersonalInfo(true);
    setProfileError(null);
    try {
      const profile = studentProfileUser.profile;
      const updated = await UserService.upsertMyProfile({
        studentNumber: profile.studentNumber,
        street: payload.street ?? profile.street,
        barangay: payload.barangay ?? profile.barangay,
        city: payload.city ?? profile.city,
        province: payload.province ?? profile.province,
        zipCode: payload.zipCode ?? profile.zipCode,
        phone: payload.phone ?? profile.phone,
        courseOfStudy: profile.courseOfStudy,
        yearLevel: profile.yearLevel,
        department: profile.department,
        birthday: payload.birthday,
        sex: payload.sex,
        guardianFullName: payload.guardianFullName,
        guardianRelationship: payload.guardianRelationship,
      });
      setStudentProfileUser(updated);
    } catch (error) {
      const message = getApiErrorMessage(error) || 'Unable to update personal information.';
      setProfileError(message);
      throw new Error(message);
    } finally {
      setIsSavingProfilePersonalInfo(false);
    }
  };

  return (
    <div className="space-y-6">
      {(credentialsError || requestsError || notificationsError) &&
        (section === 'credentials' ||
          section === 'requests' ||
          section === 'notifications' ||
          section === 'overview') && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {credentialsError || requestsError || notificationsError}
        </div>
      )}
      {profileError && (section === 'profile' || section === 'overview') && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {profileError}
        </div>
      )}

      {section === 'credentials' && (
        <>
          {isCredentialsEmptyPage ? (
            <StudentEmptyStateSection
              title="No Credentials Yet"
              description="Credentials issued by your institution will appear here."
              icon={<ShieldCheck size={28} />}
            />
          ) : credentialDetailId ? (
            <StudentCredentialDetailsSection
              selectedCredential={selectedCredential}
              onBack={() => navigate('/student/credentials')}
            />
          ) : (
            <StudentCredentialsSection
              credentials={credentials}
              isLoadingCredentials={isLoadingCredentials}
              selectedCredentialId={selectedCredentialId}
              onSelectCredential={setSelectedCredentialId}
              onOpenDetails={(credentialId: string) =>
                navigate(`/student/credentials/${encodeURIComponent(credentialId)}`)
              }
              onRefresh={() => void loadCredentials()}
            />
          )}
        </>
      )}

      {section === 'requests' && (
        <StudentRequestHistorySection
          requests={requests}
          isLoadingRequests={isLoadingRequests}
          onRefresh={() => void loadRequests()}
          onViewIssuedCredential={handleViewIssuedCredential}
          onCancelRequest={(requestId: string) => void handleCancelRequest(requestId)}
          cancelingRequestId={cancelingRequestId}
          animatedRequestIds={animatedRequestIds}
          initialDetailsRequestId={requestDetailsFromQueryId}
          onDetailsRequestConsumed={() => setRequestDetailsFromQueryId(null)}
          requestAction={renderRequestAction('inline-flex h-10 items-center justify-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100')}
        />
      )}

      {section === 'notifications' && (
        <StudentNotificationsSection
          notifications={notifications}
          institutionName={institutionName}
          isLoading={isLoadingNotifications}
          onMarkAllRead={() => void handleMarkAllNotificationsRead()}
          onMarkRead={(id: string) => void handleMarkNotificationRead(id)}
          onOpenCredential={(credentialId: string) =>
            navigate(`/student/credentials/${encodeURIComponent(credentialId)}`)
          }
          onOpenRequest={(requestId: string) =>
            navigate(`/student/requests?requestId=${encodeURIComponent(requestId)}`)
          }
          onOpenNotificationsPage={() => navigate('/student/notifications')}
          isMarkingAllRead={isMarkingAllNotificationsRead}
        />
      )}

      {section === 'profile' && (
        <StudentProfileSection
          user={studentProfileUser}
          isLoading={isLoadingProfile}
          onRefresh={() => void loadProfile()}
          onSavePersonalInfo={handleSaveStudentPersonalInfo}
          isSavingPersonalInfo={isSavingProfilePersonalInfo}
        />
      )}
    </div>
  );
}
