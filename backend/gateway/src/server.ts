import app from './app';
import { ENV } from './config/env';

app.listen(ENV.PORT,  "0.0.0.0", () => {
  console.log(`Gateway running on port ${ENV.PORT}`);
});
