import { ReactNode, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  CalendarDays,
  FileText,
  Info,
  Link2,
  MessageSquare,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Tag,
  Truck,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import {
  ApprovalReceipt,
  CredentialRequest,
  CredentialService,
  CredentialType,
} from '../../../services/credential.service';
import { formatDate } from '../utils';

interface StudentRequestHistorySectionProps {
  requests: Array<CredentialRequest & { _uiKey?: string }>;
  isLoadingRequests: boolean;
  requestAction?: ReactNode;
  onViewIssuedCredential?: (credentialId: string) => void;
  onCancelRequest?: (requestId: string) => void;
  cancelingRequestId?: string | null;
  animatedRequestIds?: string[];
  initialDetailsRequestId?: string | null;
  onDetailsRequestConsumed?: () => void;
}

type RequestTypeFilter = 'ALL' | CredentialType;
type DateRangeFilter = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH';

const requestTypeFilters: RequestTypeFilter[] = ['ALL', 'TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
const dateRangeFilters: Array<{ value: DateRangeFilter; label: string }> = [
  { value: 'ALL', label: 'All time' },
  { value: 'TODAY', label: 'Today' },
  { value: 'THIS_WEEK', label: 'This week' },
  { value: 'THIS_MONTH', label: 'This month' },
];

export default function StudentRequestHistorySection({
  requests,
  isLoadingRequests,
  requestAction,
  onViewIssuedCredential,
  onCancelRequest,
  cancelingRequestId = null,
  animatedRequestIds = [],
  initialDetailsRequestId = null,
  onDetailsRequestConsumed,
}: StudentRequestHistorySectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<RequestTypeFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('ALL');
  const [openMenuRequestId, setOpenMenuRequestId] = useState<string | null>(null);
  const [detailsRequest, setDetailsRequest] = useState<(CredentialRequest & { _uiKey?: string }) | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<ApprovalReceipt | null>(null);
  const [receiptQrDataUrl, setReceiptQrDataUrl] = useState<string | null>(null);
  const [loadingReceiptRequestId, setLoadingReceiptRequestId] = useState<string | null>(null);
  const [receiptActionError, setReceiptActionError] = useState<string | null>(null);

  const canOpenReceipt = (request: CredentialRequest) =>
    request.status === 'APPROVED' &&
    (request.deliveryMethod === 'PHYSICAL' || request.deliveryMethod === 'BOTH');

  const buildReceiptPdf = (receipt: ApprovalReceipt, qrDataUrl: string | null) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const left = 48;
    let y = 56;

    const writeRow = (label: string, value: string) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text(`${label}:`, left, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(value || '-', left + 150, y);
      y += 22;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(21);
    doc.setTextColor(15, 23, 42);
    doc.text('Request Approval Receipt', left, y);
    y += 26;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text('Present this receipt to registrar for physical/both pickup verification.', left, y);
    y += 30;

    writeRow('Receipt Code', receipt.receiptCode);
    writeRow('Student Name', receipt.studentName);
    writeRow('Student Number', receipt.studentNumber || '-');
    writeRow('Request ID', receipt.requestId);
    writeRow('Credential Type', receipt.type);
    writeRow('Delivery Method', receipt.deliveryMethod);
    writeRow('Approved At', receipt.approvedAt ? formatDate(receipt.approvedAt) : '-');
    writeRow('Institution', receipt.institutionName);
    writeRow('Token Expires', formatDate(receipt.expiresAt));

    y += 14;
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', left, y, 170, 170);
      y += 188;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('One-time verification token. Regenerate if leaked.', left, y);
    y += 16;
    doc.text('Proceed to your university registrar to claim the requested credential.', left, y);
    y += 14;
    doc.text('Registrar fees may apply before release.', left, y);
    y += 14;
    doc.text('Claiming must follow your university registrar working hours.', left, y);

    doc.save(`approval-receipt-${receipt.receiptCode}.pdf`);
  };

  const handleOpenReceipt = async (requestId: string) => {
    setLoadingReceiptRequestId(requestId);
    setReceiptActionError(null);
    try {
      const receipt = await CredentialService.getApprovalReceipt(requestId);
      const qrDataUrl = await QRCode.toDataURL(receipt.verificationUrl, {
        margin: 1,
        width: 260,
      });
      setActiveReceipt(receipt);
      setReceiptQrDataUrl(qrDataUrl);
      setReceiptModalOpen(true);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Unable to load approval receipt.';
      setReceiptActionError(message);
    } finally {
      setLoadingReceiptRequestId(null);
    }
  };

  useEffect(() => {
    if (!initialDetailsRequestId) {
      return;
    }

    if (isLoadingRequests) {
      return;
    }

    const matched = requests.find(request => request.id === initialDetailsRequestId) || null;
    if (matched) {
      setDetailsRequest(matched);
    }
    onDetailsRequestConsumed?.();
  }, [initialDetailsRequestId, isLoadingRequests, onDetailsRequestConsumed, requests]);

  const matchesDateRange = (value: string | null | undefined, range: DateRangeFilter) => {
    if (range === 'ALL') return true;
    if (!value) return false;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();

    if (range === 'TODAY') {
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    }

    if (range === 'THIS_WEEK') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const day = startOfToday.getDay();
      const diffToMonday = (day + 6) % 7;
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfToday.getDate() - diffToMonday);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      return date >= startOfWeek && date < endOfWeek;
    }

    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  };

  const filteredRequests = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    const filtered = requests.filter(request => {
      if (typeFilter !== 'ALL' && request.type !== typeFilter) {
        return false;
      }
      if (!matchesDateRange(request.createdAt, dateFilter)) {
        return false;
      }
      if (!keyword) {
        return true;
      }

      const searchable = [
        request.title,
        request.type,
        request.status,
        request.purpose || '',
        request.id,
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(keyword);
    });
    return filtered.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });
  }, [dateFilter, requests, searchTerm, typeFilter]);

  const getProgressValue = (status: CredentialRequest['status']) => {
    switch (status) {
      case 'PENDING':
        return 20;
      case 'APPROVED':
        return 60;
      case 'COMPLETED':
        return 100;
      case 'REJECTED':
      case 'CANCELLED':
        return 100;
      default:
        return 0;
    }
  };

  const formatEnumLabel = (value: string) =>
    value
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Search requests..."
            className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-300"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <select
            value={typeFilter}
            onChange={event => setTypeFilter(event.target.value as RequestTypeFilter)}
            className="h-10 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-slate-300"
            aria-label="Filter requests by credential type"
          >
            <option value="ALL">All types</option>
            {requestTypeFilters
              .filter(filter => filter !== 'ALL')
              .map(filter => (
                <option key={filter} value={filter}>
                  {filter}
                </option>
              ))}
          </select>
          <select
            value={dateFilter}
            onChange={event => setDateFilter(event.target.value as DateRangeFilter)}
            className="h-10 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-slate-300"
            aria-label="Filter requests by submitted date"
          >
            {dateRangeFilters.map(filter => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          {requestAction}
        </div>
      </div>

      {isLoadingRequests && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(key => (
            <div key={key} className="h-44 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {receiptActionError && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {receiptActionError}
        </div>
      )}

      {!isLoadingRequests && filteredRequests.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
          No requests match your current filter.
        </div>
      )}

      {!isLoadingRequests && filteredRequests.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {filteredRequests.map(request => {
              const progressValue = getProgressValue(request.status);
              const isAnimated = animatedRequestIds.includes(request.id);
              const canViewIssuedCredential = Boolean(
                request.credentialId && (request.status === 'APPROVED' || request.status === 'COMPLETED'),
              );

              return (
                <motion.article
                  key={request._uiKey || request.id}
                  layout
                  initial={{ opacity: 0, y: 14, scale: 0.985 }}
                  animate={isAnimated ? { opacity: 1, y: 0, scale: [1, 1.02, 1] } : { opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.985 }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                  className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="line-clamp-1 text-sm font-semibold text-slate-900">{request.title}</p>
                      <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                        <CalendarDays size={12} />
                        {formatDate(request.createdAt)}
                      </div>
                    </div>
                    <div className="relative flex items-center gap-1">
                      <Badge status={request.status} />
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuRequestId(previous => (previous === request.id ? null : request.id))
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        aria-label="Open request actions"
                      >
                        <MoreHorizontal size={14} />
                      </button>

                      {openMenuRequestId === request.id && (
                        <div className="absolute right-0 top-9 z-20 min-w-[150px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailsRequest(request);
                              setOpenMenuRequestId(null);
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Details
                          </button>
                          {canViewIssuedCredential && onViewIssuedCredential && (
                            <button
                              type="button"
                              onClick={() => {
                                onViewIssuedCredential(request.credentialId as string);
                                setOpenMenuRequestId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              View issued credential
                            </button>
                          )}
                          {canOpenReceipt(request) && (
                            <button
                              type="button"
                              onClick={() => {
                                void handleOpenReceipt(request.id);
                                setOpenMenuRequestId(null);
                              }}
                              disabled={loadingReceiptRequestId === request.id}
                              className="w-full px-3 py-2 text-left text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {loadingReceiptRequestId === request.id ? 'Loading receipt...' : 'View receipt'}
                            </button>
                          )}
                          {request.status === 'PENDING' && onCancelRequest && (
                            <button
                              type="button"
                              onClick={() => {
                                onCancelRequest(request.id);
                                setOpenMenuRequestId(null);
                              }}
                              disabled={cancelingRequestId === request.id}
                              className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {cancelingRequestId === request.id ? 'Cancelling...' : 'Cancel request'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.09em] text-slate-500">{request.type}</p>
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm text-slate-600">
                    {request.purpose?.trim() || request.description?.trim() || 'No purpose provided.'}
                  </p>

                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-slate-600">Progress: {progressValue}%</p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        className={`h-full rounded-full ${
                          request.status === 'REJECTED' || request.status === 'CANCELLED'
                            ? 'bg-rose-400'
                            : request.status === 'COMPLETED'
                              ? 'bg-emerald-500'
                              : 'bg-slate-900'
                        }`}
                        animate={{ width: `${progressValue}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {detailsRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setDetailsRequest(null)}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Request Details</p>
                <p className="mt-1 text-xs text-slate-500">
                  Review your credential request information.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsRequest(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close details"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
              <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <FileText size={14} />
                  Title
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                  {detailsRequest.title}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Activity size={14} />
                  Status
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <Badge status={detailsRequest.status} />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Tag size={14} />
                  Type
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                  {formatEnumLabel(detailsRequest.type)}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Truck size={14} />
                  Delivery
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                  {formatEnumLabel(detailsRequest.deliveryMethod)}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <CalendarDays size={14} />
                  Submitted
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                  {formatDate(detailsRequest.createdAt)}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <RefreshCcw size={14} />
                  Updated
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                  {formatDate(detailsRequest.updatedAt)}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start">
                <p className="flex items-center gap-2 pt-2 text-sm font-medium text-slate-600">
                  <Info size={14} />
                  Purpose
                </p>
                <div className="min-h-[44px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {detailsRequest.purpose || 'No purpose provided.'}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start">
                <p className="flex items-center gap-2 pt-2 text-sm font-medium text-slate-600">
                  <FileText size={14} />
                  Description
                </p>
                <div className="min-h-[44px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {detailsRequest.description || 'No description provided.'}
                </div>
              </div>

              {detailsRequest.processedAt && (
                <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <CalendarDays size={14} />
                    Processed
                  </p>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                    {formatDate(detailsRequest.processedAt)}
                  </div>
                </div>
              )}

              {detailsRequest.notes && (
                <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start">
                  <p className="flex items-center gap-2 pt-2 text-sm font-medium text-slate-600">
                    <MessageSquare size={14} />
                    Institution Note
                  </p>
                  <div className="min-h-[44px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {detailsRequest.notes}
                  </div>
                </div>
              )}

              {detailsRequest.status === 'REJECTED' && detailsRequest.rejectionReason && (
                <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start">
                  <p className="flex items-center gap-2 pt-2 text-sm font-medium text-rose-700">
                    <AlertCircle size={14} />
                    Rejection
                  </p>
                  <div className="min-h-[44px] rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {detailsRequest.rejectionReason}
                  </div>
                </div>
              )}

              {detailsRequest.credentialId &&
                (detailsRequest.status === 'APPROVED' || detailsRequest.status === 'COMPLETED') && (
                  <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start">
                    <p className="flex items-center gap-2 pt-2 text-sm font-medium text-emerald-700">
                      <Link2 size={14} />
                      Credential
                    </p>
                    <div className="min-h-[44px] rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      <p>A credential has been linked to this request.</p>
                      {onViewIssuedCredential && (
                        <button
                          type="button"
                          onClick={() => {
                            onViewIssuedCredential(detailsRequest.credentialId as string);
                            setDetailsRequest(null);
                          }}
                          className="mt-2 inline-flex items-center rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          View issued credential
                        </button>
                      )}
                    </div>
                  </div>
                )}

              {canOpenReceipt(detailsRequest) && (
                <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start">
                  <p className="flex items-center gap-2 pt-2 text-sm font-medium text-indigo-700">
                    <Link2 size={14} />
                    Receipt
                  </p>
                  <div className="min-h-[44px] rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                    <p>Approval receipt is available for physical pickup verification.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleOpenReceipt(detailsRequest.id)}
                        className="inline-flex items-center rounded-md border border-indigo-300 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        View receipt
                      </button>
                      {activeReceipt?.requestId === detailsRequest.id && (
                        <button
                          type="button"
                          onClick={() => buildReceiptPdf(activeReceipt, receiptQrDataUrl)}
                          className="inline-flex items-center rounded-md border border-indigo-300 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          Download Receipt (PDF)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </motion.div>
        </div>
      )}

      {receiptModalOpen && activeReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setReceiptModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">Approval Receipt</p>
                <p className="text-xs text-slate-500">Use this one-time QR at registrar check-in.</p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                {receiptQrDataUrl ? (
                  <img src={receiptQrDataUrl} alt="Approval receipt QR" className="h-auto w-full rounded-lg bg-white p-2" />
                ) : (
                  <div className="flex h-[260px] items-center justify-center rounded-lg bg-white text-xs text-slate-500">
                    QR unavailable
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                  Receipt Code: <span className="font-mono">{activeReceipt.receiptCode}</span>
                </p>
                <p><span className="text-slate-500">Student</span>: <span className="font-semibold text-slate-900">{activeReceipt.studentName}</span></p>
                <p><span className="text-slate-500">Student Number</span>: <span className="font-semibold text-slate-900">{activeReceipt.studentNumber || '-'}</span></p>
                <p><span className="text-slate-500">Request ID</span>: <span className="font-semibold text-slate-900">{activeReceipt.requestId}</span></p>
                <p><span className="text-slate-500">Type</span>: <span className="font-semibold text-slate-900">{activeReceipt.type}</span></p>
                <p><span className="text-slate-500">Delivery</span>: <span className="font-semibold text-slate-900">{activeReceipt.deliveryMethod}</span></p>
                <p><span className="text-slate-500">Approved At</span>: <span className="font-semibold text-slate-900">{activeReceipt.approvedAt ? formatDate(activeReceipt.approvedAt) : '-'}</span></p>
                <p><span className="text-slate-500">Institution</span>: <span className="font-semibold text-slate-900">{activeReceipt.institutionName}</span></p>
                <p><span className="text-slate-500">Expires</span>: <span className="font-semibold text-slate-900">{formatDate(activeReceipt.expiresAt)}</span></p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="mt-1">Note: Proceed to your university registrar to claim this requested credential. Registrar fees may apply before credentials can be released. Please follow your university registrar working hours.</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(activeReceipt.verificationUrl)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Copy verification URL
              </button>
              <button
                type="button"
                onClick={() => buildReceiptPdf(activeReceipt, receiptQrDataUrl)}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Download Receipt (PDF)
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </Card>
  );
}
