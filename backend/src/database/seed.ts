import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseSeeder {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Load seed files from the seeds directory
   */
  private loadSeedFiles(): Array<{ filename: string; sql: string }> {
    const seedsDir = path.join(__dirname, 'seeds');
    
    if (!fs.existsSync(seedsDir)) {
      console.log('No seeds directory found');
      return [];
    }

    const files = fs.readdirSync(seedsDir)
      .filter((file: string) => file.endsWith('.sql'))
      .sort();

    return files.map((filename: string) => {
      const sql = fs.readFileSync(path.join(seedsDir, filename), 'utf8');
      return { filename, sql };
    });
  }

  /**
   * Execute a single seed file
   */
  private async executeSeed(seed: { filename: string; sql: string }): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(seed.sql);
      await client.query('COMMIT');
      console.log(`✓ Executed seed: ${seed.filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`✗ Failed to execute seed: ${seed.filename}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all seed files
   */
  async seed(): Promise<void> {
    try {
      const seedFiles = this.loadSeedFiles();
      
      if (seedFiles.length === 0) {
        console.log('No seed files found');
        return;
      }

      console.log(`Running ${seedFiles.length} seed file(s)...`);
      
      for (const seedFile of seedFiles) {
        await this.executeSeed(seedFile);
      }
      
      console.log('All seed files executed successfully');
    } catch (error) {
      console.error('Seeding failed:', error);
      throw error;
    }
  }

  /**
   * Clear all data from tables (for testing)
   */
  async clear(): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Delete in order to respect foreign key constraints
        await client.query('DELETE FROM subtitles');
        await client.query('DELETE FROM videos');
        
        // Reset sequences
        await client.query('ALTER SEQUENCE subtitles_id_seq RESTART WITH 1');
        
        await client.query('COMMIT');
        console.log('✓ Database cleared successfully');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to clear database:', error);
      throw error;
    }
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

  const seeder = new DatabaseSeeder(pool);

  const command = process.argv[2];

  switch (command) {
    case 'seed':
      seeder.seed()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
    case 'clear':
      seeder.clear()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
    case 'reset':
      seeder.clear()
        .then(() => seeder.seed())
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
    default:
      console.log('Usage: npm run seed [seed|clear|reset]');
      process.exit(1);
  }
}