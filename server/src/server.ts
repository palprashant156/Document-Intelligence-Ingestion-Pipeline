import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`documind api listening on :${env.PORT} (env=${env.NODE_ENV}, embeddings=${env.EMBEDDING_PROVIDER})`);
});
