import { openProduct } from '../db/product.js';

// U1 deliberately has no Program schema or fixtures. This command never opens feedback.
export function seedEmptyProduct(env = process.env) {
  if (env.APP_ENV !== 'dev') throw new Error('Demo seed requires APP_ENV=dev');
  const db = openProduct(env.PRODUCT_DB_PATH || './data/program-rundown.sqlite');
  db.close();
}
if (process.argv[1]?.endsWith('/seed.ts') || process.argv[1]?.endsWith('/seed.js')) {
  seedEmptyProduct();
  console.log('U1 demo ready: empty product collection. Existing data preserved.');
}
