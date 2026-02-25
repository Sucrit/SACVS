import { ENV } from '../config/env';

interface AnchorCredentialPayload {
  credentialId: string;
  studentId: string;
  fileHash: string;
  allowReissue?: boolean;
}

interface AnchorCredentialResponse {
  chain: string;
  txHash: string;
  blockNumber: number | null;
  anchoredAt: string;
  onChainCredentialId: string;
  reissued: boolean;
}

interface RevokeCredentialPayload {
  credentialId: string;
}

const parseBaseUrl = (value: string | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export class BlockchainClient {
  async anchorCredential(payload: AnchorCredentialPayload): Promise<AnchorCredentialResponse> {
    const baseUrl = parseBaseUrl(ENV.BLOCKCHAIN_INTERFACE_SERVICE_URL);
    if (!baseUrl) {
      throw new Error('BLOCKCHAIN_INTERFACE_UNAVAILABLE');
    }

    const response = await fetch(`${baseUrl}/blockchain/credentials/anchor`, {
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
        `BLOCKCHAIN_ANCHOR_FAILED:${response.status}:${responseText || 'No response body'}`,
      );
    }

    return (await response.json()) as AnchorCredentialResponse;
  }

  async revokeCredential(payload: RevokeCredentialPayload): Promise<void> {
    const baseUrl = parseBaseUrl(ENV.BLOCKCHAIN_INTERFACE_SERVICE_URL);
    if (!baseUrl) {
      throw new Error('BLOCKCHAIN_INTERFACE_UNAVAILABLE');
    }

    const response = await fetch(`${baseUrl}/blockchain/credentials/revoke`, {
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
        `BLOCKCHAIN_REVOKE_FAILED:${response.status}:${responseText || 'No response body'}`,
      );
    }
  }
}

export const blockchainClient = new BlockchainClient();
