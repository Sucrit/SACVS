import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
	console.log(`User service running on port ${PORT}`);
});
