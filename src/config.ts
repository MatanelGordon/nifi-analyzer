export interface Config {
	nifiUrl: string;
	nifiUsername: string;
	nifiPassword: string;
	pgId: string | null;
	dbPath: string;
	noExit: boolean;
}

export async function getConfig(conf: Partial<Config> = {}): Promise<Config> {
  const nifiUrl = conf.nifiUrl ?? process.env.NIFI_URL ?? 'https://localhost:8080';
  const nifiUsername = conf.nifiUsername ?? process.env.NIFI_USERNAME ?? 'admin';
  const nifiPassword = conf.nifiPassword ?? process.env.NIFI_PASSWORD ?? '12345678Admin!';
  const pgId = conf.pgId ?? process.env.PG_ID ?? null;
  const dbPath = conf.dbPath ?? process.env.DB_PATH ?? './data/output.db';

  console.log('📋 Configuration:');
  console.log(`  NiFi URL: ${nifiUrl}`);
  console.log(`  Username: ${nifiUsername}`);
  console.log(`  Database Path: ${dbPath} (SQLite)`);
  console.log(`  Process Group ID: ${pgId || 'Not specified (will prompt)'}`);
  console.log('\n');

  return {
		nifiUrl: removeTrailingSlash(nifiUrl),
		nifiUsername,
		nifiPassword,
		pgId,
		dbPath,
		noExit: conf.noExit ?? false,
  };
}

function removeTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;

}