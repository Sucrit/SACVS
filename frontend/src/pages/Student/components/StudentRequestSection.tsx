import { FormEvent, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Info, X } from 'lucide-react';
import {
  CreateCredentialRequestPayload,
  CredentialType,
  DeliveryMethod,
} from '../../../services/credential.service';
import { CREDENTIAL_TYPES, DELIVERY_METHODS } from '../utils';
import {
  MODAL_BACKDROP_VARIANTS,
  MODAL_PANEL_VARIANTS,
  MODAL_TRANSITION,
} from '../../../components/common/modal-motion';

interface StudentRequestSectionProps {
  requestForm: CreateCredentialRequestPayload;
  isSubmittingRequest: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  onTypeChange: (value: CredentialType) => void;
  onTitleChange: (value: string) => void;
  onPurposeChange: (value: string) => void;
  onDeliveryMethodChange: (value: DeliveryMethod) => void;
  buttonClassName?: string;
}

export default function StudentRequestSection({
  requestForm,
  isSubmittingRequest,
  onSubmit,
  onTypeChange,
  onTitleChange,
  onPurposeChange,
  onDeliveryMethodChange,
  buttonClassName,
}: StudentRequestSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const requiresOnsiteClaim =
    requestForm.deliveryMethod === 'PHYSICAL' || requestForm.deliveryMethod === 'BOTH';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    const submitted = await onSubmit(event);
    if (submitted) {
      setIsModalOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={buttonClassName || 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black'}
      >
        <FileText size={16} />
        New Credential Request
      </button>

      <AnimatePresence>
        {isModalOpen && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={MODAL_BACKDROP_VARIANTS}
          transition={MODAL_TRANSITION}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[1px]"
          onClick={() => setIsModalOpen(false)}
        >
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={MODAL_PANEL_VARIANTS}
            transition={MODAL_TRANSITION}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Submit Credential Request</p>
                <p className="mt-1 text-xs text-slate-500">
                  Fill in the details below to send a new request for institution review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center text-slate-500 transition-colors hover:text-slate-900"
                aria-label="Close modal"
              >
                <X size={14} />
              </button>
            </div>

            <form className="space-y-4 p-5" onSubmit={event => void handleSubmit(event)}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Credential Type</span>
                  <select
                    value={requestForm.type}
                    onChange={event => onTypeChange(event.target.value as CredentialType)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
                  >
                    {CREDENTIAL_TYPES.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Title</span>
                  <input
                    value={requestForm.title}
                    onChange={event => onTitleChange(event.target.value)}
                    placeholder="e.g. BS Computer Science"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400"
                  />
                </label>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Delivery Method</p>
                <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {DELIVERY_METHODS.map(method => {
                    const selected = requestForm.deliveryMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => onDeliveryMethodChange(method as DeliveryMethod)}
                        className={`px-3 py-2 text-xs font-semibold transition ${selected ? 'bg-white text-slate-900' : 'text-slate-500 hover:bg-white/70'}`}
                      >
                        {method.charAt(0) + method.slice(1).toLowerCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Purpose</span>
                <textarea
                  value={requestForm.purpose || ''}
                  onChange={event => onPurposeChange(event.target.value)}
                  placeholder="Describe the reason for this request..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400"
                />
              </label>

              <AnimatePresence initial={false}>
                {requiresOnsiteClaim && (
                  <motion.div
                    key="onsite-claim-hint"
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <p className="flex items-start gap-2 text-xs text-amber-800">
                        <Info size={14} className="mt-0.5 shrink-0" />
                        <span>
                          You must claim your requested credentials at your university or institution registrar office.
                          This system does not handle delivery to a designated external location.
                        </span>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmittingRequest ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  ) : (
                    <>
                      <FileText size={16} />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
