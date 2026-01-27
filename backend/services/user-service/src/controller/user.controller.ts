import { Request, Response } from 'express';
import { UserService } from '../service/user.service';
import { asyncHandler } from '../utils/asyncHandler';

const userService = new UserService();

export const getUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await userService.getAllUsers();
  res.json(users);
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  res.status(201).json(user);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
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