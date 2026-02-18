import { UserRepository, User } from '../repository/user.repository';
import { NotificationRepository } from '../repository/notification.repository';
import { AuditLogRepository } from '../repository/audit.repository';
import { CreateUserDto, UserResponseDto, UpdateProfileDto, UserListQuery, PaginatedResponse } from '../dto/user.dto';
import { Role, Status, AuditAction, AuditSeverity, NotificationType } from '@prisma/client';
import { logAudit, AuditContext } from '../utils/logger';

const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();
const auditLogRepository = new AuditLogRepository();

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

  private toUserResponse(user: User): UserResponseDto {
    const { id, clerkId, email, fullName, role, status, approvedById, approvedAt, lastLoginAt, createdAt, updatedAt, profile } = user;
    return {
      id, clerkId, email, fullName, role, status,
      approvedById, approvedAt, lastLoginAt, createdAt, updatedAt,
      profile: profile ? {
        id: profile.id,
        userId: profile.userId,
        studentNumber: profile.studentNumber,
        address: profile.address,
        phone: profile.phone,
        courseOfStudy: profile.courseOfStudy,
        yearLevel: profile.yearLevel,
        department: profile.department,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      } : null
    };
  }

  // Get all users with pagination and filters
  async getAllUsers(query?: UserListQuery): Promise<PaginatedResponse<UserResponseDto>> {
    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 20));
    const skip = (page - 1) * limit;

    const { data, total } = await userRepository.list({
      role: query?.role,
      status: query?.status,
      search: query?.search,
      skip,
      take: limit,
    });

    return {
      data: data.map(u => this.toUserResponse(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get current user by clerk ID
  async getCurrentUser(clerkId: string, isAdminAuth = false): Promise<UserResponseDto> {
    if (!clerkId || typeof clerkId !== 'string') {
      throw { status: 400, message: 'ClerkId is required and must be a string.' };
    }

    if (isAdminAuth) {
      const now = new Date();
      return {
        id: `admin:${clerkId}`,
        clerkId,
        email: null,
        fullName: null,
        role: Role.ADMIN,
        status: Status.APPROVED,
        approvedById: clerkId,
        approvedAt: now,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
        profile: null,
      };
    }

    const existing = await userRepository.findByClerkId(clerkId);
    if (!existing) {
      throw { status: 404, message: 'User not found.' };
    }

    // Update last login
    await userRepository.update(existing.id, { lastLoginAt: new Date() });

    return this.toUserResponse(existing);
  }

  // Get user by ID
  async getUserById(id: string): Promise<UserResponseDto> {
    if (!id) throw { status: 400, message: 'User id is required.' };
    const user = await userRepository.findById(id);
    if (!user) throw { status: 404, message: 'User not found.' };
    return this.toUserResponse(user);
  }

  // Self-registration: STUDENT/REGISTRAR only, always PENDING
  async createSelfUser(clerkId: string, dto: CreateUserDto, auditCtx?: AuditContext): Promise<UserResponseDto> {
    if (!clerkId || typeof clerkId !== 'string') {
      throw { status: 400, message: 'ClerkId is required and must be a string.' };
    }

    if (dto.role && this.normalizeRole(String(dto.role)) === Role.ADMIN) {
      throw { status: 403, message: 'Admin accounts are managed in Clerk and are not stored in the user database.' };
    }

    const existing = await userRepository.findByClerkId(clerkId);
    if (existing) {
      return this.toUserResponse(existing);
    }

    const normalizedRequestedRole = this.normalizeRole(String(dto.role || ''));
    const role = normalizedRequestedRole === Role.REGISTRAR ? Role.REGISTRAR : Role.STUDENT;

    const user = await userRepository.create({
      clerkId,
      email: dto.email || null,
      fullName: dto.fullName || null,
      role,
      status: Status.PENDING,
    });

    // Create student profile if student data is provided
    if (role === Role.STUDENT && dto.studentNumber) {
      try {
        await userRepository.createProfile({
          user: { connect: { id: user.id } },
          studentNumber: dto.studentNumber,
          address: dto.address || null,
          phone: dto.phone || null,
          courseOfStudy: dto.courseOfStudy || null,
          yearLevel: dto.yearLevel || null,
          department: dto.department || null,
        });
      } catch (err: any) {
        // If profile creation fails (e.g., duplicate student number), still return user
        if (err?.code !== 'P2002') throw err;
      }
    }

    // Fetch updated user with profile
    const fullUser = await userRepository.findById(user.id);

    await logAudit(AuditAction.USER_CREATED, auditCtx || {}, {
      targetType: 'User',
      targetId: user.id,
      description: `Self-registration as ${role}`,
    });

    return this.toUserResponse(fullUser || user);
  }

  // Admin creates user accounts (student/registrar)
  async createUserByAdmin(actorClerkId: string, data: CreateUserDto, auditCtx?: AuditContext): Promise<UserResponseDto> {
    if (!data.clerkId || typeof data.clerkId !== 'string') {
      throw { status: 400, message: 'ClerkId is required and must be a string.' };
    }

    const existing = await userRepository.findByClerkId(data.clerkId);
    if (existing) {
      throw { status: 409, message: 'User with this Clerk ID already exists.' };
    }

    const role = this.normalizeRole(String(data.role || '')) || Role.STUDENT;
    if (role === Role.ADMIN) {
      throw { status: 400, message: 'Admin accounts are managed in Clerk and should not be created in the user database.' };
    }

    const status = this.normalizeStatus(String(data.status || '')) || Status.APPROVED;
    const isApproved = status === Status.APPROVED;

    const user = await userRepository.create({
      clerkId: data.clerkId,
      email: data.email || null,
      fullName: data.fullName || null,
      role,
      status,
      approvedById: isApproved ? actorClerkId : null,
      approvedAt: isApproved ? new Date() : null,
    });

    // Create student profile if provided
    if (role === Role.STUDENT && data.studentNumber) {
      try {
        await userRepository.createProfile({
          user: { connect: { id: user.id } },
          studentNumber: data.studentNumber,
          address: data.address || null,
          phone: data.phone || null,
          courseOfStudy: data.courseOfStudy || null,
          yearLevel: data.yearLevel || null,
          department: data.department || null,
        });
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err;
      }
    }

    const fullUser = await userRepository.findById(user.id);

    if (isApproved) {
      await notificationRepository.create({
        userId: user.id,
        type: NotificationType.ACCOUNT_APPROVED,
        title: 'Account Approved',
        message: 'Your account has been approved by an administrator. You can now access all features.',
      });
    }

    await logAudit(AuditAction.USER_CREATED, auditCtx || {}, {
      targetType: 'User',
      targetId: user.id,
      description: `Admin created user as ${role} with status ${status}`,
    });

    return this.toUserResponse(fullUser || user);
  }

  // Admin updates account status
  async updateUserStatusByAdmin(actorClerkId: string, id: string, rawStatus: string, auditCtx?: AuditContext): Promise<UserResponseDto> {
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

    // Send notification based on status change
    const notifType = isApproved ? NotificationType.ACCOUNT_APPROVED
      : status === Status.REJECTED ? NotificationType.ACCOUNT_REJECTED
      : null;

    if (notifType) {
      await notificationRepository.create({
        userId: id,
        type: notifType,
        title: isApproved ? 'Account Approved' : 'Account Status Updated',
        message: isApproved
          ? 'Your account has been approved. You can now access your dashboard.'
          : `Your account status has been updated to ${status}.`,
      });
    }

    // Audit log for status change
    const auditAction = isApproved ? AuditAction.USER_APPROVED
      : status === Status.REJECTED ? AuditAction.USER_REJECTED
      : status === Status.SUSPENDED ? AuditAction.USER_SUSPENDED
      : AuditAction.SETTINGS_CHANGED;

    await logAudit(auditAction, auditCtx || {}, {
      targetType: 'User',
      targetId: id,
      description: `Status changed from ${existing.status} to ${status}`,
    });

    return this.toUserResponse(updated);
  }

  // Update user profile
  async updateProfile(userId: string, data: UpdateProfileDto, auditCtx?: AuditContext): Promise<UserResponseDto> {
    if (!userId) throw { status: 400, message: 'User id is required.' };

    const existing = await userRepository.findById(userId);
    if (!existing) throw { status: 404, message: 'User not found.' };

    // Update user-level fields
    const userUpdate: Record<string, any> = {};
    if (data.email !== undefined) userUpdate.email = data.email;
    if (data.fullName !== undefined) userUpdate.fullName = data.fullName;

    if (Object.keys(userUpdate).length > 0) {
      await userRepository.update(userId, userUpdate);
    }

    // Update or create profile
    const profileFields = {
      address: data.address,
      phone: data.phone,
      courseOfStudy: data.courseOfStudy,
      yearLevel: data.yearLevel,
      department: data.department,
    };

    const hasProfileData = Object.values(profileFields).some(v => v !== undefined);
    if (hasProfileData || data.studentNumber) {
      if (existing.profile) {
        const profileUpdate: Record<string, any> = {};
        for (const [key, value] of Object.entries(profileFields)) {
          if (value !== undefined) profileUpdate[key] = value;
        }
        if (data.studentNumber) profileUpdate.studentNumber = data.studentNumber;
        if (Object.keys(profileUpdate).length > 0) {
          await userRepository.updateProfile(userId, profileUpdate);
        }
      } else if (data.studentNumber) {
        await userRepository.createProfile({
          user: { connect: { id: userId } },
          studentNumber: data.studentNumber,
          address: data.address || null,
          phone: data.phone || null,
          courseOfStudy: data.courseOfStudy || null,
          yearLevel: data.yearLevel || null,
          department: data.department || null,
        });
      }
    }

    const updated = await userRepository.findById(userId);
    if (!updated) throw { status: 500, message: 'Failed to retrieve updated user.' };

    await logAudit(AuditAction.SETTINGS_CHANGED, auditCtx || {}, {
      targetType: 'User',
      targetId: userId,
      description: 'Profile updated',
    });

    return this.toUserResponse(updated);
  }

  // Admin only: delete user account
  async deleteUserByAdmin(actorClerkId: string, id: string, auditCtx?: AuditContext): Promise<UserResponseDto> {
    if (!id) throw { status: 400, message: 'User id is required.' };
    if (!actorClerkId || typeof actorClerkId !== 'string') {
      throw { status: 401, message: 'Unauthorized' };
    }

    const existing = await userRepository.findById(id);
    if (!existing) throw { status: 404, message: 'User not found.' };

    const deleted = await userRepository.delete(id);

    await logAudit(AuditAction.USER_DELETED, auditCtx || {}, {
      severity: AuditSeverity.WARNING,
      targetType: 'User',
      targetId: id,
      description: `User deleted (was ${existing.role}/${existing.status})`,
    });

    return this.toUserResponse(deleted);
  }

  // Get user stats  
  async getUserStats(): Promise<{ byRole: Record<string, number>; byStatus: Record<string, number>; total: number }> {
    const [byRole, byStatus] = await Promise.all([
      userRepository.countByRole(),
      userRepository.countByStatus(),
    ]);
    const total = Object.values(byRole).reduce((sum, n) => sum + n, 0);
    return { byRole, byStatus, total };
  }

  // Get audit logs
  async getAuditLogs(options?: {
    action?: string;
    severity?: string;
    actorId?: string;
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
  }): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 50));

    const { data, total } = await auditLogRepository.list({
      action: options?.action as any,
      severity: options?.severity as any,
      actorId: options?.actorId,
      skip: (page - 1) * limit,
      take: limit,
      from: options?.from ? new Date(options.from) : undefined,
      to: options?.to ? new Date(options.to) : undefined,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get notifications for user
  async getNotifications(userId: string, options?: { unreadOnly?: boolean; page?: number; limit?: number }): Promise<PaginatedResponse<any>> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));

    const { data, total } = await notificationRepository.listByUser(userId, {
      unreadOnly: options?.unreadOnly,
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async markNotificationRead(notificationId: string): Promise<any> {
    return notificationRepository.markAsRead(notificationId);
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    return notificationRepository.markAllAsRead(userId);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    return notificationRepository.unreadCount(userId);
  }
}
