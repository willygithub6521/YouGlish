import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Migration {
  id: number;
  filename: string;
  sql: string;
}

export class DatabaseMigrator {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Initialize the migrations table if it doesn't exist
   */
  private async initializeMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await this.pool.query(query);
  }

  /**
   * Get list of executed migrations
   */
  private async getExecutedMigrations(): Promise<number[]> {
    const result = await this.pool.query('SELECT id FROM migrations ORDER BY id');
    return result.rows.map((row: any) => row.id);
  }

  /**
   * Load migration files from the migrations directory
   */
  private loadMigrationFiles(): Migration[] {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((file: string) => file.endsWith('.sql'))
      .sort();

    return files.map((filename: string) => {
      const match = filename.match(/^(\d+)_/);
      if (!match) {
        throw new Error(`Invalid migration filename: ${filename}`);
      }

      const id = parseInt(match[1], 10);
      const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');

      return { id, filename, sql };
    });
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Execute the migration SQL
      await client.query(migration.sql);
      
      // Record the migration as executed
      await client.query(
        'INSERT INTO migrations (id, filename) VALUES ($1, $2)',
        [migration.id, migration.filename]
      );
      
      await client.query('COMMIT');
      console.log(`✓ Executed migration: ${migration.filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    try {
      await this.initializeMigrationsTable();
      
      const executedMigrations = await this.getExecutedMigrations();
      const allMigrations = this.loadMigrationFiles();
      
      const pendingMigrations = allMigrations.filter(
        migration => !executedMigrations.includes(migration.id)
      );

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations');
        return;
      }

      console.log(`Running ${pendingMigrations.length} pending migration(s)...`);
      
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }
      
      console.log('All migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{ executed: number[], pending: string[] }> {
    await this.initializeMigrationsTable();
    
    const executedMigrations = await this.getExecutedMigrations();
    const allMigrations = this.loadMigrationFiles();
    
    const pendingMigrations = allMigrations
      .filter(migration => !executedMigrations.includes(migration.id))
      .map(migration => migration.filename);

    return {
      executed: executedMigrations,
      pending: pendingMigrations
    };
  }
}

// CLI usage
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'youtube_pronunciation',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  const migrator = new DatabaseMigrator(pool);

  const command = process.argv[2];

  switch (command) {
    case 'migrate':
      migrator.migrate()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
    case 'status':
      migrator.getStatus()
        .then(status => {
          console.log('Executed migrations:', status.executed);
          console.log('Pending migrations:', status.pending);
          process.exit(0);
        })
        .catch(() => process.exit(1));
      break;
    default:
      console.log('Usage: npm run migrate [migrate|status]');
      process.exit(1);
  }
}