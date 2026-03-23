import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Credential,
  CredentialRequest,
  CredentialService,
  CreateCredentialRequestPayload,
} from '../../services/credential.service';
import {
  AppNotification,
  NotificationListResponse,
  NotificationService,
} from '../../services/notification.service';
import { User, UserService } from '../../services/user.service';
import { getApiErrorMessage, getStudentCredentialDetailId, getStudentSection } from './utils';
import { useLegacyAuth } from '../../auth/auth-context';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { appQueryKeys } from '../../lib/queryKeys';
import { useToast } from '../../hooks/useToast';
import { toErrorMessage } from '../../utils/errors';
import { StudentSection } from './types';

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

const toStudentRequestUiItem = (item: CredentialRequest): CredentialRequest & { _uiKey: string } => ({
  ...item,
  _uiKey: item.id,
});

const timeSensitiveQueryOptions = {
  staleTime: 1000 * 30,
  refetchOnWindowFocus: 'always' as const,
};

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

const studentCredentialsQueryOptions = () => ({
  queryKey: appQueryKeys.student.credentials(),
  queryFn: async () => {
    try {
      return await CredentialService.listMine();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        await wait(350);
        return await CredentialService.listMine();
      }
      throw error;
    }
  },
});

const studentRequestsQueryOptions = () => ({
  queryKey: appQueryKeys.student.requests(),
  queryFn: async () => {
    const data = await CredentialService.listRequests();
    return sortRequestsByNewest(data.map(toStudentRequestUiItem));
  },
});

const studentNotificationsQueryOptions = () => ({
  queryKey: appQueryKeys.student.notifications(),
  queryFn: () => NotificationService.list({ page: 1, pageSize: 100 }),
  ...timeSensitiveQueryOptions,
});

const studentProfileQueryOptions = () => ({
  queryKey: appQueryKeys.student.profile(),
  queryFn: () => UserService.getMe(),
});

export interface StudentDashboardState {
  section: StudentSection;
  credentialDetailId: string | null;

  // Credentials
  credentials: Credential[];
  selectedCredentialId: string | null;
  setSelectedCredentialId: (id: string | null) => void;
  isLoadingCredentials: boolean;
  selectedCredential: Credential | null;
  isCredentialsEmptyPage: boolean;

  // Requests
  requests: Array<CredentialRequest & { _uiKey?: string }>;
  isLoadingRequests: boolean;
  isSubmittingRequest: boolean;
  cancelingRequestId: string | null;
  animatedRequestIds: string[];
  requestForm: CreateCredentialRequestPayload;
  setRequestForm: React.Dispatch<React.SetStateAction<CreateCredentialRequestPayload>>;
  requestDetailsFromQueryId: string | null;
  setRequestDetailsFromQueryId: (id: string | null) => void;
  handleRequestSubmit: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  handleCancelRequest: (requestId: string) => Promise<void>;

  // Notifications
  notifications: AppNotification[];
  isLoadingNotifications: boolean;
  isMarkingAllNotificationsRead: boolean;
  institutionName: string | null;
  handleMarkNotificationRead: (notificationId: string) => Promise<void>;
  handleMarkAllNotificationsRead: () => Promise<void>;

  // Profile
  studentProfileUser: User | null;
  isLoadingProfile: boolean;
  isSavingProfilePersonalInfo: boolean;
  handleSaveStudentPersonalInfo: (payload: {
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
  }) => Promise<void>;

  // Navigation
  navigate: ReturnType<typeof useNavigate>;
  handleViewIssuedCredential: (credentialId: string) => void;
}

export function useStudentDashboardState(): StudentDashboardState {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: sessionUser } = useLegacyAuth();
  const section = getStudentSection(location.pathname);
  const credentialDetailId = getStudentCredentialDetailId(location.pathname);
  const shouldLoadCredentials = section === 'credentials';
  const shouldLoadRequests = section === 'requests';
  const shouldLoadNotifications = section === 'notifications';
  const shouldLoadProfile = section === 'profile';

  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [requestDetailsFromQueryId, setRequestDetailsFromQueryId] = useState<string | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);
  const [animatedRequestIds, setAnimatedRequestIds] = useState<string[]>([]);
  const [isMarkingAllNotificationsRead, setIsMarkingAllNotificationsRead] = useState(false);
  const [isSavingProfilePersonalInfo, setIsSavingProfilePersonalInfo] = useState(false);
  const { showToast } = useToast();
  const [requestForm, setRequestForm] = useState<CreateCredentialRequestPayload>({
    type: 'TRANSCRIPT',
    title: '',
    description: '',
    purpose: '',
    deliveryMethod: 'DIGITAL',
  });

  const {
    data: credentials = [],
    isLoading: isLoadingCredentials,
    isFetching: isFetchingCredentials,
    error: credentialsError,
    status: credentialsStatus,
  } = useQuery({
    ...studentCredentialsQueryOptions(),
    enabled: shouldLoadCredentials,
  });

  const {
    data: requests = [],
    isLoading: isLoadingRequests,
    isFetching: isFetchingRequests,
    error: requestsError,
    status: requestsStatus,
  } = useQuery({
    ...studentRequestsQueryOptions(),
    enabled: shouldLoadRequests,
  });

  const {
    data: notificationsData,
    isLoading: isLoadingNotifications,
    isFetching: isFetchingNotifications,
    error: notificationsError,
    status: notificationsStatus,
  } = useQuery({
    ...studentNotificationsQueryOptions(),
    enabled: shouldLoadNotifications,
  });
  const notifications = notificationsData?.items || [];

  const {
    data: studentProfileUser = null,
    isLoading: isLoadingProfile,
    isFetching: isFetchingProfile,
    error: profileError,
    status: profileStatus,
  } = useQuery({
    ...studentProfileQueryOptions(),
    enabled: shouldLoadProfile,
  });

  const setRequestsCache = useCallback((
    updater: (previous: Array<CredentialRequest & { _uiKey?: string }>) => Array<CredentialRequest & { _uiKey?: string }>,
  ) => {
    queryClient.setQueryData(appQueryKeys.student.requests(), (oldData: Array<CredentialRequest & { _uiKey?: string }> | undefined) => {
      return updater(oldData || []);
    });
  }, [queryClient]);

  const setNotificationsCache = useCallback((
    updater: (previous: AppNotification[]) => AppNotification[],
  ) => {
    queryClient.setQueryData(appQueryKeys.student.notifications(), (oldData: NotificationListResponse | undefined) => {
      if (!oldData) {
        const nextItems = updater([]);
        return {
          items: nextItems,
          pagination: { page: 1, pageSize: 100, total: nextItems.length },
        };
      }

      const nextItems = updater(oldData.items || []);
      return {
        ...oldData,
        items: nextItems,
        pagination: {
          ...oldData.pagination,
          total: Math.max(oldData.pagination?.total || 0, nextItems.length),
        },
      };
    });
  }, [queryClient]);

  const setProfileCache = useCallback((profile: User) => {
    queryClient.setQueryData(appQueryKeys.student.profile(), profile);
  }, [queryClient]);

  const invalidateIfCached = useCallback((queryKey: ReturnType<typeof appQueryKeys.student[keyof typeof appQueryKeys.student]>) => {
    const queryState = queryClient.getQueryState(queryKey);
    if (queryState?.dataUpdatedAt) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient]);

  useEffect(() => {
    if (section === 'overview') {
      navigate('/student/credentials', { replace: true });
    }
  }, [navigate, section]);

  useEffect(() => {
    if (shouldLoadCredentials && credentialsError) {
      showToast({ variant: 'error', message: toErrorMessage(credentialsError, 'Unable to load credentials from the server.') });
    }
  }, [credentialsError, shouldLoadCredentials, showToast]);

  useEffect(() => {
    if (shouldLoadRequests && requestsError) {
      showToast({ variant: 'error', message: toErrorMessage(requestsError, 'Unable to load requests from the server.') });
    }
  }, [requestsError, shouldLoadRequests, showToast]);

  useEffect(() => {
    if (shouldLoadNotifications && notificationsError) {
      showToast({ variant: 'error', message: toErrorMessage(notificationsError, 'Unable to load notifications from the server.') });
    }
  }, [notificationsError, shouldLoadNotifications, showToast]);

  useEffect(() => {
    if (shouldLoadProfile && profileError) {
      showToast({ variant: 'error', message: toErrorMessage(profileError, 'Unable to load profile information from the server.') });
    }
  }, [profileError, shouldLoadProfile, showToast]);

  useEffect(() => {
    if (section !== 'credentials' || credentialsStatus !== 'success' || isFetchingCredentials) return;

    const timer = window.setTimeout(() => {
      void queryClient.prefetchQuery(studentRequestsQueryOptions());
    }, 150);

    return () => window.clearTimeout(timer);
  }, [credentialsStatus, isFetchingCredentials, queryClient, section]);

  useEffect(() => {
    if (section !== 'requests' || requestsStatus !== 'success' || isFetchingRequests) return;

    const timer = window.setTimeout(() => {
      void queryClient.prefetchQuery(studentCredentialsQueryOptions());
      void queryClient.prefetchQuery(studentNotificationsQueryOptions());
    }, 150);

    return () => window.clearTimeout(timer);
  }, [isFetchingRequests, queryClient, requestsStatus, section]);

  useEffect(() => {
    if (section !== 'notifications' || notificationsStatus !== 'success' || isFetchingNotifications) return;

    const timer = window.setTimeout(() => {
      void queryClient.prefetchQuery(studentRequestsQueryOptions());
    }, 150);

    return () => window.clearTimeout(timer);
  }, [isFetchingNotifications, notificationsStatus, queryClient, section]);

  useEffect(() => {
    if (section !== 'profile' || profileStatus !== 'success' || isFetchingProfile) return;

    const timer = window.setTimeout(() => {
      void queryClient.prefetchQuery(studentNotificationsQueryOptions());
      void queryClient.prefetchQuery(studentRequestsQueryOptions());
    }, 200);

    return () => window.clearTimeout(timer);
  }, [isFetchingProfile, profileStatus, queryClient, section]);

  const realtimeRefreshMap = useMemo(() => ({
    credentials: () => {
      if (shouldLoadCredentials) {
        void queryClient.invalidateQueries({ queryKey: appQueryKeys.student.credentials() });
        return;
      }
      invalidateIfCached(appQueryKeys.student.credentials());
    },
    credentialRequests: () => {
      if (shouldLoadRequests) {
        void queryClient.invalidateQueries({ queryKey: appQueryKeys.student.requests() });
        return;
      }
      invalidateIfCached(appQueryKeys.student.requests());
    },
    notifications: () => {
      if (shouldLoadNotifications) {
        void queryClient.invalidateQueries({ queryKey: appQueryKeys.student.notifications() });
        return;
      }
      invalidateIfCached(appQueryKeys.student.notifications());
    },
    users: () => {
      if (shouldLoadProfile) {
        void queryClient.invalidateQueries({ queryKey: appQueryKeys.student.profile() });
        return;
      }
      invalidateIfCached(appQueryKeys.student.profile());
    },
  }), [invalidateIfCached, queryClient, shouldLoadCredentials, shouldLoadNotifications, shouldLoadProfile, shouldLoadRequests]);

  useRealtimeSync(realtimeRefreshMap);

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
    if (!selectedCredentialId || !credentials.some(c => c.id === selectedCredentialId)) {
      setSelectedCredentialId(credentials[0].id);
    }
  }, [credentialDetailId, credentials, selectedCredentialId, shouldLoadCredentials]);

  useEffect(() => {
    if (section !== 'requests') return;
    const params = new URLSearchParams(location.search);
    const requestId = params.get('requestId');
    if (!requestId || isLoadingRequests) return;

    let isCancelled = false;

    const openRequestDetailsFromQuery = async () => {
      let targetRequestId: string | null = requests.find(r => r.id === requestId)?.id ?? null;

      if (!targetRequestId) {
        try {
          const fetched = await CredentialService.getRequestById(requestId);
          if (!isCancelled && fetched) {
            const uiRequest = toStudentRequestUiItem(fetched);
            targetRequestId = uiRequest.id;
            setRequestsCache(previous => {
              if (previous.some(r => r.id === uiRequest.id)) return previous;
              return sortRequestsByNewest([uiRequest, ...previous]);
            });
          }
        } catch (error) {
          console.error('Failed to fetch request from notification deep-link:', error);
        }
      }

      if (!isCancelled && targetRequestId) setRequestDetailsFromQueryId(targetRequestId);
      if (!isCancelled) {
        params.delete('requestId');
        const nextSearch = params.toString();
        navigate({ pathname: '/student/requests', search: nextSearch ? `?${nextSearch}` : '' }, { replace: true });
      }
    };

    void openRequestDetailsFromQuery();
    return () => { isCancelled = true; };
  }, [isLoadingRequests, location.search, navigate, requests, section, setRequestsCache]);

  const selectedCredential = useMemo(
    () => credentials.find(c => c.id === (credentialDetailId || selectedCredentialId)) ?? null,
    [credentialDetailId, credentials, selectedCredentialId],
  );

  const institutionName = useMemo(
    () => studentProfileUser?.institution?.institutionName || sessionUser?.institution?.institutionName || null,
    [sessionUser?.institution?.institutionName, studentProfileUser?.institution?.institutionName],
  );

  const isCredentialsEmptyPage = section === 'credentials' && !isLoadingCredentials && credentials.length === 0;

  const handleRequestSubmit = async (event: FormEvent<HTMLFormElement>): Promise<boolean> => {
    event.preventDefault();
    setIsSubmittingRequest(true);
    try {
      const created = await CredentialService.createRequest({
        type: requestForm.type,
        title: requestForm.title.trim(),
        description: requestForm.description?.trim() || undefined,
        purpose: requestForm.purpose?.trim() || undefined,
        deliveryMethod: requestForm.deliveryMethod,
      });

      const createdUiRequest = toStudentRequestUiItem(created);
      setRequestsCache(previous => sortRequestsByNewest([
        createdUiRequest,
        ...previous.filter(r => r.id !== createdUiRequest.id),
      ]));
      setAnimatedRequestIds(previous => previous.includes(created.id) ? previous : [created.id, ...previous]);

      setRequestForm({ type: 'TRANSCRIPT', title: '', description: '', purpose: '', deliveryMethod: 'DIGITAL' });
      window.setTimeout(() => { setAnimatedRequestIds(previous => previous.filter(id => id !== created.id)); }, 900);
      showToast({ variant: 'success', message: 'Credential request submitted successfully.' });
      return true;
    } catch (error) {
      console.error('Failed to submit credential request:', error);
      showToast({ variant: 'error', message: toErrorMessage(error, 'Unable to submit your request to the backend.') });
      return false;
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleCancelRequest = async (requestId: string): Promise<void> => {
    setCancelingRequestId(requestId);
    const previousRequests = queryClient.getQueryData<Array<CredentialRequest & { _uiKey?: string }>>(appQueryKeys.student.requests()) || [];
    const previousRequest = previousRequests.find(r => r.id === requestId) || null;
    if (previousRequest) {
      const nowIso = new Date().toISOString();
      setRequestsCache(previous => sortRequestsByNewest(
        previous.map(r => r.id === requestId ? { ...r, status: 'CANCELLED' as const, updatedAt: nowIso } : r),
      ));
      setAnimatedRequestIds(previous => previous.includes(requestId) ? previous : [requestId, ...previous]);
    }

    try {
      const updated = await CredentialService.updateRequestStatus(requestId, 'CANCELLED');
      const updatedUiRequest = toStudentRequestUiItem(updated);
      setRequestsCache(previous => sortRequestsByNewest(
        previous.map(r => r.id === requestId ? { ...updatedUiRequest, _uiKey: r._uiKey || updatedUiRequest.id } : r),
      ));
      window.setTimeout(() => { setAnimatedRequestIds(previous => previous.filter(id => id !== requestId)); }, 900);
      showToast({ variant: 'success', message: 'Request cancelled successfully.' });
    } catch (error) {
      console.error('Failed to cancel credential request:', error);
      queryClient.setQueryData(appQueryKeys.student.requests(), previousRequests);
      setAnimatedRequestIds(previous => previous.filter(id => id !== requestId));
      showToast({ variant: 'error', message: toErrorMessage(error, 'Unable to cancel request right now.') });
      if (!previousRequest) {
        void queryClient.invalidateQueries({ queryKey: appQueryKeys.student.requests() });
      }
    } finally {
      setCancelingRequestId(null);
    }
  };

  const handleViewIssuedCredential = useCallback((credentialId: string) => {
    navigate(`/student/credentials/${encodeURIComponent(credentialId)}`);
  }, [navigate]);

  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      const updated = await NotificationService.markRead(notificationId, true);
      setNotificationsCache(previous => previous.map(item => (item.id === notificationId ? updated : item)));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      showToast({ variant: 'error', message: toErrorMessage(error, 'Unable to update notification state.') });
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (isMarkingAllNotificationsRead || notifications.every(item => item.read)) return;

    setIsMarkingAllNotificationsRead(true);
    try {
      await NotificationService.markAllRead();
      setNotificationsCache(previous => previous.map(item => ({ ...item, read: true })));
      showToast({ variant: 'success', message: 'All notifications marked as read.' });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      showToast({ variant: 'error', message: toErrorMessage(error, 'Unable to mark all notifications as read.') });
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
    if (!studentProfileUser?.profile) throw new Error('Student profile is not available yet.');
    setIsSavingProfilePersonalInfo(true);
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
      setProfileCache(updated);
    } catch (error) {
      const message = getApiErrorMessage(error) || 'Unable to update personal information.';
      throw new Error(message);
    } finally {
      setIsSavingProfilePersonalInfo(false);
    }
  };

  return {
    section,
    credentialDetailId,
    credentials,
    selectedCredentialId,
    setSelectedCredentialId,
    isLoadingCredentials,
    selectedCredential,
    isCredentialsEmptyPage,
    requests,
    isLoadingRequests,
    isSubmittingRequest,
    cancelingRequestId,
    animatedRequestIds,
    requestForm,
    setRequestForm,
    requestDetailsFromQueryId,
    setRequestDetailsFromQueryId,
    handleRequestSubmit,
    handleCancelRequest,
    notifications,
    isLoadingNotifications,
    isMarkingAllNotificationsRead,
    institutionName,
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,
    studentProfileUser,
    isLoadingProfile,
    isSavingProfilePersonalInfo,
    handleSaveStudentPersonalInfo,
    navigate,
    handleViewIssuedCredential,
  };
}
