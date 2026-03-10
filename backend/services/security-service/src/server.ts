import app from './app';
import { ENV } from './config/env';
import { shadowRiskWorker } from './runtime/shadow-risk.worker';

app.listen(Number(ENV.PORT), '0.0.0.0', () => {
  console.log(`Security service running on port ${ENV.PORT}`);
  if (ENV.RISK_SHADOW_AUTORUN) {
    shadowRiskWorker.start();
  } else {
    console.log('[security-service] Shadow risk worker disabled by configuration.');
  }
});
