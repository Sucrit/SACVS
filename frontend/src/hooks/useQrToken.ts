import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useToast } from './useToast';
import { GeneratedQrTokenResponse } from '../services/credential.service';

interface UseQrTokenReturn {
  /** The current QR token response (null when no QR is active). */
  qrToken: GeneratedQrTokenResponse | null;
  /** Data URL of the rendered QR code image. */
  qrDataUrl: string | null;
  /** Whether a QR generation request is in flight. */
  isGeneratingQr: boolean;
  /** Seconds remaining before the QR token expires. */
  qrSecondsRemaining: number;
  /** Set a freshly generated token (triggers render + countdown). */
  setQrToken: (token: GeneratedQrTokenResponse | null) => void;
  /** Set the generating flag manually (for wrapping calls). */
  setIsGeneratingQr: (value: boolean) => void;
  /** Clear all QR state. */
  clearQr: () => void;
  /** Format seconds as MM:SS. */
  formatQrCountdown: (totalSeconds: number) => string;
}

/**
 * Encapsulates the QR token rendering + countdown timer pattern used across
 * StudentCredentialsSection, StudentCredentialDetailsSection, and StudentRequestHistorySection.
 *
 * Callers are responsible for calling `CredentialService.generateQrToken(...)` and passing
 * the result to `setQrToken`. This hook manages:
 * - Converting the verification URL to a QR data URL via `qrcode`
 * - A per-second countdown based on `expiresAt`
 * - Clearing state when the QR is dismissed
 */
export function useQrToken(): UseQrTokenReturn {
  const [qrToken, setQrToken] = useState<GeneratedQrTokenResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrSecondsRemaining, setQrSecondsRemaining] = useState(0);
  const { showToast } = useToast();

  // Render QR code image from verification URL
  useEffect(() => {
    let cancelled = false;

    const renderQr = async () => {
      if (!qrToken?.verificationUrl) {
        setQrDataUrl(null);
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(qrToken.verificationUrl, { width: 280, margin: 1 });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) {
          setQrDataUrl(null);
          showToast({ variant: 'error', message: 'Unable to render QR code.' });
        }
      }
    };

    void renderQr();
    return () => {
      cancelled = true;
    };
  }, [qrToken?.verificationUrl, showToast]);

  // Countdown timer
  useEffect(() => {
    if (!qrToken?.expiresAt) {
      setQrSecondsRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const diff = Math.max(0, Math.floor((new Date(qrToken.expiresAt).getTime() - Date.now()) / 1000));
      setQrSecondsRemaining(diff);
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [qrToken?.expiresAt]);

  const clearQr = useCallback(() => {
    setQrToken(null);
    setQrDataUrl(null);
    setIsGeneratingQr(false);
    setQrSecondsRemaining(0);
  }, []);

  const formatQrCountdown = useCallback((totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, []);

  return {
    qrToken,
    qrDataUrl,
    isGeneratingQr,
    qrSecondsRemaining,
    setQrToken,
    setIsGeneratingQr,
    clearQr,
    formatQrCountdown,
  };
}
