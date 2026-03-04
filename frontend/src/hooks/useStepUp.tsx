import { useCallback, useMemo, useRef, useState } from 'react';
import StepUpOtpModal, { StepUpPrompt } from '../components/common/StepUpOtpModal';

interface PendingStepUp {
  prompt: StepUpPrompt;
}

export function useStepUp() {
  const [pending, setPending] = useState<PendingStepUp | null>(null);
  const resolveRef = useRef<((token: string) => void) | null>(null);
  const rejectRef = useRef<((reason?: unknown) => void) | null>(null);

  const closeModal = useCallback(() => {
    setPending(null);
    if (rejectRef.current) {
      rejectRef.current(new Error('STEP_UP_CANCELLED'));
    }
    resolveRef.current = null;
    rejectRef.current = null;
  }, []);

  const requestStepUpToken = useCallback((prompt: StepUpPrompt): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (resolveRef.current || rejectRef.current || pending) {
        reject(new Error('STEP_UP_IN_PROGRESS'));
        return;
      }
      resolveRef.current = resolve;
      rejectRef.current = reject;
      setPending({ prompt });
    });
  }, [pending]);

  const handleVerified = useCallback((token: string) => {
    setPending(null);
    if (resolveRef.current) {
      resolveRef.current(token);
    }
    resolveRef.current = null;
    rejectRef.current = null;
  }, []);

  const modal = useMemo(
    () => (
      <StepUpOtpModal
        prompt={pending?.prompt ?? null}
        onClose={closeModal}
        onVerified={handleVerified}
      />
    ),
    [closeModal, handleVerified, pending?.prompt],
  );

  return {
    requestStepUpToken,
    stepUpModal: modal,
  };
}
