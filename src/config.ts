import { resolve } from 'node:path';

export function readConfig(env = process.env) {
  const appEnv = env.APP_ENV || 'production';
  if (!['dev', 'test', 'production'].includes(appEnv)) throw new Error('Invalid APP_ENV');
  const origin = new URL(env.APP_ORIGIN || 'http://localhost:3000');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.protocol !== 'https:' && !(loopback && appEnv !== 'production')) throw new Error('APP_ORIGIN requires HTTPS');
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('APP_ORIGIN must be an origin');
  const secret = env.SESSION_SECRET || '';
  if (secret.length < 32) throw new Error('SESSION_SECRET must have at least 32 characters');
  const productPath = env.PRODUCT_DB_PATH || './data/program-rundown.sqlite';
  const feedbackPath = env.FEEDBACK_DB_PATH || './feedback-data/feedback.sqlite';
  if (resolve(productPath) === resolve(feedbackPath)) throw new Error('Product and feedback databases must be separate');
  return {
    appEnv, origin: origin.origin, secureCookies: origin.protocol === 'https:', secret,
    issuer: env.OIDC_ISSUER || '', clientId: env.OIDC_CLIENT_ID || '',
    testerIssuer: env.DEV_COORDINATOR_ISSUER || '', testerSubject: env.DEV_COORDINATOR_SUBJECT || '',
    feedbackEnabled: appEnv === 'dev' && env.FEEDBACK_ENABLED === 'true',
    productPath, feedbackPath,
  };
}
export type Config = ReturnType<typeof readConfig>;
