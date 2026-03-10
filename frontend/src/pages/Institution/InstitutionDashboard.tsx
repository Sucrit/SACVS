import { AuditAction, AuditSeverity } from '../../services/audit.service';
import InstitutionStudentsSection from './components/InstitutionStudentsSection';
import InstitutionRequestsSection from './components/InstitutionRequestsSection';
import InstitutionIssueSection from './components/InstitutionIssueSection';
import InstitutionNotificationsSection from './components/InstitutionNotificationsSection';
import InstitutionOverviewSection from './components/InstitutionOverviewSection';
import InstitutionAnalyticsSection from './components/InstitutionAnalyticsSection';
import InstitutionReceiptVerifySection from './components/InstitutionReceiptVerifySection';
import InstitutionCredentialDetailsDrawer from './components/InstitutionCredentialDetailsDrawer';
import { useInstitutionDashboardState } from './useInstitutionDashboardState';

export default function InstitutionDashboard() {
  const state = useInstitutionDashboardState();

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
          credentials={state.credentials}
          isLoadingCredentials={state.isLoadingCredentials}
          requests={state.requests}
          isLoadingRequests={state.isLoadingRequests}
          updatingRequestId={state.updatingRequestId}
          onDirectIssue={state.handleDirectIssueCredential}
          onCredentialStatusUpdate={state.handleCredentialStatusUpdate}
          onCredentialReissue={state.handleCredentialReissue}
          issueFileByRequestId={state.issueFileByRequestId}
          issueExpiryByRequestId={state.issueExpiryByRequestId}
          onIssueFileChange={(requestId: string, file: File | null) => {
            state.setIssueFileByRequestId(previous => ({ ...previous, [requestId]: file }));
          }}
          onIssueExpiryChange={(requestId: string, expiryDate: string) => {
            state.setIssueExpiryByRequestId(previous => ({ ...previous, [requestId]: expiryDate }));
          }}
          onRequestAction={state.handleRequestAction}
          onViewCredentialDetails={(credentialId: string) => {
            state.setSelectedCredentialId(credentialId);
            state.setIsCredentialDrawerOpen(true);
          }}
        />
      )}

      {state.section === 'notifications' && (
        <InstitutionNotificationsSection
          notificationTarget={state.notificationTarget}
          notificationTitle={state.notificationTitle}
          notificationMessage={state.notificationMessage}
          pendingCount={state.pendingCount}
          pendingStudentCount={state.studentCounts.pending}
          suspendedStudentCount={state.studentCounts.suspended}
          notifications={state.outboundNotifications}
          isSubmitting={state.isSubmittingNotification}
          onTargetChange={state.setNotificationTarget}
          onTitleChange={state.setNotificationTitle}
          onMessageChange={state.setNotificationMessage}
          onSubmit={state.handleNotificationSubmit}
        />
      )}

      {state.section === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Institution Audit Logs</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Action</label>
              <select
                value={state.auditActionFilter}
                onChange={event => state.setAuditActionFilter(event.target.value as 'ALL' | AuditAction)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                {state.institutionAuditActionOptions.map(action => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Severity</label>
              <select
                value={state.auditSeverityFilter}
                onChange={event => state.setAuditSeverityFilter(event.target.value as 'ALL' | AuditSeverity)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                {(['ALL', 'INFO', 'WARNING', 'CRITICAL'] as const).map(severity => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Page Size</label>
              <select
                value={state.auditPageSize}
                onChange={event => state.setAuditPageSize(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              >
                {[10, 20, 50].map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {state.filteredInstitutionAuditLogs.length} entries
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {state.isLoadingAuditLogs && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      Loading audit logs...
                    </td>
                  </tr>
                )}
                {!state.isLoadingAuditLogs && state.filteredInstitutionAuditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      No audit logs found for institution scope.
                    </td>
                  </tr>
                )}
                {!state.isLoadingAuditLogs &&
                  state.pagedInstitutionAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-xs text-slate-600">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800">{log.action}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{log.severity}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{log.actorEmail || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{log.description || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!state.isLoadingAuditLogs && state.filteredInstitutionAuditLogs.length > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Page {state.currentInstitutionAuditPage} of {state.totalInstitutionAuditPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => state.setAuditPage(previous => Math.max(1, previous - 1))}
                  disabled={state.currentInstitutionAuditPage <= 1}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    state.setAuditPage(previous => Math.min(state.totalInstitutionAuditPages, previous + 1))
                  }
                  disabled={state.currentInstitutionAuditPage >= state.totalInstitutionAuditPages}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
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
