import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Textarea from '../../../components/ui/Textarea';
import {
  RiskEventRecord,
  RiskReviewReasonCode,
  RiskReviewStatus,
} from '../../../services/risk.service';
import { formatRiskReviewStatus } from '../../../utils/formatting';

type Props = {
  isOpen: boolean;
  event: RiskEventRecord | null;
  isLoading: boolean;
  isSavingReview: boolean;
  onClose: () => void;
  onSaveReview: (
    id: string,
    reviewStatus: RiskReviewStatus,
    reviewReasonCode: RiskReviewReasonCode | null,
    reviewReasonDetail: string | null,
    reviewNotes: string | null,
  ) => Promise<void> | void;
};

const REVIEW_ACTIONS: Array<{ status: Exclude<RiskReviewStatus, 'PENDING_REVIEW'>; label: string }> = [
  { status: 'CONFIRMED_ABUSE', label: 'Mark abuse' },
  { status: 'BENIGN', label: 'Mark benign' },
  { status: 'UNCERTAIN', label: 'Mark uncertain' },
];

const REVIEW_REASON_OPTIONS: Record<
  Exclude<RiskReviewStatus, 'PENDING_REVIEW'>,
  Array<{ value: RiskReviewReasonCode; label: string }>
> = {
  CONFIRMED_ABUSE: [
    { value: 'OTP_BRUTE_FORCE', label: 'OTP brute force' },
    { value: 'TOKEN_ABUSE', label: 'Token abuse' },
    { value: 'RATE_LIMIT_ABUSE', label: 'Rate-limit abuse' },
    { value: 'CROSS_SCOPE_ACCESS', label: 'Cross-scope access' },
    { value: 'PRIVILEGE_MISUSE', label: 'Privilege misuse' },
    { value: 'AUTOMATED_PROBING', label: 'Automated probing' },
    { value: 'SUSPICIOUS_BULK_ACTIVITY', label: 'Suspicious bulk activity' },
    { value: 'OTHER_ABUSE', label: 'Other abuse' },
  ],
  BENIGN: [
    { value: 'USER_MISTAKE', label: 'User mistake' },
    { value: 'TEST_ACTIVITY', label: 'Test activity' },
    { value: 'EXPECTED_ADMIN_ACTION', label: 'Expected admin action' },
    { value: 'EXPECTED_INSTITUTION_FLOW', label: 'Expected institution flow' },
    { value: 'FALSE_POSITIVE_PATTERN', label: 'False positive pattern' },
    { value: 'OTHER_BENIGN', label: 'Other benign' },
  ],
  UNCERTAIN: [
    { value: 'NEEDS_MORE_CONTEXT', label: 'Needs more context' },
    { value: 'INSUFFICIENT_EVIDENCE', label: 'Insufficient evidence' },
    { value: 'MIXED_SIGNALS', label: 'Mixed signals' },
  ],
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : '-';
  if (typeof value === 'string') return value.trim().length > 0 ? value : '-';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '-';
  return JSON.stringify(value);
};

export default function AdminRiskEventDetailsDrawer({
  isOpen,
  event,
  isLoading,
  isSavingReview,
  onClose,
  onSaveReview,
}: Props) {
  const [draftNotes, setDraftNotes] = useState('');
  const [draftReasonCode, setDraftReasonCode] = useState<RiskReviewReasonCode | ''>('');
  const [draftReasonDetail, setDraftReasonDetail] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    setDraftNotes(event?.reviewNotes ?? '');
    setDraftReasonCode(event?.reviewReasonCode ?? '');
    setDraftReasonDetail(event?.reviewReasonDetail ?? '');
  }, [event?.id, event?.reviewNotes, event?.reviewReasonCode, event?.reviewReasonDetail]);

  const features = event?.features && typeof event.features === 'object' ? event.features : null;
  const hasUnsavedNotes = useMemo(() => draftNotes.trim() !== (event?.reviewNotes ?? ''), [draftNotes, event?.reviewNotes]);
  const hasUnsavedReviewMeta = useMemo(
    () =>
      draftReasonCode !== (event?.reviewReasonCode ?? '') ||
      draftReasonDetail.trim() !== (event?.reviewReasonDetail ?? ''),
    [draftReasonCode, draftReasonDetail, event?.reviewReasonCode, event?.reviewReasonDetail],
  );
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-90 flex justify-end bg-neutral-950/40 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={onClose}
        >
          <motion.aside
            className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-neutral-200 px-4 py-4 sm:px-7 sm:py-6">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Risk Event Details</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Inspect shadow-model signals, feature context, and analyst rationale before saving a label.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-neutral-400 transition hover:text-neutral-900"
                aria-label="Close risk event details"
              >
                <X size={24} strokeWidth={1.8} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-6">
              {isLoading && (
                <div className="flex min-h-80 flex-col items-center justify-center text-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-700" />
                  <p className="mt-4 text-base font-medium text-neutral-700">Loading risk event details</p>
                  <p className="mt-1 text-sm text-neutral-500">Fetching feature snapshot and review context.</p>
                </div>
              )}

              {!isLoading && !event && (
                <div className="flex min-h-80 flex-col items-center justify-center text-center">
                  <p className="text-base font-medium text-neutral-700">No risk event selected</p>
                  <p className="mt-1 text-sm text-neutral-500">Choose a row from the queue to inspect it.</p>
                </div>
              )}

              {!isLoading && event && (
                <div className="space-y-8">
                  <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold  text-neutral-500">Action</p>
                      <p className="mt-2 text-lg font-semibold text-neutral-900">{event.action}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold  text-neutral-500">Risk Score</p>
                      <p className="mt-2 text-lg font-semibold text-neutral-900">{event.riskScore.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold  text-neutral-500">Risk Band</p>
                      <p className="mt-2 text-base font-semibold text-neutral-900">{event.riskBand}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold  text-neutral-500">Review Status</p>
                      <p className={`mt-2 text-sm font-semibold tracking-[0.08em] ${
                        event.reviewStatus === 'PENDING_REVIEW' ? 'text-amber-500' :
                        event.reviewStatus === 'CONFIRMED_ABUSE' ? 'text-rose-800' :
                        event.reviewStatus === 'BENIGN' ? 'text-emerald-600' :
                        'text-neutral-900'
                      }`}>
                        {formatRiskReviewStatus(event.reviewStatus)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold  text-neutral-500">Reason Code</p>
                      <p className="mt-2 text-sm text-neutral-700">{event.reviewReasonCode || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold  text-neutral-500">Reason Detail</p>
                      <p className="mt-2 text-sm text-neutral-700">{event.reviewReasonDetail || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold  text-neutral-500">Actor</p>
                      <p className="mt-2 text-sm text-neutral-700">
                        {event.actorRole || 'UNKNOWN'} | {event.actorId || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold  text-neutral-500">Model Version</p>
                      <p className="mt-2 text-sm text-neutral-700">{event.modelVersion}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold  text-neutral-500">Observed At</p>
                      <p className="mt-2 text-sm text-neutral-700">{formatDateTime(event.observedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold  text-neutral-500">Reviewed At</p>
                      <p className="mt-2 text-sm text-neutral-700">{formatDateTime(event.reviewedAt)}</p>
                    </div>
                  </section>

                  <section className="border-t border-neutral-200 pt-6">
                    <h3 className="text-xs font-semibold  text-neutral-500">Top Signals</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {event.topSignals.length === 0 && (
                        <p className="text-sm text-neutral-500">No top signals were saved for this event.</p>
                      )}
                      {event.topSignals.map(signal => (
                        <span
                          key={signal}
                          className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="border-t border-neutral-200 pt-6">
                    <h3 className="text-xs font-semibold  text-neutral-500">Scope Context</h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold  text-neutral-400">Correlation ID</p>
                        <p className="mt-2 break-all text-sm text-neutral-700">{event.correlationId || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold  text-neutral-400">Feature Snapshot</p>
                        <p className="mt-2 break-all text-sm text-neutral-700">{event.featureSnapshotId || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold  text-neutral-400">Target</p>
                        <p className="mt-2 break-all text-sm text-neutral-700">
                          {event.targetType || 'No target'}{event.targetId ? ` | ${event.targetId}` : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold  text-neutral-400">Institution Scope</p>
                        <p className="mt-2 break-all text-sm text-neutral-700">{event.institutionId || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold  text-neutral-400">Window Start</p>
                        <p className="mt-2 text-sm text-neutral-700">{formatDateTime(event.featuresWindowStart)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold  text-neutral-400">Window End</p>
                        <p className="mt-2 text-sm text-neutral-700">{formatDateTime(event.featuresWindowEnd)}</p>
                      </div>
                    </div>
                  </section>

                  <section className="border-t border-neutral-200 pt-6">
                    <h3 className="text-xs font-semibold  text-neutral-500">Review Rationale</h3>
                    <p className="mt-2 text-sm text-neutral-500">
                      Save analyst reasoning with the selected label so reviewed events can be used for later model training.
                    </p>
                    <div className="mt-4 space-y-4">
                      <Select
                        label="Review reason"
                        value={draftReasonCode}
                        onChange={event => setDraftReasonCode(event.target.value as RiskReviewReasonCode | '')}
                        className="h-auto bg-neutral-50 py-3"
                      >
                        <option value="">Select a review reason</option>
                        {Object.entries(REVIEW_REASON_OPTIONS).map(([status, options]) => (
                          <optgroup key={status} label={status.replace('_', ' ')}>
                            {options.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </Select>
                      <Input
                        label="Reason detail"
                        value={draftReasonDetail}
                        onChange={event => setDraftReasonDetail(event.target.value)}
                        placeholder="Optional detail for the selected reason."
                        className="h-auto bg-neutral-50 py-3"
                      />
                      <Textarea
                        label="Review notes"
                        value={draftNotes}
                        onChange={event => setDraftNotes(event.target.value)}
                        rows={5}
                        placeholder="Add analyst rationale, evidence, or follow-up notes."
                        className="bg-neutral-50"
                      />
                    </div>
                  </section>

                  <section className="border-t border-neutral-200 pt-6">
                    <h3 className="text-xs font-semibold  text-neutral-500">Feature Snapshot</h3>
                    <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                      {features &&
                        Object.entries(features).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-xs font-semibold  text-neutral-400">{key}</p>
                            <p className="mt-2 break-all text-sm text-neutral-700">{formatValue(value)}</p>
                          </div>
                        ))}
                      {!features && <p className="text-sm text-neutral-500">No feature payload available.</p>}
                    </div>
                  </section>
                </div>
              )}
            </div>
            
            {event && (
              <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-4 sm:px-7 shrink-0">
                <div className="flex flex-wrap gap-2">
                  {REVIEW_ACTIONS.map(action => (
                    <Button
                      key={action.status}
                      type="button"
                      variant={action.status === 'CONFIRMED_ABUSE' ? 'danger' : action.status === 'BENIGN' ? 'success' : 'secondary'}
                      size="sm"
                      disabled={isSavingReview}
                      onClick={() =>
                        void onSaveReview(
                          event.id,
                          action.status,
                          draftReasonCode || REVIEW_REASON_OPTIONS[action.status][0]?.value || null,
                          draftReasonDetail.trim() || null,
                          draftNotes.trim() || null,
                        )
                      }
                    >
                      {isSavingReview && event.reviewStatus !== action.status ? <ButtonLoadingContent label="Saving" /> : action.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isSavingReview || (!hasUnsavedNotes && !hasUnsavedReviewMeta)}
                    onClick={() =>
                      void onSaveReview(
                        event.id,
                        event.reviewStatus,
                        draftReasonCode || null,
                        draftReasonDetail.trim() || null,
                        draftNotes.trim() || null,
                      )
                    }
                  >
                    {isSavingReview ? <ButtonLoadingContent label="Saving" /> : 'Save notes'}
                  </Button>
                </div>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
