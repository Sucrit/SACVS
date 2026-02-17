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

  private async requireApprovedAdmin(actorClerkId: string): Promise<UserEntity> {
    const actor = await userRepository.findByClerkId(actorClerkId);
    if (!actor || actor.role !== Role.ADMIN || actor.status !== Status.APPROVED) {
      throw { status: 403, message: 'Admin privileges required.' };
    }
    return actor;
  }

  // get all users
  async getAllUsers(): Promise<UserResponseDto[]> {
    const users: UserEntity[] = await userRepository.list();
    return users.map(u => this.toUserResponse(u));
  }

  async getCurrentUser(clerkId: string): Promise<UserResponseDto> {
    if (!clerkId || typeof clerkId !== 'string') {
      throw { status: 400, message: 'ClerkId is required and must be a string.' };
    }
    const existing = await userRepository.findByClerkId(clerkId);
    if (!existing) {
      throw { status: 404, message: 'User not found.' };
    }
    return this.toUserResponse(existing);
  }

  // self-registration: always STUDENT and PENDING
  async createSelfUser(clerkId: string): Promise<UserResponseDto> {
    if (!clerkId || typeof clerkId !== 'string') {
      throw { status: 400, message: 'ClerkId is required and must be a string.' };
    }

    const existing = await userRepository.findByClerkId(clerkId);
    if (existing) {
      return this.toUserResponse(existing);
    }

    const user = await userRepository.create({
      clerkId,
      role: Role.STUDENT,
      status: Status.PENDING,
    });

    return this.toUserResponse(user);
  }

  // admin creates user accounts (student/registrar/admin)
  async createUserByAdmin(actorClerkId: string, data: CreateUserDto): Promise<UserResponseDto> {
    const admin = await this.requireApprovedAdmin(actorClerkId);

    if (!data.clerkId || typeof data.clerkId !== 'string') {
      throw { status: 400, message: 'ClerkId is required and must be a string.' };
    }

    const existing = await userRepository.findByClerkId(data.clerkId);
    if (existing) {
      throw { status: 409, message: 'User with this Clerk ID already exists.' };
    }

    const role = this.normalizeRole(data.role) || Role.STUDENT;
    const status = this.normalizeStatus(data.status) || Status.APPROVED;
    const isApproved = status === Status.APPROVED;

    const user = await userRepository.create({
      clerkId: data.clerkId,
      role,
      status,
      approvedById: isApproved ? admin.id : null,
      approvedAt: isApproved ? new Date() : null,
    });

    return this.toUserResponse(user);
  }

  // admin updates account status
  async updateUserStatusByAdmin(actorClerkId: string, id: string, rawStatus: string): Promise<UserResponseDto> {
    const admin = await this.requireApprovedAdmin(actorClerkId);

    if (!id) throw { status: 400, message: 'User id is required.' };
    const status = this.normalizeStatus(rawStatus);
    if (!status) throw { status: 400, message: 'Valid status is required.' };

    const existing = await userRepository.findById(id);
    if (!existing) throw { status: 404, message: 'User not found.' };

    const isApproved = status === Status.APPROVED;
    const updated = await userRepository.update(id, {
      status,
      approvedById: isApproved ? admin.id : null,
      approvedAt: isApproved ? new Date() : null,
    });

    return this.toUserResponse(updated);
  }

  // admin only: delete user account
  async deleteUserByAdmin(actorClerkId: string, id: string): Promise<UserResponseDto> {
    await this.requireApprovedAdmin(actorClerkId);
    if (!id) throw { status: 400, message: 'User id is required.' };
    const deleted = await userRepository.delete(id);
    return this.toUserResponse(deleted);
  }
}
