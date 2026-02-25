import path from 'node:path';
import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';
import { ENV } from '../config/env';

type ContractCredentialTuple = [string, string, string, bigint, boolean];
type ContractVerifyTuple = [boolean, string, bigint];
type ContractVerifyDocumentTuple = [boolean, string, bigint, number];

interface AnchorCredentialInput {
  credentialId: string;
  studentId: string;
  fileHash: string;
  allowReissue?: boolean;
}

interface RevokeCredentialInput {
  credentialId: string;
}

interface ArtifactJson {
  networks?: Record<string, { address: string }>;
}

const ACADEMIC_CREDENTIAL_REGISTRY_ABI: ethers.InterfaceAbi = [
  'function issueCredential(bytes32 credentialId, bytes32 studentHash, bytes32 documentHash)',
  'function reissueCredential(bytes32 credentialId, bytes32 studentHash, bytes32 documentHash)',
  'function revokeCredential(bytes32 credentialId)',
  'function getCredential(bytes32 credentialId) view returns (bytes32 studentHash, bytes32 documentHash, address issuer, uint256 issuedAt, bool revoked)',
  'function verifyCredential(bytes32 credentialId) view returns (bool valid, address issuer, uint256 issuedAt)',
  'function verifyCredentialDocument(bytes32 credentialId, bytes32 expectedDocumentHash) view returns (bool valid, address issuer, uint256 issuedAt, uint32 version)',
];

const isBytes32Hex = (value: string): boolean => /^0x[0-9a-fA-F]{64}$/.test(value);
const isSha256Hex = (value: string): boolean => /^[0-9a-fA-F]{64}$/.test(value);

const toBytes32 = (value: string): string => {
  const trimmed = value.trim();
  if (isBytes32Hex(trimmed)) {
    return trimmed;
  }
  if (isSha256Hex(trimmed)) {
    return `0x${trimmed}`;
  }
  return ethers.keccak256(ethers.toUtf8Bytes(trimmed));
};

export class BlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private readOnlyContract: ethers.Contract | null = null;
  private readonly chainName: string = ENV.CHAIN_NAME;

  private resolveAddressFromArtifact(artifact: ArtifactJson): string | null {
    const networks = artifact.networks ?? {};
    const entries = Object.values(networks).filter((entry) => Boolean(entry?.address));
    if (entries.length === 0) return null;
    return entries[entries.length - 1].address;
  }

  private toOnChainCredentialId(credentialId: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(credentialId));
  }

  private getContract(): ethers.Contract {
    if (!this.contract) {
      if (!ENV.PRIVATE_KEY) {
        throw new Error(
          'BLOCKCHAIN_PRIVATE_KEY is not configured for blockchain-interface-service.',
        );
      }

      const readOnly = this.getReadOnlyContract();
      if (!this.provider) {
        this.provider = new ethers.JsonRpcProvider(ENV.RPC_URL);
      }
      this.wallet = new ethers.Wallet(ENV.PRIVATE_KEY, this.provider);
      this.contract = readOnly.connect(this.wallet) as unknown as ethers.Contract;
    }

    const contract = this.contract;
    if (!contract) {
      throw new Error('Blockchain contract is not initialized.');
    }
    return contract;
  }

  private getReadOnlyContract(): ethers.Contract {
    if (this.readOnlyContract) {
      return this.readOnlyContract;
    }

    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(ENV.RPC_URL);
    }

    const artifactPath = path.resolve(
      __dirname,
      '../../build/contracts/AcademicCredentialRegistry.json',
    );
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as ArtifactJson;
    const contractAddress = ENV.CONTRACT_ADDRESS ?? this.resolveAddressFromArtifact(artifact);

    if (!contractAddress) {
      throw new Error(
        'Unable to resolve blockchain contract address. Set BLOCKCHAIN_CONTRACT_ADDRESS.',
      );
    }

    this.readOnlyContract = new ethers.Contract(
      contractAddress,
      ACADEMIC_CREDENTIAL_REGISTRY_ABI,
      this.provider,
    );
    return this.readOnlyContract;
  }

  async anchorCredential(input: AnchorCredentialInput): Promise<{
    chain: string;
    txHash: string;
    blockNumber: number | null;
    anchoredAt: string;
    onChainCredentialId: string;
    reissued: boolean;
  }> {
    const onChainCredentialId = this.toOnChainCredentialId(input.credentialId);
    const studentHash = toBytes32(input.studentId);
    const documentHash = toBytes32(input.fileHash);
    const readOnlyContract = this.getReadOnlyContract();
    const contract = this.getContract();

    const existing = (await readOnlyContract.getCredential(onChainCredentialId)) as ContractCredentialTuple;
    const exists = Number(existing[3]) > 0;

    if (exists && !input.allowReissue) {
      throw new Error('CREDENTIAL_ALREADY_EXISTS_ON_CHAIN');
    }
    if (exists && existing[4]) {
      throw new Error('CREDENTIAL_ALREADY_REVOKED_ON_CHAIN');
    }

    const tx = exists
      ? await contract.reissueCredential(onChainCredentialId, studentHash, documentHash)
      : await contract.issueCredential(onChainCredentialId, studentHash, documentHash);
    const receipt = await tx.wait();

    return {
      chain: this.chainName,
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : null,
      anchoredAt: new Date().toISOString(),
      onChainCredentialId,
      reissued: exists,
    };
  }

  async revokeCredential(input: RevokeCredentialInput): Promise<{
    chain: string;
    txHash: string;
    blockNumber: number | null;
    revokedAt: string;
    onChainCredentialId: string;
  }> {
    const onChainCredentialId = this.toOnChainCredentialId(input.credentialId);
    const contract = this.getContract();

    const tx = await contract.revokeCredential(onChainCredentialId);
    const receipt = await tx.wait();

    return {
      chain: this.chainName,
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : null,
      revokedAt: new Date().toISOString(),
      onChainCredentialId,
    };
  }

  async verifyCredential(credentialId: string): Promise<{
    chain: string;
    exists: boolean;
    valid: boolean;
    revoked: boolean;
    issuer: string | null;
    issuedAt: string | null;
    onChainCredentialId: string;
    documentHash: string | null;
  }> {
    const onChainCredentialId = this.toOnChainCredentialId(credentialId);
    const contract = this.getReadOnlyContract();

    const credential = (await contract.getCredential(
      onChainCredentialId,
    )) as ContractCredentialTuple;
    const verify = (await contract.verifyCredential(
      onChainCredentialId,
    )) as ContractVerifyTuple;

    const issuedAtEpoch = Number(credential[3]);
    const revoked = credential[4];
    const exists = issuedAtEpoch > 0;

    return {
      chain: this.chainName,
      exists,
      valid: Boolean(verify[0]),
      revoked,
      issuer: verify[1] && verify[1] !== ethers.ZeroAddress ? verify[1] : null,
      issuedAt:
        Number(verify[2]) > 0 ? new Date(Number(verify[2]) * 1000).toISOString() : null,
      onChainCredentialId,
      documentHash: exists ? credential[1] : null,
    };
  }

  async verifyCredentialDocument(
    credentialId: string,
    fileHash: string,
  ): Promise<{
    chain: string;
    valid: boolean;
    issuer: string | null;
    issuedAt: string | null;
    version: number;
    onChainCredentialId: string;
    documentHash: string;
  }> {
    const onChainCredentialId = this.toOnChainCredentialId(credentialId);
    const documentHash = toBytes32(fileHash);
    const contract = this.getReadOnlyContract();

    const verify = (await contract.verifyCredentialDocument(
      onChainCredentialId,
      documentHash,
    )) as ContractVerifyDocumentTuple;

    return {
      chain: this.chainName,
      valid: Boolean(verify[0]),
      issuer: verify[1] && verify[1] !== ethers.ZeroAddress ? verify[1] : null,
      issuedAt: Number(verify[2]) > 0 ? new Date(Number(verify[2]) * 1000).toISOString() : null,
      version: Number(verify[3]) || 0,
      onChainCredentialId,
      documentHash,
    };
  }
}

export const blockchainService = new BlockchainService();
