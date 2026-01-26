import { Router } from 'express';
import { UserController } from '../api/user.controller';

const router = Router();

router.get('/users', UserController.getUsers);
router.post('/users', UserController.createUser);

export default router;
