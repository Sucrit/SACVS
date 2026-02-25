import express from 'express';
import blockchainRoutes from './routes/blockchain.routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', blockchainRoutes);

export default app;
