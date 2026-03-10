import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Credential,
  CredentialRequest,
  CredentialService,
  CreateCredentialRequestPayload,
} from '../../services/credential.service';
import { AppNotification, NotificationService } from '../../services/notification.service';
import { User, UserService } from '../../services/user.service';
import { getApiErrorMessage, getStudentCredentialDetailId, getStudentSection } from './utils';
import { useLegacyAuth } from '../../auth/auth-context';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
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
  const [hasLoadedCredentials, setHasLoadedCredentials] = useState(false);

  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);
  const [animatedRequestIds, setAnimatedRequestIds] = useState<string[]>([]);
  const [requests, setRequests] = useState<Array<CredentialRequest & { _uiKey?: string }>>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [hasLoadedRequests, setHasLoadedRequests] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [hasLoadedNotifications, setHasLoadedNotifications] = useState(false);
  const [isMarkingAllNotificationsRead, setIsMarkingAllNotificationsRead] = useState(false);
  const [studentProfileUser, setStudentProfileUser] = useState<User | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfilePersonalInfo, setIsSavingProfilePersonalInfo] = useState(false);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const { showToast } = useToast();
  const [requestForm, setRequestForm] = useState<CreateCredentialRequestPayload>({
    type: 'TRANSCRIPT',
    title: '',
    description: '',
    purpose: '',
    deliveryMethod: 'DIGITAL',
  });

  // --- Data loaders ---

  const loadCredentials = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setIsLoadingCredentials(true);
    try {
      const data = await CredentialService.listMine();
      setCredentials(data);
      setHasLoadedCredentials(true);
    } catch (error) {
      console.error('Failed to load credentials:', error);
      if (!silent) {
        setCredentials([]);
        showToast({ variant: 'error', message: toErrorMessage(error, 'Unable to load credentials from the server.') });
      }
    } finally {
      if (!silent) setIsLoadingCredentials(false);
    }
  }, [showToast]);

  const loadRequests = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setIsLoadingRequests(true);
    try {
      const data = await CredentialService.listRequests();
      setRequests(sortRequestsByNewest(data.map(item => ({ ...item, _uiKey: item.id }))));
      setHasLoadedRequests(true);
    } catch (error) {
      console.error('Failed to load requests:', error);
      if (!silent) {
        setRequests([]);
        showToast({ variant: 'error', message: toErrorMessage(error, 'Unable to load requests from the server.') });
      }
    } finally {
      if (!silent) setIsLoadingRequests(false);
    }
  }, [showToast]);

  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    try {
      const me = await UserService.getMe();
      setStudentProfileUser(me);
      setHasLoadedProfile(true);
    } catch (error) {
      console.error('Failed to load student profile:', error);
      setStudentProfileUser(null);
      showToast({ variant: 'error', message: toErrorMessage(error, 'Unable to load profile information from the server.') });
    } finally {
      setIsLoadingProfile(false);
    }
  }, [showToast]);

  const loadNotifications = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setIsLoadingNotifications(true);
    try {
      const data = await NotificationService.list({ page: 1, pageSize: 100 });
      setNotifications(data.items);
      setHasLoadedNotifications(true);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      if (!silent) {
        setNotifications([]);
        showToast({ variant: 'error', message: toErrorMessage(error, 'Unable to load notifications from the server.') });
      }
    } finally {
      if (!silent) setIsLoadingNotifications(false);
    }
  }, [showToast]);

  // --- Realtime sync ---

  const realtimeRefreshMap = useMemo(() => ({
    credentials: () => { if (shouldLoadCredentials) void loadCredentials({ silent: true }); },
    credentialRequests: () => { if (shouldLoadRequests) void loadRequests({ silent: true }); },
    notifications: () => { if (shouldLoadNotifications) void loadNotifications({ silent: true }); },
    users: () => { if (shouldLoadProfile) void loadProfile(); },
  }), [loadCredentials, loadNotifications, loadProfile, loadRequests, shouldLoadCredentials, shouldLoadNotifications, shouldLoadProfile, shouldLoadRequests]);

  useRealtimeSync(realtimeRefreshMap);

  // --- Section-based lazy loading ---

  useEffect(() => {
    if (section === 'overview') {
      navigate('/student/credentials', { replace: true });
    }
  }, [navigate, section]);

  useEffect(() => {
    if (shouldLoadCredentials && !hasLoadedCredentials) void loadCredentials();
    if (shouldLoadRequests && !hasLoadedRequests) void loadRequests();
    if (shouldLoadNotifications && !hasLoadedNotifications) void loadNotifications();
    if (shouldLoadProfile && !hasLoadedProfile) void loadProfile();
  }, [
    hasLoadedCredentials, hasLoadedNotifications, hasLoadedProfile, hasLoadedRequests,
    loadCredentials, loadNotifications, loadProfile, loadRequests,
    shouldLoadCredentials, shouldLoadNotifications, shouldLoadProfile, shouldLoadRequests,
  ]);

  // --- Credential selection sync ---

  useEffect(() => {
    if (!shouldLoadCredentials) return;
    if (credentials.length === 0) { setSelectedCredentialId(null); return; }
    if (credentialDetailId) { setSelectedCredentialId(credentialDetailId); return; }
    if (!selectedCredentialId || !credentials.some(c => c.id === selectedCredentialId)) {
      setSelectedCredentialId(credentials[0].id);
    }
  }, [credentialDetailId, credentials, selectedCredentialId, shouldLoadCredentials]);

  // --- Request deep-link from notifications ---

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
            targetRequestId = fetched.id;
            setRequests(previous => {
              if (previous.some(r => r.id === fetched.id)) return previous;
              return [{ ...fetched, _uiKey: fetched.id }, ...previous];
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
  }, [isLoadingRequests, location.search, navigate, requests, section]);

  // --- Computed ---

  const selectedCredential = useMemo(
    () => credentials.find(c => c.id === (credentialDetailId || selectedCredentialId)) ?? null,
    [credentialDetailId, credentials, selectedCredentialId],
  );

  const institutionName = useMemo(
    () => studentProfileUser?.institution?.institutionName || sessionUser?.institution?.institutionName || null,
    [sessionUser?.institution?.institutionName, studentProfileUser?.institution?.institutionName],
  );

  const isCredentialsEmptyPage = section === 'credentials' && !isLoadingCredentials && credentials.length === 0;

  // --- Handlers ---

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

      if (shouldLoadRequests) {
        setRequests(previous => sortRequestsByNewest([
          { ...created, _uiKey: created.id },
          ...previous.filter(r => r.id !== created.id),
        ]));
        setAnimatedRequestIds(previous => previous.includes(created.id) ? previous : [created.id, ...previous]);
      }

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
    const previousRequest = requests.find(r => r.id === requestId) || null;
    if (previousRequest) {
      const nowIso = new Date().toISOString();
      setRequests(previous => sortRequestsByNewest(
        previous.map(r => r.id === requestId ? { ...r, status: 'CANCELLED' as const, updatedAt: nowIso } : r),
      ));
      setAnimatedRequestIds(previous => previous.includes(requestId) ? previous : [requestId, ...previous]);
    }

    try {
      const updated = await CredentialService.updateRequestStatus(requestId, 'CANCELLED');
      setRequests(previous => sortRequestsByNewest(
        previous.map(r => r.id === requestId ? { ...updated, _uiKey: r._uiKey || updated.id } : r),
      ));
      window.setTimeout(() => { setAnimatedRequestIds(previous => previous.filter(id => id !== requestId)); }, 900);
      showToast({ variant: 'success', message: 'Request cancelled successfully.' });
    } catch (error) {
      console.error('Failed to cancel credential request:', error);
      if (previousRequest) {
        setRequests(previous => sortRequestsByNewest(previous.map(r => (r.id === requestId ? previousRequest : r))));
      }
      setAnimatedRequestIds(previous => previous.filter(id => id !== requestId));
      showToast({ variant: 'error', message: toErrorMessage(error, 'Unable to cancel request right now.') });
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
      setNotifications(previous => previous.map(item => (item.id === notificationId ? updated : item)));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      showToast({ variant: 'error', message: toErrorMessage(error, 'Unable to update notification state.') });
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setIsMarkingAllNotificationsRead(true);
    try {
      await NotificationService.markAllRead();
      setNotifications(previous => previous.map(item => ({ ...item, read: true })));
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
      setStudentProfileUser(updated);
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
