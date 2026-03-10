import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Clock3,
  Mail,
  ShieldAlert,
  Users,
} from 'lucide-react';
import Card from '../../../components/common/Card';
import { formatDate, formatDateTime } from '../../../utils/formatting';
import { getFullName, getRoleStyles, getRiskBandStyles, OTP_BADGE_CLASS } from '../useAdminDashboardState';
import type { RiskEventRecord } from '../../../services/risk.service';
import type { User } from '../../../services/user.service';

interface AdminOverviewSectionProps {
  // Users
  users: User[];
  isLoadingUsers: boolean;
  totalUsers: number;
  pendingUsers: number;
  roleDistribution: Record<'STUDENT' | 'INSTITUTION' | 'ADMIN', number>;
  pendingQueue: User[];
  isUpdatingStatus: string | null;
  handleStatusUpdate: (userId: string, status: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'PENDING') => Promise<void>;
  // Risk
  riskSummary: {
    pendingReviewCount: number;
    highRiskCount: number;
    criticalRiskCount: number;
    confirmedAbuseCount: number;
  };
  riskEvents: RiskEventRecord[];
  isLoadingRiskEvents: boolean;
}

export default function AdminOverviewSection({
  isLoadingUsers,
  totalUsers,
  pendingUsers,
  roleDistribution,
  pendingQueue,
  isUpdatingStatus,
  handleStatusUpdate,
  riskSummary,
  riskEvents,
  isLoadingRiskEvents,
}: AdminOverviewSectionProps) {
  const alertCount = riskSummary.highRiskCount + riskSummary.criticalRiskCount;
  const recentHighRiskEvents = riskEvents
    .filter(e => (e.riskBand === 'HIGH' || e.riskBand === 'CRITICAL') && e.reviewStatus === 'PENDING_REVIEW')
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <Clock3 size={18} />
          </div>
          <div>
            <p className="text-2xl font-semibold text-neutral-900">{pendingUsers}</p>
            <p className="text-xs text-neutral-500">Pending Institution Approvals</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Users size={18} />
          </div>
          <div>
            <p className="text-2xl font-semibold text-neutral-900">{totalUsers}</p>
            <p className="text-xs text-neutral-500">Total users</p>
          </div>
        </div>

        <div className={`flex items-center gap-4 rounded-lg border p-4 ${alertCount > 0 ? 'border-rose-200 bg-rose-50/50' : 'border-neutral-200 bg-white'}`}>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${alertCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-neutral-100 text-neutral-600'}`}>
            <ShieldAlert size={18} />
          </div>
          <div>
            <p className="text-2xl font-semibold text-neutral-900">{alertCount}</p>
            <p className="text-xs text-neutral-500">Security alerts</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
            <Building2 size={18} />
          </div>
          <div>
            <p className="text-2xl font-semibold text-neutral-900">{roleDistribution.INSTITUTION}</p>
            <p className="text-xs text-neutral-500">Institutions</p>
          </div>
        </div>
      </div>

      {/* Pending Approvals + Security Alerts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card
            title="Pending Institution Approvals    "
            action={
              <Link
                to="/admin/users"
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                All Users
                <ArrowRight size={14} />
              </Link>
            }
          >
            {isLoadingUsers && (
              <div className="space-y-3">
                {[1, 2, 3].map(key => (
                  <div key={key} className="h-16 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
                ))}
              </div>
            )}
            {!isLoadingUsers && pendingQueue.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-6 py-12 text-center">
                <Clock3 size={28} className="mb-2 text-neutral-400" />
                <p className="text-sm font-medium text-neutral-600">No pending approvals</p>
                <p className="mt-1 text-xs text-neutral-400">All user registrations have been processed.</p>
              </div>
            )}
            {!isLoadingUsers && pendingQueue.length > 0 && (
              <div className="space-y-3">
                {pendingQueue.slice(0, 5).map(user => (
                  <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-900">{getFullName(user)}</p>
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getRoleStyles(user.role)}`}>
                          {user.role}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                          <Mail size={12} />
                          {user.email}
                        </span>
                        <span>Registered {formatDate(user.createdAt)}</span>
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
                    </div>
                  </div>
                ))}
                {pendingQueue.length > 5 && (
                  <Link
                    to="/admin/users"
                    className="block text-center text-xs font-medium text-primary-600 hover:text-primary-700"
                  >
                    View all {pendingQueue.length} pending users →
                  </Link>
                )}
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card
            title="Security Alerts"
            action={
              <Link
                to="/admin/risk"
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                Risk Review
                <ArrowRight size={14} />
              </Link>
            }
          >
            {isLoadingRiskEvents && (
              <div className="space-y-3">
                {[1, 2, 3].map(key => (
                  <div key={key} className="h-12 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
                ))}
              </div>
            )}
            {!isLoadingRiskEvents && recentHighRiskEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-10 text-center">
                <ShieldAlert size={24} className="mb-2 text-neutral-400" />
                <p className="text-sm font-medium text-neutral-600">No active alerts</p>
                <p className="mt-1 text-xs text-neutral-400">No high or critical risk events pending review.</p>
              </div>
            )}
            {!isLoadingRiskEvents && recentHighRiskEvents.length > 0 && (
              <div className="space-y-2">
                {recentHighRiskEvents.map(event => (
                  <div key={event.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">{event.action}</p>
                        <p className="text-xs text-neutral-500">{formatDateTime(event.observedAt)}</p>
                      </div>
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getRiskBandStyles(event.riskBand)}`}>
                        {event.riskBand}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      Score: {event.riskScore.toFixed(2)} · {event.actorRole || 'Unknown actor'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Summary counters */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-center">
                <p className="text-lg font-semibold text-amber-600">{riskSummary.highRiskCount}</p>
                <p className="text-[10px] text-neutral-500">High risk</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-center">
                <p className="text-lg font-semibold text-rose-600">{riskSummary.criticalRiskCount}</p>
                <p className="text-[10px] text-neutral-500">Critical</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-center">
                <p className="text-lg font-semibold text-neutral-800">{riskSummary.pendingReviewCount}</p>
                <p className="text-[10px] text-neutral-500">Pending review</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-center">
                <p className="text-lg font-semibold text-red-600">{riskSummary.confirmedAbuseCount}</p>
                <p className="text-[10px] text-neutral-500">Confirmed abuse</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
