/**
 * Shared error extraction utilities.
 * Consolidates getApiErrorMessage from Student/utils, Institution/utils,
 * and toErrorMessage from utils/toast-message.ts.
 */
import { isAxiosError } from 'axios';

const CODE_MESSAGE_MAP: Record<string, string> = {
  RATE_LIMITED: 'Too many requests. Please slow down and try again.',
  TOO_MANY_REQUESTS: 'Too many requests. Please slow down and try again.',
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  AUTH_TOKEN_MISSING: 'Your session is missing. Please sign in again.',
  AUTH_TOKEN_ERROR: 'We could not verify your session. Please sign in again.',
  FORBIDDEN: 'You do not have permission to do that.',
  FORBIDDEN_SCOPE: 'You do not have access to that item.',
  FORBIDDEN_ROLE: 'Your account is not allowed to perform that action.',
  ACTOR_NOT_FOUND: 'We could not find your account details. Please sign in again.',
  RELATED_RECORD_NOT_FOUND: 'Some required information could not be found.',
  REQUEST_NOT_FOUND: 'That request could not be found.',
  CREDENTIAL_NOT_FOUND: 'That credential could not be found.',
  STUDENT_NOT_FOUND: 'That student could not be found.',
  NOT_FOUND: 'We could not find what you were looking for.',
  INVALID_STATUS: 'That selection is no longer valid.',
  INVALID_TYPE: 'That selection is not supported.',
  INVALID_STATUS_TRANSITION: 'That change is not allowed right now.',
  CANNOT_CANCEL_NON_PENDING: 'Only pending requests can be cancelled.',
  FORBIDDEN_STATUS_FOR_ROLE: 'Your account cannot make that request change.',
  INVALID_REQUEST_PAYLOAD: 'Some information is missing or invalid. Please review your input and try again.',
  INVALID_PHONE_NUMBER: 'Enter a valid phone number and try again.',
  INVALID_PHONE: 'Enter a valid phone number and try again.',
  INVALID_PHONE_FORMAT: 'Enter a valid phone number and try again.',
  INVALID_BIRTHDAY: 'Enter a valid birth date and try again.',
  INVALID_SEX: 'Select a valid sex value and try again.',
  INVALID_GUARDIAN_FULL_NAME: 'Enter a valid guardian name and try again.',
  INVALID_GUARDIAN_RELATIONSHIP: 'Enter a valid guardian relationship and try again.',
  STUDENT_PROFILE_FORBIDDEN: 'This account is not allowed to update student profile details.',
  STEP_UP_MISCONFIGURED: 'This verification step is not available right now. Please try again later.',
  STEP_UP_DELIVERY_NOT_CONFIGURED: 'Verification email delivery is not available right now.',
  STEP_UP_DELIVERY_FAILED: 'We could not send the verification code. Please try again in a moment.',
  STEP_UP_CHALLENGE_LOCKED: 'Too many invalid code attempts. Request a new code and try again.',
  STEP_UP_TOKEN_EXPIRED: 'That verification code has expired. Request a new one and try again.',
  STEP_UP_TOKEN_INVALID: 'That verification code is invalid. Try again or request a new one.',
  STEP_UP_REQUIRED: 'A verification code is required to continue.',
  QR_TOKEN_INVALID: 'This verification link is invalid. Ask for a new one and try again.',
  QR_TOKEN_EXPIRED: 'This verification link has expired. Ask for a fresh link and try again.',
  QR_TOKEN_USED: 'This verification link has already been used. Ask for a new one.',
  QR_TOKEN_MALFORMED: 'This verification link is not valid.',
  QR_DOCUMENT_ACCESS_NOT_ALLOWED: 'Document access is not available for this verification link.',
  QR_TOKEN_PEPPER_MISSING: 'Public verification is not available right now. Please try again later.',
  INVALID_QR_OPTIONS: 'The QR options are invalid. Please try again.',
  REQUEST_RECEIPT_TOKEN_PEPPER_MISSING: 'Receipt verification is not available right now. Please try again later.',
  MISSING_CREDENTIAL_FILE: 'Attach a credential file before continuing.',
  INVALID_FILE_TYPE: 'That file type is not supported. Please upload a PDF or image file.',
  INVALID_BLOCK_NUMBER: 'The block number is invalid.',
  INVALID_METADATA_JSON: 'The metadata format is invalid.',
  INVALID_ANCHORED_AT: 'The anchored date is invalid.',
  INVALID_ISSUED_DATE: 'The issued date is invalid.',
  INVALID_EXPIRY_DATE: 'The expiry date is invalid.',
  INVALID_CERTIFICATE_CATEGORY: 'The certificate category is invalid.',
  EXPIRED_STATUS_SYSTEM_MANAGED: 'Expired status is managed automatically by the system.',
  CREDENTIAL_EXPIRED_IMMUTABLE: 'This credential has expired and is locked. Re-issue it to renew access.',
  CREDENTIAL_ALREADY_EXISTS_ON_CHAIN: 'This credential already exists on the blockchain.',
  CREDENTIAL_ALREADY_REVOKED_ON_CHAIN: 'This credential has already been revoked on the blockchain.',
  SUSPENDED: 'This account is suspended. Contact support if you think this is a mistake.',
};

const LITERAL_MESSAGE_MAP: Record<string, string> = {
  'forbidden': 'You do not have permission to do that.',
  'not allowed to access this credential.': 'You do not have access to that credential.',
  'not allowed to access this credential request.': 'You do not have access to that request.',
  'authenticated user record was not found.': 'We could not find your account details. Please sign in again.',
  'credential request not found.': 'That request could not be found.',
  'credential not found.': 'That credential could not be found.',
  'student not found.': 'That student could not be found.',
  'invalid status query value.': 'That filter is not valid.',
  'invalid request payload.': 'Some information is missing or invalid. Please review your input and try again.',
  'invalid status transition.': 'That change is not allowed right now.',
  'invalid file type. use png, jpeg, webp, or pdf.': 'That file type is not supported. Please upload a PDF or image file.',
  'a credential file is required before issuing.': 'Attach a credential file before issuing.',
  'expired credentials are locked. use re-issue to renew.': 'This credential has expired and is locked. Re-issue it to renew access.',
  'institution accounts cannot override issuedbyid.': 'This institution action is not allowed.',
};

const RAW_CODE_PATTERN = /^[A-Z0-9]+(?:_[A-Z0-9]+)+(?::[A-Za-z0-9._-]+)?$/;

const extractErrorPayloadField = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const sentenceCase = (value: string) => {
  const normalized = value.replace(/_/g, ' ').toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const normalizeByCode = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const [baseCode] = trimmed.split(':', 1);
  if (baseCode === 'MISSING_REQUIRED_FIELD') {
    return 'Please complete all required fields and try again.';
  }

  return CODE_MESSAGE_MAP[trimmed] || CODE_MESSAGE_MAP[baseCode] || null;
};

const normalizeByLiteralMessage = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const exact = LITERAL_MESSAGE_MAP[trimmed.toLowerCase()];
  if (exact) return exact;

  if (/too many requests|rate limit|rate_limited/i.test(trimmed)) {
    return 'Too many requests. Please slow down and try again.';
  }
  if (/network error|failed to fetch|gateway is unreachable|network request failed/i.test(trimmed)) {
    return 'Unable to reach the server. Check your connection and try again.';
  }
  if (/unauthorized|authorization failed|authentication failed/i.test(trimmed)) {
    return 'Your session has expired. Please sign in again.';
  }
  if (/forbidden|not allowed|access denied/i.test(trimmed)) {
    return 'You do not have permission to do that.';
  }
  if (/token.+expired|expired.+token/i.test(trimmed)) {
    return 'This link has expired. Request a new one and try again.';
  }
  if (/token.+used|already been used/i.test(trimmed)) {
    return 'This link has already been used. Ask for a new one.';
  }
  if (/token.+invalid|invalid.+token|malformed.+token/i.test(trimmed)) {
    return 'This link is not valid. Please use a fresh one.';
  }
  if (/otp.+expired|verification code.+expired/i.test(trimmed)) {
    return 'That verification code has expired. Request a new one and try again.';
  }
  if (/otp|verification code/i.test(trimmed) && /invalid/i.test(trimmed)) {
    return 'That verification code is invalid. Try again or request a new one.';
  }
  if (/not found/i.test(trimmed)) {
    return 'We could not find what you were looking for.';
  }

  return null;
};

const normalizeErrorString = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const byCode = normalizeByCode(trimmed);
  if (byCode) return byCode;

  const byLiteral = normalizeByLiteralMessage(trimmed);
  if (byLiteral) return byLiteral;

  if (RAW_CODE_PATTERN.test(trimmed)) {
    return null;
  }

  if (/^[A-Z0-9_:-]+$/.test(trimmed)) {
    return sentenceCase(trimmed);
  }

  return trimmed;
};

/**
 * Extract a human-friendly error message from an unknown error.
 * Returns `null` when no message can be determined.
 */
export const getApiErrorMessage = (error: unknown): string | null => {
  if (!isAxiosError(error)) {
    if (error instanceof Error && error.message.trim().length > 0) {
      return normalizeErrorString(error.message);
    }
    return null;
  }

  const responseData = error.response?.data as
    | string
    | { error?: string; code?: string; message?: string }
    | undefined;

  if (!error.response) {
    return 'Unable to reach the server. Check your connection and try again.';
  }

  if (typeof responseData === 'string') {
    return normalizeErrorString(responseData);
  }

  const payloadError = extractErrorPayloadField(responseData?.error);
  if (payloadError) {
    return normalizeErrorString(payloadError);
  }

  const payloadCode = extractErrorPayloadField(responseData?.code);
  if (payloadCode) {
    return normalizeErrorString(payloadCode);
  }

  const payloadMessage = extractErrorPayloadField(responseData?.message);
  if (payloadMessage) {
    return normalizeErrorString(payloadMessage);
  }

  if (typeof error.message === 'string' && error.message.trim().length > 0) {
    return normalizeErrorString(error.message);
  }

  return null;
};

/**
 * Same as `getApiErrorMessage` but returns a fallback string instead of `null`.
 * Drop-in replacement for the old `toErrorMessage()` from `utils/toast-message.ts`.
 */
export const toErrorMessage = (error: unknown, fallback: string): string =>
  getApiErrorMessage(error) ?? fallback;
