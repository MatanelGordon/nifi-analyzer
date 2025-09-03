import { ProcessorDatabase } from './database';
import { getProcessGroups } from './get-process-groups';
import { getProcessorsInGroup } from './get-processors';
import { createNiFiClient, NiFiBaseClient } from './nifi-base';
import { getConfig } from './config';
import { selectProcessGroup } from './user-prompts';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function analyzeProcessGroups(
	client: NiFiBaseClient,
	database: ProcessorDatabase,
	processGroupId: string
): Promise<void> {
	console.log(`🚀 Starting analysis for process group: ${processGroupId}`);

	let totalProcessors = 0;
	let processedGroups = 0;

  const processGroups = getProcessGroups(
			client,
			processGroupId
		);

	try {
		// Process all process groups using the lazy async generator
		for await (const processGroup of processGroups) {
			console.log(
				`📊 Processing group: ${processGroup.component.name} (${processGroup.component.id})`
			);

			try {
				const processors = await getProcessorsInGroup(
					client,
					processGroup.component.id
				);

				if (processors.length > 0) {
					await database.insertProcessorsInfo(processors);
					totalProcessors += processors.length;
					console.log(
						`✅ Processed ${processors.length} processors from ${processGroup.component.name}`
					);
				}

				processedGroups++;
			} catch (error) {
				console.error(
					`❌ Error processing group ${processGroup.component.name}:`,
					error
				);
				// Continue with other groups
			}
		}

		console.log(`\n🎉 Analysis completed!`);
		console.log(`📊 Total process groups processed: ${processedGroups}`);
		console.log(`⚙️  Total processors found: ${totalProcessors}`);
		console.log(
			`💾 Database location: ${await database.getProcessorCount()} processors stored`
		);

		// Display statistics
		const stats = await database.getProcessorStats();
		console.log('\n📈 Processor Statistics:');
		console.log(`Total Processors: ${stats.totalProcessors}`);

		if (stats.typeDistribution.length > 0) {
			console.log('\nProcessor Types:');
			stats.typeDistribution.forEach(
				(stat: { type: string; count: number }) => {
					console.log(`  ${stat.type}: ${stat.count}`);
				}
			);
		}

		if (stats.executionDistribution.length > 0) {
			console.log('\nExecution Distribution:');
			stats.executionDistribution.forEach(
				(stat: { execution: string; count: number }) => {
					console.log(`  ${stat.execution}: ${stat.count}`);
				}
			);
		}
	} catch (error) {
		console.error('❌ Error during analysis:', error);
		throw error;
	}
}

async function main(): Promise<void> {
	console.log('🚀 NiFi Processor Analyzer Starting...\n');

	try {
		const config = await getConfig();

		// Create NiFi client
		const client = createNiFiClient({
			baseUrl: config.nifiUrl,
			username: config.nifiUsername,
			password: config.nifiPassword,
		});

		// Create database
		const database = new ProcessorDatabase(config.dbPath);

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
		await analyzeProcessGroups(client, database, processGroupId);

		// Close database connection
		await database.close();

		console.log('\n✅ Analysis completed successfully!');
		console.log(`💾 Database saved to: ${config.dbPath}`);
		console.log(
			'🔍 You can now query the database or use any SQLite client to analyze the data.'
		);
	} catch (error) {
		console.error('❌ Fatal error:', error);
		process.exit(1);
	}
}

// Handle graceful shutdown
process.on('SIGINT', () => {
	console.log('\n👋 Shutting down gracefully...');
	process.exit(0);
});

process.on('SIGTERM', () => {
	console.log('\n👋 Shutting down gracefully...');
	process.exit(0);
});

// Run the main function
try {
	await main();
} catch (error) {
	console.error('❌ Unhandled error:', error);
	process.exit(1);
}

