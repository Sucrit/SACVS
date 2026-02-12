import app from './app';
import { ENV } from './config/env';

const PORT = ENV.PORT || '5100';

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Credentials service running on port ${PORT}`);
});
