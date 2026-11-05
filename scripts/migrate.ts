import './env';
import { getDatabase } from '../src/lib/database';
async function main() {
  const database = getDatabase();
  await database.ready(); await database.client.close();
  console.log('Skema database siap.');
}
main().catch(error => { console.error(error.message); process.exit(1); });
