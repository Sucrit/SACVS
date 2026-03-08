import app from './app';
import { ENV } from './config/env';

app.listen(Number(ENV.PORT), '0.0.0.0', () => {
  console.log(`Security service running on port ${ENV.PORT}`);
});
