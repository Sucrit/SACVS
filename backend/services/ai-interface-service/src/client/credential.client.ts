import { ENV } from '../config/env';

interface CredentialDocumentResponse {
  credentialId: string;
  studentId: string;
  institutionId: string | null;
  title: string;
  filename: string | null;
  mimeType: string | null;
  fileHash: string | null;
  storageKey: string | null;
  fileBase64: string;
}

export class CredentialClient {
  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(ENV.INTERNAL_SERVICE_TOKEN
        ? { 'x-internal-service-token': ENV.INTERNAL_SERVICE_TOKEN }
        : {}),
    };
  }

  async getCredentialDocument(credentialId: string): Promise<CredentialDocumentResponse> {
    const response = await fetch(
      `${ENV.CREDENTIAL_SERVICE_URL}/credentials/internal/documents/${encodeURIComponent(credentialId)}`,
      {
        method: 'GET',
        headers: this.headers(),
      },
    );

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `CREDENTIAL_DOCUMENT_FETCH_FAILED:${response.status}:${responseText || 'No response body'}`,
      );
    }

    return (await response.json()) as CredentialDocumentResponse;
  }

  async applyAiResult(payload: {
    credentialId: string;
    aiDecision: 'PENDING' | 'CLEAR' | 'REVIEW_REQUIRED' | 'BLOCK' | 'FAILED';
    aiStatus: string;
    aiScore: number;
    aiReport: Record<string, unknown>;
    aiSignals: unknown[];
    aiModel: string;
    aiModelVersion: string;
    aiValidatedAt: string;
    provider: string;
    error?: string;
    raw?: Record<string, unknown>;
  }): Promise<void> {
    const response = await fetch(`${ENV.CREDENTIAL_SERVICE_URL}/credentials/internal/ai-results`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `CREDENTIAL_AI_RESULT_APPLY_FAILED:${response.status}:${responseText || 'No response body'}`,
      );
    }
  }
}

export const credentialClient = new CredentialClient();
