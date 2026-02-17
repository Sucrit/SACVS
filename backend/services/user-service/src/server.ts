import app from './app';
import { ENV } from './config/env';

const PORT = ENV.PORT || 5000;

if (!ENV.CLERK_SECRET_KEY) {
	console.warn('CLERK_SECRET_KEY is missing. Authenticated routes will fail.');
}

app.listen(Number(PORT), "0.0.0.0", () => {
	console.log(`User service running on port ${PORT}`);
});
