import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { isAxiosError } from 'axios';
import { StepUpAction, UserService } from '../../services/user.service';
import { useLegacyAuth } from '../../auth/auth-context';
import ButtonLoadingContent from './ButtonLoadingContent';
import { useToast } from '../../hooks/useToast';
import {
  MODAL_BACKDROP_VARIANTS,
  MODAL_PANEL_VARIANTS,
  MODAL_TRANSITION,
} from './modal-motion';

export interface StepUpPrompt {
  action: StepUpAction;
  targetId?: string;
  payloadHash?: string;
  title?: string;
  description?: string;
}

interface StepUpOtpModalProps {
  prompt: StepUpPrompt | null;
  onClose: () => void;
  onVerified: (stepUpToken: string) => void;
}

/* ── Per-action metadata ── */
interface ActionMeta {
  riskLabel: string;
  riskDescription: string;
  contextLabel: string;
  contextDetail: string;
}

const ACTION_META: Record<StepUpAction, ActionMeta> = {
  ROLE_CHANGE: {
    riskLabel: 'Privilege Escalation',
    riskDescription: 'Changing a user role modifies their system-wide access level.',
    contextLabel: 'Change User Role',
    contextDetail: 'Assign a new permission role to the target account',
  },
  STATUS_CHANGE: {
    riskLabel: 'Account State Change',
    riskDescription: 'Updating account status directly impacts login access and platform capabilities.',
    contextLabel: 'Update Account Status',
    contextDetail: 'Approve, suspend, or reject the target account',
  },
  CREDENTIAL_ISSUE: {
    riskLabel: 'Immutable Record Creation',
    riskDescription: 'Issuing a credential writes a permanent blockchain record that cannot be reversed.',
    contextLabel: 'Issue Credential',
    contextDetail: 'Publish an immutable credential to the blockchain',
  },
  BULK_STUDENT_CREATE: {
    riskLabel: 'Bulk Account Creation',
    riskDescription: 'Bulk import creates multiple student accounts in a single operation.',
    contextLabel: 'Bulk Student Import',
    contextDetail: 'Create multiple student accounts from CSV data',
  },
  QR_DOWNLOAD_ENABLE: {
    riskLabel: 'High-Risk Action Detected',
    riskDescription: 'Allowing document download permits recipients to save a permanent PDF copy.',
    contextLabel: 'Allow Document Download',
    contextDetail: 'Recipient can export to PDF format',
  },
};

const OTP_LENGTH = 6;

const getApiErrorCode = (error: unknown): string | null => {
  if (!isAxiosError(error)) return null;
  if (typeof error.response?.data === 'string') return null;
  const payload = error.response?.data as { error?: string; code?: string; message?: string } | undefined;
  if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
  if (typeof payload?.code === 'string' && payload.code.trim()) return payload.code.trim();
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  return null;
};

const getApiErrorMessage = (error: unknown): string => {
  const code = getApiErrorCode(error);
  if (code === 'STEP_UP_MISCONFIGURED') {
    return 'Step-up OTP is not configured on the server yet. Contact your administrator.';
  }
  if (code === 'STEP_UP_DELIVERY_NOT_CONFIGURED') {
    return 'OTP email delivery is not configured on the server.';
  }
  if (code === 'STEP_UP_DELIVERY_FAILED') {
    return 'Failed to send OTP email. Please try again in a moment.';
  }
  if (code === 'STEP_UP_CHALLENGE_LOCKED') {
    return 'Too many invalid OTP attempts. Request a new code.';
  }
  if (code === 'STEP_UP_TOKEN_EXPIRED') {
    return 'This OTP session expired. Request a new code.';
  }
  if (code === 'STEP_UP_TOKEN_INVALID' || code === 'STEP_UP_REQUIRED') {
    return 'Invalid or expired OTP code. Try again.';
  }
  if (isAxiosError(error) && typeof error.response?.data === 'string' && error.response.data.trim().length > 0) {
    return error.response.data;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Unable to verify OTP. Please try again.';
};

const formatRemaining = (seconds: number) => {
  const mm = Math.floor(Math.max(0, seconds) / 60);
  const ss = Math.max(0, seconds) % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

export default function StepUpOtpModal({ prompt, onClose, onVerified }: StepUpOtpModalProps) {
  const { showToast } = useToast();
  const { user } = useLegacyAuth();
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [digits, setDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ''));
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const meta = useMemo<ActionMeta | null>(() => {
    if (!prompt) return null;
    return ACTION_META[prompt.action];
  }, [prompt]);

  const maskedEmail = useMemo(() => {
    const email = user?.email;
    if (!email) return null;
    const [local, domain] = email.split('@');
    if (!domain) return email;
    if (local.length <= 3) return `${local}@${domain}`;
    return `${local.slice(0, 3)}${'*'.repeat(Math.min(local.length - 3, 5))}@${domain}`;
  }, [user?.email]);

  /* ── Auto-issue challenge when prompt opens ── */
  useEffect(() => {
    if (!prompt) {
      setChallengeId(null);
      setExpiresAt(null);
      setDigits(Array.from({ length: OTP_LENGTH }, () => ''));
      setIsSending(false);
      setIsVerifying(false);
      setSecondsRemaining(0);
      return;
    }

    let cancelled = false;
    const issueChallenge = async () => {
      setIsSending(true);
      setDigits(Array.from({ length: OTP_LENGTH }, () => ''));
      try {
        const response = await UserService.createStepUpChallenge({
          action: prompt.action,
          targetId: prompt.targetId,
          payloadHash: prompt.payloadHash,
        });
        if (cancelled) return;
        setChallengeId(response.challengeId);
        setExpiresAt(response.expiresAt);
      } catch (requestError) {
        if (!cancelled) {
          setChallengeId(null);
          setExpiresAt(null);
          showToast({ variant: 'error', message: getApiErrorMessage(requestError) });
        }
      } finally {
        if (!cancelled) setIsSending(false);
      }
    };
    void issueChallenge();
    return () => { cancelled = true; };
  }, [prompt, showToast]);

  /* ── Countdown ── */
  useEffect(() => {
    if (!expiresAt || !prompt) { setSecondsRemaining(0); return; }
    const updateRemaining = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsRemaining(diff);
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, prompt]);

  /* ── Focus first input when challenge arrives ── */
  useEffect(() => {
    if (challengeId && !isSending) {
      inputRefs.current[0]?.focus();
    }
  }, [challengeId, isSending]);

  const hasChallenge = Boolean(challengeId && expiresAt);
  const isExpired = hasChallenge && secondsRemaining <= 0;
  const otpCode = digits.join('');
  const disableVerify = isSending || isVerifying || !hasChallenge || isExpired || otpCode.length < OTP_LENGTH;

  /* ── Digit input handlers ── */
  const handleDigitChange = useCallback((index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 0) {
      setDigits(prev => { const next = [...prev]; next[index] = ''; return next; });
      return;
    }
    if (cleaned.length === 1) {
      setDigits(prev => { const next = [...prev]; next[index] = cleaned; return next; });
      if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
      return;
    }
    // Paste handling — spread across boxes
    const chars = cleaned.slice(0, OTP_LENGTH).split('');
    setDigits(prev => {
      const next = [...prev];
      chars.forEach((char, offset) => {
        if (index + offset < OTP_LENGTH) next[index + offset] = char;
      });
      return next;
    });
    const focusIndex = Math.min(index + chars.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  }, []);

  const handleDigitKeyDown = useCallback((index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  /* ── Resend ── */
  const handleResend = async () => {
    if (!prompt) return;
    setIsSending(true);
    setDigits(Array.from({ length: OTP_LENGTH }, () => ''));
    try {
      const response = await UserService.createStepUpChallenge({
        action: prompt.action,
        targetId: prompt.targetId,
        payloadHash: prompt.payloadHash,
      });
      setChallengeId(response.challengeId);
      setExpiresAt(response.expiresAt);
    } catch (requestError) {
      showToast({ variant: 'error', message: getApiErrorMessage(requestError) });
    } finally {
      setIsSending(false);
    }
  };

  /* ── Verify ── */
  const handleVerify = async () => {
    const code = otpCode.trim();
    if (!challengeId || code.length < OTP_LENGTH) {
      showToast({ variant: 'warning', message: 'Enter the full 6-digit code.' });
      return;
    }
    setIsVerifying(true);
    try {
      const result = await UserService.verifyStepUpChallenge(challengeId, code);
      onVerified(result.stepUpToken);
      setDigits(Array.from({ length: OTP_LENGTH }, () => ''));
      showToast({ variant: 'success', message: 'OTP verified successfully.' });
    } catch (verifyError) {
      showToast({ variant: 'error', message: getApiErrorMessage(verifyError) });
    } finally {
      setIsVerifying(false);
    }
  };

  /* ── Auto-submit when all digits filled ── */
  useEffect(() => {
    if (otpCode.length === OTP_LENGTH && hasChallenge && !isExpired && !isVerifying && !isSending) {
      void handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpCode]);

  return (
    <AnimatePresence>
      {prompt && meta && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={MODAL_BACKDROP_VARIANTS}
          transition={MODAL_TRANSITION}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-900/60 p-2 backdrop-blur-[1px] sm:p-4"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={MODAL_PANEL_VARIANTS}
            transition={MODAL_TRANSITION}
            className="w-full max-w-md overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg"
            onClick={event => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">
                  {prompt.title || meta.contextLabel || 'Step-Up Verification'}
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-500 max-w-[95%]">
                  {meta.riskDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none"
                aria-label="Close"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="space-y-6 px-5 py-6 sm:px-6 sm:pb-7">
              {/* ── OTP input section ── */}
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-neutral-800">
                    Enter the 6-digit code sent to your account to complete the action.
                  </p>
                  {maskedEmail && (
                    <p className="mt-1.5 text-xs text-neutral-500">Sent to: {maskedEmail}</p>
                  )}
                </div>

                {/* Digit boxes */}
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={element => { inputRefs.current[index] = element; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      maxLength={OTP_LENGTH}
                      value={digit}
                      onChange={event => handleDigitChange(index, event.target.value)}
                      onKeyDown={event => handleDigitKeyDown(index, event)}
                      disabled={isSending || isVerifying}
                      className={`h-12 w-10 rounded-lg border text-center text-lg font-semibold outline-none transition-colors sm:h-14 sm:w-12 sm:text-xl ${
                        digit
                          ? 'border-primary-300 bg-primary-50/40 text-neutral-900'
                          : 'border-neutral-300 bg-white text-neutral-900'
                      } focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:opacity-50`}
                      aria-label={`Digit ${index + 1}`}
                    />
                  ))}
                </div>

                {/* Resend / Timer */}
                <div className="text-center">
                  {isSending ? (
                    <p className="text-xs text-neutral-500">Sending code...</p>
                  ) : isExpired ? (
                    <button
                      type="button"
                      onClick={() => void handleResend()}
                      disabled={isVerifying}
                      className="text-xs font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50"
                    >
                      Resend Code
                    </button>
                  ) : hasChallenge ? (
                    <p className="text-xs text-primary-600 font-medium">
                      Resend code in {formatRemaining(secondsRemaining)}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleResend()}
                      disabled={isVerifying}
                      className="text-xs font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50"
                    >
                      Send Code
                    </button>
                  )}
                </div>
              </div>

              {/* ── Verify button ── */}
              <button
                type="button"
                onClick={() => void handleVerify()}
                disabled={disableVerify}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
              >
                {isVerifying ? <ButtonLoadingContent label="Verifying" /> : 'Verify and Continue'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
