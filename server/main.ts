import { serve } from '@hono/node-server';
import { createApp } from './src/app';
import { assertWritableDir, openDb } from './src/db/openDb';
import { migrate } from './src/db/migrate';
import { parseEnv } from './src/env';

function fatal(message: string): never {
  console.error(JSON.stringify({ msg: 'fatal', error: message }));
  process.exit(1);
}

let env;
try {
  env = parseEnv(process.env);
  assertWritableDir(env.DATA_DIR);
} catch (error) {
  fatal(error instanceof Error ? error.message : String(error));
}

const db = openDb(`${env.DATA_DIR}/split.db`);
migrate(db);

const server = serve({ fetch: createApp({ env, db }).fetch, port: env.PORT }, (info) => {
  console.log(JSON.stringify({ msg: 'listening', port: info.port }));
});

process.on('SIGTERM', () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
