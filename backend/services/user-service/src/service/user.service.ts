import { UserRepository } from '../repository/user.repository';
import { CreateUserDto, UserResponseDto } from '../dto/user.dto';
import { Prisma, Role } from '@prisma/client';
type UserEntity = Prisma.UserGetPayload<{}>;

const userRepository = new UserRepository();

export class UserService {
  private normalizeRole(rawRole?: string): Role | undefined {
    if (!rawRole || typeof rawRole !== 'string') return undefined;
    const upper = rawRole.trim().toUpperCase();
    if (Object.values(Role).includes(upper as Role)) return upper as Role;
    return undefined;
  }

  private toUserResponse(user: UserEntity): UserResponseDto {
    const { id, clerkId, role, createdAt, updatedAt } = user;
    return { id, clerkId, role, createdAt, updatedAt };
  }

  // get all users
  async getAllUsers(): Promise<UserResponseDto[]> {
    const users: UserEntity[] = await userRepository.list();
    return users.map(u => this.toUserResponse(u));
  }

  // create user account
  async createUser(data: CreateUserDto): Promise<UserResponseDto> {
    if (!data.clerkId || typeof data.clerkId !== 'string') {
      throw { status: 400, message: 'ClerkId is required and must be a string.' };
    }
    const existing = await userRepository.findByClerkId(data.clerkId);
    if (existing) {
      throw { status: 409, message: 'User with this Clerk ID already exists.' };
    }
    const role = this.normalizeRole(data.role);
    // db 
    const user = await userRepository.create({
      clerkId: data.clerkId,
      ...(role ? { role } : {}),
    });
    return this.toUserResponse(user);
  }

  // delete user account
  async deleteUser(id: string): Promise<UserResponseDto> {
    if (!id) throw { status: 400, message: 'User id is required.' };
    const deleted = await userRepository.delete(id);
    return this.toUserResponse(deleted);
  }
}
