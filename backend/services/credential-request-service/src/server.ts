import app from './app';
import { ENV } from './config/env';

const PORT = ENV.PORT || 5200;

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Credential request service running on port ${PORT}`);
});
