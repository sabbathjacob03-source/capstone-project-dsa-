import { createApp } from './http/app.js';
import { config } from './config.js';

const server = createApp({ publicDir: config.publicDir });

server.on('error', (error) => {
  console.error('Unable to start the HTTP server:', error.message);
  process.exitCode = 1;
});

server.listen(config.port, () => {
  console.log(`Event Ticketing server listening on port ${config.port}`);
});
