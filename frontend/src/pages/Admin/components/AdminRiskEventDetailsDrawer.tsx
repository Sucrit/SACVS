import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import { RiskEventRecord, RiskReviewStatus } from '../../../services/risk.service';

type Props = {
  isOpen: boolean;
  event: RiskEventRecord | null;
  isLoading: boolean;
  isSavingReview: boolean;
  onClose: () => void;
  onSaveReview: (id: string, reviewStatus: RiskReviewStatus, reviewNotes: string | null) => Promise<void> | void;
};

const REVIEW_ACTIONS: Array<{ status: RiskReviewStatus; label: string }> = [
  { status: 'CONFIRMED_ABUSE', label: 'Mark abuse' },
  { status: 'BENIGN', label: 'Mark benign' },
  { status: 'UNCERTAIN', label: 'Mark uncertain' },
];

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
  }, [event?.id, event?.reviewNotes]);

  const features = event?.features && typeof event.features === 'object' ? event.features : null;
  const hasUnsavedNotes = useMemo(() => draftNotes.trim() !== (event?.reviewNotes ?? ''), [draftNotes, event?.reviewNotes]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[90] flex justify-end bg-slate-950/40 backdrop-blur-[2px]"
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
            <div className="flex items-start justify-between border-b border-slate-200 px-7 py-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Risk Event Details</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Inspect shadow-model signals, feature context, and analyst rationale before saving a label.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 transition hover:text-slate-900"
                aria-label="Close risk event details"
              >
                <X size={24} strokeWidth={1.8} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-6">
              {isLoading && (
                <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
                  <p className="mt-4 text-base font-medium text-slate-700">Loading risk event details</p>
                  <p className="mt-1 text-sm text-slate-500">Fetching feature snapshot and review context.</p>
                </div>
              )}

              {!isLoading && !event && (
                <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                  <p className="text-base font-medium text-slate-700">No risk event selected</p>
                  <p className="mt-1 text-sm text-slate-500">Choose a row from the queue to inspect it.</p>
                </div>
              )}

              {!isLoading && event && (
                <div className="space-y-8">
                  <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Action</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{event.action}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Risk Score</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{event.riskScore.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Risk Band</p>
                      <p className="mt-2 text-base font-semibold text-slate-900">{event.riskBand}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Review Status</p>
                      <p className="mt-2 text-base font-semibold text-slate-900">{event.reviewStatus}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Actor</p>
                      <p className="mt-2 text-sm text-slate-700">
                        {event.actorRole || 'UNKNOWN'} | {event.actorId || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Model Version</p>
                      <p className="mt-2 text-sm text-slate-700">{event.modelVersion}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Observed At</p>
                      <p className="mt-2 text-sm text-slate-700">{formatDateTime(event.observedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Reviewed At</p>
                      <p className="mt-2 text-sm text-slate-700">{formatDateTime(event.reviewedAt)}</p>
                    </div>
                  </section>

                  <section className="border-t border-slate-200 pt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Top Signals</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {event.topSignals.length === 0 && (
                        <p className="text-sm text-slate-500">No top signals were saved for this event.</p>
                      )}
                      {event.topSignals.map(signal => (
                        <span
                          key={signal}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="border-t border-slate-200 pt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Scope Context</h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Correlation ID</p>
                        <p className="mt-2 break-all text-sm text-slate-700">{event.correlationId || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Feature Snapshot</p>
                        <p className="mt-2 break-all text-sm text-slate-700">{event.featureSnapshotId || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Target</p>
                        <p className="mt-2 break-all text-sm text-slate-700">
                          {event.targetType || 'No target'}{event.targetId ? ` | ${event.targetId}` : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Institution Scope</p>
                        <p className="mt-2 break-all text-sm text-slate-700">{event.institutionId || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Window Start</p>
                        <p className="mt-2 text-sm text-slate-700">{formatDateTime(event.featuresWindowStart)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Window End</p>
                        <p className="mt-2 text-sm text-slate-700">{formatDateTime(event.featuresWindowEnd)}</p>
                      </div>
                    </div>
                  </section>

                  <section className="border-t border-slate-200 pt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Review Rationale</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Save analyst reasoning with the selected label so reviewed events can be used for later model training.
                    </p>
                    <div className="mt-4 space-y-4">
                      <textarea
                        value={draftNotes}
                        onChange={event => setDraftNotes(event.target.value)}
                        rows={5}
                        placeholder="Add analyst rationale, evidence, or follow-up notes."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
                      />
                      <div className="flex flex-wrap gap-2">
                        {REVIEW_ACTIONS.map(action => (
                          <button
                            key={action.status}
                            type="button"
                            disabled={isSavingReview}
                            onClick={() => void onSaveReview(event.id, action.status, draftNotes.trim() || null)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSavingReview && event.reviewStatus !== action.status ? (
                              <ButtonLoadingContent label="Saving" />
                            ) : (
                              action.label
                            )}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={isSavingReview || !hasUnsavedNotes}
                          onClick={() => void onSaveReview(event.id, event.reviewStatus, draftNotes.trim() || null)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingReview ? <ButtonLoadingContent label="Saving" /> : 'Save notes'}
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="border-t border-slate-200 pt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Feature Snapshot</h3>
                    <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                      {features &&
                        Object.entries(features).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{key}</p>
                            <p className="mt-2 break-all text-sm text-slate-700">{formatValue(value)}</p>
                          </div>
                        ))}
                      {!features && <p className="text-sm text-slate-500">No feature payload available.</p>}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
