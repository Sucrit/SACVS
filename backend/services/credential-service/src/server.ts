import app from './app';
import { ENV } from './config/env';
import { CredentialService } from './service/credential.service';

const PORT = ENV.PORT || 5100;
const AUTO_EXPIRY_SWEEP_MS = 60_000;
const credentialService = new CredentialService();

app.listen(Number(PORT), "0.0.0.0", () => {
	console.log(`Credential service running on port ${PORT}`);
});

void credentialService.runAutoExpirySweep().catch(error => {
  console.error('[credential-service] Initial auto-expiry sweep failed:', error);
});

setInterval(() => {
  void credentialService.runAutoExpirySweep().catch(error => {
    console.error('[credential-service] Scheduled auto-expiry sweep failed:', error);
  });
}, AUTO_EXPIRY_SWEEP_MS).unref();
