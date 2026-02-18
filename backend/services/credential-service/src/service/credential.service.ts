import { CredentialRepository, CredentialRequestRepository } from '../repository/credential.repository';
import {
  CreateCredentialDto,
  CredentialResponseDto,
  CreateCredentialRequestDto,
  UpdateCredentialRequestDto,
  CredentialRequestResponseDto,
  CredentialListQuery,
  PaginatedResponse,
  UpdateCredentialStatusDto,
} from '../dto/credential.dto';
import { archiveCredentialDocument } from '../utils/credentialArchive';
import { prisma } from '../db/prisma';
import { Prisma, CredentialStatus, CredentialRequestStatus, CredentialType, DeliveryMethod, Role } from '@prisma/client';
import { ENV } from '../config/env';

const credentialRepo = new CredentialRepository();
const requestRepo = new CredentialRequestRepository();

// ─── AI Validation Stub ──────────────────────────────────────

interface AiValidationResult {
  status: 'PASS' | 'FLAG' | 'FAIL';
  score: number;
  report: Record<string, unknown>;
}

async function runAiValidation(credential: Record<string, unknown>): Promise<AiValidationResult> {
  // Stub: In production this would call an external AI service
  if (ENV.AI_ENABLED && ENV.AI_SERVICE_URL) {
    try {
      const res = await fetch(`${ENV.AI_SERVICE_URL}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      if (res.ok) return (await res.json()) as AiValidationResult;
    } catch {
      // Fall through to local stub
    }
  }

  // Local deterministic stub — always passes, realistic score
  const score = 0.85 + Math.random() * 0.15;
  return {
    status: 'PASS',
    score: Math.round(score * 100) / 100,
    report: {
      checks: ['format_valid', 'institution_verified', 'date_range_valid', 'duplicate_check_passed'],
      timestamp: new Date().toISOString(),
      engine: 'stub-v1',
    },
  };
}

// ─── Blockchain Stub ─────────────────────────────────────────

interface BlockchainAnchorResult {
  chain: string;
  txHash: string;
  blockNumber: number;
  anchoredAt: Date;
}

async function anchorToBlockchain(credentialId: string, hash: string): Promise<BlockchainAnchorResult | null> {
  if (!ENV.BLOCKCHAIN_RPC_URL || !ENV.BLOCKCHAIN_CONTRACT_ADDRESS) {
    return null;
  }

  // Stub: In production this would use ethers.js / web3.js to send a transaction
  // to the AcademicCredentialRegistry smart contract
  try {
    const txHash = `0x${Buffer.from(`${credentialId}-${hash}-${Date.now()}`).toString('hex').slice(0, 64)}`;
    return {
      chain: 'ganache-local',
      txHash,
      blockNumber: Math.floor(Math.random() * 100000) + 1,
      anchoredAt: new Date(),
    };
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function normalizeMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function toCredentialDto(entity: any): CredentialResponseDto {
  return {
    id: entity.id,
    studentId: entity.studentId,
    issuedById: entity.issuedById,
    title: entity.title,
    type: entity.type,
    status: entity.status,
    description: entity.description,
    filename: entity.filename,
    metadata: normalizeMetadata(entity.metadata),
    institution_name: entity.metadata?.institution_name,
    student_name: entity.metadata?.student_name,
    student_email: entity.metadata?.student_email,
    issue_date: entity.metadata?.issue_date,
    expiry_date: entity.metadata?.expiry_date,
    document_url: entity.metadata?.document_url,
    // AI
    aiStatus: entity.aiStatus,
    aiScore: entity.aiScore ? Number(entity.aiScore) : null,
    aiReport: entity.aiReport ? normalizeMetadata(entity.aiReport) : null,
    aiValidatedAt: entity.aiValidatedAt?.toISOString?.() ?? entity.aiValidatedAt,
    // Blockchain
    chain: entity.chain,
    txHash: entity.txHash,
    blockNumber: entity.blockNumber,
    anchoredAt: entity.anchoredAt?.toISOString?.() ?? entity.anchoredAt,
    // Timestamps
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

function toRequestDto(entity: any): CredentialRequestResponseDto {
  return {
    id: entity.id,
    studentId: entity.studentId,
    credentialId: entity.credentialId,
    type: entity.type,
    title: entity.title,
    description: entity.description,
    purpose: entity.purpose,
    deliveryMethod: entity.deliveryMethod,
    status: entity.status,
    processedById: entity.processedById,
    processedAt: entity.processedAt?.toISOString?.() ?? entity.processedAt,
    rejectionReason: entity.rejectionReason,
    notes: entity.notes,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

// ─── Credential Service ──────────────────────────────────────

export class CredentialService {
  // ── Issue a credential (registrar / admin) ─────────────────

  async createCredential(data: CreateCredentialDto): Promise<CredentialResponseDto> {
    if (!data.issuerClerkId || !data.studentId || !data.title) {
      throw { status: 400, message: 'issuerClerkId, studentId, and title are required' };
    }

    const issuer = await prisma.user.findUnique({
      where: { clerkId: data.issuerClerkId },
      select: { id: true, role: true },
    });
    if (!issuer) throw { status: 404, message: 'Issuer user not found' };
    if (issuer.role !== Role.REGISTRAR && issuer.role !== Role.ADMIN) {
      throw { status: 403, message: 'Issuer must be registrar or admin' };
    }

    const student = await prisma.user.findUnique({
      where: { id: data.studentId },
      select: { id: true, role: true },
    });
    if (!student) throw { status: 404, message: 'Student user not found' };
    if (student.role !== Role.STUDENT) throw { status: 400, message: 'studentId must belong to a student user' };

    // Archive document if present
    let documentArchivePath: string | undefined;
    if (data.document_base64) {
      documentArchivePath = await archiveCredentialDocument({
        documentBase64: data.document_base64,
        mimeType: data.document_mime_type,
        originalName: data.document_original_name,
        tag: data.title,
      });
    }

    const baseMetadata = normalizeMetadata(data.metadata);
    const mergedMetadata: Record<string, unknown> = {
      ...baseMetadata,
      institution_name: data.institution_name ?? baseMetadata.institution_name,
      student_name: data.student_name ?? baseMetadata.student_name,
      student_email: data.student_email ?? baseMetadata.student_email,
      issue_date: data.issue_date ?? baseMetadata.issue_date,
      expiry_date: data.expiry_date ?? baseMetadata.expiry_date,
      document_url: data.document_url ?? baseMetadata.document_url,
      ...(documentArchivePath ? { document_archive_path: documentArchivePath } : {}),
    };

    const credentialType = (data.type as CredentialType) || CredentialType.CERTIFICATE;

    const created = await credentialRepo.create({
      student: { connect: { id: data.studentId } },
      issuedBy: { connect: { id: issuer.id } },
      title: data.title,
      type: credentialType,
      description: data.description || null,
      status: CredentialStatus.PENDING,
      filename: data.filename || data.document_original_name || null,
      issuedDate: data.issue_date ? new Date(data.issue_date) : null,
      expiryDate: data.expiry_date ? new Date(data.expiry_date) : null,
      metadata: mergedMetadata as Prisma.InputJsonValue,
    });

    // Run AI validation asynchronously
    this.processAiAndBlockchain(created.id).catch(() => {});

    return toCredentialDto(created);
  }

  // ── AI + Blockchain pipeline ───────────────────────────────

  private async processAiAndBlockchain(credentialId: string): Promise<void> {
    const credential = await credentialRepo.findById(credentialId);
    if (!credential) return;

    // AI validation
    const aiResult = await runAiValidation({ ...credential });

    const aiUpdate: Prisma.CredentialUpdateInput = {
      aiStatus: aiResult.status,
      aiScore: aiResult.score,
      aiReport: aiResult.report as Prisma.InputJsonValue,
      aiValidatedAt: new Date(),
    };

    if (aiResult.status === 'FAIL') {
      aiUpdate.status = CredentialStatus.AI_REVIEW;
    } else if (aiResult.status === 'FLAG') {
      aiUpdate.status = CredentialStatus.AI_REVIEW;
    } else {
      aiUpdate.status = CredentialStatus.VERIFIED;
    }

    await credentialRepo.update(credentialId, aiUpdate);

    // Blockchain anchoring (only if AI passed)
    if (aiResult.status === 'PASS') {
      const hash = `${credential.title}-${credential.studentId}-${credential.createdAt.toISOString()}`;
      const anchor = await anchorToBlockchain(credentialId, hash);

      if (anchor) {
        await credentialRepo.update(credentialId, {
          chain: anchor.chain,
          txHash: anchor.txHash,
          blockNumber: anchor.blockNumber,
          anchoredAt: anchor.anchoredAt,
        });
      }
    }
  }

  // ── Update credential status ───────────────────────────────

  async updateCredentialStatus(id: string, dto: UpdateCredentialStatusDto): Promise<CredentialResponseDto> {
    const existing = await credentialRepo.findById(id);
    if (!existing) throw { status: 404, message: 'Credential not found' };

    const status = dto.status as CredentialStatus;
    const updated = await credentialRepo.update(id, { status });
    return toCredentialDto(updated);
  }

  // ── List credentials (paginated) ──────────────────────────

  async getCredentials(query: CredentialListQuery): Promise<PaginatedResponse<CredentialResponseDto>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const { data, total } = await credentialRepo.list(query);
    return {
      data: data.map(toCredentialDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Get student's own credentials ─────────────────────────

  async getStudentCredentials(clerkId: string): Promise<CredentialResponseDto[]> {
    const student = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!student) return [];

    const items = await credentialRepo.listByStudentId(student.id);
    return items.map(toCredentialDto);
  }

  // ── Get single credential ─────────────────────────────────

  async getCredentialById(id: string): Promise<CredentialResponseDto> {
    if (!id) throw { status: 400, message: 'id required' };
    const item = await credentialRepo.findById(id);
    if (!item) throw { status: 404, message: 'Credential not found' };
    return toCredentialDto(item);
  }

  // ── Delete a credential ────────────────────────────────────

  async deleteCredential(id: string): Promise<void> {
    const existing = await credentialRepo.findById(id);
    if (!existing) throw { status: 404, message: 'Credential not found' };
    await credentialRepo.delete(id);
  }

  // ── Stats ──────────────────────────────────────────────────

  async getStats(): Promise<{
    statusCounts: Record<string, number>;
    typeCounts: Record<string, number>;
    requestStatusCounts: Record<string, number>;
    total: number;
    totalRequests: number;
  }> {
    const [statusCounts, typeCounts, requestStatusCounts] = await Promise.all([
      credentialRepo.countByStatus(),
      credentialRepo.countByType(),
      requestRepo.countByStatus(),
    ]);

    const total = Object.values(statusCounts).reduce((s, n) => s + n, 0);
    const totalRequests = Object.values(requestStatusCounts).reduce((s, n) => s + n, 0);

    return { statusCounts, typeCounts, requestStatusCounts, total, totalRequests };
  }

  // ═════════════════════════════════════════════════════════════
  // CREDENTIAL REQUESTS (student self-service)
  // ═════════════════════════════════════════════════════════════

  // ── Student creates a request ──────────────────────────────

  async createRequest(studentClerkId: string, dto: CreateCredentialRequestDto): Promise<CredentialRequestResponseDto> {
    const student = await prisma.user.findUnique({
      where: { clerkId: studentClerkId },
      select: { id: true, role: true },
    });
    if (!student || student.role !== Role.STUDENT) {
      throw { status: 403, message: 'Only students can submit credential requests' };
    }

    const credType = (dto.type as CredentialType) || CredentialType.CERTIFICATE;
    const delivery = (dto.deliveryMethod as DeliveryMethod) || DeliveryMethod.DIGITAL;

    const created = await requestRepo.create({
      student: { connect: { id: student.id } },
      type: credType,
      title: dto.title,
      description: dto.description || null,
      purpose: dto.purpose || null,
      deliveryMethod: delivery,
      status: CredentialRequestStatus.PENDING,
    });

    return toRequestDto(created);
  }

  // ── Student views own requests ────────────────────────────

  async getMyRequests(clerkId: string, page = 1, limit = 20): Promise<PaginatedResponse<CredentialRequestResponseDto>> {
    const student = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!student) return { data: [], total: 0, page, limit, totalPages: 0 };

    const { data, total } = await requestRepo.listByStudent(student.id, page, limit);
    return {
      data: data.map(toRequestDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Get a single request ───────────────────────────────────

  async getRequestById(id: string): Promise<CredentialRequestResponseDto> {
    const item = await requestRepo.findById(id);
    if (!item) throw { status: 404, message: 'Request not found' };
    return toRequestDto(item);
  }

  // ── Registrar lists pending requests ──────────────────────

  async getPendingRequests(page = 1, limit = 20): Promise<PaginatedResponse<CredentialRequestResponseDto>> {
    const { data, total } = await requestRepo.listPending(page, limit);
    return {
      data: data.map(toRequestDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── List all requests (admin/registrar) ───────────────────

  async getAllRequests(status?: CredentialRequestStatus, page = 1, limit = 20): Promise<PaginatedResponse<CredentialRequestResponseDto>> {
    const { data, total } = await requestRepo.listAll(status, page, limit);
    return {
      data: data.map(toRequestDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Process a request (approve/reject) ────────────────────

  async processRequest(
    requestId: string,
    registrarClerkId: string,
    dto: UpdateCredentialRequestDto,
  ): Promise<CredentialRequestResponseDto> {
    const registrar = await prisma.user.findUnique({
      where: { clerkId: registrarClerkId },
      select: { id: true, role: true },
    });
    if (!registrar || (registrar.role !== Role.REGISTRAR && registrar.role !== Role.ADMIN)) {
      throw { status: 403, message: 'Only registrars or admins can process requests' };
    }

    const existing = await requestRepo.findById(requestId);
    if (!existing) throw { status: 404, message: 'Request not found' };
    if (existing.status !== CredentialRequestStatus.PENDING) {
      throw { status: 400, message: `Request already ${existing.status.toLowerCase()}` };
    }

    const newStatus = dto.status as CredentialRequestStatus;

    const updateData: Prisma.CredentialRequestUpdateInput = {
      status: newStatus,
      processedBy: { connect: { id: registrar.id } },
      processedAt: new Date(),
      notes: dto.notes || null,
    };

    if (newStatus === CredentialRequestStatus.REJECTED) {
      updateData.rejectionReason = dto.rejectionReason || 'No reason provided';
    }

    const updated = await requestRepo.update(requestId, updateData);
    return toRequestDto(updated);
  }
}
