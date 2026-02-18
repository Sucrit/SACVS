import { CreateUserDto, UpdateUserStatusDto, UpsertStudentProfileDto } from '../dto/user.dto';
import { UserRepository } from '../repository/user.repository';
import { signAccessToken } from '../utils/token';
import { ENV } from '../config/env';

const userRepository = new UserRepository();

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export class UserService {
  async listUsers() {
    return userRepository.listUsers();
  }

  async register(data: { email: string; fullName?: string | null }) {
    const email = normalizeEmail(data.email);
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const user = await userRepository.createUser({
      email,
      fullName: data.fullName ?? null,
      role: 'STUDENT',
    });

    return {
      message: 'Registration request created. Verify OTP to continue.',
      requiresOtp: true,
      otpBypassCode: ENV.OTP_BYPASS_CODE,
      user,
    };
  }

  async login(data: { email: string }) {
    const email = normalizeEmail(data.email);
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return {
      message: 'OTP challenge created.',
      requiresOtp: true,
      otpBypassCode: ENV.OTP_BYPASS_CODE,
      email,
    };
  }

  async verifyOtp(data: { email: string; otp: string }) {
    if (data.otp !== ENV.OTP_BYPASS_CODE) {
      throw new Error('INVALID_OTP');
    }

    const email = normalizeEmail(data.email);
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    });

    return { token, user };
  }

  async createUser(data: CreateUserDto) {
    return userRepository.createUser(data);
  }

  async getUserById(userId: string) {
    return userRepository.getUserById(userId);
  }

  async getCurrentUser(userId: string) {
    return userRepository.getUserById(userId);
  }

  async upsertStudentProfileByUserId(userId: string, data: UpsertStudentProfileDto) {
    return userRepository.upsertStudentProfileByUserId(userId, data);
  }

  async updateUserStatus(userId: string, data: UpdateUserStatusDto, actorId?: string | null) {
    return userRepository.updateUserStatus(userId, data.status, actorId);
  }
}
