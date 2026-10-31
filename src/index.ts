import { createApp } from './app.js';
import { readConfig } from './config.js';
const runtime = await createApp(readConfig());
const server = runtime.app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Program Rundown listening'));
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close(() => { runtime.close(); process.exit(0); }));
