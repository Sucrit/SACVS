import { UserRepository } from '../repository/user.repository';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from '../dto/user.dto';
import { Prisma } from '@prisma/client';
type UserEntity = Prisma.UserGetPayload<{}>;

const userRepository = new UserRepository();

export class UserService {
  private toUserResponse(user: UserEntity): UserResponseDto {
    const { id, username, email, role, createdAt, updatedAt } = user as any;
    return { id, username, email, role, createdAt, updatedAt };
  }

  async getAllUsers(): Promise<UserResponseDto[]> {
    const users: UserEntity[] = await userRepository.list();
    return users.map(u => this.toUserResponse(u));
  }


  async createUser(data: CreateUserDto): Promise<UserResponseDto> {
    // DTO validation
    if (!data.username || typeof data.username !== 'string') {
      throw { status: 400, message: 'Username is required and must be a string.' };
    }
    if (!data.email || typeof data.email !== 'string') {
      throw { status: 400, message: 'Email is required and must be a string.' };
    }
    if (!data.password || typeof data.password !== 'string') {
      throw { status: 400, message: 'Password is required and must be a string.' };
    }
    // check existing email
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw { status: 409, message: 'User with this email already exists.' };
    }
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    // Create user
    const user = await userRepository.create({
      username: data.username,
      email: data.email,
      password: hashedPassword,
    });
    return this.toUserResponse(user);
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<UserResponseDto> {
    if (!id) throw { status: 400, message: 'User id is required.' };

    const updateData: Prisma.UserUpdateInput = {};
    if (data.username && typeof data.username === 'string') updateData.username = data.username;
    if (data.email && typeof data.email === 'string') updateData.email = data.email;
    if (data.password && typeof data.password === 'string') {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const updated = await userRepository.update(id, updateData);
    return this.toUserResponse(updated);
  }

  async deleteUser(id: string): Promise<UserResponseDto> {
    if (!id) throw { status: 400, message: 'User id is required.' };
    const deleted = await userRepository.delete(id);
    return this.toUserResponse(deleted);
  }

}