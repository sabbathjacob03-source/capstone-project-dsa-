import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 3000;
const rawPort = process.env.PORT;
const port = rawPort === undefined ? DEFAULT_PORT : Number(rawPort);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT must be a whole number between 1 and 65535');
}

export const config = Object.freeze({
  port,
  publicDir: fileURLToPath(new URL('../public/', import.meta.url)),
});
