import express from 'express';
import { createCredential, getCredentials, getCredential } from '../controller/credential.controller';

const router = express.Router();

router.get('/health', (_req, res) => res.json({ status: 'OK', message: 'Credentials service is up' }));
router.post('/', createCredential);
router.get('/', getCredentials);
router.get('/:id', getCredential);

export default router;
