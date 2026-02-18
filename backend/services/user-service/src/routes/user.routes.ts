import express from 'express';
import { UserController } from '../controller/user.controller';
import { requireAuth } from '@clerk/express';

const router = express.Router();
const userController = new UserController();

// cretae user
router.post('/', userController.createUser.bind(userController));

// get user by ID
router.get('/:id', requireAuth, userController.getUserById.bind(userController));

// uodfate user status
router.put('/:id/status', requireAuth, userController.updateUserStatus.bind(userController));

export default router;