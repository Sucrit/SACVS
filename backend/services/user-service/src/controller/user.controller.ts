import { Request, Response } from 'express';
import { UserService } from '../service/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { CreateUserDto, UpdateUserStatusDto, UpdateProfileDto, UserListQuery } from '../dto/user.dto';
import { AuditContext } from '../utils/logger';
import { Role } from '@prisma/client';

const userService = new UserService();
type AuthenticatedRequest = Request & { auth?: { userId?: string; isAdminAuth?: boolean } };

function extractAuditContext(req: AuthenticatedRequest): AuditContext {
  return {
    actorId: undefined, // resolved in service if needed
    actorEmail: undefined,
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || undefined,
    userAgent: req.headers['user-agent'] || undefined,
  };
}

export const getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query: UserListQuery = {
    role: req.query.role ? (String(req.query.role).toUpperCase() as Role) : undefined,
    status: req.query.status ? (String(req.query.status).toUpperCase() as any) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  };
  const result = await userService.getAllUsers(query);
  res.json(result);
});

export const createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkIdFromAuth = req.auth?.userId;
  if (!clerkIdFromAuth) throw { status: 401, message: 'Unauthorized' };

  if (Boolean(req.auth?.isAdminAuth)) {
    throw { status: 403, message: 'Admin accounts are managed in Clerk and are not stored in the user database.' };
  }

  const payload = req.body as CreateUserDto;
  const user = await userService.createSelfUser(
    clerkIdFromAuth,
    { ...payload, clerkId: clerkIdFromAuth },
    extractAuditContext(req)
  );
  res.status(201).json(user);
});

export const getCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkIdFromAuth = req.auth?.userId;
  if (!clerkIdFromAuth) throw { status: 401, message: 'Unauthorized' };
  const user = await userService.getCurrentUser(clerkIdFromAuth, Boolean(req.auth?.isAdminAuth));
  res.json(user);
});

export const getUserById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const user = await userService.getUserById(id);
  res.json(user);
});

export const adminCreateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorClerkId = req.auth?.userId;
  if (!actorClerkId) throw { status: 401, message: 'Unauthorized' };
  const payload = req.body as CreateUserDto;
  const user = await userService.createUserByAdmin(actorClerkId, payload, extractAuditContext(req));
  res.status(201).json(user);
});

export const updateUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorClerkId = req.auth?.userId;
  if (!actorClerkId) throw { status: 401, message: 'Unauthorized' };
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const payload = req.body as UpdateUserStatusDto;
  const user = await userService.updateUserStatusByAdmin(actorClerkId, id, String(payload?.status || ''), extractAuditContext(req));
  res.json(user);
});

export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkIdFromAuth = req.auth?.userId;
  if (!clerkIdFromAuth) throw { status: 401, message: 'Unauthorized' };

  // Resolve the user ID from clerk ID
  const currentUser = await userService.getCurrentUser(clerkIdFromAuth, Boolean(req.auth?.isAdminAuth));
  const payload = req.body as UpdateProfileDto;
  const user = await userService.updateProfile(currentUser.id, payload, extractAuditContext(req));
  res.json(user);
});

export const adminUpdateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorClerkId = req.auth?.userId;
  if (!actorClerkId) throw { status: 401, message: 'Unauthorized' };
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const payload = req.body as UpdateProfileDto;
  const user = await userService.updateProfile(id, payload, extractAuditContext(req));
  res.json(user);
});

export const deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorClerkId = req.auth?.userId;
  if (!actorClerkId) throw { status: 401, message: 'Unauthorized' };
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const user = await userService.deleteUserByAdmin(actorClerkId, id, extractAuditContext(req));
  res.json(user);
});

export const getUserStats = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const stats = await userService.getUserStats();
  res.json(stats);
});

export const getAuditLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await userService.getAuditLogs({
    action: req.query.action ? String(req.query.action) : undefined,
    severity: req.query.severity ? String(req.query.severity) : undefined,
    actorId: req.query.actorId ? String(req.query.actorId) : undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
  });
  res.json(result);
});

export const getNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkIdFromAuth = req.auth?.userId;
  if (!clerkIdFromAuth) throw { status: 401, message: 'Unauthorized' };
  const currentUser = await userService.getCurrentUser(clerkIdFromAuth, Boolean(req.auth?.isAdminAuth));
  const result = await userService.getNotifications(currentUser.id, {
    unreadOnly: req.query.unreadOnly === 'true',
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const markNotificationRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const notification = await userService.markNotificationRead(id);
  res.json(notification);
});

export const markAllNotificationsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkIdFromAuth = req.auth?.userId;
  if (!clerkIdFromAuth) throw { status: 401, message: 'Unauthorized' };
  const currentUser = await userService.getCurrentUser(clerkIdFromAuth, Boolean(req.auth?.isAdminAuth));
  const count = await userService.markAllNotificationsRead(currentUser.id);
  res.json({ markedRead: count });
});

export const getUnreadCount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkIdFromAuth = req.auth?.userId;
  if (!clerkIdFromAuth) throw { status: 401, message: 'Unauthorized' };
  const currentUser = await userService.getCurrentUser(clerkIdFromAuth, Boolean(req.auth?.isAdminAuth));
  const count = await userService.getUnreadNotificationCount(currentUser.id);
  res.json({ count });
});

export const UserController = {
  getUsers,
  getCurrentUser,
  getUserById,
  createUser,
  adminCreateUser,
  updateUserStatus,
  updateProfile,
  adminUpdateProfile,
  deleteUser,
  getUserStats,
  getAuditLogs,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
};
