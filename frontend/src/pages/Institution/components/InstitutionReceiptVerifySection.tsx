import { useState } from 'react';
import Card from '../../../components/common/Card';
import { useToast } from '../../../hooks/useToast';

export default function InstitutionReceiptVerifySection() {
  const [receiptTokenInput, setReceiptTokenInput] = useState('');
  const { showToast } = useToast();

  const openReceiptVerifier = () => {
    const raw = receiptTokenInput.trim();
    if (!raw) {
      showToast({ variant: 'warning', message: 'Paste a receipt verification URL or token first.' });
      return;
    }

    try {
      const parsed = new URL(raw);
      const token = parsed.pathname.split('/').filter(Boolean).pop() || '';
      window.open(`/verify/receipt/${encodeURIComponent(decodeURIComponent(token))}`, '_blank');
    } catch {
      window.open(`/verify/receipt/${encodeURIComponent(raw)}`, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Registrar Receipt Verification">
        <p className="mb-3 text-sm text-slate-600">
          Verify student approval receipts for credentials that requires physical delivery.
        </p>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            value={receiptTokenInput}
            onChange={event => setReceiptTokenInput(event.target.value)}
            placeholder="Paste approval receipt URL or token"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={openReceiptVerifier}
            disabled={!receiptTokenInput.trim()}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
          >
            Verify receipt
          </button>
        </div>
      </Card>
    </div>
  );
}
