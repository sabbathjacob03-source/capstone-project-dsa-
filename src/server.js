import { createApp } from './http/app.js';
import { createApiRouter } from './http/apiRoutes.js';
import { config } from './config.js';
import { createSqliteRepository } from './repositories/sqlite.js';

if (![process.env.TOKEN_SECRET, process.env.JWT_SECRET, process.env.AUTH_SECRET]
  .some((secret) => typeof secret === 'string' && secret.trim() !== '')) {
  throw new Error('Set TOKEN_SECRET before starting the server');
}

const repository = createSqliteRepository();
const router = createApiRouter({ repository });
const server = createApp({ router, publicDir: config.publicDir });

server.on('error', (error) => {
  console.error('Unable to start the HTTP server:', error.message);
  process.exitCode = 1;
});

server.listen(config.port, () => {
  console.log(`Event Ticketing server listening on port ${config.port}`);
});

server.on('close', () => repository.close());
