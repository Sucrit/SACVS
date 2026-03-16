import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/common/Card';
import SearchFilterModal, { SearchFilterGroup } from '../../components/common/SearchFilterModal';
import ActionMenu from '../../components/common/ActionMenu';
import {
  AlertCircle,
  AlertTriangle,
  Clock3,
  UserRoundCheck,
  Check,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { AuditAction, AuditSeverity } from '../../services/audit.service';
import { RiskBand, RiskReviewStatus, RiskService } from '../../services/risk.service';
import Button from '../../components/ui/Button';
import RecordDetailsDrawer from '../../components/common/RecordDetailsDrawer';
import AdminRiskEventDetailsDrawer from './components/AdminRiskEventDetailsDrawer';
import AdminNotificationsSection from './components/AdminNotificationsSection';
import AdminOverviewSection from './components/AdminOverviewSection';
import AdminGenerateReportSection from './components/AdminGenerateReportSection';
import AdminUserSection from './components/AdminUserSection';
import { formatDateTime, formatRiskReviewStatus } from '../../utils/formatting';
import {
  useAdminDashboardState,
  RISK_BAND_OPTIONS,
  RISK_REVIEW_OPTIONS,
  getRiskBandStyles,
} from './useAdminDashboardState';
import { getRiskReviewStyle } from '../../utils/statusStyles';



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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const {
    section,
    users,
    isLoadingUsers,
    filteredUsers,
    selectedUser,
    selectedUserId,
    setSelectedUserId,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    isUpdatingStatus,
    isUpdatingRole,
    handleStatusUpdate,
    handleRoleUpdate,
    totalUsers,
    roleDistribution,
    pendingQueue,
    notifications,
    isLoadingNotifications,
    isMarkingAllNotificationsRead,
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,
    isLoadingCredentialRequests,
    auditLogs,
    isLoadingAuditLogs,
    auditActionFilter,
    setAuditActionFilter,
    auditSeverityFilter,
    setAuditSeverityFilter,
    setAuditPage,
    auditPageSize,
    setAuditPageSize,
    adminAuditActionOptions,
    filteredAdminAuditLogs,
    totalAdminAuditPages,
    currentAdminAuditPage,
    pagedAdminAuditLogs,
    riskEvents,
    credentialRequests,
    isLoadingRiskEvents,
    riskBandFilter,
    setRiskBandFilter,
    riskReviewFilter,
    setRiskReviewFilter,
    reviewedOnly,
    setReviewedOnly,
    riskPage,
    setRiskPage,
    riskPageSize,
    setRiskPageSize,
    riskTotal,
    riskSummary,
    riskWorkerStatus,
    isLoadingRiskWorkerStatus,
    reviewingRiskEventId,
    selectedRiskEventId,
    selectedRiskEvent,
    isLoadingSelectedRiskEvent,
    isExportingRiskReport,
    handleRiskReviewUpdate,
    openRiskEventDetails,
    closeRiskEventDetails,
    exportReviewedRiskReport,
    stepUpModal,
  } = useAdminDashboardState();

  const [selectedAuditLogId, setSelectedAuditLogId] = useState<string | null>(null);
  const [riskCardDeltas, setRiskCardDeltas] = useState({
    pendingReview: 0,
    highRisk: 0,
    criticalRisk: 0,
    confirmedAbuse: 0,
  });
  const selectedAuditLog = useMemo(
    () => filteredAdminAuditLogs.find(log => log.id === selectedAuditLogId) || null,
    [filteredAdminAuditLogs, selectedAuditLogId],
  );

  useEffect(() => {
    if (section !== 'risk') {
      return;
    }

    let cancelled = false;

    const loadRiskCardDeltas = async () => {
      try {
        const response = await RiskService.list({
          page: 1,
          pageSize: Math.max(riskTotal, 1000),
          riskBand: riskBandFilter,
          reviewStatus: riskReviewFilter,
          reviewedOnly,
        });

        if (cancelled) {
          return;
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
        const startOfTomorrow = startOfToday + 24 * 60 * 60 * 1000;

        const countByDay = (
          predicate: (item: (typeof response.items)[number]) => boolean,
          getTimestamp: (item: (typeof response.items)[number]) => string | null,
        ) => {
          let todayCount = 0;
          let yesterdayCount = 0;

          response.items.forEach(item => {
            if (!predicate(item)) {
              return;
            }

            const timestamp = getTimestamp(item);
            if (!timestamp) {
              return;
            }

            const timeMs = new Date(timestamp).getTime();
            if (timeMs >= startOfToday && timeMs < startOfTomorrow) {
              todayCount += 1;
              return;
            }

            if (timeMs >= startOfYesterday && timeMs < startOfToday) {
              yesterdayCount += 1;
            }
          });

          return todayCount - yesterdayCount;
        };

        setRiskCardDeltas({
          pendingReview: countByDay(item => item.reviewStatus === 'PENDING_REVIEW', item => item.observedAt),
          highRisk: countByDay(item => item.riskBand === 'HIGH', item => item.observedAt),
          criticalRisk: countByDay(item => item.riskBand === 'CRITICAL', item => item.observedAt),
          confirmedAbuse: countByDay(item => item.reviewStatus === 'CONFIRMED_ABUSE', item => item.reviewedAt),
        });
      } catch {
        if (!cancelled) {
          setRiskCardDeltas({
            pendingReview: 0,
            highRisk: 0,
            criticalRisk: 0,
            confirmedAbuse: 0,
          });
        }
      }
    };

    void loadRiskCardDeltas();

    return () => {
      cancelled = true;
    };
  }, [reviewedOnly, riskBandFilter, riskReviewFilter, riskTotal, section]);

  const formatRiskDeltaValue = (delta: number) => `${delta > 0 ? '+' : ''}${delta}`;

  const riskFilterGroups = useMemo<SearchFilterGroup[]>(() => [
    {
      id: 'admin-risk-band',
      label: 'Risk band',
      value: riskBandFilter,
      defaultValue: 'ALL',
      options: RISK_BAND_OPTIONS.map(option => ({
        value: option,
        label: option === 'ALL' ? 'All bands' : option,
      })),
      onChange: value => setRiskBandFilter(value as RiskBand | 'ALL'),
    },
    {
      id: 'admin-risk-review',
      label: 'Review status',
      value: riskReviewFilter,
      defaultValue: 'ALL',
      options: RISK_REVIEW_OPTIONS.map(option => ({
        value: option,
        label: option === 'ALL' ? 'Any review state' : formatRiskReviewStatus(option),
      })),
      onChange: value => setRiskReviewFilter(value as RiskReviewStatus | 'ALL'),
    },
    {
      id: 'admin-risk-page-size',
      label: 'Page size',
      value: String(riskPageSize),
      defaultValue: '10',
      options: [10, 20, 50].map(size => ({
        value: String(size),
        label: `${size} rows`,
      })),
      onChange: value => setRiskPageSize(Number(value)),
    },
    {
      id: 'admin-risk-reviewed',
      label: 'Scope',
      type: 'boolean',
      value: reviewedOnly,
      defaultValue: false,
      trueLabel: 'Reviewed only',
      falseLabel: 'All events',
      onChange: setReviewedOnly,
    },
  ], [reviewedOnly, riskBandFilter, riskPageSize, riskReviewFilter, setReviewedOnly, setRiskBandFilter, setRiskPageSize, setRiskReviewFilter]);

  const auditFilterGroups = useMemo<SearchFilterGroup[]>(() => [
    {
      id: 'admin-audit-action',
      label: 'Action',
      value: auditActionFilter,
      defaultValue: 'ALL',
      options: adminAuditActionOptions.map(action => ({
        value: action,
        label: action === 'ALL' ? 'All actions' : action,
      })),
      onChange: value => setAuditActionFilter(value as 'ALL' | AuditAction),
    },
    {
      id: 'admin-audit-severity',
      label: 'Severity',
      value: auditSeverityFilter,
      defaultValue: 'ALL',
      options: (['ALL', 'INFO', 'WARNING', 'CRITICAL'] as const).map(severity => ({
        value: severity,
        label: severity === 'ALL' ? 'All severities' : severity,
      })),
      onChange: value => setAuditSeverityFilter(value as 'ALL' | AuditSeverity),
    },
    {
      id: 'admin-audit-page-size',
      label: 'Page size',
      value: String(auditPageSize),
      defaultValue: '10',
      options: [10, 20, 50].map(size => ({
        value: String(size),
        label: `${size} rows`,
      })),
      onChange: value => setAuditPageSize(Number(value)),
    },
  ], [adminAuditActionOptions, auditActionFilter, auditPageSize, auditSeverityFilter, setAuditActionFilter, setAuditPageSize, setAuditSeverityFilter]);

  const totalRiskPages = Math.max(1, Math.ceil(riskTotal / riskPageSize));
  const currentRiskPage = Math.min(riskPage, totalRiskPages);
  const riskWorkerStatusView = useMemo(() => {
    if (!riskWorkerStatus) {
      return {
        titleClass: 'text-neutral-600',
        dotClass: 'bg-neutral-400',
        label: isLoadingRiskWorkerStatus ? 'Checking worker' : 'Worker unavailable',
        detail: isLoadingRiskWorkerStatus ? 'Loading latest runtime health.' : 'Status could not be loaded.',
      };
    }

    if (!riskWorkerStatus.autorunEnabled) {
      return {
        titleClass: 'text-neutral-700',
        dotClass: 'bg-neutral-400',
        label: 'Autorun disabled',
        detail: 'Shadow scoring requires manual execution.',
      };
    }

    if (riskWorkerStatus.lastErrorMessage) {
      return {
        titleClass: 'text-rose-700',
        dotClass: 'bg-rose-500',
        label: 'Worker error',
        detail: riskWorkerStatus.lastFailureAt
          ? `Last failure ${formatDateTime(riskWorkerStatus.lastFailureAt)}`
          : 'The most recent scoring pass failed.',
      };
    }

    if (riskWorkerStatus.isRunning) {
      return {
        titleClass: 'text-cyan-700',
        dotClass: 'bg-cyan-500',
        label: 'Scoring now',
        detail: riskWorkerStatus.lastRunStartedAt
          ? `Current pass started ${formatDateTime(riskWorkerStatus.lastRunStartedAt)}`
          : 'A scoring pass is in progress.',
      };
    }

    const staleThresholdMs = riskWorkerStatus.intervalMs * 2;
    const lastSuccessfulMs = riskWorkerStatus.lastSuccessfulRunAt
      ? new Date(riskWorkerStatus.lastSuccessfulRunAt).getTime()
      : Number.NaN;
    const isStale =
      Number.isNaN(lastSuccessfulMs) ||
      Date.now() - lastSuccessfulMs > staleThresholdMs;

    if (isStale) {
      return {
        titleClass: 'text-amber-700',
        dotClass: 'bg-amber-500',
        label: 'Worker degraded',
        detail: riskWorkerStatus.lastSuccessfulRunAt
          ? `No successful run within ${Math.round(staleThresholdMs / 60000)} minute(s). Last success ${formatDateTime(riskWorkerStatus.lastSuccessfulRunAt)}`
          : 'No successful shadow scoring pass has completed yet.',
      };
    }

    return {
      titleClass: 'text-emerald-700',
      dotClass: 'bg-emerald-500',
      label: 'Shadow worker active',
      detail: riskWorkerStatus.lastSuccessfulRunAt
        ? `Last success ${formatDateTime(riskWorkerStatus.lastSuccessfulRunAt)}`
        : 'Waiting for the first successful scoring pass.',
    };
  }, [isLoadingRiskWorkerStatus, riskWorkerStatus]);

  const renderRiskReview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center text-amber-600">
            <Clock3 size={18} />
          </div>
          <div>
            <p className="text-3xl font-bold tracking-tight text-amber-600">{riskSummary.pendingReviewCount}</p>
            <p className="text-[13px] font-medium text-neutral-500">Pending review</p>
            <p className="mt-1 text-[11px] font-semibold text-neutral-400">
              <span className="text-amber-500">{formatRiskDeltaValue(riskCardDeltas.pendingReview)}</span> vs yesterday
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center text-rose-500">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-3xl font-bold tracking-tight text-rose-500">{riskSummary.highRiskCount}</p>
            <p className="text-[13px] font-medium text-neutral-500">High risk</p>
            <p className="mt-1 text-[11px] font-semibold text-neutral-400">
              <span className="text-rose-400">{formatRiskDeltaValue(riskCardDeltas.highRisk)}</span> vs yesterday
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center text-rose-600">
            <AlertCircle size={18} />
          </div>
          <div>
            <p className="text-3xl font-bold tracking-tight text-rose-600">{riskSummary.criticalRiskCount}</p>
            <p className="text-[13px] font-medium text-neutral-500">Critical risk</p>
            <p className="mt-1 text-[11px] font-semibold text-neutral-400">
              <span className="text-rose-500">{formatRiskDeltaValue(riskCardDeltas.criticalRisk)}</span> vs yesterday
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center text-rose-800">
            <UserRoundCheck size={18} />
          </div>
          <div>
            <p className="text-3xl font-bold tracking-tight text-rose-800">{riskSummary.confirmedAbuseCount}</p>
            <p className="text-[13px] font-medium text-neutral-500">Confirmed abuse</p>
            <p className="mt-1 text-[11px] font-semibold text-neutral-400">
              <span className="text-rose-800">{formatRiskDeltaValue(riskCardDeltas.confirmedAbuse)}</span> vs yesterday
            </p>
          </div>
        </div>
      </div>

      <Card
        title="Risk Review Queue"
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
              <span className={`h-2.5 w-2.5 rounded-full ${riskWorkerStatusView.dotClass}`} />
              <div className="text-left">
                <p className={`font-semibold ${riskWorkerStatusView.titleClass}`}>
                  {riskWorkerStatusView.label}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {riskWorkerStatusView.detail}
                  {riskWorkerStatus && !riskWorkerStatus.isRunning && riskWorkerStatus.autorunEnabled && !riskWorkerStatus.lastErrorMessage
                    ? ` â€¢ Scanned ${riskWorkerStatus.lastScannedCount}, inserted ${riskWorkerStatus.lastInsertedCount}`
                    : ''}
                </p>
              </div>
            </div>
          </div>
        }
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <SearchFilterModal
              hideLabel
              groups={riskFilterGroups}
              description="Refine the risk queue by band, review state, scope, and result size."
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 text-xs font-medium text-neutral-500">
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="hidden px-4 py-3 sm:table-cell">Actor</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Band</th>
                <th className="hidden px-4 py-3 md:table-cell">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {isLoadingRiskEvents && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-neutral-500">
                    Loading risk events...
                  </td>
                </tr>
              )}
              {!isLoadingRiskEvents && riskEvents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-neutral-500">
                    No risk events matched the current filters.
                  </td>
                </tr>
              )}
              {!isLoadingRiskEvents &&
                riskEvents.map((event, index) => (
                  <motion.tr
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="align-top cursor-pointer hover:bg-neutral-50/70"
                    onClick={() => void openRiskEventDetails(event.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-neutral-900">{event.action}</p>
                        <p className="text-xs text-neutral-500">{event.targetType || 'System scope'}</p>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <div className="space-y-1 text-xs text-neutral-600">
                        <p className="font-semibold text-neutral-800">{event.actorRole || 'UNKNOWN'}</p>
                        <p>{event.actorId ? 'Authenticated activity' : 'System generated'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-neutral-900">{event.riskScore.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`font-semibold uppercase tracking-[0.08em] ${getRiskBandStyles(event.riskBand)}`}>
                        {event.riskBand}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs md:table-cell">
                      <div className="space-y-1">
                        <span className={`inline-flex font-semibold text-xs tracking-[0.08em] ${getRiskReviewStyle(event.reviewStatus)}`}>
                          {formatRiskReviewStatus(event.reviewStatus)}
                        </span>
                        <p className="text-neutral-500">{event.reviewedAt ? formatDateTime(event.reviewedAt) : 'Not reviewed yet'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end" onClick={event => event.stopPropagation()}>
                        <ActionMenu
                          items={[
                            {
                              label: reviewingRiskEventId === event.id && event.reviewStatus !== 'CONFIRMED_ABUSE' ? 'Saving...' : 'Confirm abuse',
                              icon: <XCircle size={14} className="text-rose-600" />,
                              onClick: () => void handleRiskReviewUpdate(event.id, 'CONFIRMED_ABUSE'),
                              disabled: reviewingRiskEventId === event.id || event.reviewStatus === 'CONFIRMED_ABUSE',
                              className: 'text-rose-700',
                            },
                            {
                              label: 'Benign',
                              icon: <Check size={14} className="text-emerald-600" />,
                              onClick: () => void handleRiskReviewUpdate(event.id, 'BENIGN'),
                              disabled: reviewingRiskEventId === event.id || event.reviewStatus === 'BENIGN',
                              className: 'text-emerald-700',
                            },
                            {
                              label: 'Uncertain',
                              icon: <HelpCircle size={14} className="text-neutral-500" />,
                              onClick: () => void handleRiskReviewUpdate(event.id, 'UNCERTAIN'),
                              disabled: reviewingRiskEventId === event.id || event.reviewStatus === 'UNCERTAIN',
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </motion.tr>
                ))}
            </tbody>
          </table>
        </div>
        {!isLoadingRiskEvents && riskTotal > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              Page {currentRiskPage} of {totalRiskPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRiskPage(previous => Math.max(1, previous - 1))}
                disabled={currentRiskPage <= 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRiskPage(previous => Math.min(totalRiskPages, previous + 1))}
                disabled={currentRiskPage >= totalRiskPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
      <AdminRiskEventDetailsDrawer
        isOpen={selectedRiskEventId !== null}
        event={selectedRiskEvent}
        isLoading={isLoadingSelectedRiskEvent}
        isSavingReview={reviewingRiskEventId === selectedRiskEvent?.id}
        onClose={closeRiskEventDetails}
        onSaveReview={handleRiskReviewUpdate}
      />
    </div>
  );

  const renderLogsPlaceholder = () => (
    <div className="space-y-4">
      <Card
        title="Admin Governance Audit Logs"
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <SearchFilterModal
              hideLabel
              groups={auditFilterGroups}
              description="Refine governance logs by action, severity, and page size."
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 text-xs font-medium text-neutral-500">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="hidden px-4 py-3 sm:table-cell">Severity</th>
                <th className="hidden px-4 py-3 md:table-cell">Actor</th>
                <th className="hidden px-4 py-3 lg:table-cell">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {isLoadingAuditLogs && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-500">
                    Loading audit logs...
                  </td>
                </tr>
              )}
              {!isLoadingAuditLogs && filteredAdminAuditLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-500">
                    No admin audit logs found.
                  </td>
                </tr>
              )}
              {!isLoadingAuditLogs &&
                pagedAdminAuditLogs.map((log, index) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="cursor-pointer hover:bg-neutral-50/70"
                    onClick={() => setSelectedAuditLogId(log.id)}
                  >
                    <td className="px-4 py-3 text-xs text-neutral-600">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-neutral-800">{log.action}</td>
                    <td className="hidden px-4 py-3 text-xs sm:table-cell">
                      <span className={`font-semibold ${getAuditSeverityTextClass(log.severity)}`}>{log.severity}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-neutral-600 md:table-cell">{log.actorEmail || '-'}</td>
                    <td className="hidden px-4 py-3 text-sm text-neutral-700 lg:table-cell">{log.description || '-'}</td>
                  </motion.tr>
                ))}
            </tbody>
          </table>
        </div>
        {!isLoadingAuditLogs && filteredAdminAuditLogs.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              Page {currentAdminAuditPage} of {totalAdminAuditPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAuditPage(previous => Math.max(1, previous - 1))}
                disabled={currentAdminAuditPage <= 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAuditPage(previous => Math.min(totalAdminAuditPages, previous + 1))}
                disabled={currentAdminAuditPage >= totalAdminAuditPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
      <RecordDetailsDrawer
        open={selectedAuditLog !== null}
        onClose={() => setSelectedAuditLogId(null)}
        title={selectedAuditLog?.action || 'Audit Log Details'}
        description="Review audit event details."
        sections={
          selectedAuditLog
            ? [
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
              ]
            : []
        }
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {section === 'overview' && (
        <AdminOverviewSection
          users={users}
          isLoadingUsers={isLoadingUsers}
          totalUsers={totalUsers}
          roleDistribution={roleDistribution}
          pendingQueue={pendingQueue}
          // isUpdatingStatus={isUpdatingStatus}
          // handleStatusUpdate={handleStatusUpdate}
          riskSummary={riskSummary}
          riskEvents={riskEvents}
          credentialRequests={credentialRequests}
          isLoadingRiskEvents={isLoadingRiskEvents}
        />
      )}
      {section === 'users' && (
        <AdminUserSection
          filteredUsers={filteredUsers}
          isLoadingUsers={isLoadingUsers}
          search={search}
          setSearch={setSearch}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          selectedUserId={selectedUserId}
          setSelectedUserId={setSelectedUserId}
          selectedUser={selectedUser}
          isUpdatingStatus={isUpdatingStatus}
          isUpdatingRole={isUpdatingRole}
          handleStatusUpdate={handleStatusUpdate}
          handleRoleUpdate={handleRoleUpdate}
        />
      )}
      {section === 'notifications' && (
        <AdminNotificationsSection
          notifications={notifications}
          isLoading={isLoadingNotifications}
          isMarkingAllRead={isMarkingAllNotificationsRead}
          onMarkAllRead={() => void handleMarkAllNotificationsRead()}
          onMarkRead={(id: string) => void handleMarkNotificationRead(id)}
          onOpenUsers={(options) => {
            const params = new URLSearchParams();
            const userId = options?.userId?.trim();
            if (userId) {
              setSelectedUserId(userId);
              params.set('userId', userId);
            }
            if (options?.roleFilter) params.set('role', options.roleFilter);
            if (options?.statusFilter) params.set('status', options.statusFilter);
            const query = params.toString();
            navigate(`/admin/users${query ? `?${query}` : ''}`);
          }}
          onOpenRiskReview={(options) => {
            const params = new URLSearchParams();
            if (options?.riskEventId) params.set('riskEventId', options.riskEventId);
            if (options?.targetId) params.set('targetId', options.targetId);
            if (options?.actorId) params.set('actorId', options.actorId);
            const query = params.toString();
            navigate(`/admin/risk${query ? `?${query}` : ''}`);
          }}
          onOpenNotificationsPage={() => navigate('/admin/notifications')}
        />
      )}
      {section === 'risk' && renderRiskReview()}
      {section === 'reports' && (
        <AdminGenerateReportSection
          users={users}
          requests={credentialRequests}
          riskEvents={riskEvents}
          auditLogs={auditLogs}
          notifications={notifications}
          isLoadingUsers={isLoadingUsers}
          isLoadingRequests={isLoadingCredentialRequests}
          isLoadingRiskEvents={isLoadingRiskEvents}
          isLoadingAuditLogs={isLoadingAuditLogs}
          isLoadingNotifications={isLoadingNotifications}
        />
      )}
      {section === 'logs' && renderLogsPlaceholder()}

      {stepUpModal}
    </div>
  );
}
