import {
  Prisma,
  PrismaClient,
  FraudAnalysisJobStatus,
} from '../../../../db/node_modules/@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ENV } from '../config/env';

if (!ENV.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured for ai-interface-service.');
}

const prismaAdapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: prismaAdapter });

export class AnalysisRepository {
  async createAnalysisJob(credentialId: string): Promise<{ id: string }> {
    return prisma.fraudAnalysisJob.create({
      data: {
        credentialId,
        status: FraudAnalysisJobStatus.QUEUED,
      },
      select: {
        id: true,
      },
    });
  }

  async markJobProcessing(jobId: string): Promise<void> {
    await prisma.fraudAnalysisJob.update({
      where: { id: jobId },
      data: {
        status: FraudAnalysisJobStatus.PROCESSING,
        attempts: {
          increment: 1,
        },
      },
    });
  }

  async markJobCompleted(jobId: string, payload: Record<string, unknown>, provider: string): Promise<void> {
    await prisma.fraudAnalysisJob.update({
      where: { id: jobId },
      data: {
        status: FraudAnalysisJobStatus.COMPLETED,
        provider,
        payload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
        completedAt: new Date(),
        error: null,
      },
    });
  }

  async markJobFailed(jobId: string, error: string): Promise<void> {
    await prisma.fraudAnalysisJob.update({
      where: { id: jobId },
      data: {
        status: FraudAnalysisJobStatus.FAILED,
        error,
      },
    });
  }

  async getDuplicateHashStats(fileHash: string, studentId: string, institutionId: string | null): Promise<{
    duplicateCount: number;
    crossStudentReuse: boolean;
    crossInstitutionReuse: boolean;
  }> {
    const matches = await prisma.credential.findMany({
      where: {
        fileHash,
      },
      select: {
        studentId: true,
        student: {
          select: {
            institutionId: true,
          },
        },
      },
    });

    const duplicateCount = matches.length;
    const crossStudentReuse = matches.some(item => item.studentId !== studentId);
    const crossInstitutionReuse = matches.some(
      item => item.student.institutionId && institutionId && item.student.institutionId !== institutionId,
    );

    return {
      duplicateCount,
      crossStudentReuse,
      crossInstitutionReuse,
    };
  }
}

export const analysisRepository = new AnalysisRepository();
