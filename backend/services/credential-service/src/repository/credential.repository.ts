import {
  CredentialType,
  CredentialStatus,
  Prisma,
  PrismaClient,
  Role,
  Status,
} from '../../../../db/node_modules/@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ENV } from '../config/env';

if (!ENV.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured for credential-service.');
}

const prismaAdapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: prismaAdapter });

const credentialWithIssuerInclude = {
  issuedBy: {
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      institution: {
        select: {
          institutionName: true,
        },
      },
    },
  },
} satisfies Prisma.CredentialInclude;

type CredentialWithIssuer = Prisma.CredentialGetPayload<{
  include: typeof credentialWithIssuerInclude;
}>;

export class CredentialRepository {
  async getStudentContextById(studentId: string): Promise<{
    id: string;
    role: Role;
    status: Status;
    institutionId: string | null;
  } | null> {
    return prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        role: true,
        status: true,
        institutionId: true,
      },
    });
  }

  async listCredentials(
    where: Prisma.CredentialWhereInput,
    skip: number,
    take: number,
  ): Promise<CredentialWithIssuer[]> {
    return prisma.credential.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: credentialWithIssuerInclude,
    });
  }

  async createCredential(data: Prisma.CredentialUncheckedCreateInput): Promise<CredentialWithIssuer> {
    return prisma.credential.create({
      data,
      include: credentialWithIssuerInclude,
    });
  }

  async getCredentialById(credentialId: string): Promise<CredentialWithIssuer | null> {
    return prisma.credential.findUnique({
      where: { id: credentialId },
      include: credentialWithIssuerInclude,
    });
  }

  async getCredentialScopeById(credentialId: string): Promise<{
    id: string;
    title: string;
    type: CredentialType;
    status: CredentialStatus;
    issuedById: string;
    studentId: string;
    issuedDate: Date | null;
    student: {
      institutionId: string | null;
    };
  } | null> {
    return prisma.credential.findUnique({
      where: { id: credentialId },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        issuedById: true,
        studentId: true,
        issuedDate: true,
        student: {
          select: {
            institutionId: true,
          },
        },
      },
    });
  }

  async updateCredential(
    credentialId: string,
    data: Prisma.CredentialUncheckedUpdateInput,
  ): Promise<CredentialWithIssuer> {
    return prisma.credential.update({
      where: { id: credentialId },
      data,
      include: credentialWithIssuerInclude,
    });
  }
}
