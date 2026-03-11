import { Link } from 'react-router-dom';
import {
  ArrowRight,
  AlertCircle,
  ClipboardList,
  Mail,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import Card from '../../../components/common/Card';
import { formatDate, formatDateTime } from '../../../utils/formatting';
import { getFullName, getRoleStyles, getRiskBandStyles } from '../useAdminDashboardState';
import type { RiskEventRecord } from '../../../services/risk.service';
import type { User } from '../../../services/user.service';

interface AdminOverviewSectionProps {
  // Users
  users: User[];
  isLoadingUsers: boolean;
  totalUsers: number;
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
  users,
  isLoadingUsers,
  totalUsers,
  roleDistribution,
  pendingQueue,
  isUpdatingStatus,
  handleStatusUpdate,
  riskSummary,
  riskEvents,
  isLoadingRiskEvents,
}: AdminOverviewSectionProps) {
  const recentHighRiskEvents = riskEvents
    .filter(e => (e.riskBand === 'HIGH' || e.riskBand === 'CRITICAL') && e.reviewStatus === 'PENDING_REVIEW')
    .slice(0, 5);

  const last7DaysCounts = Array(7).fill(0);
  const now = new Date().getTime();
  users.forEach(u => {
    const diff = now - new Date(u.createdAt).getTime();
    const daysAgo = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (daysAgo >= 0 && daysAgo < 7) {
      last7DaysCounts[6 - daysAgo]++;
    }
  });
  last7DaysCounts.reverse(); // Newest day on the right
  const maxDay = Math.max(...last7DaysCounts, 1);
  const recentRegistrationsCount = last7DaysCounts.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total Users */}
        <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <h3 className="text-[13px] font-semibold text-neutral-500">Total Users</h3>
            <Users size={18} className="text-orange-500" />
          </div>
          <div className="mt-4 mb-5">
            <p className="text-3xl font-bold tracking-tight text-neutral-900">{totalUsers.toLocaleString()}</p>
            <p className="mt-1 text-[11px] font-bold text-neutral-400">
              <span className="text-emerald-500">+5.2%</span> VS LAST MONTH
            </p>
          </div>
          <div className="text-[11px] font-medium text-neutral-500">
            Students: {(roleDistribution.STUDENT / 1000).toFixed(1)}k &nbsp; Inst: {(roleDistribution.INSTITUTION / 1000).toFixed(1)}k &nbsp; Admin: {roleDistribution.ADMIN}
          </div>
        </div>

        {/* Card 2: Recent Registrations */}
        <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <h3 className="text-[13px] font-semibold text-neutral-500">Recent Registrations</h3>
            <UserPlus size={18} className="text-orange-500" />
          </div>
          <div className="mt-4 mb-5">
            <p className="text-3xl font-bold tracking-tight text-neutral-900">+{recentRegistrationsCount}</p>
            <p className="mt-1 text-[11px] font-bold text-neutral-400">
              <span className="text-emerald-500">+12%</span> LAST 7 DAYS
            </p>
          </div>
          <div className="flex h-5 items-end gap-1.5 opacity-90">
            {last7DaysCounts.map((count, idx) => {
              const heightPercent = Math.max((count / maxDay) * 100, 20);
              const isLast = idx === last7DaysCounts.length - 1;
              return (
                <div key={idx} className="flex h-full w-full items-end">
                  <div 
                    className={`w-full rounded-sm transition-all ${isLast ? 'bg-orange-500' : 'bg-orange-200/70'}`} 
                    style={{ height: `${heightPercent}%` }}
                    title={`${count} users on day ${idx + 1}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 3: Pending Approvals */}
        <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <h3 className="text-[13px] font-semibold text-neutral-500">Pending Approvals</h3>
            <ClipboardList size={18} className="text-amber-500" />
          </div>
          <div className="mt-4 mb-5">
            <p className="text-3xl font-bold tracking-tight text-neutral-900">{pendingQueue.length}</p>
            <p className="mt-1 text-[11px] font-bold text-neutral-400">
              <span className="text-amber-500">Requires Action</span> INSTITUTIONS
            </p>
          </div>
          <div className="flex h-5 items-center">
            {pendingQueue.length > 0 ? (
              <>
                {pendingQueue.slice(0, 3).map((u, i) => (
                  <div 
                    key={u.id} 
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-[10px] font-bold text-white shadow-sm ${i > 0 ? '-ml-2' : ''}`}
                    style={{ zIndex: 10 - i }}
                    title={getFullName(u)}
                  >
                    {u.firstName?.[0] || u.email[0].toUpperCase()}
                  </div>
                ))}
                {pendingQueue.length > 3 && (
                  <div className="-ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white bg-neutral-100 text-[9px] font-bold text-neutral-500 shadow-sm z-0">
                    +{pendingQueue.length - 3}
                  </div>
                )}
              </>
            ) : (
              <span className="text-[11px] text-neutral-400">All caught up</span>
            )}
          </div>
        </div>

        {/* Card 4: Critical Risk Events */}
        <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <h3 className="text-[13px] font-semibold text-neutral-500">Critical Risk Events</h3>
            <AlertCircle size={18} className="text-rose-600" />
          </div>
          <div className="mt-4 mb-5">
            <p className="text-3xl font-bold tracking-tight text-rose-600">{riskSummary.criticalRiskCount}</p>
            <p className="mt-1 text-[11px] font-bold text-neutral-400">
              <span className="text-rose-600">High Priority</span> SHADOW ML MODE
            </p>
          </div>
          <div className="mt-auto h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div 
              className="h-full rounded-full bg-rose-500 transition-all duration-500" 
              style={{ width: `${riskSummary.criticalRiskCount > 0 ? Math.min(riskSummary.criticalRiskCount * 15 + 10, 100) : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Pending Approvals + Security Alerts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card
            title="Institution Approval Queue"
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
                <ClipboardList size={28} className="mb-2 text-neutral-400" />
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
                      >
                        Approve
                      </button>
                      <button
                        disabled={isUpdatingStatus === user.id}
                        onClick={() => void handleStatusUpdate(user.id, 'REJECTED')}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reject
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
