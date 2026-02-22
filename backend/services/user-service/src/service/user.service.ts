import { clerkClient } from '@clerk/express';
import {
  BulkCreateInstitutionStudentsResultDto,
  CreateInstitutionStudentDto,
  CompleteOrganizationOnboardingDto,
  CreateUserDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UpsertStudentProfileDto,
  UserStatus,
} from '../dto/user.dto';
import { UserRepository } from '../repository/user.repository';

const userRepository = new UserRepository();

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const maybeErrors = (error as { errors?: Array<{ message?: string }> }).errors;
    const first = maybeErrors?.[0]?.message;
    if (typeof first === 'string' && first.trim().length > 0) {
      return first;
    }
  }

  return 'Unknown error';
};

type WithApprover = { approvedById: string | null };

export class UserService {
  private async addApproverNames<T extends WithApprover>(
    records: T[],
  ): Promise<Array<T & { approverName: string | null }>> {
    const approverIds = Array.from(
      new Set(records.map(record => record.approvedById).filter((value): value is string => Boolean(value))),
    );
    const namesById = await userRepository.getUserDisplayNamesByIds(approverIds);

    return records.map(record => ({
      ...record,
      approverName: record.approvedById ? namesById.get(record.approvedById) ?? null : null,
    }));
  }

  private async addApproverName<T extends WithApprover>(
    record: T,
  ): Promise<T & { approverName: string | null }> {
    const [enriched] = await this.addApproverNames([record]);
    return enriched;
  }

  private isClerkUserNotFoundError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('not found') || message.includes('resource_not_found')) {
        return true;
      }
    }

    if (typeof error === 'object' && error !== null) {
      const maybeErrors = (error as { errors?: Array<{ code?: string; message?: string }> }).errors;
      if (Array.isArray(maybeErrors)) {
        return maybeErrors.some(item => {
          const code = (item.code ?? '').toLowerCase();
          const message = (item.message ?? '').toLowerCase();
          return code.includes('not_found') || message.includes('not found');
        });
      }
    }

    return false;
  }

  private async getInstitutionActorContext(actorUserId: string): Promise<{
    id: string;
    institutionId: string;
  }> {
    const actor = await userRepository.getUserContextById(actorUserId);
    if (!actor) {
      throw new Error('ACTOR_NOT_FOUND');
    }
    if (actor.role !== 'INSTITUTION') {
      throw new Error('FORBIDDEN_ROLE');
    }
    if (!actor.institutionId) {
      throw new Error('INSTITUTION_CONTEXT_MISSING');
    }

    return {
      id: actor.id,
      institutionId: actor.institutionId,
    };
  }

  private async createInstitutionStudentForContext(
    institutionId: string,
    actorUserId: string,
    data: CreateInstitutionStudentDto,
  ) {
    const normalizedEmail = normalizeEmail(data.email);
    let createdClerkUserId: string | null = null;

    try {
      const clerkUser = await clerkClient.users.createUser({
        emailAddress: [normalizedEmail],
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        skipPasswordRequirement: true,
        skipPasswordChecks: true,
        publicMetadata: {
          role: 'STUDENT',
          institutionId,
        },
      });
      createdClerkUserId = clerkUser.id;

      return await userRepository.createInstitutionStudentByClerkUserId(
        clerkUser.id,
        institutionId,
        {
          ...data,
          email: normalizedEmail,
        },
        actorUserId,
      );
    } catch (error) {
      if (createdClerkUserId) {
        try {
          await clerkClient.users.deleteUser(createdClerkUserId);
        } catch (cleanupError) {
          console.error('Failed to rollback Clerk user after DB failure:', cleanupError);
        }
      }
      throw error;
    }
  }

  async listUsers() {
    return userRepository.listUsersForAdmin();
  }

  async listInstitutionStudents(actorUserId: string) {
    const actor = await this.getInstitutionActorContext(actorUserId);
    const students = await userRepository.listInstitutionStudents(actor.institutionId);
    return this.addApproverNames(students);
  }

  async createUser(data: CreateUserDto) {
    return userRepository.createUser(data);
  }

  async createInstitutionStudent(actorUserId: string, data: CreateInstitutionStudentDto) {
    const actor = await this.getInstitutionActorContext(actorUserId);
    const student = await this.createInstitutionStudentForContext(actor.institutionId, actor.id, data);
    return this.addApproverName(student);
  }

  async createInstitutionStudentsBulk(
    actorUserId: string,
    students: CreateInstitutionStudentDto[],
  ): Promise<BulkCreateInstitutionStudentsResultDto> {
    const actor = await this.getInstitutionActorContext(actorUserId);
    const failed: BulkCreateInstitutionStudentsResultDto['failed'] = [];
    let created = 0;

    for (let index = 0; index < students.length; index += 1) {
      const student = students[index];
      try {
        await this.createInstitutionStudentForContext(actor.institutionId, actor.id, student);
        created += 1;
      } catch (error) {
        failed.push({
          index,
          email: student.email,
          error: normalizeErrorMessage(error),
        });
      }
    }

    return { created, failed };
  }

  async getUserById(userId: string) {
    return userRepository.getUserByIdForAdmin(userId);
  }

  async getCurrentUser(userId: string) {
    return userRepository.getUserById(userId);
  }

  async upsertStudentProfileByUserId(userId: string, data: UpsertStudentProfileDto) {
    return userRepository.upsertStudentProfileByUserId(userId, data);
  }

  async completeOrganizationOnboarding(clerkUserId: string, data: CompleteOrganizationOnboardingDto) {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const primaryEmail = clerkUser.emailAddresses.find(
      entry => entry.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;
    const fallbackEmail = clerkUser.emailAddresses[0]?.emailAddress;
    const resolvedEmail = normalizeEmail(primaryEmail ?? fallbackEmail ?? '');

    if (!resolvedEmail) {
      throw new Error('CLERK_EMAIL_NOT_AVAILABLE');
    }

    return userRepository.upsertOrganizationOnboardingByClerkUserId(clerkUserId, {
      userEmail: resolvedEmail,
      firstName: data.firstName.trim(),
      middleName: data.middleName?.trim() || null,
      lastName: data.lastName.trim(),
      role: data.role,
      registrationNumber: data.registrationNumber.trim(),
      organizationEmail: normalizeEmail(data.organizationEmail),
      phoneNumber: data.phoneNumber.trim(),
      employer: data.role === 'EMPLOYER'
        ? {
            companyName: data.companyName.trim(),
            taxId: data.taxId.trim(),
          }
        : undefined,
      institution: data.role === 'INSTITUTION'
        ? {
            name: data.name.trim(),
            accreditationNumber: data.accreditationNumber.trim(),
          }
        : undefined,
    });
  }

  async updateInstitutionStudentStatus(
    actorUserId: string,
    studentUserId: string,
    status: UserStatus,
  ) {
    const actor = await this.getInstitutionActorContext(actorUserId);
    const updated = await userRepository.updateInstitutionStudentStatus(
      actor.institutionId,
      studentUserId,
      status,
      actorUserId,
    );

    if (!updated) {
      throw new Error('STUDENT_NOT_FOUND_OR_FORBIDDEN');
    }

    return this.addApproverName(updated);
  }

  async updateInstitutionStudent(
    actorUserId: string,
    studentUserId: string,
    data: CreateInstitutionStudentDto,
  ) {
    const actor = await this.getInstitutionActorContext(actorUserId);
    const updated = await userRepository.updateInstitutionStudent(
      actor.institutionId,
      studentUserId,
      data,
      actorUserId,
    );

    if (!updated) {
      throw new Error('STUDENT_NOT_FOUND_OR_FORBIDDEN');
    }

    return this.addApproverName(updated);
  }

  async deleteInstitutionStudent(actorUserId: string, studentUserId: string) {
    const actor = await this.getInstitutionActorContext(actorUserId);
    const target = await userRepository.getInstitutionStudentIdentity(actor.institutionId, studentUserId);
    if (!target) {
      throw new Error('STUDENT_NOT_FOUND_OR_FORBIDDEN');
    }

    try {
      await clerkClient.users.deleteUser(studentUserId);
    } catch (error) {
      if (!this.isClerkUserNotFoundError(error)) {
        throw new Error('CLERK_DELETE_FAILED');
      }
    }

    const deleted = await userRepository.deleteInstitutionStudentAccount(actor.institutionId, studentUserId);
    if (!deleted) {
      throw new Error('STUDENT_NOT_FOUND_OR_FORBIDDEN');
    }

    return deleted;
  }

  async updateUserStatus(userId: string, data: UpdateUserStatusDto, actorId?: string | null) {
    return userRepository.updateUserStatus(userId, data.status, actorId);
  }

  async updateUserRole(userId: string, data: UpdateUserRoleDto) {
    return userRepository.updateUserRole(userId, data.role);
  }
}
