import { Prisma, CredentialStatus, CredentialType, CredentialRequestStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { CredentialListQuery } from '../dto/credential.dto';

export type Credential = Prisma.CredentialGetPayload<{}>;
export type CredentialRequest = Prisma.CredentialRequestGetPayload<{}>;

// ─── Credential Repository ───────────────────────────────────

export class CredentialRepository {
  async create(data: Prisma.CredentialCreateInput): Promise<Credential> {
    return prisma.credential.create({ data });
  }

  async findById(id: string): Promise<Credential | null> {
    return prisma.credential.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.CredentialUpdateInput): Promise<Credential> {
    return prisma.credential.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.credential.delete({ where: { id } });
  }

  async list(query: CredentialListQuery = {}): Promise<{ data: Credential[]; total: number }> {
    const { status, type, studentId, search, page = 1, limit = 20 } = query;
    const where: Prisma.CredentialWhereInput = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (studentId) where.studentId = studentId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.credential.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.credential.count({ where }),
    ]);

    return { data, total };
  }

  async listByStudentId(studentId: string): Promise<Credential[]> {
    return prisma.credential.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async countByStatus(): Promise<Record<string, number>> {
    const results = await prisma.credential.groupBy({
      by: ['status'],
      _count: true,
    });
    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r.status] = r._count;
    }
    return counts;
  }

  async countByType(): Promise<Record<string, number>> {
    const results = await prisma.credential.groupBy({
      by: ['type'],
      _count: true,
    });
    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r.type] = r._count;
    }
    return counts;
  }
}

// ─── Credential Request Repository ──────────────────────────

export class CredentialRequestRepository {
  async create(data: Prisma.CredentialRequestCreateInput): Promise<CredentialRequest> {
    return prisma.credentialRequest.create({ data });
  }

  async findById(id: string): Promise<CredentialRequest | null> {
    return prisma.credentialRequest.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.CredentialRequestUpdateInput): Promise<CredentialRequest> {
    return prisma.credentialRequest.update({ where: { id }, data });
  }

  async listByStudent(studentId: string, page = 1, limit = 20): Promise<{ data: CredentialRequest[]; total: number }> {
    const where = { studentId };
    const [data, total] = await Promise.all([
      prisma.credentialRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.credentialRequest.count({ where }),
    ]);
    return { data, total };
  }

  async listPending(page = 1, limit = 20): Promise<{ data: CredentialRequest[]; total: number }> {
    const where = { status: CredentialRequestStatus.PENDING };
    const [data, total] = await Promise.all([
      prisma.credentialRequest.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.credentialRequest.count({ where }),
    ]);
    return { data, total };
  }

  async listAll(status?: CredentialRequestStatus, page = 1, limit = 20): Promise<{ data: CredentialRequest[]; total: number }> {
    const where: Prisma.CredentialRequestWhereInput = {};
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      prisma.credentialRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.credentialRequest.count({ where }),
    ]);
    return { data, total };
  }

  async countByStatus(): Promise<Record<string, number>> {
    const results = await prisma.credentialRequest.groupBy({
      by: ['status'],
      _count: true,
    });
    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r.status] = r._count;
    }
    return counts;
  }
}
