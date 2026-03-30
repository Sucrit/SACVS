import { useCallback, useMemo, useRef, useState } from 'react';
import StepUpOtpModal, { StepUpPrompt } from '../components/common/StepUpOtpModal';

interface PendingStepUp {
  prompt: StepUpPrompt;
}

/* ── Issuance token sessionStorage cache ── */

const ISSUANCE_CACHE_KEY = 'sacvs.stepup.CREDENTIAL_ISSUE';

interface CachedIssuanceToken {
  token: string;
  expiresAt: string; // ISO string
}

function getCachedIssuanceToken(): string | null {
  try {
    const raw = sessionStorage.getItem(ISSUANCE_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedIssuanceToken = JSON.parse(raw);
    if (new Date(cached.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(ISSUANCE_CACHE_KEY);
      return null;
    }
    return cached.token;
  } catch {
    sessionStorage.removeItem(ISSUANCE_CACHE_KEY);
    return null;
  }
}

function setCachedIssuanceToken(token: string, expiresAt: string): void {
  try {
    sessionStorage.setItem(ISSUANCE_CACHE_KEY, JSON.stringify({ token, expiresAt }));
  } catch {
    // sessionStorage may be full or unavailable; silently ignore.
  }
}

export function clearCachedIssuanceToken(): void {
  try {
    sessionStorage.removeItem(ISSUANCE_CACHE_KEY);
  } catch {
    // ignore
  }
}

/* ── Hook ── */

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
    // For CREDENTIAL_ISSUE, check sessionStorage cache first.
    if (prompt.action === 'CREDENTIAL_ISSUE') {
      const cached = getCachedIssuanceToken();
      if (cached) {
        return Promise.resolve(cached);
      }
    }

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

  const handleVerified = useCallback((token: string, expiresAt?: string) => {
    const prompt = pending?.prompt;
    setPending(null);

    // Cache CREDENTIAL_ISSUE tokens in sessionStorage for reuse.
    if (prompt?.action === 'CREDENTIAL_ISSUE' && expiresAt) {
      setCachedIssuanceToken(token, expiresAt);
    }

    if (resolveRef.current) {
      resolveRef.current(token);
    }
    resolveRef.current = null;
    rejectRef.current = null;
  }, [pending]);

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
    clearCachedIssuanceToken,
    stepUpModal: modal,
  };
}
