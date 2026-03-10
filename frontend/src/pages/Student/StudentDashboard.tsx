import { ShieldCheck } from 'lucide-react';
import {
  CredentialType,
  DeliveryMethod,
} from '../../services/credential.service';
import StudentCredentialsSection from './components/StudentCredentialsSection';
import StudentCredentialDetailsSection from './components/StudentCredentialDetailsSection';
import StudentRequestSection from './components/StudentRequestSection';
import StudentEmptyStateSection from './components/StudentEmptyStateSection';
import StudentRequestHistorySection from './components/StudentRequestHistorySection';
import StudentProfileSection from './components/StudentProfileSection';
import StudentNotificationsSection from './components/StudentNotificationsSection';
import { useStudentDashboardState } from './useStudentDashboardState';

export default function StudentDashboard() {
  const state = useStudentDashboardState();

  const renderRequestAction = (buttonClassName?: string) => (
    <StudentRequestSection
      requestForm={state.requestForm}
      isSubmittingRequest={state.isSubmittingRequest}
      onSubmit={state.handleRequestSubmit}
      onTypeChange={(value: CredentialType) => state.setRequestForm(previous => ({ ...previous, type: value }))}
      onTitleChange={(value: string) => state.setRequestForm(previous => ({ ...previous, title: value }))}
      onPurposeChange={(value: string) => state.setRequestForm(previous => ({ ...previous, purpose: value }))}
      onDeliveryMethodChange={(value: DeliveryMethod) =>
        state.setRequestForm(previous => ({ ...previous, deliveryMethod: value }))
      }
      buttonClassName={buttonClassName}
    />
  );

  return (
    <div className="space-y-6">
      {state.section === 'credentials' && (
        <>
          {state.isCredentialsEmptyPage ? (
            <StudentEmptyStateSection
              title="No Digital Credentials Yet"
              description="Credentials issued by your institution will appear here."
              icon={<ShieldCheck size={28} />}
            />
          ) : state.credentialDetailId ? (
            <StudentCredentialDetailsSection
              selectedCredential={state.selectedCredential}
              onBack={() => state.navigate('/student/credentials')}
            />
          ) : (
            <StudentCredentialsSection
              credentials={state.credentials}
              isLoadingCredentials={state.isLoadingCredentials}
              selectedCredentialId={state.selectedCredentialId}
              onSelectCredential={state.setSelectedCredentialId}
              onOpenDetails={(credentialId: string) =>
                state.navigate(`/student/credentials/${encodeURIComponent(credentialId)}`)
              }
            />
          )}
        </>
      )}

      {state.section === 'requests' && (
        <StudentRequestHistorySection
          requests={state.requests}
          isLoadingRequests={state.isLoadingRequests}
          onViewIssuedCredential={state.handleViewIssuedCredential}
          onCancelRequest={(requestId: string) => void state.handleCancelRequest(requestId)}
          cancelingRequestId={state.cancelingRequestId}
          animatedRequestIds={state.animatedRequestIds}
          initialDetailsRequestId={state.requestDetailsFromQueryId}
          onDetailsRequestConsumed={() => state.setRequestDetailsFromQueryId(null)}
          requestAction={renderRequestAction('inline-flex h-10 items-center justify-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100')}
        />
      )}

      {state.section === 'notifications' && (
        <StudentNotificationsSection
          notifications={state.notifications}
          institutionName={state.institutionName}
          isLoading={state.isLoadingNotifications}
          onMarkAllRead={() => void state.handleMarkAllNotificationsRead()}
          onMarkRead={(id: string) => void state.handleMarkNotificationRead(id)}
          onOpenCredential={(credentialId: string) =>
            state.navigate(`/student/credentials/${encodeURIComponent(credentialId)}`)
          }
          onOpenRequest={(requestId: string) =>
            state.navigate(`/student/requests?requestId=${encodeURIComponent(requestId)}`)
          }
          onOpenNotificationsPage={() => state.navigate('/student/notifications')}
          isMarkingAllRead={state.isMarkingAllNotificationsRead}
        />
      )}

      {state.section === 'profile' && (
        <StudentProfileSection
          user={state.studentProfileUser}
          isLoading={state.isLoadingProfile}
          onSavePersonalInfo={state.handleSaveStudentPersonalInfo}
          isSavingPersonalInfo={state.isSavingProfilePersonalInfo}
        />
      )}
    </div>
  );
}
