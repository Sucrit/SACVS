import app from './app';
import { ENV } from './config/env';

const PORT = ENV.PORT || '5100';

app.listen(Number(PORT), () => {
  console.log(`Credentials service running on port ${PORT}`);
});
