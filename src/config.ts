export interface Config {
	nifiUrl: string;
	nifiUsername: string;
	nifiPassword: string;
	pgId: string | null;
	dbPath: string;
	noExit: boolean;
	provenance: {
		maxResults: number;
		enabled: boolean;
	};
}

export async function getConfig(conf: Partial<Config> = {}): Promise<Config> {
  const nifiUrl = conf.nifiUrl ?? process.env.NIFI_URL ?? 'https://localhost:8080';
  const nifiUsername = conf.nifiUsername ?? process.env.NIFI_USERNAME ?? 'admin';
  const nifiPassword = conf.nifiPassword ?? process.env.NIFI_PASSWORD ?? '12345678Admin!';
  const pgId = conf.pgId ?? process.env.PG_ID ?? null;
  const dbPath = conf.dbPath ?? process.env.DB_PATH ?? './data/output.db';
  const p_maxResults =
		conf.provenance?.maxResults ?? +(process.env['PROVENANCE_MAX_RESULTS'] ?? 50000);
  const p_enabled = conf.provenance?.enabled ?? (process.env['PROVENANCE_ENABLED']?.toLowerCase() ?? 'true') === 'true'

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
		dbPath,
		noExit: conf.noExit ?? false,
    provenance: {
      enabled: p_enabled,
      maxResults: p_maxResults
    }
  };





}