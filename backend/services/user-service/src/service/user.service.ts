import { clerkClient } from '@clerk/express';
import {
  CreateUserDto,
  CompleteStudentOnboardingDto,
  UpdateUserStatusDto,
  UpsertStudentProfileDto,
} from '../dto/user.dto';
import { UserRepository } from '../repository/user.repository';

const userRepository = new UserRepository();

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export class UserService {
  async listUsers() {
    return userRepository.listUsers();
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

  async completeStudentOnboarding(clerkUserId: string, data: CompleteStudentOnboardingDto) {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const primaryEmail = clerkUser.emailAddresses.find(
      entry => entry.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;
    const fallbackEmail = clerkUser.emailAddresses[0]?.emailAddress;
    const resolvedEmail = normalizeEmail(primaryEmail ?? fallbackEmail ?? '');

    if (!resolvedEmail) {
      throw new Error('CLERK_EMAIL_NOT_AVAILABLE');
    }

    return userRepository.upsertStudentOnboardingByClerkUserId(clerkUserId, {
      email: resolvedEmail,
      firstName: data.firstName.trim(),
      middleName: data.middleName?.trim() || null,
      lastName: data.lastName.trim(),
      profile: {
        studentNumber: data.studentNumber,
        street: data.street,
        barangay: data.barangay,
        city: data.city,
        province: data.province,
        zipCode: data.zipCode,
        phone: data.phone,
        courseOfStudy: data.courseOfStudy,
        yearLevel: data.yearLevel,
        department: data.department,
      },
    });
  }

  async updateUserStatus(userId: string, data: UpdateUserStatusDto, actorId?: string | null) {
    return userRepository.updateUserStatus(userId, data.status, actorId);
  }
}
