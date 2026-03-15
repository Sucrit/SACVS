
import { useMemo, useState } from 'react';
import { Download, FileText, Filter, ShieldCheck, Sparkles } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import type { AuditLogEntry } from '../../../services/audit.service';
import type { CredentialRequest } from '../../../services/credential.service';
import type { AppNotification } from '../../../services/notification.service';
import type { RiskEventRecord } from '../../../services/risk.service';
import type { User } from '../../../services/user.service';
import {
  ADMIN_REPORT_AUDIT_SEVERITY_OPTIONS,
  ADMIN_REPORT_DATE_RANGE_OPTIONS,
  ADMIN_REPORT_REQUEST_STATUS_OPTIONS,
  ADMIN_REPORT_RISK_BAND_OPTIONS,
  ADMIN_REPORT_RISK_REVIEW_OPTIONS,
  ADMIN_REPORT_ROLE_OPTIONS,
  ADMIN_REPORT_STATUS_OPTIONS,
  DEFAULT_ADMIN_REPORT_CONFIG,
  buildAdminReport,
  downloadAdminReportPdf,
  getAdminInstitutionOptions,
  type AdminGeneratedReport,
  type AdminReportConfig,
} from '../reporting';

interface AdminGenerateReportSectionProps {
  users: User[];
  requests: CredentialRequest[];
  riskEvents: RiskEventRecord[];
  auditLogs: AuditLogEntry[];
  notifications: AppNotification[];
  isLoadingUsers: boolean;
  isLoadingRequests: boolean;
  isLoadingRiskEvents: boolean;
  isLoadingAuditLogs: boolean;
  isLoadingNotifications: boolean;
}

const getToneClasses = (tone?: 'neutral' | 'success' | 'warning') => {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50/70 text-emerald-700';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50/70 text-amber-700';
  return 'border-neutral-200 bg-neutral-50 text-neutral-700';
};

const renderNoData = (label: string) => (
  <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
    No {label.toLowerCase()} available for the selected report scope.
  </div>
);

export default function AdminGenerateReportSection({
  users,
  requests,
  riskEvents,
  auditLogs,
  notifications,
  isLoadingUsers,
  isLoadingRequests,
  isLoadingRiskEvents,
  isLoadingAuditLogs,
  isLoadingNotifications,
}: AdminGenerateReportSectionProps) {
  const [config, setConfig] = useState<AdminReportConfig>(DEFAULT_ADMIN_REPORT_CONFIG);
  const [generatedReport, setGeneratedReport] = useState<AdminGeneratedReport | null>(null);
  const [generatedConfigSignature, setGeneratedConfigSignature] = useState<string | null>(null);

  const institutionOptions = useMemo(() => getAdminInstitutionOptions(users), [users]);
  const isLoading = isLoadingUsers || isLoadingRequests || isLoadingRiskEvents || isLoadingAuditLogs || isLoadingNotifications;
  const currentConfigSignature = useMemo(() => JSON.stringify(config), [config]);
  const hasPendingChanges = generatedConfigSignature !== null && generatedConfigSignature !== currentConfigSignature;
  const selectedSectionCount = Object.values(config.includeSections).filter(Boolean).length;

  const updateConfig = <K extends keyof AdminReportConfig>(key: K, value: AdminReportConfig[K]) => {
    setConfig(previous => ({ ...previous, [key]: value }));
  };

  const updateIncludedSection = (key: keyof AdminReportConfig['includeSections'], checked: boolean) => {
    setConfig(previous => ({
      ...previous,
      includeSections: { ...previous.includeSections, [key]: checked },
    }));
  };

  const updateIncludedTable = (key: keyof AdminReportConfig['includeTables'], checked: boolean) => {
    setConfig(previous => ({
      ...previous,
      includeTables: { ...previous.includeTables, [key]: checked },
    }));
  };

  const toggleFilterValue = <T extends string>(
    key: keyof AdminReportConfig['filters'],
    value: T,
  ) => {
    setConfig(previous => {
      const current = previous.filters[key] as T[];
      const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value];
      return {
        ...previous,
        filters: {
          ...previous.filters,
          [key]: next.length > 0 ? next : [value],
        },
      };
    });
  };

  const handleGenerateReport = () => {
    const report = buildAdminReport(config, {
      users,
      requests,
      riskEvents,
      auditLogs,
      notifications,
    });
    setGeneratedReport(report);
    setGeneratedConfigSignature(currentConfigSignature);
  };

  const handleDownloadPdf = () => {
    if (!generatedReport || hasPendingChanges) return;
    downloadAdminReportPdf(generatedReport);
  };

  return (
    <div className="space-y-6">
      <Card
        title="Generate Report"
        action={<span className="text-xs font-medium text-neutral-400">{selectedSectionCount} sections</span>}
      >
        <div className="space-y-6">
          <p className="text-sm text-neutral-600">
            Build a governance and risk oversight report for platform activity and export the full result as a PDF.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Report Title"
              required
              value={config.reportTitle}
              onChange={event => updateConfig('reportTitle', event.target.value)}
              placeholder="Admin Governance Report"
            />

            <Select
              label="Date Range"
              value={config.dateRangePreset}
              onChange={event => updateConfig('dateRangePreset', event.target.value as AdminReportConfig['dateRangePreset'])}
            >
              {ADMIN_REPORT_DATE_RANGE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {config.dateRangePreset === 'CUSTOM' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Start Date"
                type="date"
                value={config.customStartDate}
                onChange={event => updateConfig('customStartDate', event.target.value)}
              />
              <Input
                label="End Date"
                type="date"
                value={config.customEndDate}
                onChange={event => updateConfig('customEndDate', event.target.value)}
              />
            </div>
          )}

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <ShieldCheck size={15} className="text-cyan-600" />
              Scope and Sections
            </div>
            <div className="space-y-4">
              <Select
                label="Institution Scope"
                value={config.institutionId}
                onChange={event => updateConfig('institutionId', event.target.value)}
              >
                {institutionOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {[
                  ['executiveSummary', 'Executive summary'],
                  ['onboardingOversight', 'User and onboarding oversight'],
                  ['requestOversight', 'Request oversight summary'],
                  ['riskReviewSummary', 'Risk review summary'],
                  ['auditActivitySummary', 'Audit activity summary'],
                  ['notificationActivitySummary', 'Notification activity summary'],
                  ['operationalHighlights', 'Operational highlights'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-white">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                      checked={config.includeSections[key as keyof AdminReportConfig['includeSections']]}
                      onChange={event => updateIncludedSection(key as keyof AdminReportConfig['includeSections'], event.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <FileText size={15} className="text-cyan-600" />
              Detail Tables
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {[
                ['users', 'Include users / institutions table'],
                ['requests', 'Include requests table'],
                ['riskEvents', 'Include risk events table'],
                ['auditEntries', 'Include audit entries table'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-white">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                    checked={config.includeTables[key as keyof AdminReportConfig['includeTables']]}
                    onChange={event => updateIncludedTable(key as keyof AdminReportConfig['includeTables'], event.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Filter size={15} className="text-cyan-600" />
              Data Filters
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-neutral-700">User Roles</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {ADMIN_REPORT_ROLE_OPTIONS.map(role => (
                    <label key={role} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                        checked={config.filters.userRoles.includes(role)}
                        onChange={() => toggleFilterValue('userRoles', role)}
                      />
                      <span>{role.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-neutral-700">User Statuses</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {ADMIN_REPORT_STATUS_OPTIONS.map(status => (
                    <label key={status} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                        checked={config.filters.userStatuses.includes(status)}
                        onChange={() => toggleFilterValue('userStatuses', status)}
                      />
                      <span>{status.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-neutral-700">Request Statuses</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {ADMIN_REPORT_REQUEST_STATUS_OPTIONS.map(status => (
                    <label key={status} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                        checked={config.filters.requestStatuses.includes(status)}
                        onChange={() => toggleFilterValue('requestStatuses', status)}
                      />
                      <span>{status.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-neutral-700">Risk Bands</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {ADMIN_REPORT_RISK_BAND_OPTIONS.map(band => (
                    <label key={band} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                        checked={config.filters.riskBands.includes(band)}
                        onChange={() => toggleFilterValue('riskBands', band)}
                      />
                      <span>{band.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-neutral-700">Risk Review States</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {ADMIN_REPORT_RISK_REVIEW_OPTIONS.map(reviewStatus => (
                    <label key={reviewStatus} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                        checked={config.filters.riskReviewStatuses.includes(reviewStatus)}
                        onChange={() => toggleFilterValue('riskReviewStatuses', reviewStatus)}
                      />
                      <span>{reviewStatus.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-neutral-700">Audit Severities</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {ADMIN_REPORT_AUDIT_SEVERITY_OPTIONS.map(severity => (
                    <label key={severity} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                        checked={config.filters.auditSeverities.includes(severity)}
                        onChange={() => toggleFilterValue('auditSeverities', severity)}
                      />
                      <span>{severity.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {hasPendingChanges && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Configuration changed. Generate the report again to refresh the preview and PDF.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" icon={<Sparkles size={15} />} onClick={handleGenerateReport} disabled={isLoading}>
              Generate Report
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<Download size={15} />}
              onClick={handleDownloadPdf}
              disabled={!generatedReport || hasPendingChanges}
            >
              Download PDF
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Report Preview" action={<span className="text-xs font-medium text-neutral-400">PDF-ready</span>}>
        {isLoading && (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
            <div className="h-40 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
            <div className="h-56 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
          </div>
        )}

        {!isLoading && !generatedReport && (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
            <p className="text-base font-semibold text-neutral-900">No generated report yet</p>
            <p className="mt-2 text-sm text-neutral-500">
              Configure the report above, then click Generate Report to build a downloadable governance preview.
            </p>
          </div>
        )}

        {!isLoading && generatedReport && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-neutral-950 px-6 py-6 text-white">
              <h2 className="mt-2 text-2xl font-semibold">{generatedReport.title}</h2>
              <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-neutral-200 sm:grid-cols-2">
                <p>{generatedReport.scopeLabel}</p>
                <p>Reporting period: {generatedReport.periodLabel}</p>
                <p>Generated: {new Date(generatedReport.generatedAt).toLocaleString()}</p>
                <p>{generatedReport.filterSummary.length} filters applied</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {generatedReport.summaryCards.map(card => (
                <div key={card.title} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-neutral-500">{card.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-neutral-900">{card.value}</p>
                  <p className="mt-1 text-xs text-neutral-500">{card.subtitle}</p>
                </div>
              ))}
            </div>

            <Card title="Applied Filters" className="border-neutral-200 bg-neutral-50 p-4 sm:p-4">
              <ul className="space-y-2 text-sm text-neutral-600">
                {generatedReport.filterSummary.map(item => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </Card>

            {generatedReport.includedSections.operationalHighlights && (
              <Card title="Operational Highlights" className="border-neutral-200 bg-white p-4 sm:p-4">
                {generatedReport.highlights.length === 0 ? renderNoData('operational highlights') : (
                  <div className="space-y-3 text-sm text-neutral-600">
                    {generatedReport.highlights.map(item => (
                      <div key={item} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {generatedReport.includedSections.executiveSummary && (
              <Card title="Executive Summary" className="border-neutral-200 bg-white p-4 sm:p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {generatedReport.executiveSummary.map(metric => (
                    <div key={metric.label} className={`rounded-xl border px-4 py-3 ${getToneClasses(metric.tone)}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">{metric.label}</p>
                      <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {generatedReport.includedSections.onboardingOversight && (
              <Card title="User and Institution Onboarding Sample" className="border-neutral-200 bg-white p-4 sm:p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {generatedReport.onboardingOversight.metrics.map(metric => (
                    <div key={metric.label} className={`rounded-xl border px-4 py-3 ${getToneClasses(metric.tone)}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">{metric.label}</p>
                      <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                    </div>
                  ))}
                </div>
                {generatedReport.includeTables.users && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
                    {generatedReport.onboardingOversight.previewRows.length === 0 ? renderNoData('user records') : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                          <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Institution</th>
                            <th className="px-4 py-3">Activity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 bg-white">
                          {generatedReport.onboardingOversight.previewRows.map(row => (
                            <tr key={row.id}>
                              <td className="px-4 py-3 font-medium text-neutral-900">{row.name}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.email}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.role}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.status}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.institution}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.activityDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            )}

            {generatedReport.includedSections.requestOversight && (
              <Card title="Request Oversight Sample" className="border-neutral-200 bg-white p-4 sm:p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {generatedReport.requestOversight.metrics.map(metric => (
                    <div key={metric.label} className={`rounded-xl border px-4 py-3 ${getToneClasses(metric.tone)}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">{metric.label}</p>
                      <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                    </div>
                  ))}
                </div>
                {generatedReport.includeTables.requests && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
                    {generatedReport.requestOversight.previewRows.length === 0 ? renderNoData('request records') : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                          <tr>
                            <th className="px-4 py-3">Title</th>
                            <th className="px-4 py-3">Student</th>
                            <th className="px-4 py-3">Institution</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Delivery</th>
                            <th className="px-4 py-3">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 bg-white">
                          {generatedReport.requestOversight.previewRows.map(row => (
                            <tr key={row.id}>
                              <td className="px-4 py-3 font-medium text-neutral-900">{row.title}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.student}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.institution}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.status}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.deliveryMethod}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.createdAt}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            )}

            {generatedReport.includedSections.riskReviewSummary && (
              <Card title="Risk Review Summary" className="border-neutral-200 bg-white p-4 sm:p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {generatedReport.riskReviewSummary.metrics.map(metric => (
                    <div key={metric.label} className={`rounded-xl border px-4 py-3 ${getToneClasses(metric.tone)}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">{metric.label}</p>
                      <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                    </div>
                  ))}
                </div>
                {generatedReport.includeTables.riskEvents && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
                    {generatedReport.riskReviewSummary.previewRows.length === 0 ? renderNoData('risk events') : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                          <tr>
                            <th className="px-4 py-3">Action</th>
                            <th className="px-4 py-3">Institution</th>
                            <th className="px-4 py-3">Band</th>
                            <th className="px-4 py-3">Review</th>
                            <th className="px-4 py-3">Score</th>
                            <th className="px-4 py-3">Observed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 bg-white">
                          {generatedReport.riskReviewSummary.previewRows.map(row => (
                            <tr key={row.id}>
                              <td className="px-4 py-3 font-medium text-neutral-900">{row.action}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.institution}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.riskBand}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.reviewStatus}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.score}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.observedAt}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            )}

            {generatedReport.includedSections.auditActivitySummary && (
              <Card title="Audit Activity Summary" className="border-neutral-200 bg-white p-4 sm:p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {generatedReport.auditActivitySummary.metrics.map(metric => (
                    <div key={metric.label} className={`rounded-xl border px-4 py-3 ${getToneClasses(metric.tone)}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">{metric.label}</p>
                      <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                    </div>
                  ))}
                </div>
                {generatedReport.includeTables.auditEntries && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
                    {generatedReport.auditActivitySummary.previewRows.length === 0 ? renderNoData('audit entries') : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                          <tr>
                            <th className="px-4 py-3">Action</th>
                            <th className="px-4 py-3">Severity</th>
                            <th className="px-4 py-3">Actor</th>
                            <th className="px-4 py-3">Institution</th>
                            <th className="px-4 py-3">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 bg-white">
                          {generatedReport.auditActivitySummary.previewRows.map(row => (
                            <tr key={row.id}>
                              <td className="px-4 py-3 font-medium text-neutral-900">{row.action}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.severity}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.actor}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.institution}</td>
                              <td className="px-4 py-3 text-neutral-600">{row.createdAt}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            )}

            {generatedReport.includedSections.notificationActivitySummary && (
              <Card title="Notification Activity Summary" className="border-neutral-200 bg-white p-4 sm:p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {generatedReport.notificationActivitySummary.map(metric => (
                    <div key={metric.label} className={`rounded-xl border px-4 py-3 ${getToneClasses(metric.tone)}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em]">{metric.label}</p>
                      <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
