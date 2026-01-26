import { UserRepository } from '../repository/user.repository';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';

const userRepository = new UserRepository();

export class UserService {
  async getAllUsers() {
    return userRepository.list();
  }

  async createUser(data: CreateUserDto) {
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
    // Check for existing user (by email or username)
    const existing = await userRepository.findByEmail(data.email) || await userRepository.findByUsername(data.username);
    if (existing) {
      throw { status: 409, message: 'User with this email or username already exists.' };
    }
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    // Create user
    const user = await userRepository.create({
      username: data.username,
      email: data.email,
      password: hashedPassword,
    });
    // Remove password from result
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

}