import {
  CredentialRequest as PrismaCredentialRequest,
  CredentialRequestStatus,
  DeliveryMethod,
  Prisma,
  RequesterType,
  Role,
} from '../../../../db/node_modules/@prisma/client';
import {
  CreateCredentialRequestDto,
  CredentialRequestResponseDto,
  ListCredentialRequestsQueryDto,
  UpdateCredentialRequestStatusDto,
} from '../dto/credential-request.dto';
import {
  CredentialRequestRepository,
  UserContext,
} from '../repository/credential-request.repository';

const credentialRequestRepository = new CredentialRequestRepository();

const parseOptionalString = (value?: string): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toCredentialRequestResponse = (
  request: PrismaCredentialRequest,
): CredentialRequestResponseDto => ({
  id: request.id,
  studentId: request.studentId,
  credentialId: request.credentialId,
  type: request.type,
  title: request.title,
  description: request.description,
  purpose: request.purpose,
  deliveryMethod: request.deliveryMethod,
  status: request.status,
  processedById: request.processedById,
  processedAt: request.processedAt ? request.processedAt.toISOString() : null,
  rejectionReason: request.rejectionReason,
  notes: null,
  metadata: {
    requesterType: request.requesterType,
    requesterId: request.requesterId,
    institutionId: request.institutionId,
    employerId: request.employerId,
  },
  createdAt: request.createdAt.toISOString(),
  updatedAt: request.updatedAt.toISOString(),
});

export class CredentialRequestService {
  private isInstitutionScopedRole(role: Role): boolean {
    return role === Role.INSTITUTION;
  }

  private ensureCanCreateForRole(actor: UserContext): void {
    if (!['STUDENT', 'EMPLOYER', 'INSTITUTION'].includes(actor.role)) {
      throw new Error('FORBIDDEN_ROLE');
    }
  }

  private buildListScopeWhere(
    actor: UserContext,
    query: ListCredentialRequestsQueryDto,
  ): Prisma.CredentialRequestWhereInput {
    const where: Prisma.CredentialRequestWhereInput = {};

    if (query.status) {
      where.status = query.status as CredentialRequestStatus;
    }
    if (query.studentId) {
      where.studentId = query.studentId;
    }

    if (actor.role === Role.ADMIN) {
      return where;
    }

    if (actor.role === Role.STUDENT) {
      return {
        AND: [
          where,
          {
            OR: [{ studentId: actor.id }, { requesterId: actor.id }],
          },
        ],
      };
    }

    if (actor.role === Role.EMPLOYER) {
      return {
        AND: [
          where,
          actor.employerId
            ? { OR: [{ employerId: actor.employerId }, { requesterId: actor.id }] }
            : { requesterId: actor.id },
        ],
      };
    }

    if (this.isInstitutionScopedRole(actor.role)) {
      if (!actor.institutionId) {
        throw new Error('INSTITUTION_CONTEXT_MISSING');
      }

      return {
        AND: [
          where,
          {
            OR: [
              { institutionId: actor.institutionId },
              { student: { institutionId: actor.institutionId } },
            ],
          },
        ],
      };
    }

    throw new Error('FORBIDDEN_ROLE');
  }

  async listCredentialRequests(
    actorUserId: string,
    query: ListCredentialRequestsQueryDto,
  ): Promise<CredentialRequestResponseDto[]> {
    const actor = await credentialRequestRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 100));
    const skip = (page - 1) * pageSize;
    const where = this.buildListScopeWhere(actor, query);

    const requests = await credentialRequestRepository.listCredentialRequests(where, skip, pageSize);
    return requests.map(toCredentialRequestResponse);
  }

  async createCredentialRequest(
    actorUserId: string,
    data: CreateCredentialRequestDto,
  ): Promise<CredentialRequestResponseDto> {
    const actor = await credentialRequestRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }

    this.ensureCanCreateForRole(actor);

    const title = data.title.trim();
    if (!title) {
      throw new Error('TITLE_REQUIRED');
    }

    const type = data.type;
    const deliveryMethod = (data.deliveryMethod ?? 'DIGITAL') as DeliveryMethod;

    let studentId = parseOptionalString(data.studentId);
    let requesterType: RequesterType = RequesterType.STUDENT;
    let institutionId: string | null = null;
    let employerId: string | null = null;

    if (actor.role === Role.STUDENT) {
      studentId = actor.id;
      requesterType = RequesterType.STUDENT;
      institutionId = actor.institutionId ?? null;
    } else if (actor.role === Role.EMPLOYER) {
      if (!studentId) {
        throw new Error('STUDENT_ID_REQUIRED');
      }
      requesterType = RequesterType.EMPLOYER;
      employerId = actor.employerId ?? parseOptionalString(data.employerId);
      institutionId = parseOptionalString(data.institutionId);
      if (!employerId) {
        throw new Error('EMPLOYER_CONTEXT_MISSING');
      }
    } else if (this.isInstitutionScopedRole(actor.role)) {
      if (!studentId) {
        throw new Error('STUDENT_ID_REQUIRED');
      }
      requesterType = RequesterType.INSTITUTION;
      institutionId = actor.institutionId;
      if (!institutionId) {
        throw new Error('INSTITUTION_CONTEXT_MISSING');
      }
    }

    if (!studentId) {
      throw new Error('STUDENT_ID_REQUIRED');
    }

    try {
      const created = await credentialRequestRepository.createCredentialRequest({
        studentId,
        credentialId: parseOptionalString(data.credentialId),
        type,
        title,
        description: parseOptionalString(data.description),
        purpose: parseOptionalString(data.purpose),
        deliveryMethod,
        status: CredentialRequestStatus.PENDING,
        requesterType,
        requesterId: actor.id,
        employerId,
        institutionId,
      });

      return toCredentialRequestResponse(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new Error('FOREIGN_KEY_CONSTRAINT');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
        throw new Error('DATABASE_SCHEMA_MISMATCH');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error('RELATED_RECORD_NOT_FOUND');
      }
      throw error;
    }
  }

  async getCredentialRequestById(
    actorUserId: string,
    requestId: string,
  ): Promise<CredentialRequestResponseDto | null> {
    const actor = await credentialRequestRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }

    const request = await credentialRequestRepository.getCredentialRequestById(requestId);
    if (!request) {
      return null;
    }

    const visible = this.buildListScopeWhere(actor, { studentId: request.studentId });
    const scoped = await credentialRequestRepository.listCredentialRequests(
      {
        AND: [visible, { id: requestId }],
      },
      0,
      1,
    );

    if (scoped.length === 0) {
      throw new Error('FORBIDDEN_SCOPE');
    }

    return toCredentialRequestResponse(request);
  }

  async updateCredentialRequestStatus(
    actorUserId: string,
    requestId: string,
    data: UpdateCredentialRequestStatusDto,
  ): Promise<CredentialRequestResponseDto> {
    const actor = await credentialRequestRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }

    const target = await credentialRequestRepository.getCredentialRequestScopeById(requestId);
    if (!target) {
      throw new Error('REQUEST_NOT_FOUND');
    }

    const status = data.status as CredentialRequestStatus;
    const providedCredentialId = parseOptionalString(data.credentialId);
    if (status === CredentialRequestStatus.PENDING) {
      throw new Error('INVALID_STATUS_TRANSITION');
    }

    if (actor.role === Role.STUDENT) {
      const canAccess = target.studentId === actor.id || target.requesterId === actor.id;
      if (!canAccess) {
        throw new Error('FORBIDDEN_SCOPE');
      }
      if (status !== CredentialRequestStatus.CANCELLED) {
        throw new Error('FORBIDDEN_STATUS_FOR_ROLE');
      }
      if (target.status !== CredentialRequestStatus.PENDING) {
        throw new Error('CANNOT_CANCEL_NON_PENDING');
      }

      const updatedByStudent = await credentialRequestRepository.updateCredentialRequestStatus(requestId, {
        status,
        processedById: null,
        processedAt: null,
        rejectionReason: null,
      });

      return toCredentialRequestResponse(updatedByStudent);
    }

    if (actor.role !== Role.ADMIN && !this.isInstitutionScopedRole(actor.role)) {
      throw new Error('FORBIDDEN_ROLE');
    }

    if (this.isInstitutionScopedRole(actor.role)) {
      if (!actor.institutionId) {
        throw new Error('INSTITUTION_CONTEXT_MISSING');
      }
      const targetInstitutionId = target.institutionId ?? target.student.institutionId;
      if (!targetInstitutionId || targetInstitutionId !== actor.institutionId) {
        throw new Error('FORBIDDEN_SCOPE');
      }
    }

    if (status === CredentialRequestStatus.REJECTED && !parseOptionalString(data.rejectionReason)) {
      throw new Error('REJECTION_REASON_REQUIRED');
    }

    const completionCredentialId =
      status === CredentialRequestStatus.COMPLETED
        ? providedCredentialId ?? target.credentialId
        : null;
    if (status === CredentialRequestStatus.COMPLETED && !completionCredentialId) {
      throw new Error('CREDENTIAL_ID_REQUIRED_FOR_COMPLETION');
    }

    const processedStatuses = new Set<CredentialRequestStatus>([
      CredentialRequestStatus.APPROVED,
      CredentialRequestStatus.COMPLETED,
      CredentialRequestStatus.REJECTED,
      CredentialRequestStatus.CANCELLED,
    ]);

    const updated = await credentialRequestRepository.updateCredentialRequestStatus(requestId, {
      status,
      processedById: processedStatuses.has(status) ? actor.id : null,
      processedAt: processedStatuses.has(status) ? new Date() : null,
      rejectionReason: status === CredentialRequestStatus.REJECTED
        ? parseOptionalString(data.rejectionReason)
        : null,
      ...(status === CredentialRequestStatus.COMPLETED
        ? { credentialId: completionCredentialId }
        : Object.prototype.hasOwnProperty.call(data, 'credentialId')
          ? { credentialId: providedCredentialId }
          : {}),
    });

    return toCredentialRequestResponse(updated);
  }
}
