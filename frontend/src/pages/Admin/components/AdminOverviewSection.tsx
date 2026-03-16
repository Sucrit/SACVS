import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ClipboardList,
  ShieldAlert,
  Users,
} from 'lucide-react';
import Card from '../../../components/common/Card';
import UserAvatar from '../../../components/common/UserAvatar';
import { LoadingAdminOverviewCard, LoadingTableCard } from '../../../components/common/LoadingCard';
import EmptyState from '../../../components/ui/EmptyState';
import { buildSparkline } from '../../../components/common/sparkline';
import { formatDate, formatDateTime } from '../../../utils/formatting';
import { getFullName, getInitials } from '../useAdminDashboardState';
import type { RiskEventRecord } from '../../../services/risk.service';
import type { User } from '../../../services/user.service';
import type { CredentialRequest } from '../../../services/credential.service';

interface AdminOverviewSectionProps {
  // Users
  users: User[];
  isLoadingUsers: boolean;
  totalUsers: number;
  roleDistribution: Record<'STUDENT' | 'INSTITUTION' | 'ADMIN', number>;
  pendingQueue: User[];
  // Risk
  riskSummary: {
    pendingReviewCount: number;
    highRiskCount: number;
    criticalRiskCount: number;
    confirmedAbuseCount: number;
  };
  riskEvents: RiskEventRecord[];
  isLoadingRiskEvents: boolean;
  credentialRequests: CredentialRequest[];
}

export default function AdminOverviewSection({
  users,
  isLoadingUsers,
  totalUsers,
  roleDistribution,
  pendingQueue,
  // isUpdatingStatus,
  // handleStatusUpdate,
  riskSummary,
  riskEvents,
  credentialRequests,
  isLoadingRiskEvents,
}: AdminOverviewSectionProps) {
  const securityAlertSummaryCards = [
    {
      key: 'pending',
      label: 'Pending review',
      value: riskSummary.pendingReviewCount,
      valueClassName: 'text-amber-600',
      labelClassName: 'text-amber-500',
    },
    {
      key: 'high',
      label: 'High risk',
      value: riskSummary.highRiskCount,
      valueClassName: 'text-rose-500',
      labelClassName: 'text-rose-400',
    },
    {
      key: 'critical',
      label: 'Critical',
      value: riskSummary.criticalRiskCount,
      valueClassName: 'text-rose-600',
      labelClassName: 'text-rose-500',
    },
    {
      key: 'abuse',
      label: 'Confirmed abuse',
      value: riskSummary.confirmedAbuseCount,
      valueClassName: 'text-rose-800',
      labelClassName: 'text-rose-800',
    },
  ] as const;

  const recentHighRiskEvents = riskEvents
    .filter(e => (e.riskBand === 'HIGH' || e.riskBand === 'CRITICAL') && e.reviewStatus === 'PENDING_REVIEW')
    .slice(0, 5);
  const mergedRiskCount = riskSummary.highRiskCount + riskSummary.criticalRiskCount;

  const last7DaysCounts = Array(7).fill(0);
  let previous7DaysCount = 0;
  let usersCreatedLast30Days = 0;
  
  const now = new Date().getTime();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  users.forEach(u => {
    const timeMs = new Date(u.createdAt).getTime();
    const diff = now - timeMs;
    const daysAgo = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (daysAgo >= 0 && daysAgo < 7) {
      last7DaysCounts[6 - daysAgo]++;
    } else if (daysAgo >= 7 && daysAgo < 14) {
      previous7DaysCount++;
    }

    if (timeMs >= thirtyDaysAgo) {
      usersCreatedLast30Days++;
    }
  });
  // Removed .reverse() to keep the newest day (index 6) on the right

  // Real data metrics
  const usersTotalLastMonth = Math.max(users.length - usersCreatedLast30Days, 1);
  const totalUsersGrowthNum = (usersCreatedLast30Days / usersTotalLastMonth) * 100;
  const totalUsersGrowthStr = totalUsersGrowthNum > 0 ? `+${totalUsersGrowthNum.toFixed(1)}%` : `${totalUsersGrowthNum.toFixed(1)}%`;
  
  const recentRegistrationsCount = last7DaysCounts.reduce((a, b) => a + b, 0);
  let registrationsGrowthNum = 0;
  if (previous7DaysCount === 0) {
    registrationsGrowthNum = recentRegistrationsCount > 0 ? 100 : 0;
  } else {
    registrationsGrowthNum = ((recentRegistrationsCount - previous7DaysCount) / previous7DaysCount) * 100;
  }
  const formattedRegGrowth = registrationsGrowthNum > 0 ? `+${registrationsGrowthNum.toFixed(0)}%` : `${registrationsGrowthNum.toFixed(0)}%`;

  // Credential Issuance Trend (Last 30 Days)
  const last30DaysCredCounts = Array(30).fill(0);
  let totalCredentialsLastMonth = 0;
  let previous30DaysCredCount = 0;

  credentialRequests
    .filter(req => req.status === 'APPROVED' || req.status === 'COMPLETED')
    .forEach(req => {
      const timeMs = new Date(req.updatedAt || req.createdAt).getTime();
      const diff = now - timeMs;
      const daysAgo = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (daysAgo >= 0 && daysAgo < 30) {
        last30DaysCredCounts[29 - daysAgo]++;
        totalCredentialsLastMonth++;
      } else if (daysAgo >= 30 && daysAgo < 60) {
        previous30DaysCredCount++;
      }
    });
  
  let credGrowthNum = 0;
  if (previous30DaysCredCount === 0) {
    credGrowthNum = totalCredentialsLastMonth > 0 ? 100 : 0;
  } else {
    credGrowthNum = ((totalCredentialsLastMonth - previous30DaysCredCount) / previous30DaysCredCount) * 100;
  }
  const formattedCredGrowth = credGrowthNum > 0 ? `+${credGrowthNum.toFixed(0)}%` : `${credGrowthNum.toFixed(0)}%`;

  let last30DaysRiskCount = 0;
  const mergedRiskEvents = riskEvents.filter(event => event.riskBand === 'HIGH' || event.riskBand === 'CRITICAL');

  mergedRiskEvents.forEach(event => {
    const diff = now - new Date(event.observedAt).getTime();
    const daysAgo = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (daysAgo >= 0 && daysAgo < 30) {
      last30DaysRiskCount += 1;
    }
  });

  const riskBlocks = [
    {
      key: 'pending',
      labelLines: ['Pending'],
      value: riskSummary.pendingReviewCount,
      barClassName: 'bg-amber-200',
      textClassName: 'text-amber-600',
    },
    {
      key: 'high',
      labelLines: ['High'],
      value: riskSummary.highRiskCount,
      barClassName: 'bg-rose-200',
      textClassName: 'text-rose-500',
    },
    {
      key: 'critical',
      labelLines: ['Critical'],
      value: riskSummary.criticalRiskCount,
      barClassName: 'bg-rose-400',
      textClassName: 'text-rose-600',
    },
    {
      key: 'abuse',
      labelLines: ['Abuse'],
      value: riskSummary.confirmedAbuseCount,
      barClassName: 'bg-rose-700',
      textClassName: 'text-rose-700',
    },
  ] as const;
  const riskBlockMax = Math.max(...riskBlocks.map(block => block.value), 1);
  const getRiskBlockHeightPercent = (value: number) => {
    if (value <= 0) return 8;

    const normalized = Math.sqrt(value / riskBlockMax);
    return 10 + normalized * 90;
  };
  const securityAlertBandStyles: Record<'HIGH' | 'CRITICAL', string> = {
    HIGH: 'border-rose-200 bg-rose-50 text-rose-500',
    CRITICAL: 'border-rose-300 bg-rose-100 text-rose-600',
  };
  const getSecurityAlertBandStyles = (riskBand: RiskEventRecord['riskBand']) => {
    if (riskBand === 'CRITICAL') return securityAlertBandStyles.CRITICAL;
    return securityAlertBandStyles.HIGH;
  };

  const registrationSparkline = buildSparkline(last7DaysCounts, { minimumCeiling: 4 });
  const credentialSparkline = buildSparkline(last30DaysCredCounts, { minimumCeiling: 4 });

  const pendingLast7DaysCounts = Array(7).fill(0);
  pendingQueue.forEach(u => {
    const timeMs = new Date(u.createdAt).getTime();
    const diff = now - timeMs;
    const daysAgo = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (daysAgo >= 0 && daysAgo < 7) {
      pendingLast7DaysCounts[6 - daysAgo]++;
    }
  });

  const pendingSparkline = buildSparkline(pendingLast7DaysCounts, { minimumCeiling: 4 });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoadingUsers ? (
          <>
            <LoadingAdminOverviewCard rows={1} />
            <LoadingAdminOverviewCard rows={1} />
            <LoadingAdminOverviewCard rows={1} />
          </>
        ) : (
          <>
            {/* Card 1 & 2 Combined: Total Users & Registrations */}
            <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <h3 className="text-[13px] font-semibold text-neutral-500">Total Users</h3>
                <Users size={18} className="text-orange-500" />
              </div>
              <div className="mt-4 mb-2">
                <p className="text-3xl font-bold tracking-tight text-neutral-900">
                  {totalUsers.toLocaleString()}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[11px] font-bold text-neutral-400">
                  <span>
                    <span className={`text-${totalUsersGrowthNum >= 0 ? 'emerald' : 'rose'}-500`}>{totalUsersGrowthStr}</span> LAST MONTH
                  </span>
                  <span>&bull;</span>
                  <span>
                    <span className={`text-${registrationsGrowthNum >= 0 ? 'emerald' : 'rose'}-500`}>{formattedRegGrowth}</span> LAST 7 DAYS
                  </span>
                </div>
              </div>
              
              <div className="mt-2 mb-3 w-full h-8">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                  <defs>
                    <linearGradient id="regSparkline" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgb(249 115 22)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="rgb(249 115 22)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {!isLoadingUsers && (
                    <g className="animate-sparkline">
                        <path
                          fill="url(#regSparkline)"
                          d={registrationSparkline.areaD}
                        />
                        <path
                        vectorEffect="non-scaling-stroke"
                        fill="none"
                        stroke="rgb(249 115 22)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                          d={registrationSparkline.pathD}
                        />
                    </g>
                  )}
                </svg>
              </div>

              <div className="mt-auto text-[10px] font-medium text-neutral-500">
                Students: {roleDistribution.STUDENT.toLocaleString()} &nbsp; Inst: {roleDistribution.INSTITUTION.toLocaleString()} &nbsp; Admin: {roleDistribution.ADMIN.toLocaleString()}
              </div>
            </div>

            {/* New Card 2: Credential Issuance Trend */}
            <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <h3 className="text-[13px] font-semibold text-neutral-500">Credentials Issued</h3>
                <ShieldAlert size={18} className="text-emerald-500" />
              </div>
              <div className="mt-4 mb-5">
                <p className="text-3xl font-bold tracking-tight text-neutral-900">+{totalCredentialsLastMonth}</p>
                <p className="mt-1 text-[11px] font-bold text-neutral-400">
                  <span className={`text-${credGrowthNum >= 0 ? 'emerald' : 'rose'}-500`}>{formattedCredGrowth}</span> ISSUED LAST 30 DAYS
                </p>
              </div>
              <div className="mt-auto space-y-2">
                <div className="h-12 w-full">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                    <defs>
                      <linearGradient id="credSparkline" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {!isLoadingUsers && (
                      <g className="animate-sparkline">
                        <path
                          fill="url(#credSparkline)"
                          d={credentialSparkline.areaD}
                        />
                        <path
                          vectorEffect="non-scaling-stroke"
                          fill="none"
                          stroke="rgb(16 185 129)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={credentialSparkline.pathD}
                        />
                      </g>
                    )}
                  </svg>
                </div>
                <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-400">
                  <span>Approval/Completion trend</span>
                  <span>{credentialSparkline.peak} peak</span>
                </div>
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
              {/* Sparkline stats for pending approvals */}
              <div className="mt-2 mb-3 w-full h-8">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                  <defs>
                    <linearGradient id="pendingSparkline" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgb(251 191 36)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="rgb(251 191 36)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {!isLoadingUsers && (
                    <g className="animate-sparkline">
                      <path
                        fill="url(#pendingSparkline)"
                        d={pendingSparkline.areaD}
                      />
                      <path
                        vectorEffect="non-scaling-stroke"
                        fill="none"
                        stroke="rgb(251 191 36)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={pendingSparkline.pathD}
                      />
                    </g>
                  )}
                </svg>
              </div>
              <div className="flex h-5 items-center">
                {pendingQueue.length > 0 ? (
                  <>
                    {(() => {
                      const pendingInstitutionListPath = '/admin/users?role=INSTITUTION&status=PENDING';

                      return pendingQueue.slice(0, 2).map((u, i) => (
                        <Link
                          key={u.id}
                          to={`${pendingInstitutionListPath}&userId=${encodeURIComponent(u.id)}`}
                          className={`block transition-transform hover:-translate-y-0.5 ${i > 0 ? '-ml-2' : ''}`}
                          style={{ zIndex: 10 - i }}
                          title={`Open ${getFullName(u)} in pending institution approvals`}
                          aria-label={`Open ${getFullName(u)} in pending institution approvals`}
                        >
                          <UserAvatar initials={getInitials(u)} size="xs" className="border-2 border-white" />
                        </Link>
                      ));
                    })()}
                    {pendingQueue.length > 2 && (
                      <Link
                        to="/admin/users?role=INSTITUTION&status=PENDING"
                        className="-ml-2 flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-neutral-100 px-1.5 text-[10px] font-bold text-neutral-600 shadow-sm transition-colors hover:bg-neutral-200"
                        style={{ zIndex: 0 }}
                        title={`View ${pendingQueue.length} pending institution approvals`}
                        aria-label={`View ${pendingQueue.length} pending institution approvals`}
                      >
                        +{pendingQueue.length - 2}
                      </Link>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-neutral-400">All caught up</span>
                )}
              </div>
            </div>
          </>
        )}

        {isLoadingRiskEvents ? (
          <LoadingAdminOverviewCard rows={1} />
        ) : (
          /* Card 4: High + Critical Risk Events */
          <div className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <h3 className="text-[13px] font-semibold text-neutral-500">High Risk Events</h3>
              <AlertCircle size={18} className="text-rose-600" />
            </div>
            <div className="mt-4 mb-5">
              <p className="text-3xl font-bold tracking-tight text-rose-600">{mergedRiskCount}</p>
              <p className="mt-1 text-[11px] font-bold text-neutral-400">
                <span className="text-rose-600">
                  +{last30DaysRiskCount}
                </span> LAST 30 DAYS
              </p>
            </div>
            <div className="mt-auto space-y-2">
              <div className="flex h-20 items-end gap-2.5">
                {riskBlocks.map(block => {
                  const heightPercent = getRiskBlockHeightPercent(block.value);

                  return (
                    <div key={block.key} className="flex w-0 flex-1 flex-col items-center gap-2">
                      <div className="flex h-12 w-full items-end rounded-sm bg-neutral-50 px-1.5 pb-0.5">
                        <div
                          className={`w-full rounded-sm ${block.barClassName} transition-all duration-500`}
                          style={{ height: `${heightPercent}%` }}
                          title={`${block.labelLines.join(' ')}: ${block.value}`}
                        />
                      </div>
                      <div className="min-h-[2.1rem] text-center leading-none">
                        {block.labelLines.map((line, index) => (
                          <p
                            key={`${block.key}-${line}`}
                            className={`text-[9px] font-bold uppercase tracking-[0.08em] ${block.textClassName} ${index > 0 ? 'mt-0.5' : ''}`}
                          >
                            {line}
                          </p>
                        ))}
                        <p className="mt-1 text-[10px] font-medium text-neutral-400">{block.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-400">
                <span>Risk summary</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pending Approvals + Security Alerts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 xl:h-full">
          <Card
            className="flex h-full flex-col"
            title="Institution Approval Queue"
            action={
              <Link
                to="/admin/users"
                className="text-xs font-semibold text-neutral-600 underline decoration-neutral-300 underline-offset-4 transition-colors hover:text-neutral-900 hover:decoration-neutral-900"
                aria-label="See more institution approval queue entries"
              >
                See More
              </Link>
            }
          >
            <div className="flex h-full flex-col">
              {isLoadingUsers && (
                <LoadingTableCard className="border-0 shadow-none" rows={3} />
              )}
              {!isLoadingUsers && pendingQueue.length === 0 && (
                <EmptyState
                  title="No pending approvals"
                  description="All user registrations have been processed."
                  icon={<ClipboardList size={28} />}
                  className="my-8 border-none bg-transparent"
                />
              )}
              {!isLoadingUsers && pendingQueue.length > 0 && (
                <div className="flex h-full flex-col space-y-3">
                  <div className="overflow-x-auto rounded-lg border border-neutral-200">
                    <table className="min-w-full divide-y divide-neutral-200 bg-white text-sm">
                      <thead className="bg-neutral-50 text-left">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-neutral-600">Representative Name</th>
                          <th className="px-4 py-3 font-semibold text-neutral-600">Email</th>
                          <th className="px-4 py-3 font-semibold text-neutral-600">Institution Name</th>
                          <th className="px-4 py-3 font-semibold text-neutral-600">Registered At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {pendingQueue.slice(0, 5).map(user => (
                          <tr key={user.id} className="hover:bg-neutral-50/50">
                            <td className="px-4 py-3 font-medium text-neutral-900">
                              <div className="flex items-center gap-3">
                                <UserAvatar initials={getInitials(user)} />
                                {getFullName(user)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-neutral-500">
                              <span>{user.email}</span>
                            </td>
                            <td className="px-4 py-3 text-neutral-600">
                              {user.institution?.institutionName || 'Institution profile pending'}
                            </td>
                            <td className="px-4 py-3 text-neutral-500">{formatDate(user.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {pendingQueue.length > 5 && (
                    <Link
                      to="/admin/users"
                      className="mt-auto block text-center text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      View all {pendingQueue.length} pending users &rarr;
                    </Link>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="xl:h-full">
          <Card
            className="flex h-full flex-col"
            title="Security Alerts"
            action={
              <Link
                to="/admin/risk"
                className="text-xs font-semibold text-neutral-600 underline decoration-neutral-300 underline-offset-4 transition-colors hover:text-neutral-900 hover:decoration-neutral-900"
                aria-label="See more security alerts in risk review"
              >
                See More
              </Link>
            }
          >
            <div className="flex h-full flex-col">
              {isLoadingRiskEvents && (
                <div className="space-y-3">
                  <LoadingAdminOverviewCard rows={1} className="border-0 bg-transparent p-0 shadow-none" />
                  <LoadingAdminOverviewCard rows={1} className="border-0 bg-transparent p-0 shadow-none" />
                </div>
              )}
              {!isLoadingRiskEvents && recentHighRiskEvents.length === 0 && (
                <div className="flex flex-1 flex-col justify-between">
                  <EmptyState
                    title="No high/critical alerts"
                    description="Everything looks safe at the moment."
                    icon={<AlertCircle size={24} />}
                    className="my-4 border-none bg-transparent"
                  />

                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {securityAlertSummaryCards.map(card => (
                      <div key={card.key} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-center">
                        <p className={`text-lg font-semibold ${card.valueClassName}`}>{card.value}</p>
                        <p className={`text-[10px] font-medium ${card.labelClassName}`}>{card.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!isLoadingRiskEvents && recentHighRiskEvents.length > 0 && (
                <div className="flex h-full flex-col">
                  <div className="space-y-2">
                    {recentHighRiskEvents.map(event => (
                      <div key={event.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-semibold text-neutral-900">{event.action}</p>
                            <p className="text-xs text-neutral-500">{formatDateTime(event.observedAt)}</p>
                          </div>
                          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getSecurityAlertBandStyles(event.riskBand)}`}>
                            {event.riskBand}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">
                          Score: {event.riskScore.toFixed(2)} · {event.actorRole || 'Unknown actor'}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {securityAlertSummaryCards.map(card => (
                      <div key={card.key} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-center">
                        <p className={`text-lg font-semibold ${card.valueClassName}`}>{card.value}</p>
                        <p className={`text-[10px] font-medium ${card.labelClassName}`}>{card.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
