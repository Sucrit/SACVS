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

export const UserController = {
  getUsers,
  createUser,
};