export interface Config {
  nifiUrl: string;
  nifiUsername: string;
  nifiPassword: string;
  pgId: string | null;
  dbPath: string;
}

export async function getConfig(): Promise<Config> {
  const nifiUrl = process.env.NIFI_URL || 'https://localhost:8080';
  const nifiUsername = process.env.NIFI_USERNAME || 'admin';
  const nifiPassword = process.env.NIFI_PASSWORD || '12345678Matanel!';
  const pgId = process.env.PG_ID ?? null;
  const dbPath = process.env.DB_PATH || './data/output.db';

  console.log('📋 Configuration:');
  console.log(`  NiFi URL: ${nifiUrl}`);
  console.log(`  Username: ${nifiUsername}`);
  console.log(`  Database Path: ${dbPath} (SQLite)`);
  console.log(`  Process Group ID: ${pgId || 'Not specified (will prompt)'}`);
  console.log('\n');

  return {
    nifiUrl,
    nifiUsername,
    nifiPassword,
    pgId,
    dbPath
  };
}