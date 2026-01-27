import { Role } from '@prisma/client';
import { UserRepository } from '../repository/user.repository';
import { CreateUserDto, UserResponseDto } from '../dto/user.dto';
import { Prisma } from '@prisma/client';
type UserEntity = Prisma.UserGetPayload<{}>;

const userRepository = new UserRepository();

export class UserService {
  private toUserResponse(user: UserEntity): UserResponseDto {
    const { id, clerkId, role, createdAt, updatedAt } = user as any;
    return { id, clerkId, role, createdAt, updatedAt };
  }

  // get all users
  async getAllUsers(): Promise<UserResponseDto[]> {
    const users: UserEntity[] = await userRepository.list();
    return users.map(u => this.toUserResponse(u));
  }

  // create user account
  async createUser(data: CreateUserDto): Promise<UserResponseDto> {
    // DTO validation
    if (!data.clerkId || typeof data.clerkId !== 'string') {
      throw { status: 400, message: 'ClerkId is required and must be a string.' };
    }
    const existing = await userRepository.findByClerkId(data.clerkId);
    if (existing) {
      throw { status: 409, message: 'User with this Clerk ID already exists.' };
    }
    // Create user (no password)
    const user = await userRepository.create({
      clerkId: data.clerkId,
      role: data.role as Role
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