import express from 'express';
import { CredentialController } from '../controller/credential.controller';

const router = express.Router();
const credentialController = new CredentialController();

router.post('/', credentialController.createCredential.bind(credentialController));
router.get('/:id', credentialController.getCredentialById.bind(credentialController));
router.put('/:id/status', credentialController.updateCredentialStatus.bind(credentialController));

export default router;
