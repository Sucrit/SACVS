import { UserRepository } from '../repository/user.repository';
import { CreateUserDto, UserResponseDto } from '../dto/user.dto';
import { Prisma, Role, Status } from '@prisma/client';
type UserEntity = Prisma.UserGetPayload<{}>;

const userRepository = new UserRepository();

export class UserService {
  private normalizeRole(rawRole?: string): Role | undefined {
    if (!rawRole || typeof rawRole !== 'string') return undefined;
    const upper = rawRole.trim().toUpperCase();
    if (Object.values(Role).includes(upper as Role)) return upper as Role;
    return undefined;
  }

  private normalizeStatus(rawStatus?: string): Status | undefined {
    if (!rawStatus || typeof rawStatus !== 'string') return undefined;
    const upper = rawStatus.trim().toUpperCase();
    if (Object.values(Status).includes(upper as Status)) return upper as Status;
    return undefined;
  }

  private toUserResponse(user: UserEntity): UserResponseDto {
    const { id, clerkId, role, status, approvedById, approvedAt, createdAt, updatedAt } = user;
    return { id, clerkId, role, status, approvedById, approvedAt, createdAt, updatedAt };
  }

  // get all users
  async getAllUsers(): Promise<UserResponseDto[]> {
    const users: UserEntity[] = await userRepository.list();
    return users.map(u => this.toUserResponse(u));
  }

  async getCurrentUser(clerkId: string, isAdminAuth = false): Promise<UserResponseDto> {
    if (!clerkId || typeof clerkId !== 'string') {
      throw { status: 400, message: 'ClerkId is required and must be a string.' };
    }

    if (isAdminAuth) {
      const now = new Date();
      return {
        id: `admin:${clerkId}`,
        clerkId,
        role: Role.ADMIN,
        status: Status.APPROVED,
        approvedById: clerkId,
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      };
    }

    const existing = await userRepository.findByClerkId(clerkId);
    if (!existing) {
      throw { status: 404, message: 'User not found.' };
    }
    return this.toUserResponse(existing);
  }

  // self-registration: STUDENT/REGISTRAR only, always PENDING
  async createSelfUser(clerkId: string, requestedRole?: string, isAdminAuth = false): Promise<UserResponseDto> {
    if (!clerkId || typeof clerkId !== 'string') {
      throw { status: 400, message: 'ClerkId is required and must be a string.' };
    }

    if (isAdminAuth) {
      throw { status: 403, message: 'Admin accounts are managed in Clerk and are not stored in the user database.' };
    }

    const existing = await userRepository.findByClerkId(clerkId);
    if (existing) {
      return this.toUserResponse(existing);
    }

    const normalizedRequestedRole = this.normalizeRole(requestedRole);
    if (normalizedRequestedRole === Role.ADMIN) {
      throw { status: 403, message: 'Admin accounts cannot be self-requested.' };
    }

    const role = normalizedRequestedRole === Role.REGISTRAR ? Role.REGISTRAR : Role.STUDENT;

    const user = await userRepository.create({
      clerkId,
      role,
      status: Status.PENDING,
    });

    return this.toUserResponse(user);
  }

  // admin creates user accounts (student/registrar)
  async createUserByAdmin(actorClerkId: string, data: CreateUserDto): Promise<UserResponseDto> {
    if (!data.clerkId || typeof data.clerkId !== 'string') {
      throw { status: 400, message: 'ClerkId is required and must be a string.' };
    }

    const existing = await userRepository.findByClerkId(data.clerkId);
    if (existing) {
      throw { status: 409, message: 'User with this Clerk ID already exists.' };
    }

    const role = this.normalizeRole(data.role) || Role.STUDENT;
    if (role === Role.ADMIN) {
      throw { status: 400, message: 'Admin accounts are managed in Clerk and should not be created in the user database.' };
    }

    const status = this.normalizeStatus(data.status) || Status.APPROVED;
    const isApproved = status === Status.APPROVED;

    const user = await userRepository.create({
      clerkId: data.clerkId,
      role,
      status,
      approvedById: isApproved ? actorClerkId : null,
      approvedAt: isApproved ? new Date() : null,
    });

    return this.toUserResponse(user);
  }

  // admin updates account status
  async updateUserStatusByAdmin(actorClerkId: string, id: string, rawStatus: string): Promise<UserResponseDto> {
    if (!id) throw { status: 400, message: 'User id is required.' };
    const status = this.normalizeStatus(rawStatus);
    if (!status) throw { status: 400, message: 'Valid status is required.' };

    const existing = await userRepository.findById(id);
    if (!existing) throw { status: 404, message: 'User not found.' };

    const isApproved = status === Status.APPROVED;
    const updated = await userRepository.update(id, {
      status,
      approvedById: isApproved ? actorClerkId : null,
      approvedAt: isApproved ? new Date() : null,
    });

    return this.toUserResponse(updated);
  }

  // admin only: delete user account
  async deleteUserByAdmin(actorClerkId: string, id: string): Promise<UserResponseDto> {
    if (!id) throw { status: 400, message: 'User id is required.' };
    if (!actorClerkId || typeof actorClerkId !== 'string') {
      throw { status: 401, message: 'Unauthorized' };
    }
    const deleted = await userRepository.delete(id);
    return this.toUserResponse(deleted);
  }
}
