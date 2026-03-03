import http from 'node:http';
import app from './app';
import { ENV } from './config/env';
import { realtimeHub } from './realtime/realtime.hub';

const server = http.createServer(app);
realtimeHub.attach(server);

server.listen(ENV.PORT, '0.0.0.0', () => {
  console.log(`Gateway running on port ${ENV.PORT}`);
});
