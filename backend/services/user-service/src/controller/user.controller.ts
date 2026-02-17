import { Request, Response } from 'express';
import { UserService } from '../service/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { CreateUserDto, UpdateUserStatusDto } from '../dto/user.dto';

const userService = new UserService();
type AuthenticatedRequest = Request & { auth?: { userId?: string; isAdminAuth?: boolean } };

export const getUsers = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const users = await userService.getAllUsers();
  res.json(users);
});

export const createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkIdFromAuth = req.auth?.userId;
  if (!clerkIdFromAuth) throw { status: 401, message: 'Unauthorized' };
  const payload = req.body as CreateUserDto;

  const user = await userService.createSelfUser(
    clerkIdFromAuth,
    payload?.role ? String(payload.role) : undefined,
    Boolean(req.auth?.isAdminAuth)
  );
  res.status(201).json(user);
});

export const getCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const clerkIdFromAuth = req.auth?.userId;
  if (!clerkIdFromAuth) throw { status: 401, message: 'Unauthorized' };
  const user = await userService.getCurrentUser(clerkIdFromAuth, Boolean(req.auth?.isAdminAuth));
  res.json(user);
});

export const adminCreateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorClerkId = req.auth?.userId;
  if (!actorClerkId) throw { status: 401, message: 'Unauthorized' };
  const payload = req.body as CreateUserDto;
  const user = await userService.createUserByAdmin(actorClerkId, payload);
  res.status(201).json(user);
});

export const updateUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorClerkId = req.auth?.userId;
  if (!actorClerkId) throw { status: 401, message: 'Unauthorized' };
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const payload = req.body as UpdateUserStatusDto;
  const user = await userService.updateUserStatusByAdmin(actorClerkId, id, String(payload?.status || ''));
  res.json(user);
});

export const deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actorClerkId = req.auth?.userId;
  if (!actorClerkId) throw { status: 401, message: 'Unauthorized' };
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const user = await userService.deleteUserByAdmin(actorClerkId, id);
  res.json(user);
});

export const UserController = {
  getUsers,
  getCurrentUser,
  createUser,
  adminCreateUser,
  updateUserStatus,
  deleteUser,
};
