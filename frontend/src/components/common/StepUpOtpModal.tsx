import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { isAxiosError } from 'axios';
import { StepUpAction, UserService } from '../../services/user.service';
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

const getActionLabel = (action: StepUpAction) => {
  if (action === 'ROLE_CHANGE') return 'role update';
  if (action === 'STATUS_CHANGE') return 'status update';
  if (action === 'CREDENTIAL_ISSUE') return 'credential issuance';
  if (action === 'BULK_STUDENT_CREATE') return 'bulk student import';
  return 'document download enable';
};

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
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const description = useMemo(() => {
    if (!prompt) return '';
    if (prompt.description) return prompt.description;
    return `Enter the OTP sent to your email to approve ${getActionLabel(prompt.action)}.`;
  }, [prompt]);

  useEffect(() => {
    if (!prompt) {
      setChallengeId(null);
      setExpiresAt(null);
      setOtpCode('');
      setIsSending(false);
      setIsVerifying(false);
      setSecondsRemaining(0);
      return;
    }

    let cancelled = false;
    const issueChallenge = async () => {
      setIsSending(true);
      setOtpCode('');
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
          showToast({
            variant: 'error',
            message: getApiErrorMessage(requestError),
          });
        }
      } finally {
        if (!cancelled) {
          setIsSending(false);
        }
      }
    };

    void issueChallenge();
    return () => {
      cancelled = true;
    };
  }, [prompt, showToast]);

  useEffect(() => {
    if (!expiresAt || !prompt) {
      setSecondsRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsRemaining(diff);
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, prompt]);

  const hasChallenge = Boolean(challengeId && expiresAt);
  const isExpired = hasChallenge && secondsRemaining <= 0;
  const disableVerify = isSending || isVerifying || !hasChallenge || isExpired;

  const handleResend = async () => {
    if (!prompt) return;
    setIsSending(true);
    setOtpCode('');
    try {
      const response = await UserService.createStepUpChallenge({
        action: prompt.action,
        targetId: prompt.targetId,
        payloadHash: prompt.payloadHash,
      });
      setChallengeId(response.challengeId);
      setExpiresAt(response.expiresAt);
    } catch (requestError) {
      showToast({
        variant: 'error',
        message: getApiErrorMessage(requestError),
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = otpCode.trim();
    if (!challengeId || trimmed.length === 0) {
      showToast({ variant: 'warning', message: 'Enter the OTP code first.' });
      return;
    }

    setIsVerifying(true);
    try {
      const result = await UserService.verifyStepUpChallenge(challengeId, trimmed);
      onVerified(result.stepUpToken);
      setOtpCode('');
      showToast({ variant: 'success', message: 'OTP verified successfully.' });
    } catch (verifyError) {
      showToast({
        variant: 'error',
        message: getApiErrorMessage(verifyError),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AnimatePresence>
      {prompt && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={MODAL_BACKDROP_VARIANTS}
          transition={MODAL_TRANSITION}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[1px]"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={MODAL_PANEL_VARIANTS}
            transition={MODAL_TRANSITION}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">{prompt.title || 'Security Verification'}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Email OTP</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center text-slate-500 transition-colors hover:text-slate-900"
          >
            <X size={15} />
          </button>
            </div>

            <form onSubmit={handleVerify} className="space-y-4 p-5">
          <p className="text-sm text-slate-600">{description}</p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {isSending
              ? 'Sending OTP'
              : hasChallenge
                ? `OTP expires in ${formatRemaining(secondsRemaining)}.`
                : 'No active OTP challenge. Click Resend Code.'}
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">One-time code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={event => setOtpCode(event.target.value.replace(/\s+/g, ''))}
              placeholder="Enter 6-digit code"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-slate-300"
              disabled={isSending || isVerifying}
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={isSending || isVerifying}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {isSending ? <ButtonLoadingContent label="Sending" /> : 'Resend Code'}
            </button>
            <button
              type="submit"
              disabled={disableVerify}
              className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isVerifying ? <ButtonLoadingContent label="Verifying" /> : 'Verify and Continue'}
            </button>
          </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
