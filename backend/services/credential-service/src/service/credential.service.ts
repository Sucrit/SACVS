import { Prisma, Role } from '../../../../db/node_modules/@prisma/client';
import { CredentialRepository } from '../repository/credential.repository';
import {
  CreateCredentialDto,
  ListCredentialsQueryDto,
  UpdateCredentialStatusDto,
} from '../dto/credential.dto';

const credentialRepository = new CredentialRepository();

export interface CredentialListActor {
  userId: string;
  role?: `${Role}`;
}

export class CredentialService {
  private buildListWhere(
    actor: CredentialListActor,
    query: ListCredentialsQueryDto,
  ): Prisma.CredentialWhereInput {
    const where: Prisma.CredentialWhereInput = {};

    if (query.studentId) {
      where.studentId = query.studentId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.type) {
      where.type = query.type;
    }

    if (query.scope === 'mine') {
      if (actor.role === Role.STUDENT) {
        return { ...where, studentId: actor.userId };
      }
      if (actor.role === Role.INSTITUTION || actor.role === Role.ADMIN) {
        return { ...where, issuedById: actor.userId };
      }
      return { ...where, id: '__no_results__' };
    }

    if (actor.role === Role.ADMIN) {
      return where;
    }

    if (actor.role === Role.STUDENT) {
      return { ...where, studentId: actor.userId };
    }

    if (actor.role === Role.INSTITUTION) {
      return { ...where, issuedById: actor.userId };
    }

    return { ...where, id: '__no_results__' };
  }

  async listCredentials(actor: CredentialListActor, query: ListCredentialsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 100));
    const skip = (page - 1) * pageSize;
    const where = this.buildListWhere(actor, query);

    return credentialRepository.listCredentials(where, skip, pageSize);
  }

  // Create a new credential
  async createCredential(data: CreateCredentialDto) {
    return credentialRepository.createCredential(data);
  }

  // Get a credential by ID
  async getCredentialById(credentialId: string) {
    return credentialRepository.getCredentialById(credentialId);
  }

  // Update credential status
  async updateCredentialStatus(credentialId: string, statusData: UpdateCredentialStatusDto) {
    return credentialRepository.updateCredentialStatus(credentialId, statusData.status);
  }
}
