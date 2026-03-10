import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  Database,
  ListFilter,
  Mail,
  Search,
  Server,
  ShieldAlert,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { AuditAction, AuditSeverity } from '../../services/audit.service';
import { RiskBand, RiskReviewStatus } from '../../services/risk.service';
import ButtonLoadingContent from '../../components/common/ButtonLoadingContent';
import AdminRiskEventDetailsDrawer from './components/AdminRiskEventDetailsDrawer';
import { formatDate, formatDateTime } from '../../utils/formatting';
import {
  useAdminDashboardState,
  getFullName,
  getInitials,
  getRoleStyles,
  getLinkedOrganizationLabel,
  getRiskBandStyles,
  getRiskReviewStyles,
  ROLE_OPTIONS,
  STATUS_OPTIONS,
  USER_STATUS_ACTIONS,
  USER_ROLE_ACTIONS,
  RISK_BAND_OPTIONS,
  RISK_REVIEW_OPTIONS,
  OTP_BADGE_CLASS,
} from './useAdminDashboardState';
import type { RoleFilter, StatusFilter } from './useAdminDashboardState';

export default function AdminDashboard() {
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
    approvedUsers,
    pendingUsers,
    studentAccounts,
    roleDistribution,
    statusDistribution,
    recentUsers,
    pendingQueue,
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

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Total Users" className="border-slate-900 bg-slate-900 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-white">{totalUsers}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-300">All accounts</p>
            </div>
            <Users size={22} className="text-white" />
          </div>
        </Card>

        <Card title="Approved">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-emerald-700">{approvedUsers}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">Active users</p>
            </div>
            <UserRoundCheck size={22} className="text-emerald-700" />
          </div>
        </Card>

        <Card title="Pending">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-amber-700">{pendingUsers}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">Needs approval</p>
            </div>
            <Clock3 size={22} className="text-amber-700" />
          </div>
        </Card>

        <Card title="Student Accounts">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-900">{studentAccounts}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">Role-level count</p>
            </div>
            <Database size={22} className="text-slate-700" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card
            title="Recent User Registrations"
            action={
              <Link
                to="/admin/users"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                View All
                <ArrowRight size={14} />
              </Link>
            }
          >
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoadingUsers && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        Loading users...
                      </td>
                    </tr>
                  )}
                  {!isLoadingUsers && recentUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        No users found.
                      </td>
                    </tr>
                  )}
                  {!isLoadingUsers &&
                    recentUsers.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">{getFullName(user)}</p>
                          <p className="mt-1 text-xs text-slate-500">ID: {user.id}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{user.email}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${getRoleStyles(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Badge status={user.status} />
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Role Distribution">
            <div className="space-y-3">
              {Object.entries(roleDistribution).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-slate-600" />
                    <span className="text-sm font-semibold text-slate-800">{role}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Status Distribution">
            <div className="space-y-3">
              {Object.entries(statusDistribution).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Server size={14} className="text-slate-600" />
                    <span className="text-sm font-semibold text-slate-800">{status}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderUserManagement = () => (
    <div className="space-y-6">
      <Card
        title="User Management"
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">Search</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Name, email, role, organization..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">Role</label>
            <select
              value={roleFilter}
              onChange={event => setRoleFilter(event.target.value as RoleFilter)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
            >
              {ROLE_OPTIONS.map(role => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">Status</label>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as StatusFilter)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
            >
              {STATUS_OPTIONS.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
          <ListFilter size={14} />
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Card title="Accounts">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoadingUsers && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        Loading users...
                      </td>
                    </tr>
                  )}
                  {!isLoadingUsers && filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        No users matched your filters.
                      </td>
                    </tr>
                  )}
                  {!isLoadingUsers &&
                    filteredUsers.map(user => {
                      const isSelected = user.id === selectedUserId;

                      return (
                        <tr
                          key={user.id}
                          className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${isSelected ? 'bg-slate-50' : ''}`}
                          onClick={() => setSelectedUserId(user.id)}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700">
                                {getInitials(user)}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{getFullName(user)}</p>
                                <p className="text-xs text-slate-500">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-xs">
                            <span className={`rounded-md border px-2.5 py-1 font-semibold ${getRoleStyles(user.role)}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <Badge status={user.status} />
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600">{getLinkedOrganizationLabel(user)}</td>
                          <td className="px-5 py-4 text-sm text-slate-600">{formatDate(user.createdAt)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-2">
          <Card title="Selected User Details">
            {!selectedUser && <p className="text-sm text-slate-500">Select a user to view account details.</p>}

            {selectedUser && (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{getFullName(selectedUser)}</p>
                      <p className="mt-1 text-sm text-slate-500">{selectedUser.email}</p>
                    </div>
                    <Badge status={selectedUser.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="uppercase tracking-widest text-slate-500">User ID</p>
                      <p className="mt-1 break-all font-semibold text-slate-700">{selectedUser.id}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-widest text-slate-500">Role</p>
                      <p className="mt-1 font-semibold text-slate-700">{selectedUser.role}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-widest text-slate-500">Organization</p>
                      <p className="mt-1 font-semibold text-slate-700">{getLinkedOrganizationLabel(selectedUser)}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-widest text-slate-500">Created</p>
                      <p className="mt-1 font-semibold text-slate-700">{formatDateTime(selectedUser.createdAt)}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-widest text-slate-500">Updated</p>
                      <p className="mt-1 font-semibold text-slate-700">{formatDateTime(selectedUser.updatedAt)}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-widest text-slate-500">Approved At</p>
                      <p className="mt-1 font-semibold text-slate-700">{formatDateTime(selectedUser.approvedAt)}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-widest text-slate-500">Approved By ID</p>
                      <p className="mt-1 break-all font-semibold text-slate-700">{selectedUser.approvedById || '-'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Role Actions
                    <span className={OTP_BADGE_CLASS}>OTP Required</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {USER_ROLE_ACTIONS.map(nextRole => (
                      <button
                        key={nextRole}
                        disabled={isUpdatingRole === selectedUser.id || selectedUser.role === nextRole}
                        onClick={() => void handleRoleUpdate(selectedUser.id, nextRole)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          selectedUser.role === nextRole
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                        title="OTP required before this action is applied"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {isUpdatingRole === selectedUser.id && selectedUser.role !== nextRole
                            ? <ButtonLoadingContent label="Updating" />
                            : nextRole}
                          {selectedUser.role !== nextRole && <span className={OTP_BADGE_CLASS}>OTP</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Status Actions
                    <span className={OTP_BADGE_CLASS}>OTP Required</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {USER_STATUS_ACTIONS.map(nextStatus => (
                      <button
                        key={nextStatus}
                        disabled={isUpdatingStatus === selectedUser.id || selectedUser.status === nextStatus}
                        onClick={() => void handleStatusUpdate(selectedUser.id, nextStatus)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          selectedUser.status === nextStatus
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                        title="OTP required before this action is applied"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {isUpdatingStatus === selectedUser.id && selectedUser.status !== nextStatus
                            ? <ButtonLoadingContent label="Updating" />
                            : nextStatus}
                          {selectedUser.status !== nextStatus && <span className={OTP_BADGE_CLASS}>OTP</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Privacy guardrail: student profile data is hidden from admin-level tools by default.
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );

  const totalRiskPages = Math.max(1, Math.ceil(riskTotal / riskPageSize));
  const currentRiskPage = Math.min(riskPage, totalRiskPages);
  const riskWorkerStatusView = useMemo(() => {
    if (!riskWorkerStatus) {
      return {
        titleClass: 'text-slate-600',
        dotClass: 'bg-slate-400',
        label: isLoadingRiskWorkerStatus ? 'Checking worker' : 'Worker unavailable',
        detail: isLoadingRiskWorkerStatus ? 'Loading latest runtime health.' : 'Status could not be loaded.',
      };
    }

    if (!riskWorkerStatus.autorunEnabled) {
      return {
        titleClass: 'text-slate-700',
        dotClass: 'bg-slate-400',
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
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Pending Review">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-900">{riskSummary.pendingReviewCount}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">Needs analyst triage</p>
            </div>
            <Clock3 size={22} className="text-slate-700" />
          </div>
        </Card>
        <Card title="High Risk">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-amber-700">{riskSummary.highRiskCount}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">High-band shadow events</p>
            </div>
            <AlertTriangle size={22} className="text-amber-700" />
          </div>
        </Card>
        <Card title="Critical Risk">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-rose-700">{riskSummary.criticalRiskCount}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">Critical-band shadow events</p>
            </div>
            <ShieldAlert size={22} className="text-rose-700" />
          </div>
        </Card>
        <Card title="Confirmed Abuse">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-900">{riskSummary.confirmedAbuseCount}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">Analyst-confirmed events</p>
            </div>
            <UserRoundCheck size={22} className="text-slate-700" />
          </div>
        </Card>
      </div>

      <Card
        title="ML Risk Review Queue"
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-full ${riskWorkerStatusView.dotClass}`} />
              <div className="text-left">
                <p className={`font-semibold ${riskWorkerStatusView.titleClass}`}>
                  {riskWorkerStatusView.label}
                </p>
                <p className="text-[11px] text-slate-500">
                  {riskWorkerStatusView.detail}
                  {riskWorkerStatus && !riskWorkerStatus.isRunning && riskWorkerStatus.autorunEnabled && !riskWorkerStatus.lastErrorMessage
                    ? ` • Scanned ${riskWorkerStatus.lastScannedCount}, inserted ${riskWorkerStatus.lastInsertedCount}`
                    : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void exportReviewedRiskReport()}
              disabled={isExportingRiskReport}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExportingRiskReport ? <ButtonLoadingContent label="Exporting" /> : 'Export reviewed CSV'}
            </button>
          </div>
        }
      >
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Risk Band</label>
            <select
              value={riskBandFilter}
              onChange={event => setRiskBandFilter(event.target.value as RiskBand | 'ALL')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            >
              {RISK_BAND_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Review Status</label>
            <select
              value={riskReviewFilter}
              onChange={event => setRiskReviewFilter(event.target.value as RiskReviewStatus | 'ALL')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            >
              {RISK_REVIEW_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Page Size</label>
            <select
              value={riskPageSize}
              onChange={event => setRiskPageSize(Number(event.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            >
              {[10, 20, 50].map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-between gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={reviewedOnly}
                onChange={event => setReviewedOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              />
              Reviewed only
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {riskTotal} events
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Band</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Signals</th>
                <th className="px-4 py-3">Observed</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingRiskEvents && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-500">
                    Loading risk events...
                  </td>
                </tr>
              )}
              {!isLoadingRiskEvents && riskEvents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-500">
                    No risk events matched the current filters.
                  </td>
                </tr>
              )}
              {!isLoadingRiskEvents &&
                riskEvents.map(event => (
                  <tr key={event.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{event.action}</p>
                        <p className="text-xs text-slate-500">{event.targetType || 'No target'}{event.targetId ? ` • ${event.targetId}` : ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">{event.actorRole || 'UNKNOWN'}</p>
                        <p>{event.actorId || '-'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{event.riskScore.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`rounded-md border px-2.5 py-1 font-semibold ${getRiskBandStyles(event.riskBand)}`}>
                        {event.riskBand}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-md border px-2.5 py-1 font-semibold ${getRiskReviewStyles(event.reviewStatus)}`}>
                          {event.reviewStatus}
                        </span>
                        <p className="text-slate-500">{event.reviewedAt ? formatDateTime(event.reviewedAt) : 'Not reviewed'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs space-y-1 text-xs text-slate-600">
                        {event.topSignals.length === 0 && <p>-</p>}
                        {event.topSignals.slice(0, 3).map(signal => (
                          <p key={signal} className="truncate">{signal}</p>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div className="space-y-1">
                        <p>{formatDateTime(event.observedAt)}</p>
                        <p className="text-slate-500">Model {event.modelVersion}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[230px] flex-wrap gap-2">
                        <button
                          onClick={() => void openRiskEventDetails(event.id)}
                          disabled={selectedRiskEventId === event.id && isLoadingSelectedRiskEvent}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          View
                        </button>
                        <button
                          onClick={() => void handleRiskReviewUpdate(event.id, 'CONFIRMED_ABUSE')}
                          disabled={reviewingRiskEventId === event.id || event.reviewStatus === 'CONFIRMED_ABUSE'}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reviewingRiskEventId === event.id && event.reviewStatus !== 'CONFIRMED_ABUSE' ? (
                            <ButtonLoadingContent label="Saving" />
                          ) : (
                            'Confirm abuse'
                          )}
                        </button>
                        <button
                          onClick={() => void handleRiskReviewUpdate(event.id, 'BENIGN')}
                          disabled={reviewingRiskEventId === event.id || event.reviewStatus === 'BENIGN'}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Benign
                        </button>
                        <button
                          onClick={() => void handleRiskReviewUpdate(event.id, 'UNCERTAIN')}
                          disabled={reviewingRiskEventId === event.id || event.reviewStatus === 'UNCERTAIN'}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Uncertain
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!isLoadingRiskEvents && riskTotal > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Page {currentRiskPage} of {totalRiskPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRiskPage(previous => Math.max(1, previous - 1))}
                disabled={currentRiskPage <= 1}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setRiskPage(previous => Math.min(totalRiskPages, previous + 1))}
                disabled={currentRiskPage >= totalRiskPages}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
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
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Action</label>
            <select
              value={auditActionFilter}
              onChange={event => setAuditActionFilter(event.target.value as 'ALL' | AuditAction)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            >
              {adminAuditActionOptions.map(action => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Severity</label>
            <select
              value={auditSeverityFilter}
              onChange={event => setAuditSeverityFilter(event.target.value as 'ALL' | AuditSeverity)}
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
              value={auditPageSize}
              onChange={event => setAuditPageSize(Number(event.target.value))}
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
              {filteredAdminAuditLogs.length} entries
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
              {isLoadingAuditLogs && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                    Loading audit logs...
                  </td>
                </tr>
              )}
              {!isLoadingAuditLogs && filteredAdminAuditLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                    No admin audit logs found.
                  </td>
                </tr>
              )}
              {!isLoadingAuditLogs &&
                pagedAdminAuditLogs.map(log => (
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
        {!isLoadingAuditLogs && filteredAdminAuditLogs.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Page {currentAdminAuditPage} of {totalAdminAuditPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuditPage(previous => Math.max(1, previous - 1))}
                disabled={currentAdminAuditPage <= 1}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setAuditPage(previous => Math.min(totalAdminAuditPages, previous + 1))}
                disabled={currentAdminAuditPage >= totalAdminAuditPages}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {section === 'overview' && renderOverview()}
      {section === 'users' && renderUserManagement()}
      {section === 'risk' && renderRiskReview()}
      {section === 'logs' && renderLogsPlaceholder()}

      {section === 'overview' && pendingQueue.length > 0 && (
        <Card title="Pending Approval Queue">
          <div className="space-y-3">
            {pendingQueue.slice(0, 4).map(user => (
              <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{getFullName(user)}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Mail size={12} />
                      {user.email}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {user.role}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={isUpdatingStatus === user.id}
                    onClick={() => void handleStatusUpdate(user.id, 'APPROVED')}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="OTP required before this action is applied"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Approve
                      <span className={OTP_BADGE_CLASS}>OTP</span>
                    </span>
                  </button>
                  <button
                    disabled={isUpdatingStatus === user.id}
                    onClick={() => void handleStatusUpdate(user.id, 'REJECTED')}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="OTP required before this action is applied"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Reject
                      <span className={OTP_BADGE_CLASS}>OTP</span>
                    </span>
                  </button>
                  <button
                    disabled={isUpdatingStatus === user.id}
                    onClick={() => void handleStatusUpdate(user.id, 'SUSPENDED')}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    title="OTP required before this action is applied"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Suspend
                      <span className={OTP_BADGE_CLASS}>OTP</span>
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {stepUpModal}
    </div>
  );
}
