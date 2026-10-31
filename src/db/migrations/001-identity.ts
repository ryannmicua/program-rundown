export const identityMigration = {
  version: 1,
  sql: `
    CREATE TABLE identities (
      id INTEGER PRIMARY KEY, issuer TEXT NOT NULL, subject TEXT NOT NULL,
      label TEXT NOT NULL, UNIQUE(issuer, subject)
    );
    CREATE TABLE coordinator_grants (
      identity_id INTEGER PRIMARY KEY REFERENCES identities(id) ON DELETE CASCADE,
      environment TEXT NOT NULL CHECK(environment = 'dev')
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      identity_id INTEGER REFERENCES identities(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      verifier TEXT, state TEXT, nonce TEXT
    );
    CREATE INDEX sessions_expiry ON sessions(expires_at);
  `,
};
