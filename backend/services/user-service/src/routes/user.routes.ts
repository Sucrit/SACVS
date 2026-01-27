import { Router } from 'express';
import { UserController } from '../controller/user.controller';
import { healthCheck } from '../controller/health.controller';

const router = Router();

router.get('/users/health', healthCheck);
router.get('/users', UserController.getUsers);
router.post('/users', UserController.createUser);
router.patch('/users/:id', UserController.updateUser);
router.delete('/users/:id', UserController.deleteUser);

export default router;
