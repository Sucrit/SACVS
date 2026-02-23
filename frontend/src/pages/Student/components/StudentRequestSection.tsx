import { FormEvent } from 'react';
import { FileText } from 'lucide-react';
import Card from '../../../components/common/Card';
import {
  CreateCredentialRequestPayload,
  CredentialType,
  DeliveryMethod,
} from '../../../services/credential.service';
import { CREDENTIAL_TYPES, DELIVERY_METHODS } from '../utils';

interface StudentRequestSectionProps {
  requestForm: CreateCredentialRequestPayload;
  isSubmittingRequest: boolean;
  requestError: string | null;
  requestSuccess: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onTypeChange: (value: CredentialType) => void;
  onTitleChange: (value: string) => void;
  onPurposeChange: (value: string) => void;
  onDeliveryMethodChange: (value: DeliveryMethod) => void;
}

export default function StudentRequestSection({
  requestForm,
  isSubmittingRequest,
  requestError,
  requestSuccess,
  onSubmit,
  onTypeChange,
  onTitleChange,
  onPurposeChange,
  onDeliveryMethodChange,
}: StudentRequestSectionProps) {
  return (
    <Card>
      <p className="mb-4 text-sm text-slate-600">Submit a request to your institution for new credential issuance.</p>
      <form className="space-y-3" onSubmit={event => void onSubmit(event)}>
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
        <input
          value={requestForm.title}
          onChange={event => onTitleChange(event.target.value)}
          placeholder="Request title"
          required
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400"
        />
        <input
          value={requestForm.purpose || ''}
          onChange={event => onPurposeChange(event.target.value)}
          placeholder="Purpose"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400"
        />
        <select
          value={requestForm.deliveryMethod}
          onChange={event => onDeliveryMethodChange(event.target.value as DeliveryMethod)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
        >
          {DELIVERY_METHODS.map(method => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isSubmittingRequest}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
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
      </form>
      {requestError && <p className="mt-3 text-xs text-rose-700">{requestError}</p>}
      {requestSuccess && <p className="mt-3 text-xs text-emerald-700">{requestSuccess}</p>}
    </Card>
  );
}
