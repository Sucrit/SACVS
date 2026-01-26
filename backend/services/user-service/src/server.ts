import app from './app';
import 'dotenv/config';

const PORT = process.env.PORT;

app.listen(PORT, () => {
	console.log(`User service running on port ${PORT}`);
});
