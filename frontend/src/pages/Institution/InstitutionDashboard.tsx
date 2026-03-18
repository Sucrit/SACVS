import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AuditAction, AuditSeverity } from '../../services/audit.service';
import Card from '../../components/common/Card';
import SearchFilterModal, { SearchFilterGroup } from '../../components/common/SearchFilterModal';
import RecordDetailsDrawer from '../../components/common/RecordDetailsDrawer';
import InstitutionStudentsSection from './components/InstitutionStudentsSection';
import InstitutionRequestsSection from './components/InstitutionRequestsSection';
import InstitutionIssueSection from './components/InstitutionIssueFormSection';
import InstitutionAwaitingIssuanceSection from './components/InstitutionAwaitingIssuanceSection';
import InstitutionCredentialManageSection from './components/InstitutionCredentialManageSection';
import InstitutionAnnouncementsSection from './components/InstitutionAnnouncementsSection';
import InstitutionNotificationsSection from './components/InstitutionNotificationsSection';
import InstitutionOverviewSection from './components/InstitutionOverviewSection';
import InstitutionAnalyticsSection from './components/InstitutionAnalyticsSection';
import InstitutionGenerateReportSection from './components/InstitutionGenerateReportSection';
import InstitutionReceiptVerifySection from './components/InstitutionReceiptVerifySection';
import InstitutionCredentialDetailsDrawer from './components/InstitutionCredentialDetailsDrawer';
import { useInstitutionDashboardState } from './useInstitutionDashboardState';

const getAuditSeverityTextClass = (severity: AuditSeverity) => {
  switch (severity) {
    case 'WARNING':
      return 'text-error-600';
    case 'CRITICAL':
      return 'text-rose-700';
    case 'INFO':
    default:
      return 'text-cyan-700';
  }
};

export default function InstitutionDashboard() {
  const state = useInstitutionDashboardState();
  const [selectedAuditLogId, setSelectedAuditLogId] = useState<string | null>(null);
  const selectedAuditLog = useMemo(
    () => state.filteredInstitutionAuditLogs.find(log => log.id === selectedAuditLogId) || null,
    [selectedAuditLogId, state.filteredInstitutionAuditLogs],
  );

  const institutionAuditFilterGroups: SearchFilterGroup[] = [
    {
      id: 'institution-audit-action',
      label: 'Action',
      value: state.auditActionFilter,
      defaultValue: 'ALL',
      options: state.institutionAuditActionOptions.map(action => ({
        value: action,
        label: action === 'ALL' ? 'All actions' : action,
      })),
      onChange: value => state.setAuditActionFilter(value as 'ALL' | AuditAction),
    },
    {
      id: 'institution-audit-severity',
      label: 'Severity',
      value: state.auditSeverityFilter,
      defaultValue: 'ALL',
      options: (['ALL', 'INFO', 'WARNING', 'CRITICAL'] as const).map(severity => ({
        value: severity,
        label: severity === 'ALL' ? 'All severities' : severity,
      })),
      onChange: value => state.setAuditSeverityFilter(value as 'ALL' | AuditSeverity),
    },
    {
      id: 'institution-audit-page-size',
      label: 'Page size',
      value: String(state.auditPageSize),
      defaultValue: '10',
      options: [10, 20, 50].map(size => ({
        value: String(size),
        label: `${size} rows`,
      })),
      onChange: value => state.setAuditPageSize(Number(value)),
    },
  ];

  return (
    <div className="space-y-6">
      {state.section === 'overview' && (
        <InstitutionOverviewSection
          students={state.students}
          requests={state.requests}
          credentials={state.credentials}
          isLoadingStudents={state.isLoadingStudents}
          isLoadingRequests={state.isLoadingRequests}
          isLoadingCredentials={state.isLoadingCredentials}
        />
      )}

      {state.section === 'analytics' && (
        <InstitutionAnalyticsSection
          students={state.students}
          requests={state.requests}
          credentials={state.credentials}
          isLoadingStudents={state.isLoadingStudents}
          isLoadingRequests={state.isLoadingRequests}
          isLoadingCredentials={state.isLoadingCredentials}
        />
      )}

      {state.section === 'reports' && (
        <InstitutionGenerateReportSection
          students={state.students}
          requests={state.requests}
          credentials={state.credentials}
          isLoadingStudents={state.isLoadingStudents}
          isLoadingRequests={state.isLoadingRequests}
          isLoadingCredentials={state.isLoadingCredentials}
        />
      )}

      {state.section === 'students' && (
        <InstitutionStudentsSection
          studentForm={state.studentForm}
          isSubmittingStudent={state.isSubmittingStudent}
          isBulkImporting={state.isBulkImporting}
          onSetStudentFormValue={state.setStudentFormValue}
          onCreateStudent={state.handleCreateStudent}
          onBulkCsvUpload={state.handleBulkCsvUpload}
          students={state.filteredStudents}
          isLoadingStudents={state.isLoadingStudents}
          studentSearch={state.studentSearch}
          studentStatusFilter={state.studentStatusFilter}
          studentDepartmentFilter={state.studentDepartmentFilter}
          departmentOptions={state.departmentOptions}
          onStudentSearchChange={state.setStudentSearch}
          onStudentStatusFilterChange={state.setStudentStatusFilter}
          onStudentDepartmentFilterChange={state.setStudentDepartmentFilter}
          updatingStudentId={state.updatingStudentId}
          onStartEditStudent={state.handleStartEditStudent}
          onStudentStatusUpdate={state.handleStudentStatusUpdate}
          onRemoveStudent={state.handleRemoveStudent}
          editingStudentId={state.editingStudentId}
          editStudentForm={state.editStudentForm}
          onSetEditStudentFormValue={state.setEditStudentFormValue}
          onSaveEditedStudent={state.handleSaveEditedStudent}
          onCancelEditStudent={state.handleCancelEditStudent}
        />
      )}

      {state.section === 'requests' && (
        <InstitutionRequestsSection
          requests={state.filteredRequests}
          students={state.students}
          isLoadingRequests={state.isLoadingRequests}
          initialDetailsRequestId={state.requestDetailsFromQueryId}
          onDetailsRequestConsumed={() => state.setRequestDetailsFromQueryId(null)}
          requestSearch={state.requestSearch}
          requestStatusFilter={state.requestStatusFilter}
          selectedRequestIds={state.selectedRequestIds}
          rejectionReasonByRequestId={state.rejectionReasonByRequestId}
          updatingRequestId={state.updatingRequestId}
          onSearchChange={state.setRequestSearch}
          onFilterChange={state.setRequestStatusFilter}
          onToggleRequest={(requestId: string) => {
            state.setSelectedRequestIds(previous => previous.includes(requestId) ? previous.filter(id => id !== requestId) : [...previous, requestId]);
          }}
          onReasonChange={(requestId: string, reason: string) => {
            state.setRejectionReasonByRequestId(previous => ({ ...previous, [requestId]: reason }));
          }}
          issueFileByRequestId={state.issueFileByRequestId}
          issueExpiryByRequestId={state.issueExpiryByRequestId}
          onIssueFileChange={(requestId: string, file: File | null) => {
            state.setIssueFileByRequestId(previous => ({ ...previous, [requestId]: file }));
          }}
          onIssueExpiryChange={(requestId: string, expiryDate: string) => {
            state.setIssueExpiryByRequestId(previous => ({ ...previous, [requestId]: expiryDate }));
          }}
          onRequestAction={state.handleRequestAction}
          onBulkAction={state.handleBulkRequestAction}
        />
      )}

      {state.section === 'receipt-verify' && (
        <InstitutionReceiptVerifySection />
      )}

      {state.section === 'issue' && (
        <InstitutionIssueSection
          students={state.students}
          onDirectIssue={state.handleDirectIssueCredential}
        />
      )}

      {state.section === 'issue-awaiting' && (
        <InstitutionAwaitingIssuanceSection
          students={state.students}
          requests={state.requests}
          isLoadingRequests={state.isLoadingRequests}
          updatingRequestId={state.updatingRequestId}
          issueFileByRequestId={state.issueFileByRequestId}
          issueExpiryByRequestId={state.issueExpiryByRequestId}
          onIssueFileChange={(requestId: string, file: File | null) => {
            state.setIssueFileByRequestId(previous => ({ ...previous, [requestId]: file }));
          }}
          onIssueExpiryChange={(requestId: string, expiryDate: string) => {
            state.setIssueExpiryByRequestId(previous => ({ ...previous, [requestId]: expiryDate }));
          }}
          onRequestAction={state.handleRequestAction}
        />
      )}

      {state.section === 'issue-manage' && (
        <InstitutionCredentialManageSection
          students={state.students}
          credentials={state.credentials}
          isLoadingCredentials={state.isLoadingCredentials}
          onCredentialStatusUpdate={state.handleCredentialStatusUpdate}
          onCredentialReissue={state.handleCredentialReissue}
          onViewCredentialDetails={(credentialId: string) => {
            state.setSelectedCredentialId(credentialId);
            state.setIsCredentialDrawerOpen(true);
          }}
        />
      )}

      {state.section === 'notifications' && (
        <InstitutionNotificationsSection
          inboundNotifications={state.inboundNotifications}
          isLoadingInboundNotifications={state.isLoadingInboundNotifications}
          isMarkingAllNotificationsRead={state.isMarkingAllNotificationsRead}
          onMarkNotificationRead={state.handleMarkNotificationRead}
          onMarkAllNotificationsRead={state.handleMarkAllNotificationsRead}
          onOpenCredential={(credentialId: string) =>
            state.navigate(`/institution/issue/manage?credentialId=${encodeURIComponent(credentialId)}`)
          }
          onOpenRequest={(requestId: string) =>
            state.navigate(`/institution/requests?requestId=${encodeURIComponent(requestId)}`)
          }
          onOpenNotificationsPage={() => state.navigate('/institution/notifications')}
        />
      )}

      {state.section === 'announcement' && (
        <InstitutionAnnouncementsSection
          notificationTarget={state.notificationTarget}
          notificationTitle={state.notificationTitle}
          notificationMessage={state.notificationMessage}
          notifications={state.outboundNotifications}
          isSubmitting={state.isSubmittingNotification}
          onTargetChange={state.setNotificationTarget}
          onTitleChange={state.setNotificationTitle}
          onMessageChange={state.setNotificationMessage}
          onSubmit={state.handleNotificationSubmit}
        />
      )}

      {state.section === 'logs' && (
        <>
          <Card title="Institution Audit Logs">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchFilterModal
                hideLabel
                groups={institutionAuditFilterGroups}
                description="Refine institution logs by action, severity, and page size."
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full min-w-160 text-left">
                <thead className="bg-neutral-50 text-xs font-medium uppercase tracking-widest text-neutral-500">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="hidden px-5 py-3 sm:table-cell">Severity</th>
                    <th className="hidden px-5 py-3 md:table-cell">Actor</th>
                    <th className="hidden px-5 py-3 lg:table-cell">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {state.isLoadingAuditLogs && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-500">
                        Loading audit logs...
                      </td>
                    </tr>
                  )}
                  {!state.isLoadingAuditLogs && state.filteredInstitutionAuditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-500">
                        No audit logs found for institution scope.
                      </td>
                    </tr>
                  )}
                  {!state.isLoadingAuditLogs &&
                    state.pagedInstitutionAuditLogs.map((log, index) => (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="cursor-pointer transition-colors hover:bg-neutral-50/70"
                        onClick={() => setSelectedAuditLogId(log.id)}
                      >
                        <td className="px-5 py-4 text-sm text-neutral-600">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-neutral-900">{log.action}</td>
                        <td className="hidden px-5 py-4 text-sm sm:table-cell">
                          <span className={`font-semibold ${getAuditSeverityTextClass(log.severity)}`}>{log.severity}</span>
                        </td>
                        <td className="hidden px-5 py-4 text-sm text-neutral-600 md:table-cell">
                          {log.actorEmail || '-'}
                        </td>
                        <td className="hidden px-5 py-4 text-sm text-neutral-600 lg:table-cell">
                          {log.description || '-'}
                        </td>
                      </motion.tr>
                    ))}
                </tbody>
              </table>
            </div>

            {!state.isLoadingAuditLogs && state.filteredInstitutionAuditLogs.length > 0 && (
              <div className="flex items-center justify-between pt-4 text-sm text-neutral-500">
                <span>
                  Page {state.currentInstitutionAuditPage} of {state.totalInstitutionAuditPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => state.setAuditPage(previous => Math.max(1, previous - 1))}
                    disabled={state.currentInstitutionAuditPage <= 1}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      state.setAuditPage(previous => Math.min(state.totalInstitutionAuditPages, previous + 1))
                    }
                    disabled={state.currentInstitutionAuditPage >= state.totalInstitutionAuditPages}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </Card>

          <RecordDetailsDrawer
            open={selectedAuditLog !== null}
            onClose={() => setSelectedAuditLogId(null)}
            title={selectedAuditLog?.action || 'Audit Log Details'}
            description="Review audit event details."
            sections={selectedAuditLog ? [
              {
                title: 'Audit Event',
                fields: [
                  { label: 'Timestamp', value: new Date(selectedAuditLog.createdAt).toLocaleString() },
                  { label: 'Action', value: selectedAuditLog.action },
                  {
                    label: 'Severity',
                    value: (
                      <span className={`font-semibold ${getAuditSeverityTextClass(selectedAuditLog.severity)}`}>
                        {selectedAuditLog.severity}
                      </span>
                    ),
                  },
                  { label: 'Actor Role', value: selectedAuditLog.actorRole || '--' },
                  { label: 'Actor', value: selectedAuditLog.actorEmail || 'System' },
                  { label: 'Target Type', value: selectedAuditLog.targetType || '--' },
                  { label: 'Description', value: selectedAuditLog.description || '--' },
                  {
                    label: 'Metadata',
                    value: selectedAuditLog.metadata ? (
                      <pre className="whitespace-pre-wrap text-xs text-neutral-700">
                        {JSON.stringify(selectedAuditLog.metadata, null, 2)}
                      </pre>
                    ) : '--',
                  },
                ],
              },
            ] : []}
          />
        </>
      )}
      {state.stepUpModal}
      <InstitutionCredentialDetailsDrawer
        credentialId={state.selectedCredentialId}
        isOpen={state.isCredentialDrawerOpen}
        onClose={() => state.setIsCredentialDrawerOpen(false)}
        onExited={() => state.setSelectedCredentialId(null)}
      />
    </div>
  );
}
