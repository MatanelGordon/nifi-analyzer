import Database from 'better-sqlite3';
import { ProcessorInfo } from './get-processors.js';

export class ProcessorDatabase {
  private db: Database.Database | null = null;

  constructor(private dbPath: string) {
    // Database will be initialized on first use
  }

  private ensureConnection(): Database.Database {
    if (!this.db) {
      this.db = new Database(this.dbPath);

      // Initialize the table
      const createTableSQL = `
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

      this.db.prepare(createTableSQL).run();
      console.log('✅ Database table "processors_info" initialized');
    }
    return this.db;
  }

  public async insertProcessorsInfo(processors: ProcessorInfo[]): Promise<void> {
    if (processors.length === 0) {
      console.log('⚠️  No processors to insert');
      return;
    }

    const db = this.ensureConnection();
    const insert = db.prepare(`INSERT OR REPLACE INTO processors_info (id, name, type, run_duration, concurrent_tasks, scheduling_strategy, run_schedule, execution, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
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
      console.log(`✅ Successfully inserted ${processors.length} processors into database`);
    } catch (error) {
      console.error('❌ Error inserting processors:', error);
      throw error;
    }
  }

  public async getProcessorCount(): Promise<number> {
    const db = this.ensureConnection();
  const row = db.prepare('SELECT COUNT(*) as count FROM processors_info').get() as any;
  return (row && (row.count as number)) || 0;
  }

  public async getAllProcessors(): Promise<ProcessorInfo[]> {
    const db = this.ensureConnection();
    const rows = db.prepare('SELECT * FROM processors_info').all();
    return rows as unknown as ProcessorInfo[];
  }

  public async getProcessorsByType(type: string): Promise<ProcessorInfo[]> {
    const db = this.ensureConnection();
    const rows = db.prepare('SELECT * FROM processors_info WHERE type = ?').all(type);
    return rows as unknown as ProcessorInfo[];
  }

  public async getProcessorsByExecution(execution: string): Promise<ProcessorInfo[]> {
    const db = this.ensureConnection();
    const rows = db.prepare('SELECT * FROM processors_info WHERE execution = ?').all(execution);
    return rows as unknown as ProcessorInfo[];
  }

  public async getProcessorStats(): Promise<Record<string, any>> {
    const db = this.ensureConnection();
    const totalCount = await this.getProcessorCount();

    const typeStats = db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM processors_info 
      GROUP BY type 
      ORDER BY count DESC
    `).all();

    const executionStats = db.prepare(`
      SELECT execution, COUNT(*) as count 
      FROM processors_info 
      GROUP BY execution
    `).all();

    return {
      totalProcessors: totalCount,
      typeDistribution: typeStats,
      executionDistribution: executionStats
    };
  }

  public async close(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
    console.log('✅ Database connection closed');
  }

}