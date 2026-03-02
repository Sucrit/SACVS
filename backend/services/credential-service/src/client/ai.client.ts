import { ENV } from '../config/env';

const parseBaseUrl = (value: string | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

interface QueueAnalyzePayload {
  credentialId: string;
  reason: 'CREATE' | 'REISSUE' | 'REANALYZE';
}

export class AiClient {
  async queueAnalyze(payload: QueueAnalyzePayload): Promise<void> {
    const baseUrl = parseBaseUrl(ENV.AI_SERVICE_URL);
    if (!baseUrl || !ENV.AI_ENABLED) {
      return;
    }

    const response = await fetch(`${baseUrl}/ai/internal/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ENV.INTERNAL_SERVICE_TOKEN
          ? { 'x-internal-service-token': ENV.INTERNAL_SERVICE_TOKEN }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `AI_ANALYZE_QUEUE_FAILED:${response.status}:${responseText || 'No response body'}`,
      );
    }
  }
}

export const aiClient = new AiClient();

