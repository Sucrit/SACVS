import { Request, Response } from 'express';
import { UserRepository } from '../repository/user.repository';
import { asyncHandler } from '../utils/asyncHandler';

const userRepository = new UserRepository();

export const getUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await userRepository.list();
  res.json(users);
});

export const createUser = (req: Request, res: Response) => {
  const userData = req.body;
  res.status(201).json({ message: 'User created (not implemented)', user: userData });
};

export const UserController = {
  getUsers,
  createUser,
};