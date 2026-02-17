import express from 'express';
import { createCredential, getCredentials, getCredential, getStudentCredentials } from '../controller/credential.controller';
import { healthCheck } from '../controller/health.controller';

const router = express.Router();

router.get('/health', healthCheck);
router.post('/', createCredential);
router.get('/student', getStudentCredentials);
router.get('/', getCredentials);
router.get('/:id', getCredential);

export default router;
