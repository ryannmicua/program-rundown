import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { openProduct } from './db/product.js';
import { sessions } from './auth/session.js';
import { authRoutes } from './auth/oidc.js';
import type { Config } from './config.js';
import { programRoutes } from './api/programs.js';
import { contentRoutes } from './api/content.js';
import { publicationRoutes } from './api/publication.js';
import { partsRoutes } from './api/parts.js';
import { participantRoutes } from './api/participants.js';
import { contentBodyLimit } from './domain/content.js';

export async function createApp(config: Config) {
  const db = openProduct(config.productPath);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { 'script-src': ["'self'"], 'upgrade-insecure-requests': config.secureCookies ? [] : null } }, strictTransportSecurity: config.secureCookies ? undefined : false }));
  app.get('/health', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  });
  if (!config.feedbackEnabled) app.all(['/feedback', '/api/feedback', '/api/feedback/{*path}'], (_req, res) => res.status(404).send('Not found'));
  app.use(cookieParser(config.secret));
  app.put('/api/programs/:id/content', express.json({ limit: contentBodyLimit }));
  app.use(express.json({ limit: '32kb' }));
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && (req.get('origin') !== config.origin || !req.is('application/json'))) return res.status(403).json({ error: 'Same-origin JSON required.' });
    next();
  });
  const store = sessions(db, config);
  app.use((req, res, next) => { res.locals.user = store.user(req); next(); });
  const tester: RequestHandler = (_req, res, next) => {
    if (!res.locals.user) return res.status(401).json({ error: 'Sign in to continue.' });
    if (!res.locals.user.coordinator) return res.status(403).json({ error: 'Dev tester access required.' });
    next();
  };
  app.use(authRoutes(db, config, store));
  app.get('/api/session', (_req, res) => res.json({ user: res.locals.user ? { label: res.locals.user.label, coordinator: res.locals.user.coordinator } : null, feedbackEnabled: config.feedbackEnabled }));
  app.use(publicationRoutes(db, tester));
  app.use(programRoutes(db, tester));
  app.use(contentRoutes(db, tester));
  app.use(participantRoutes(db, tester));
  app.use(partsRoutes(db, tester));
  let feedback: { close(): void } | undefined;
  if (config.feedbackEnabled) {
    const { feedbackModule } = await import('./feedback/index.js');
    feedback = feedbackModule(config.feedbackPath, tester);
    app.use((feedback as ReturnType<typeof feedbackModule>).router);
    app.get('/feedback', (_req, res) => res.sendFile('index.html', { root: resolve('web/dist') }));
  }
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(express.static(resolve('web/dist'), { index: false }));
  app.get(['/', '/signin', '/programs/new', '/programs/:id', '/p/:id'], (_req, res) => res.sendFile('index.html', { root: resolve('web/dist') }));
  app.use((_req, res) => res.status(404).send('Not found'));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    // Never log request URLs, tokens, or OIDC error bodies.
    res.status(error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 503).json({ error: 'Request could not be completed.' });
  };
  app.use(errors);
  return { app, close: () => { feedback?.close(); db.close(); } };
}
