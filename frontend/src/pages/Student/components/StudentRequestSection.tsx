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
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Textarea from '../../../components/ui/Textarea';

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
      <Button
        type="button"
        onClick={() => setIsModalOpen(true)}
        icon={<FileText size={16} />}
        size="lg"
        className={buttonClassName || 'w-full rounded-xl'}
      >
        New Credential Request
      </Button>

      <AnimatePresence>
        {isModalOpen && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={MODAL_BACKDROP_VARIANTS}
          transition={MODAL_TRANSITION}
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 backdrop-blur-[1px]"
          onClick={() => setIsModalOpen(false)}
        >
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={MODAL_PANEL_VARIANTS}
            transition={MODAL_TRANSITION}
            className="w-full max-w-2xl overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Submit Credential Request</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Fill in the details below to send a new request for institution review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-900"
                aria-label="Close modal"
              >
                <X size={14} />
              </button>
            </div>

            <form className="space-y-4 p-5" onSubmit={event => void handleSubmit(event)}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Select
                  label="Credential Type"
                  value={requestForm.type}
                  onChange={event => onTypeChange(event.target.value as CredentialType)}
                  className="h-auto bg-neutral-50 py-2.5"
                >
                    {CREDENTIAL_TYPES.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                </Select>

                <Input
                  label="Title"
                  value={requestForm.title}
                  onChange={event => onTitleChange(event.target.value)}
                  placeholder="e.g. BS Computer Science"
                  required
                  className="h-auto bg-neutral-50 py-2.5"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-neutral-600">Delivery Method</p>
                <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 sm:grid-cols-3">
                  {DELIVERY_METHODS.map(method => {
                    const selected = requestForm.deliveryMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => onDeliveryMethodChange(method as DeliveryMethod)}
                        className={`px-3 py-2 text-xs font-semibold transition ${selected ? 'bg-white text-neutral-900' : 'text-neutral-500 hover:bg-white/70'}`}
                      >
                        {method.charAt(0) + method.slice(1).toLowerCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Textarea
                label="Purpose"
                value={requestForm.purpose || ''}
                onChange={event => onPurposeChange(event.target.value)}
                placeholder="Describe the reason for this request..."
                rows={4}
                className="bg-neutral-50"
              />

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
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={isSubmittingRequest}
                  icon={<FileText size={16} />}
                  className="rounded-xl"
                >
                  Submit Request
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
