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
    const internalToken = ENV.INTERNAL_SERVICE_TOKEN?.trim();
    if (!internalToken) {
      throw new Error('INTERNAL_AUTH_MISCONFIGURED');
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/blockchain/credentials/anchor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service-token': internalToken,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error('BLOCKCHAIN_INTERFACE_UNREACHABLE');
    }

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
    const internalToken = ENV.INTERNAL_SERVICE_TOKEN?.trim();
    if (!internalToken) {
      throw new Error('INTERNAL_AUTH_MISCONFIGURED');
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/blockchain/credentials/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service-token': internalToken,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error('BLOCKCHAIN_INTERFACE_UNREACHABLE');
    }

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        `BLOCKCHAIN_REVOKE_FAILED:${response.status}:${responseText || 'No response body'}`,
      );
    }
  }
}

export const blockchainClient = new BlockchainClient();
