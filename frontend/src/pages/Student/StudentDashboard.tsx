import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, FileText, House, ShieldCheck } from 'lucide-react';
import {
  Credential,
  CredentialRequest,
  CredentialService,
  CreateCredentialRequestPayload,
  CredentialType,
  DeliveryMethod,
} from '../../services/credential.service';
import StudentCredentialsSection from './components/StudentCredentialsSection';
import StudentCredentialDetailsSection from './components/StudentCredentialDetailsSection';
import StudentRequestSection from './components/StudentRequestSection';
import StudentEmptyStateSection from './components/StudentEmptyStateSection';
import StudentRequestHistorySection from './components/StudentRequestHistorySection';
import { getApiErrorMessage, getStudentSection } from './utils';

export default function StudentDashboard() {
  const location = useLocation();
  const section = getStudentSection(location.pathname);
  const shouldLoadCredentials = section === 'credentials';
  const shouldLoadRequests = section === 'requests';

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);

  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState<CreateCredentialRequestPayload>({
    type: 'TRANSCRIPT',
    title: '',
    description: '',
    purpose: '',
    deliveryMethod: 'DIGITAL',
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
      setRequests(data);
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

  useEffect(() => {
    if (shouldLoadCredentials) {
      void loadCredentials();
    }
    if (shouldLoadRequests) {
      void loadRequests();
    }
  }, [loadCredentials, loadRequests, shouldLoadCredentials, shouldLoadRequests]);

  useEffect(() => {
    if (!shouldLoadCredentials && !shouldLoadRequests) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      if (shouldLoadCredentials) {
        void loadCredentials({ silent: true });
      }
      if (shouldLoadRequests) {
        void loadRequests({ silent: true });
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [loadCredentials, loadRequests, shouldLoadCredentials, shouldLoadRequests]);

  useEffect(() => {
    if (!shouldLoadCredentials) {
      return;
    }

    if (credentials.length === 0) {
      setSelectedCredentialId(null);
      return;
    }

    if (!selectedCredentialId || !credentials.some(credential => credential.id === selectedCredentialId)) {
      setSelectedCredentialId(credentials[0].id);
    }
  }, [credentials, selectedCredentialId, shouldLoadCredentials]);

  const selectedCredential = useMemo(
    () => credentials.find(credential => credential.id === selectedCredentialId) ?? null,
    [credentials, selectedCredentialId],
  );
  const isCredentialsEmptyPage = section === 'credentials' && !isLoadingCredentials && credentials.length === 0;
  const isRequestsEmptyPage = section === 'requests' && !isLoadingRequests && requests.length === 0;

  const handleRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestError(null);
    setRequestSuccess(null);
    setIsSubmittingRequest(true);

    try {
      await CredentialService.createRequest({
        type: requestForm.type,
        title: requestForm.title.trim(),
        description: requestForm.description?.trim() || undefined,
        purpose: requestForm.purpose?.trim() || undefined,
        deliveryMethod: requestForm.deliveryMethod,
      });

      setRequestSuccess('Credential request submitted successfully.');
      setRequestForm({
        type: 'TRANSCRIPT',
        title: '',
        description: '',
        purpose: '',
        deliveryMethod: 'DIGITAL',
      });
      if (shouldLoadRequests) {
        void loadRequests();
      }
    } catch (error) {
      console.error('Failed to submit credential request:', error);
      setRequestError(getApiErrorMessage(error) || 'Unable to submit your request to the backend.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <div className="space-y-6">
      {section === 'overview' && (
        <StudentEmptyStateSection
          title="Home"
          description="Student home is empty for now."
          icon={<House size={28} />}
        />
      )}

      {(credentialsError || requestsError) && (section === 'credentials' || section === 'requests') && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {credentialsError || requestsError}
        </div>
      )}

      {section === 'credentials' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            {isCredentialsEmptyPage ? (
              <StudentEmptyStateSection
                title="No Credentials Yet"
                description="This page starts empty. Credentials issued by your institution will appear here."
                icon={<ShieldCheck size={28} />}
              />
            ) : (
              <StudentCredentialsSection
                credentials={credentials}
                isLoadingCredentials={isLoadingCredentials}
                selectedCredentialId={selectedCredentialId}
                onSelectCredential={setSelectedCredentialId}
                onRefresh={() => void loadCredentials()}
              />
            )}
          </div>

          {!isCredentialsEmptyPage && (
            <div className="space-y-6">
              <StudentCredentialDetailsSection selectedCredential={selectedCredential} />
            </div>
          )}
        </div>
      )}

      {section === 'requests' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            {isRequestsEmptyPage ? (
              <StudentEmptyStateSection
                title="No Requests Yet"
                description="This page starts empty. Submit your first credential request below."
                icon={<FileText size={28} />}
              />
            ) : (
              <StudentRequestHistorySection
                requests={requests}
                isLoadingRequests={isLoadingRequests}
              />
            )}
          </div>

          <div className="space-y-6">
            <StudentRequestSection
              requestForm={requestForm}
              isSubmittingRequest={isSubmittingRequest}
              requestError={requestError}
              requestSuccess={requestSuccess}
              onSubmit={handleRequestSubmit}
              onTypeChange={(value: CredentialType) => setRequestForm(previous => ({ ...previous, type: value }))}
              onTitleChange={(value: string) => setRequestForm(previous => ({ ...previous, title: value }))}
              onPurposeChange={(value: string) => setRequestForm(previous => ({ ...previous, purpose: value }))}
              onDeliveryMethodChange={(value: DeliveryMethod) =>
                setRequestForm(previous => ({ ...previous, deliveryMethod: value }))
              }
            />
          </div>
        </div>
      )}

      {section === 'profile' && (
        <StudentEmptyStateSection
          title="Profile"
          description="Student profile page is empty for now."
          icon={<ShieldCheck size={28} />}
        />
      )}
    </div>
  );
}
