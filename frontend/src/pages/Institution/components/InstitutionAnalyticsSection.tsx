import { useState } from 'react';
import { Credential, CredentialRequest, CredentialStatus, CredentialType } from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import Card from '../../../components/common/Card';
import { DEFAULT_DEPARTMENT_OPTIONS } from '../constants';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

interface InstitutionAnalyticsSectionProps {
  students: User[];
  requests: CredentialRequest[];
  credentials: Credential[];
  isLoadingStudents: boolean;
  isLoadingRequests: boolean;
  isLoadingCredentials: boolean;
}

type MonthBucket = { key: string; label: string; requests: number; issued: number };

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

const REQUEST_STATUS_ORDER: Array<CredentialRequest['status']> = [
  'PENDING',
  'APPROVED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];

const CREDENTIAL_STATUS_ORDER: CredentialStatus[] = ['PENDING', 'ISSUED', 'REVOKED', 'EXPIRED'];
const CREDENTIAL_TYPE_ORDER: CredentialType[] = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
type DateRangePreset = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'LAST_180_DAYS' | 'ALL_TIME';
type DateRange = { start: Date | null; end: Date | null };
type ChartFilterKey =
  | 'requestStatus'
  | 'credentialStatus'
  | 'monthlyTrend'
  | 'delivery'
  | 'credentialTypes'
  | 'departmentVolume';

const DATE_RANGE_OPTIONS: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
  { value: 'LAST_90_DAYS', label: 'Last 90 days' },
  { value: 'LAST_180_DAYS', label: 'Last 180 days' },
  { value: 'ALL_TIME', label: 'All time' },
];

const INITIAL_CARD_FILTERS: Record<ChartFilterKey, DateRangePreset> = {
  requestStatus: 'LAST_30_DAYS',
  credentialStatus: 'LAST_30_DAYS',
  monthlyTrend: 'LAST_180_DAYS',
  delivery: 'LAST_30_DAYS',
  credentialTypes: 'LAST_30_DAYS',
  departmentVolume: 'LAST_30_DAYS',
};

const buildRecentMonthBuckets = (months: number): MonthBucket[] => {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    buckets.push({ key, label, requests: 0, issued: 0 });
  }
  return buckets;
};

const bucketKeyFromDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const buildDateRange = (preset: DateRangePreset): DateRange => {
  if (preset === 'ALL_TIME') {
    return { start: null, end: null };
  }

  const daysByPreset: Record<Exclude<DateRangePreset, 'ALL_TIME'>, number> = {
    LAST_7_DAYS: 7,
    LAST_30_DAYS: 30,
    LAST_90_DAYS: 90,
    LAST_180_DAYS: 180,
  };

  const now = new Date();
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - (daysByPreset[preset] - 1));
  start.setUTCHours(0, 0, 0, 0);

  return { start, end };
};

const isDateWithinRange = (value: string | null | undefined, range: DateRange) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
};

const getCredentialAnalyticsDate = (credential: Credential) =>
  credential.issuedDate || credential.createdAt || credential.updatedAt;

const labelize = (value: string) => value.replace(/_/g, ' ');
const toDepartmentShortName = (department: string) => {
  const match = department.match(/\(([^)]+)\)\s*$/);
  if (match?.[1]) return match[1].trim();
  return department;
};

const buildDoughnutData = (labels: string[], values: number[], colors: string[]): ChartData<'doughnut'> => ({
  labels,
  datasets: [
    {
      data: values,
      backgroundColor: colors,
      borderColor: '#ffffff',
      borderWidth: 2,
      hoverOffset: 6,
    },
  ],
});

const doughnutOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 1200,
    easing: 'easeInOutCubic',
    animateRotate: true,
    animateScale: true,
  },
  transitions: {
    show: {
      animation: {
        duration: 1200,
      },
    },
    hide: {
      animation: {
        duration: 400,
      },
    },
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        color: '#334155',
        font: { size: 11, weight: 600 },
      },
    },
  },
};

const barOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 1000,
    easing: 'easeInOutCubic',
    delay: context => context.dataIndex * 45,
  },
  transitions: {
    show: {
      animations: {
        x: { from: 0 },
        y: { from: 0 },
      },
    },
  },
  plugins: {
    legend: { display: false },
  },
  scales: {
    x: {
      ticks: {
        color: '#64748b',
        font: { size: 11, weight: 600 },
        stepSize: 1,
        precision: 0,
        callback: value => {
          const numericValue = Number(value);
          return Number.isInteger(numericValue) ? numericValue : '';
        },
      },
      grid: { color: '#e2e8f0' },
    },
    y: {
      ticks: { color: '#334155', font: { size: 11, weight: 600 } },
      grid: { display: false },
    },
  },
};

const departmentBarOptions: ChartOptions<'bar'> = {
  ...barOptions,
  plugins: {
    ...barOptions.plugins,
    tooltip: {
      callbacks: {
        title: items => {
          const rawLabel = items[0]?.label;
          if (typeof rawLabel !== 'string') return '';
          return rawLabel;
        },
      },
    },
  },
};

const lineOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 1100,
    easing: 'easeInOutCubic',
  },
  transitions: {
    show: {
      animations: {
        x: { from: 0 },
        y: { from: 0 },
      },
    },
  },
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        color: '#334155',
        font: { size: 11, weight: 600 },
      },
    },
  },
  scales: {
    x: {
      ticks: { color: '#64748b', font: { size: 11, weight: 600 } },
      grid: { display: false },
    },
    y: {
      beginAtZero: true,
      ticks: { precision: 0, color: '#64748b', font: { size: 11, weight: 600 } },
      grid: { color: '#e2e8f0' },
    },
  },
};

export default function InstitutionAnalyticsSection({
  students,
  requests,
  credentials,
  isLoadingStudents,
  isLoadingRequests,
  isLoadingCredentials,
}: InstitutionAnalyticsSectionProps) {
  const [cardFilters, setCardFilters] = useState<Record<ChartFilterKey, DateRangePreset>>(INITIAL_CARD_FILTERS);
  const isLoading = isLoadingStudents || isLoadingRequests || isLoadingCredentials;

  const getFilteredRequests = (key: ChartFilterKey) => {
    const range = buildDateRange(cardFilters[key]);
    return requests.filter(request => isDateWithinRange(request.createdAt, range));
  };

  const getFilteredCredentials = (key: ChartFilterKey) => {
    const range = buildDateRange(cardFilters[key]);
    return credentials.filter(credential => isDateWithinRange(getCredentialAnalyticsDate(credential), range));
  };

  const requestStatusRequests = getFilteredRequests('requestStatus');
  const credentialStatusCredentials = getFilteredCredentials('credentialStatus');
  const deliveryRequests = getFilteredRequests('delivery');
  const credentialTypeCredentials = getFilteredCredentials('credentialTypes');
  const departmentRequests = getFilteredRequests('departmentVolume');
  const monthTrendRequests = getFilteredRequests('monthlyTrend');
  const monthTrendCredentials = getFilteredCredentials('monthlyTrend');

  const requestStatusTotal = requestStatusRequests.length;
  const credentialStatusTotal = credentialStatusCredentials.length;
  const deliveryTotal = deliveryRequests.length;
  const credentialTypeTotal = credentialTypeCredentials.length;

  const requestsByStatus = REQUEST_STATUS_ORDER.map(status => ({
    key: status,
    value: requestStatusRequests.filter(request => request.status === status).length,
  }));

  const credentialsByStatus = CREDENTIAL_STATUS_ORDER.map(status => ({
    key: status,
    value: credentialStatusCredentials.filter(credential => credential.status === status).length,
  }));

  const credentialsByType = CREDENTIAL_TYPE_ORDER.map(type => ({
    key: type,
    value: credentialTypeCredentials.filter(credential => credential.type === type).length,
  }));

  const requestsByDelivery = (['DIGITAL', 'PHYSICAL', 'BOTH'] as const).map(deliveryMethod => ({
    key: deliveryMethod,
    value: deliveryRequests.filter(request => request.deliveryMethod === deliveryMethod).length,
  }));

  const studentDepartmentMap = new Map(
    students.map(student => [student.id, student.profile?.department?.trim() || 'Unassigned'] as const),
  );
  const departmentOptions = Array.from(
    new Set([
      ...DEFAULT_DEPARTMENT_OPTIONS,
      ...students
        .map(student => student.profile?.department?.trim() || '')
        .filter(Boolean),
      ...departmentRequests
        .map(request => studentDepartmentMap.get(request.studentId) || 'Unassigned')
        .filter(Boolean),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const requestVolumeByDepartment = departmentOptions.map(department => {
    const count = departmentRequests.reduce((total, request) => {
      const requestDepartment = studentDepartmentMap.get(request.studentId) || 'Unassigned';
      return requestDepartment === department ? total + 1 : total;
    }, 0);
    return [department, count] as const;
  });

  const monthBuckets = buildRecentMonthBuckets(6);
  const monthBucketMap = new Map(monthBuckets.map(bucket => [bucket.key, bucket]));
  monthTrendRequests.forEach(request => {
    const key = bucketKeyFromDate(request.createdAt);
    if (key && monthBucketMap.has(key)) {
      monthBucketMap.get(key)!.requests += 1;
    }
  });
  monthTrendCredentials.forEach(credential => {
    if (credential.status !== 'ISSUED') return;
    const key = bucketKeyFromDate(credential.issuedDate || credential.updatedAt);
    if (key && monthBucketMap.has(key)) {
      monthBucketMap.get(key)!.issued += 1;
    }
  });
  const monthTrend = monthBuckets;

  const requestStatusChart = buildDoughnutData(
    requestsByStatus.map(item => labelize(item.key)),
    isLoading ? requestsByStatus.map(() => 0) : requestsByStatus.map(item => item.value),
    ['#0f172a', '#1d4ed8', '#059669', '#dc2626', '#a855f7'],
  );

  const credentialStatusChart = buildDoughnutData(
    credentialsByStatus.map(item => labelize(item.key)),
    isLoading ? credentialsByStatus.map(() => 0) : credentialsByStatus.map(item => item.value),
    ['#64748b', '#0891b2', '#dc2626', '#a855f7'],
  );

  const deliveryChart = buildDoughnutData(
    requestsByDelivery.map(item => labelize(item.key)),
    isLoading ? requestsByDelivery.map(() => 0) : requestsByDelivery.map(item => item.value),
    ['#1d4ed8', '#0ea5e9', '#6366f1'],
  );

  const monthTrendChart: ChartData<'line'> = {
    labels: monthTrend.map(item => item.label),
    datasets: [
      {
        label: 'Requests',
        data: isLoading ? monthTrend.map(() => 0) : monthTrend.map(item => item.requests),
        borderColor: '#0f172a',
        backgroundColor: 'rgba(15, 23, 42, 0.2)',
        pointBackgroundColor: '#0f172a',
        tension: 0.35,
      },
      {
        label: 'Issued',
        data: isLoading ? monthTrend.map(() => 0) : monthTrend.map(item => item.issued),
        borderColor: '#0891b2',
        backgroundColor: 'rgba(8, 145, 178, 0.2)',
        pointBackgroundColor: '#0891b2',
        tension: 0.35,
      },
    ],
  };

  const credentialTypesChart: ChartData<'bar'> = {
    labels: credentialsByType.map(item => labelize(item.key)),
    datasets: [
      {
        data: isLoading ? credentialsByType.map(() => 0) : credentialsByType.map(item => item.value),
        backgroundColor: '#334155',
        borderRadius: 8,
      },
    ],
  };

  const departmentChart: ChartData<'bar'> = {
    labels: requestVolumeByDepartment.map(([department]) => toDepartmentShortName(department)),
    datasets: [
      {
        data: isLoading ? requestVolumeByDepartment.map(() => 0) : requestVolumeByDepartment.map(([, count]) => count),
        backgroundColor: '#059669',
        borderRadius: 8,
      },
    ],
  };
  const departmentFullLabels = requestVolumeByDepartment.map(([department]) => department);

  const renderFilterAction = (key: ChartFilterKey) => (
    <select
      value={cardFilters[key]}
      onChange={event =>
        setCardFilters(previous => ({
          ...previous,
          [key]: event.target.value as DateRangePreset,
        }))
      }
      className="h-9 min-w-[136px] rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700 outline-none"
    >
      {DATE_RANGE_OPTIONS.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Request Status Distribution" action={renderFilterAction('requestStatus')}>
          <div className="h-64">
            <Doughnut data={requestStatusChart} options={doughnutOptions} />
          </div>
          {!isLoading && requestStatusTotal === 0 && (
            <p className="mt-2 text-sm text-slate-500">No request records yet.</p>
          )}
        </Card>

        <Card title="Credential Status Distribution" action={renderFilterAction('credentialStatus')}>
          <div className="h-64">
            <Doughnut data={credentialStatusChart} options={doughnutOptions} />
          </div>
          {!isLoading && credentialStatusTotal === 0 && (
            <p className="mt-2 text-sm text-slate-500">No credentials yet.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Monthly Trend (Last 6 Months)" action={renderFilterAction('monthlyTrend')}>
          <div className="h-72">
            <Line data={monthTrendChart} options={lineOptions} />
          </div>
        </Card>

        <Card title="Delivery Method Distribution" action={renderFilterAction('delivery')}>
          <div className="h-72">
            <Doughnut data={deliveryChart} options={doughnutOptions} />
          </div>
          {!isLoading && deliveryTotal === 0 && (
            <p className="mt-2 text-sm text-slate-500">No delivery data yet.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Credential Types" action={renderFilterAction('credentialTypes')}>
          <div className="h-72">
            <Bar
              data={credentialTypesChart}
              options={{
                ...barOptions,
                indexAxis: 'y',
              }}
            />
          </div>
          {!isLoading && credentialTypeTotal === 0 && (
            <p className="mt-2 text-sm text-slate-500">No type data yet.</p>
          )}
        </Card>

        <Card title="Departments by Request Volume" action={renderFilterAction('departmentVolume')}>
          <div className="h-72">
            <Bar
              data={departmentChart}
              options={{
                ...departmentBarOptions,
                indexAxis: 'y',
                plugins: {
                  ...departmentBarOptions.plugins,
                  tooltip: {
                    ...departmentBarOptions.plugins?.tooltip,
                    callbacks: {
                      title: tooltipItems => {
                        const first = tooltipItems[0];
                        if (!first) return '';
                        return departmentFullLabels[first.dataIndex] || String(first.label ?? '');
                      },
                    },
                  },
                },
              }}
            />
          </div>
          {!isLoading && departmentOptions.length === 0 && (
            <p className="mt-2 text-sm text-slate-500">No department request data yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
