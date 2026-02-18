import express from 'express';
import { UserController } from '../controller/user.controller';

const router = express.Router();
const userController = new UserController();

// Route for creating a user
router.post('/', userController.createUser.bind(userController));

// Route for getting a user by ID
router.get('/:id', userController.getUserById.bind(userController));

// Route for updating user status
router.put('/:id/status', userController.updateUserStatus.bind(userController));

export default router;