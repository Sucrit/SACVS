import { Request, Response } from 'express';
import { UserService } from '../service/user.service';
import { asyncHandler } from '../utils/asyncHandler';

const userService = new UserService();

export const getUsers = asyncHandler(async (_req: Request & { auth?: { userId?: string } }, res: Response) => {
  const users = await userService.getAllUsers();
  res.json(users);
});

export const createUser = asyncHandler(async (req: Request & { auth?: { userId?: string } }, res: Response) => {
  const clerkIdFromAuth = req.auth?.userId;
  const payload = { ...req.body };
  if (!payload.clerkId && clerkIdFromAuth) payload.clerkId = clerkIdFromAuth;

  const user = await userService.createUser(payload);
  res.status(201).json(user);
});

export const deleteUser = asyncHandler(async (req: Request & { auth?: { userId?: string } }, res: Response) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const user = await userService.deleteUser(id);
  res.json(user);
});

export const UserController = {
  getUsers,
  createUser,
  deleteUser,
};