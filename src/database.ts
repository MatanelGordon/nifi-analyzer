import Database from 'better-sqlite3';
import md5 from 'md5';
import fs from 'fs';
import path from 'path';
import { ProcessorInfo } from './get-processors.js';
import { StatusHistory } from './get-status-history.js';
import { ConnectionInfo } from './get-connections.js';
import { Config } from './config.js';
import { ProvenanceEventDTO } from './provenance-events.js';

export class ProcessorDatabase {
	private db: Database.Database | null = null;

	constructor(private dbPath: string, private config: Config) {
		// Database will be initialized on first use
	}

	private ensureConnection(): Database.Database {
		if (!this.db) {
			if (fs.existsSync(path.resolve(this.dbPath))) {
				console.log(`File ${this.dbPath} exists - deleting...`);
				fs.unlinkSync(this.dbPath);
			}

			this.db = new Database(this.dbPath);

			// Initialize the table
			const processorsInfoTable = `
        CREATE TABLE IF NOT EXISTS processors_info (
          id VARCHAR NOT NULL PRIMARY KEY,
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
            average_lineage_duration REAL NOT NULL DEFAULT 0,
            bytes_written INTEGER NOT NULL DEFAULT 0,
            output_count INTEGER NOT NULL DEFAULT 0,
            bytes_transferred INTEGER NOT NULL DEFAULT 0,
            flow_files_removed INTEGER NOT NULL DEFAULT 0,
            bytes_read INTEGER NOT NULL DEFAULT 0,
            task_nanos INTEGER NOT NULL DEFAULT 0,
            average_task_nanos REAL NOT NULL DEFAULT 0,
            output_bytes INTEGER NOT NULL DEFAULT 0,
            task_count INTEGER NOT NULL DEFAULT 0,
            input_bytes INTEGER NOT NULL DEFAULT 0,
            task_millis INTEGER NOT NULL DEFAULT 0,
            input_count INTEGER NOT NULL DEFAULT 0,
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
					FOREIGN KEY (source_id) REFERENCES connections_targets(id) ON DELETE CASCADE,
					FOREIGN KEY (destination_id) REFERENCES connections_targets(id) ON DELETE CASCADE
				)
			`;

			this.db.prepare(processorsInfoTable).run();
			console.log('✅ Database table "processors_info" initialized');

			this.db.prepare(processorsPropertiesTable).run();
			// Index for searching properties by name
			this.db
				.prepare(
					'CREATE INDEX IF NOT EXISTS idx_processors_properties_name ON processors_properties(name)'
				)
				.run();
			console.log(
				'✅ Database table "processors_properties" and indexes initialized'
			);

			this.db.prepare(nifiNodesTable).run();
			console.log('✅ Database table "nodes_info" initialized');

			this.db.prepare(processorsStatusHistoryTable).run();
			// Index for time-based queries on status history
			this.db
				.prepare(
					'CREATE INDEX IF NOT EXISTS idx_processors_status_history_timestamp ON processors_status_history(timestamp)'
				)
				.run();
			console.log(
				'✅ Database table "processors_status_history" and indexes initialized'
			);
			this.db.prepare(connectionTargetsTable).run();
			console.log('✅ Database table "connections_targets" initialized');
			this.db.prepare(connectionsInfoTable).run();
			console.log('✅ Database table "connections_info" initialized');

			this.createProvenanceTable();
		}

		return this.db;
	}

	private async createProvenanceTable() {
		if (!this.config.provenance.enabled) return;

		if (!this.db) {
			throw new Error('NO this.db is found');
		}

		const provenanceEventTable = `
			CREATE TABLE IF NOT EXISTS provenance_events (
				id INTEGER NOT NULL PRIMARY KEY,
				event_time INTEGER,
				event_duration INTEGER,
				lineage_duration INTEGER,
				event_type VARCHAR,
				flowfile_uuid VARCHAR NOT NULL,
				flowfile_size_bytes INTEGER,
				pg_id VARCHAR,
				processor_id VARCHAR,
				content_equal INTEGER,
				node_id VARCHAR,
				FOREIGN KEY (processor_id) REFERENCES processors_info(id)
			)
		`;

		const provenanceEventsAttributes = `
			CREATE TABLE IF NOT EXISTS provenance_events_attributes (
				event_id INTEGER NOT NULL,
				flowfile_uuid VARCHAR NOT NULL,
				name VARCHAR NOT NULL,
				value VARCHAR NOT NULL,
				PRIMARY KEY (event_id, name, flowfile_uuid),
				FOREIGN KEY (event_id) REFERENCES provenance_events(id)
			)
		`;

		const provenanceEventsFlowfileRelationships = `
			CREATE TABLE IF NOT EXISTS provenance_events_flowfile_relationships (
				event_id INTEGER NOT NULL,
				parent_flowfile_uuid VARCHAR NOT NULL,
				child_flowfile_uuid VARCHAR NOT NULL,
				PRIMARY KEY (event_id, parent_flowfile_uuid, child_flowfile_uuid),
				FOREIGN KEY (event_id) REFERENCES provenance_events(id)
			)
		`;

		this.db.prepare(provenanceEventTable).run();

		// Create indexes for provenance_events
		this.db
			.prepare(
				'CREATE INDEX IF NOT EXISTS idx_provenance_events_flowfile_uuid ON provenance_events(flowfile_uuid)'
			)
			.run();
		this.db
			.prepare(
				'CREATE INDEX IF NOT EXISTS idx_provenance_events_event_time ON provenance_events(event_time)'
			)
			.run();
		this.db
			.prepare(
				'CREATE INDEX IF NOT EXISTS idx_provenance_events_event_type ON provenance_events(event_type)'
			)
			.run();
		this.db
			.prepare(
				'CREATE INDEX IF NOT EXISTS idx_provenance_events_pg_id ON provenance_events(pg_id)'
			)
			.run();

		console.log(
			'✅ Database table "provenance_events" and indexes initialized'
		);

		this.db.prepare(provenanceEventsAttributes).run();

		// Create index for attribute name lookups
		this.db
			.prepare(
				'CREATE INDEX IF NOT EXISTS idx_provenance_events_attributes_name ON provenance_events_attributes(name)'
			)
			.run();

		console.log(
			'✅ Database table "provenance_events_attributes" and indexes initialized'
		);

		this.db.prepare(provenanceEventsFlowfileRelationships).run();
		console.log(
			'✅ Database table "provenance_events_flowfile_relationships" initialized'
		);
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
          average_lineage_duration,
          bytes_written,
          output_count,
          bytes_transferred,
          flow_files_removed,
          bytes_read,
          task_nanos,
          average_task_nanos,
          output_bytes,
          task_count,
          input_bytes,
          task_millis,
          input_count
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
					connection.source.name,
					connection.source.type
				);

				insertTarget.run(
					connection.destination.id,
					connection.destination.name,
					connection.destination.type
				);

				insert.run(
					connection.id,
					connection.name || 'NO_NAME',
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

	public insertProvenances(provenanceEvents: ProvenanceEventDTO[]) {
		const db = this.ensureConnection();

		const insertToEvents = db.prepare(`
			INSERT OR REPLACE INTO provenance_events (
				id,
				event_time,
				event_duration,
				lineage_duration,
				event_type,
				flowfile_uuid,
				flowfile_size_bytes,
				pg_id,
				processor_id,
				content_equal,
				node_id
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);

		const insertToAttributes = db.prepare(`
			INSERT OR REPLACE INTO provenance_events_attributes (
				event_id,
				flowfile_uuid,
				name,
				value
			) VALUES (?, ?, ?, ?)
		`);

		const insertToRelationship = db.prepare(`
			INSERT OR REPLACE INTO provenance_events_flowfile_relationships (
				event_id,
				parent_flowfile_uuid,
				child_flowfile_uuid
			) VALUES (?, ?, ?)	
		`);

		db.transaction(() => {
			for (const event of provenanceEvents) {
				const eventId = +event.id;
				
				insertToEvents.run(
					eventId,
					event.eventTime ? new Date(event.eventTime).getTime() : null,
					event.eventDuration ?? null,
					event.lineageDuration ?? null,
					event.eventType ?? null,
					event.flowFileUuid ?? null,
					event.fileSizeBytes ?? null,
					event.groupId ?? null,
					event.componentId ?? null,
					event.contentEqual !== undefined
						? event.contentEqual
							? 1
							: 0
						: null,
					event.clusterNodeId ?? null
				);

				// Insert attributes for this event immediately
				if (event.attributes) {
					for (const attr of event.attributes) {
						insertToAttributes.run(eventId, event.flowFileUuid, attr.name, attr.value);
					}
				}

				// Insert child relationships
				if (event.childUuids) {
					for (const childId of event.childUuids) {
						insertToRelationship.run(eventId, event.flowFileUuid, childId);
					}
				}

				// Insert parent relationships
				if (event.parentUuids) {
					for (const parentId of event.parentUuids) {
						insertToRelationship.run(eventId, parentId, event.flowFileUuid);
					}
				}
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