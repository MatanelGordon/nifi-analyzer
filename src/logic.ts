import chalk from 'chalk';
import { Config, getConfig } from './config';
import { ProcessorDatabase } from './database';
import { listConnectionsForGroup } from './get-connections';
import { getProcessGroups } from './get-process-groups';
import { getProcessorsInGroup } from './get-processors';
import { getStatusHistory } from './get-status-history';
import { createNiFiClient, NiFiBaseClient } from './nifi-base';
import { selectProcessGroup } from './user-prompts';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export interface Message {
	content: string;
}

export interface Events {
	onMessage?: (message: Message) => void;
	onSuccess?: () => void;
	onFail?: (error: Error) => void;
}

async function analyzeProcessGroups(
	client: NiFiBaseClient,
	database: ProcessorDatabase,
	processGroupId: string,
	config: Config,
	events: Events
): Promise<void> {
	events.onMessage?.({ content: `🚀 Starting analysis for process group: ${processGroupId}` });

	let totalProcessors = 0;
	let processedGroups = 0;

	const processGroups = getProcessGroups(client, processGroupId);

	// Process all process groups using the lazy async generator
	for await (const processGroup of processGroups) {
		events.onMessage?.({ content: `📊 Processing group: ${processGroup.component.name} (${processGroup.component.id})` });

		processedGroups++;

		const processors = await getProcessorsInGroup(
			client,
			processGroup.component.id
		);

		if (processors.length === 0) continue;

		await database.insertProcessorsInfo(processors);
		await database.insertProcessorsProperties(processors);

		totalProcessors += processors.length;
		events.onMessage?.({ content: `✅ Processed ${processors.length} processors from ${processGroup.component.name}` });

		// Insert connections early to ensure targets are available
		const connections = await listConnectionsForGroup(
			client,
			processGroup.component.id
		);
		database.insertConnectionInfo(connections);

		for (const processor of processors) {
			const statusHistory = await getStatusHistory(
				client,
				processor.id
			);

			database.insertStatusHistory(processor.id, statusHistory);

			events.onMessage?.({ content: `Inserted ${
					statusHistory.aggregateSnapshots.length +
					statusHistory.nodeSnapshots.length
				} metrics for processor: ${processor.name}` });
		}
	}

	events.onMessage?.({ content: `\n🎉 Analysis completed!` });
	events.onMessage?.({ content: `📊 Total process groups processed: ${processedGroups}` });
	events.onMessage?.({ content: `⚙️  Total processors found: ${totalProcessors}` });
	events.onMessage?.({ content: `💾 Database location: ${await database.getProcessorCount()} processors stored` });

	// Display statistics
	const stats = await database.getProcessorStats();
	events.onMessage?.({ content: '\n📈 Processor Statistics:' });
	events.onMessage?.({ content: `Total Processors: ${stats.totalProcessors}` });

	if (stats.typeDistribution.length > 0) {
		events.onMessage?.({ content: '\nProcessor Types:' });
		stats.typeDistribution.forEach(
			(stat: { type: string; count: number }) => {
				events.onMessage?.({ content: `  ${stat.type}: ${stat.count}` });
			}
		);
	}

	if (stats.executionDistribution.length > 0) {
		events.onMessage?.({ content: '\nExecution Distribution:' });
		stats.executionDistribution.forEach(
			(stat: { execution: string; count: number }) => {
				events.onMessage?.({ content: `  ${stat.execution}: ${stat.count}` });
			}
		);
	}
}

export async function run(_config: Partial<Config> = {}, events?: Events): Promise<void> {
	console.log('🚀 NiFi Processor Analyzer Starting...\n');

	let database: ProcessorDatabase | null = null;

	try {
		const config = await getConfig(_config);

		// Create NiFi client
		const client = createNiFiClient({
			baseUrl: config.nifiUrl,
			username: config.nifiUsername,
			password: config.nifiPassword,
		});

		// Create database
		database = new ProcessorDatabase(config.dbPath, config);

		// Determine which process group to analyze
		let processGroupId = config.pgId;

		if (!processGroupId) {
			console.log(
				'🔍 No PG_ID environment variable found. Prompting for selection...\n'
			);
			processGroupId = await selectProcessGroup(client);
		}

		console.log(`\n🎯 Selected process group: ${processGroupId}\n`);

		// Perform analysis
		try {
			await analyzeProcessGroups(client, database, processGroupId, config, events || {
				onMessage: (message) => console.log(message.content),
				onSuccess: () => {},
				onFail: (error) => console.error('❌ Error during analysis:', error)
			});
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			events?.onFail?.(err);
			console.error('❌ Error during analysis:', error);
			await database.close();
			throw error;
		}

		// Close database connection
		await database.close();

		console.log('\n✅ Analysis completed successfully!');
		console.log(`💾 Database saved to: ${config.dbPath}`);
		console.log(
			'🔍 You can now query the database or use any SQLite client to analyze the data.'
		);
		events?.onSuccess?.();
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		events?.onFail?.(err);
		console.error('❌ Fatal error:', error);

		// Ensure database is closed even on fatal error
		if (database) {
			await database.close();
		}

		if (!_config.noExit) {
			process.exit(1);
		}
		
		// Re-throw error for server mode
		throw err;
	}
}

export function uuid() {
	return 'xxxx-xxxx-xxxx'.replaceAll('x', function () {
		const r = (Math.random() * 16) | 0;
		return r.toString(16);
	});
}


