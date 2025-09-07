import Database from 'better-sqlite3';
import md5 from 'md5';
import { ProcessorInfo } from './get-processors.js';
import { StatusHistory } from './get-status-history.js';
import { ConnectionInfo } from './get-connections.js';

export class ProcessorDatabase {
	private db: Database.Database | null = null;

	constructor(private dbPath: string) {
		// Database will be initialized on first use
	}

	private ensureConnection(): Database.Database {
		if (!this.db) {
			this.db = new Database(this.dbPath);

			// Initialize the table
			const processorsInfoTable = `
        CREATE TABLE IF NOT EXISTS processors_info (
          id VARCHAR PRIMARY KEY,
          name VARCHAR NOT NULL,
          type VARCHAR NOT NULL,
          run_duration INTEGER NOT NULL,
          concurrent_tasks INTEGER NOT NULL,
          scheduling_strategy TEXT NOT NULL,
          run_schedule VARCHAR NOT NULL,
          execution VARCHAR NOT NULL,
          comments VARCHAR
        )
      `;

			const processorsPropertiesTable = `
		CREATE TABLE IF NOT EXISTS processors_properties (
    		id VARCHAR NOT NULL PRIMARY KEY,
    		processor_id VARCHAR NOT NULL,
    		name VARCHAR NOT NULL,
			value VARCHAR,
    		FOREIGN KEY (processor_id) REFERENCES processors_info(id)
		)`;

			const nifiNodesTable = `
        CREATE TABLE IF NOT EXISTS nodes_info (
          id VARCHAR PRIMARY KEY,
          address VARCHAR NOT NULL,
          api_port INTEGER NOT NULL
        )
      `;

			// Initialize the table
			const processorsStatusHistoryTable = `
        CREATE TABLE IF NOT EXISTS processors_status_history (
            processor_id VARCHAR,
            node_id VARCHAR,
            timestamp INTEGER NOT NULL,
            averageLineageDuration REAL NOT NULL DEFAULT 0,
            bytesWritten INTEGER NOT NULL DEFAULT 0,
            outputCount INTEGER NOT NULL DEFAULT 0,
            bytesTransferred INTEGER NOT NULL DEFAULT 0,
            flowFilesRemoved INTEGER NOT NULL DEFAULT 0,
            bytesRead INTEGER NOT NULL DEFAULT 0,
            taskNanos INTEGER NOT NULL DEFAULT 0,
            averageTaskNanos REAL NOT NULL DEFAULT 0,
            outputBytes INTEGER NOT NULL DEFAULT 0,
            taskCount INTEGER NOT NULL DEFAULT 0,
            inputBytes INTEGER NOT NULL DEFAULT 0,
            taskMillis INTEGER NOT NULL DEFAULT 0,
            inputCount INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (timestamp),
            FOREIGN KEY (processor_id) REFERENCES processors_info(id),
            FOREIGN KEY (node_id) REFERENCES nodes_info(id)
        )
      `;

			const connectionTargetsTable = `
				CREATE TABLE IF NOT EXISTS connections_targets (
					id VARCHAR PRIMARY KEY,
					name VARCHAR NOT NULL,
					type VARCHAR NOT NULL
				)	
			`;

			const connectionsInfoTable = `
				CREATE TABLE IF NOT EXISTS connections_info (
					id VARCHAR PRIMARY KEY,
					name VARCHAR NOT NULL,
					source_id VARCHAR NOT NULL,
					destination_id VARCHAR NOT NULL,
					is_load_balanced BOOLEAN NOT NULL,
					load_balance_strategy VARCHAR,
					load_balance_partition_attribute VARCHAR,
					load_balance_compression VARCHAR,
					load_balance_status VARCHAR,
					back_pressure_object_threshold INTEGER,
					back_pressure_data_size_threshold VARCHAR,
					flow_file_expiration VARCHAR,
					FOREIGN KEY (source_id) REFERENCES connections_targets(id),
					FOREIGN KEY (destination_id) REFERENCES connections_targets(id)
				)
			`;

			this.db.prepare(processorsInfoTable).run();
			console.log('✅ Database table "processors_info" initialized');
			this.db.prepare(processorsPropertiesTable).run();
			console.log(
				'✅ Database table "processors_properties" initialized'
			);
			this.db.prepare(nifiNodesTable).run();
			console.log('✅ Database table "nodes_info" initialized');
			this.db.prepare(processorsStatusHistoryTable).run();
			console.log(
				'✅ Database table "processors_status_history" initialized'
			);
			this.db.prepare(connectionTargetsTable).run();
			console.log('✅ Database table "connections_targets" initialized');
			this.db.prepare(connectionsInfoTable).run();
			console.log('✅ Database table "connections_info" initialized');
		}
		return this.db;
	}

	public async insertProcessorsInfo(
		processors: ProcessorInfo[]
	): Promise<void> {
		if (processors.length === 0) {
			console.log('⚠️  No processors to insert');
			return;
		}

		const db = this.ensureConnection();
		const insert = db.prepare(
			`INSERT OR REPLACE INTO processors_info (id, name, type, run_duration, concurrent_tasks, scheduling_strategy, run_schedule, execution, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);
		const insertMany = db.transaction((rows: ProcessorInfo[]) => {
			for (const p of rows) {
				insert.run(
					p.id,
					p.name,
					p.type,
					p.run_duration,
					p.concurrent_tasks,
					p.scheduling_strategy,
					p.run_schedule,
					p.execution,
					p.comments
				);
			}
		});

		try {
			insertMany(processors);
			console.log(
				`✅ Successfully inserted ${processors.length} processors into database`
			);
		} catch (error) {
			console.error('❌ Error inserting processors:', error);
			throw error;
		}
	}

	public async insertProcessorsProperties(
		processors: ProcessorInfo[]
	): Promise<void> {
		if (processors.length === 0) {
			console.log('⚠️  No processors to insert');
			return;
		}

		const db = this.ensureConnection();
		const insert = db.prepare(
			`INSERT OR REPLACE INTO processors_properties (id, processor_id, name, value) VALUES (?, ?, ?, ?)`
		);
		const insertMany = db.transaction((rows: ProcessorInfo[]) => {
			for (const p of rows) {
				for (const [pkey, pvalue] of Object.entries(p.properties)) {
					insert.run(md5(`${p.id}:${pkey}`), p.id, pkey, pvalue);
				}
			}
		});

		try {
			insertMany(processors);
			console.log(
				`✅ Successfully inserted ${processors.length} processors into database`
			);
		} catch (error) {
			console.error('❌ Error inserting processors:', error);
			throw error;
		}
	}

	public insertStatusHistory(
		processorId: string,
		statusHistory: StatusHistory
	): void {
		const db = this.ensureConnection();

		const insertNodeInfo = db.prepare(
			`INSERT OR REPLACE INTO nodes_info (id, address, api_port) VALUES (?, ?, ?)`
		);

		const aggregatedNodeId = 'TOTAL';

		db.transaction(() => {
			insertNodeInfo.run(aggregatedNodeId, 'no_address', 0);

			for (const nodeSnapshot of statusHistory.nodeSnapshots) {
				insertNodeInfo.run(
					nodeSnapshot.nodeId,
					nodeSnapshot.address,
					nodeSnapshot.apiPort
				);
			}
		})();

		const insertStatus = db.prepare(`
        INSERT OR REPLACE INTO processors_status_history (
          processor_id,
          node_id,
          timestamp,
          averageLineageDuration,
          bytesWritten,
          outputCount,
          bytesTransferred,
          flowFilesRemoved,
          bytesRead,
          taskNanos,
          averageTaskNanos,
          outputBytes,
          taskCount,
          inputBytes,
          taskMillis,
          inputCount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

		const insertMany = db.transaction(() => {
			for (const status of statusHistory.nodeSnapshots) {
				for (const snapshot of status.statusSnapshots) {
					const metric = snapshot.statusMetrics;

					insertStatus.run(
						processorId,
						status.nodeId,
						snapshot.timestamp,
						metric.averageLineageDuration,
						metric.bytesWritten,
						metric.outputCount,
						metric.bytesTransferred,
						metric.flowFilesRemoved,
						metric.bytesRead,
						metric.taskNanos,
						metric.averageTaskNanos,
						metric.outputBytes,
						metric.taskCount,
						metric.inputBytes,
						metric.taskMillis,
						metric.inputCount
					);
				}
			}
		});

		const insertManyAggregated = db.transaction(() => {
			for (const snapshot of statusHistory.aggregateSnapshots) {
				const metric = snapshot.statusMetrics;

				insertStatus.run(
					processorId,
					aggregatedNodeId,
					snapshot.timestamp,
					metric.averageLineageDuration,
					metric.bytesWritten,
					metric.outputCount,
					metric.bytesTransferred,
					metric.flowFilesRemoved,
					metric.bytesRead,
					metric.taskNanos,
					metric.averageTaskNanos,
					metric.outputBytes,
					metric.taskCount,
					metric.inputBytes,
					metric.taskMillis,
					metric.inputCount
				);
			}
		});

		insertMany();
		insertManyAggregated();
	}

	public insertConnectionInfo(connectionInfos: ConnectionInfo[]): void {
		if (connectionInfos.length === 0) {
			console.log('⚠️  No connections to insert');
			return;
		}

		const db = this.ensureConnection();

		const insertTarget = db.prepare(`
			INSERT OR IGNORE INTO connections_targets (
				id,
				name,
				type
			) VALUES (?, ?, ?)
		`);

		const insert = db.prepare(`
			INSERT OR REPLACE INTO connections_info (
				id,
				name,
				source_id,
				destination_id,
				is_load_balanced,
				load_balance_strategy,
				load_balance_partition_attribute,
				load_balance_compression,
				load_balance_status,
				back_pressure_object_threshold,
				back_pressure_data_size_threshold,
				flow_file_expiration
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);

		db.transaction(() => {
			for (const connection of connectionInfos) {
				insertTarget.run(
					connection.source.id,
					connection.source.name || 'UNKNOWN',
					connection.source.type
				);

				insertTarget.run(
					connection.destination.id,
					connection.destination.name || 'UNKNOWN',
					connection.destination.type
				);

				insert.run(
					connection.id,
					connection.name || 'UNKNOWN',
					connection.source.id,
					connection.destination.id,
					connection.loadBalanced ? 1 : 0,
					connection.loadBalanceStrategy || null,
					connection.loadBalancePartitionAttribute || null,
					connection.loadBalanceCompression || null,
					connection.loadBalanceStatus || null,
					connection.backPressureObjectThreshold || null,
					connection.backPressureDataSizeThreshold || null,
					connection.flowFileExpiration || null
				);
			}
		})();
	}

	public async getProcessorCount(): Promise<number> {
		const db = this.ensureConnection();
		const row = db
			.prepare('SELECT COUNT(*) as count FROM processors_info')
			.get() as any;
		return (row && (row.count as number)) || 0;
	}

	public async getAllProcessors(): Promise<ProcessorInfo[]> {
		const db = this.ensureConnection();
		const rows = db.prepare('SELECT * FROM processors_info').all();
		return rows as unknown as ProcessorInfo[];
	}

	public async getProcessorsByType(type: string): Promise<ProcessorInfo[]> {
		const db = this.ensureConnection();
		const rows = db
			.prepare('SELECT * FROM processors_info WHERE type = ?')
			.all(type);
		return rows as unknown as ProcessorInfo[];
	}

	public async getProcessorsByExecution(
		execution: string
	): Promise<ProcessorInfo[]> {
		const db = this.ensureConnection();
		const rows = db
			.prepare('SELECT * FROM processors_info WHERE execution = ?')
			.all(execution);
		return rows as unknown as ProcessorInfo[];
	}

	public async getProcessorStats(): Promise<Record<string, any>> {
		const db = this.ensureConnection();
		const totalCount = await this.getProcessorCount();

		const typeStats = db
			.prepare(
				`
      SELECT type, COUNT(*) as count 
      FROM processors_info 
      GROUP BY type 
      ORDER BY count DESC
    `
			)
			.all();

		const executionStats = db
			.prepare(
				`
      SELECT execution, COUNT(*) as count 
      FROM processors_info 
      GROUP BY execution
    `
			)
			.all();

		return {
			totalProcessors: totalCount,
			typeDistribution: typeStats,
			executionDistribution: executionStats,
		};
	}

	public async close(): Promise<void> {
		if (this.db) {
			this.db.close();
		}
		console.log('✅ Database connection closed');
	}
}


