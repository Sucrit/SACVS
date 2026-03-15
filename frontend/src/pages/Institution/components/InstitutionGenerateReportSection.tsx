import { useMemo, useState } from 'react';
import { Download, FileText, Filter, Sparkles } from 'lucide-react';
import Card from '../../../components/common/Card';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { useLegacyAuth } from '../../../auth/auth-context';
import type { Credential, CredentialRequest, CredentialType, CredentialRequestStatus } from '../../../services/credential.service';
import type { User, UserStatus } from '../../../services/user.service';
import {
  buildInstitutionReport,
  DEFAULT_REPORT_CONFIG,
  downloadInstitutionReportPdf,
  getReportDepartmentOptions,
  REPORT_DATE_RANGE_OPTIONS,
  STUDENT_REPORT_STATUS_OPTIONS,
  REQUEST_REPORT_STATUS_OPTIONS,
  CREDENTIAL_REPORT_TYPE_OPTIONS,
  type InstitutionGeneratedReport,
  type InstitutionReportConfig,
} from '../reporting';

interface InstitutionGenerateReportSectionProps {
  students: User[];
  requests: CredentialRequest[];
  credentials: Credential[];
  isLoadingStudents: boolean;
  isLoadingRequests: boolean;
  isLoadingCredentials: boolean;
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

export default function InstitutionGenerateReportSection({
  students,
  requests,
  credentials,
  isLoadingStudents,
  isLoadingRequests,
  isLoadingCredentials,
}: InstitutionGenerateReportSectionProps) {
  const { user } = useLegacyAuth();
  const institutionName = user?.institution?.institutionName || 'Institution';
  const [config, setConfig] = useState<InstitutionReportConfig>(DEFAULT_REPORT_CONFIG);
  const [generatedReport, setGeneratedReport] = useState<InstitutionGeneratedReport | null>(null);
  const [generatedConfigSignature, setGeneratedConfigSignature] = useState<string | null>(null);

  const isLoading = isLoadingStudents || isLoadingRequests || isLoadingCredentials;
  const departmentOptions = useMemo(() => getReportDepartmentOptions(students), [students]);
  const currentConfigSignature = useMemo(() => JSON.stringify(config), [config]);
  const hasPendingChanges = generatedConfigSignature !== null && generatedConfigSignature !== currentConfigSignature;

  const updateConfig = <K extends keyof InstitutionReportConfig>(key: K, value: InstitutionReportConfig[K]) => {
    setConfig(previous => ({ ...previous, [key]: value }));
  };

  const updateIncludedSection = (key: keyof InstitutionReportConfig['includeSections'], checked: boolean) => {
    setConfig(previous => ({
      ...previous,
      includeSections: { ...previous.includeSections, [key]: checked },
    }));
  };

  const updateIncludedTable = (key: keyof InstitutionReportConfig['includeTables'], checked: boolean) => {
    setConfig(previous => ({
      ...previous,
      includeTables: { ...previous.includeTables, [key]: checked },
    }));
  };

  const toggleArrayFilter = <T extends UserStatus | CredentialRequestStatus | CredentialType>(
    key: 'studentStatuses' | 'requestStatuses' | 'credentialTypes',
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
    const report = buildInstitutionReport(config, { students, requests, credentials }, institutionName);
    setGeneratedReport(report);
    setGeneratedConfigSignature(currentConfigSignature);
  };

  const handleDownloadPdf = () => {
    if (!generatedReport || hasPendingChanges) return;
    downloadInstitutionReportPdf(generatedReport);
  };

  const selectedSectionCount = Object.values(config.includeSections).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <Card
        title="Generate Report"
        action={<span className="text-xs font-medium text-neutral-400">{selectedSectionCount} sections</span>}
      >
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-sm text-neutral-600">
              Build a polished operations report for your institution and download it as PDF.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Report Title"
              required
              value={config.reportTitle}
              onChange={event => updateConfig('reportTitle', event.target.value)}
              placeholder="Institution Operations Report"
            />

            <Select
              label="Date Range"
              value={config.dateRangePreset}
              onChange={event => updateConfig('dateRangePreset', event.target.value as InstitutionReportConfig['dateRangePreset'])}
            >
              {REPORT_DATE_RANGE_OPTIONS.map(option => (
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
              <Sparkles size={15} className="text-cyan-600" />
              Included Sections
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {[
                ['executiveSummary', 'Executive summary'],
                ['studentOperations', 'Student Account List'],
                ['requestOperations', 'Request operations'],
                ['credentialIssuance', 'Credential issuance'],
                ['deliveryCompletion', 'Delivery and completion'],
                ['departmentBreakdown', 'Department breakdow'],
                ['credentialTypeBreakdown', 'Credential type breakdown'],
                ['operationalHighlights', 'Operational highlights'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-white">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                    checked={config.includeSections[key as keyof InstitutionReportConfig['includeSections']]}
                    onChange={event => updateIncludedSection(key as keyof InstitutionReportConfig['includeSections'], event.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <FileText size={15} className="text-cyan-600" />
              Detail Tables
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {[
                ['students', 'Include student summary table'],
                ['requests', 'Include request summary table'],
                ['credentials', 'Include credential summary table'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-white">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                    checked={config.includeTables[key as keyof InstitutionReportConfig['includeTables']]}
                    onChange={event => updateIncludedTable(key as keyof InstitutionReportConfig['includeTables'], event.target.checked)}
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
              <Select
                label="Department"
                value={config.filters.department}
                onChange={event =>
                  setConfig(previous => ({
                    ...previous,
                    filters: { ...previous.filters, department: event.target.value },
                  }))
                }
              >
                {departmentOptions.map(option => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All departments' : option}
                  </option>
                ))}
              </Select>

              <div>
                <p className="mb-2 text-sm font-medium text-neutral-700">Student Statuses</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {STUDENT_REPORT_STATUS_OPTIONS.map(status => (
                    <label key={status} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                        checked={config.filters.studentStatuses.includes(status)}
                        onChange={() => toggleArrayFilter('studentStatuses', status)}
                      />
                      <span>{status.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-neutral-700">Request Statuses</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {REQUEST_REPORT_STATUS_OPTIONS.map(status => (
                    <label key={status} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                        checked={config.filters.requestStatuses.includes(status)}
                        onChange={() => toggleArrayFilter('requestStatuses', status)}
                      />
                      <span>{status.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-neutral-700">Credential Types</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {CREDENTIAL_REPORT_TYPE_OPTIONS.map(type => (
                    <label key={type} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500"
                        checked={config.filters.credentialTypes.includes(type)}
                        onChange={() => toggleArrayFilter('credentialTypes', type)}
                      />
                      <span>{type.replace(/_/g, ' ')}</span>
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
            <Button
              type="button"
              icon={<Sparkles size={15} />}
              onClick={handleGenerateReport}
              disabled={isLoading}
            >
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
                Configure the report on the left, then click Generate Report to build a downloadable preview.
              </p>
            </div>
          )}

          {!isLoading && generatedReport && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-neutral-950 px-6 py-6 text-white">
                <h2 className="mt-2 text-2xl font-semibold">{generatedReport.title}</h2>
                <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-neutral-200 sm:grid-cols-2">
                  <p>{generatedReport.institutionName}</p>
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
                  {generatedReport.highlights.length === 0 ? (
                    renderNoData('operational highlights')
                  ) : (
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

              {generatedReport.includedSections.studentOperations && (
                <Card title="Students Account List Sample" className="border-neutral-200 bg-white p-4 sm:p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {generatedReport.studentOperations.metrics.map(metric => (
                      <div key={metric.label} className={`rounded-xl border px-4 py-3 ${getToneClasses(metric.tone)}`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em]">{metric.label}</p>
                        <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                  {generatedReport.includeTables.students && (
                    <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
                      {generatedReport.studentOperations.previewRows.length === 0 ? renderNoData('student records') : (
                        <table className="w-full text-left text-sm">
                          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                            <tr>
                              <th className="px-4 py-3">Name</th>
                              <th className="px-4 py-3">Student No.</th>
                              <th className="px-4 py-3">Department</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Activity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 bg-white">
                            {generatedReport.studentOperations.previewRows.map(row => (
                              <tr key={row.id}>
                                <td className="px-4 py-3 font-medium text-neutral-900">{row.name}</td>
                                <td className="px-4 py-3 text-neutral-600">{row.studentNumber}</td>
                                <td className="px-4 py-3 text-neutral-600">{row.department}</td>
                                <td className="px-4 py-3 text-neutral-600">{row.status}</td>
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

              {generatedReport.includedSections.requestOperations && (
                <Card title="Credential Request Operations Sample" className="border-neutral-200 bg-white p-4 sm:p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {generatedReport.requestOperations.metrics.map(metric => (
                      <div key={metric.label} className={`rounded-xl border px-4 py-3 ${getToneClasses(metric.tone)}`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em]">{metric.label}</p>
                        <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                  {generatedReport.includeTables.requests && (
                    <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
                      {generatedReport.requestOperations.previewRows.length === 0 ? renderNoData('request records') : (
                        <table className="w-full text-left text-sm">
                          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                            <tr>
                              <th className="px-4 py-3">Title</th>
                              <th className="px-4 py-3">Student</th>
                              <th className="px-4 py-3">Type</th>
                              <th className="px-4 py-3">Delivery</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 bg-white">
                            {generatedReport.requestOperations.previewRows.map(row => (
                              <tr key={row.id}>
                                <td className="px-4 py-3 font-medium text-neutral-900">{row.title}</td>
                                <td className="px-4 py-3 text-neutral-600">{row.student}</td>
                                <td className="px-4 py-3 text-neutral-600">{row.type}</td>
                                <td className="px-4 py-3 text-neutral-600">{row.delivery}</td>
                                <td className="px-4 py-3 text-neutral-600">{row.status}</td>
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

              {generatedReport.includedSections.credentialIssuance && (
                <Card title="Credential Issuance" className="border-neutral-200 bg-white p-4 sm:p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {generatedReport.credentialIssuance.metrics.map(metric => (
                      <div key={metric.label} className={`rounded-xl border px-4 py-3 ${getToneClasses(metric.tone)}`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em]">{metric.label}</p>
                        <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                  {generatedReport.includeTables.credentials && (
                    <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
                      {generatedReport.credentialIssuance.previewRows.length === 0 ? renderNoData('credential records') : (
                        <table className="w-full text-left text-sm">
                          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                            <tr>
                              <th className="px-4 py-3">Title</th>
                              <th className="px-4 py-3">Student</th>
                              <th className="px-4 py-3">Type</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Issued</th>
                              <th className="px-4 py-3">Anchored</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 bg-white">
                            {generatedReport.credentialIssuance.previewRows.map(row => (
                              <tr key={row.id}>
                                <td className="px-4 py-3 font-medium text-neutral-900">{row.title}</td>
                                <td className="px-4 py-3 text-neutral-600">{row.student}</td>
                                <td className="px-4 py-3 text-neutral-600">{row.type}</td>
                                <td className="px-4 py-3 text-neutral-600">{row.status}</td>
                                <td className="px-4 py-3 text-neutral-600">{row.issuedAt}</td>
                                <td className="px-4 py-3 text-neutral-600">{row.anchored}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {generatedReport.includedSections.deliveryCompletion && (
                <Card title="Delivery and Completion" className="border-neutral-200 bg-white p-4 sm:p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {generatedReport.deliveryCompletion.map(metric => (
                      <div key={metric.label} className={`rounded-xl border px-4 py-3 ${getToneClasses(metric.tone)}`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em]">{metric.label}</p>
                        <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {generatedReport.includedSections.departmentBreakdown && (
                <Card title="Department Breakdown" className="border-neutral-200 bg-white p-4 sm:p-4">
                  {generatedReport.departmentBreakdown.length === 0 ? renderNoData('department breakdown data') : (
                    <div className="overflow-hidden rounded-xl border border-neutral-200">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                          <tr>
                            <th className="px-4 py-3">Department</th>
                            <th className="px-4 py-3">Students</th>
                            <th className="px-4 py-3">Requests</th>
                            <th className="px-4 py-3">Issued</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 bg-white">
                          {generatedReport.departmentBreakdown.map(entry => (
                            <tr key={entry.department}>
                              <td className="px-4 py-3 font-medium text-neutral-900">{entry.department}</td>
                              <td className="px-4 py-3 text-neutral-600">{entry.students}</td>
                              <td className="px-4 py-3 text-neutral-600">{entry.requests}</td>
                              <td className="px-4 py-3 text-neutral-600">{entry.issued}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )}

              {generatedReport.includedSections.credentialTypeBreakdown && (
                <Card title="Credential Type Breakdown" className="border-neutral-200 bg-white p-4 sm:p-4">
                  {generatedReport.credentialTypeBreakdown.length === 0 ? renderNoData('credential type data') : (
                    <div className="overflow-hidden rounded-xl border border-neutral-200">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                          <tr>
                            <th className="px-4 py-3">Credential Type</th>
                            <th className="px-4 py-3">Requests</th>
                            <th className="px-4 py-3">Issued</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 bg-white">
                          {generatedReport.credentialTypeBreakdown.map(entry => (
                            <tr key={entry.type}>
                              <td className="px-4 py-3 font-medium text-neutral-900">{entry.type}</td>
                              <td className="px-4 py-3 text-neutral-600">{entry.requests}</td>
                              <td className="px-4 py-3 text-neutral-600">{entry.issued}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
      </Card>
    </div>
  );
}
