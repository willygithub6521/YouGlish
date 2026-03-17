import { Pool } from 'pg';

export type Accent = 'ALL' | 'US' | 'UK' | 'AU' | 'CA' | 'OTHER';

export interface VideoMetadata {
  id: string;
  title: string;
  channelName: string;
  duration: number;
  accent: Accent;
  thumbnailUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVideoData {
  id: string;
  title: string;
  channelName: string;
  duration: number;
  accent: Accent;
  thumbnailUrl: string;
}

export interface UpdateVideoData {
  title?: string;
  channelName?: string;
  duration?: number;
  accent?: Accent;
  thumbnailUrl?: string;
}

export class VideoModel {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Create a new video record
   */
  async create(data: CreateVideoData): Promise<VideoMetadata> {
    const query = `
      INSERT INTO videos (id, title, channel_name, duration, accent, thumbnail_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title, channel_name as "channelName", duration, accent, 
                thumbnail_url as "thumbnailUrl", created_at as "createdAt", 
                updated_at as "updatedAt"
    `;
    
    const values = [
      data.id,
      data.title,
      data.channelName,
      data.duration,
      data.accent,
      data.thumbnailUrl
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Find video by ID
   */
  async findById(id: string): Promise<VideoMetadata | null> {
    const query = `
      SELECT id, title, channel_name as "channelName", duration, accent,
             thumbnail_url as "thumbnailUrl", created_at as "createdAt",
             updated_at as "updatedAt"
      FROM videos
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Update video by ID
   */
  async update(id: string, data: UpdateVideoData): Promise<VideoMetadata | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (data.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(data.title);
    }
    if (data.channelName !== undefined) {
      fields.push(`channel_name = $${paramCount++}`);
      values.push(data.channelName);
    }
    if (data.duration !== undefined) {
      fields.push(`duration = $${paramCount++}`);
      values.push(data.duration);
    }
    if (data.accent !== undefined) {
      fields.push(`accent = $${paramCount++}`);
      values.push(data.accent);
    }
    if (data.thumbnailUrl !== undefined) {
      fields.push(`thumbnail_url = $${paramCount++}`);
      values.push(data.thumbnailUrl);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const query = `
      UPDATE videos 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, title, channel_name as "channelName", duration, accent,
                thumbnail_url as "thumbnailUrl", created_at as "createdAt",
                updated_at as "updatedAt"
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete video by ID
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM videos WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Find videos by accent
   */
  async findByAccent(accent: Accent, limit = 20, offset = 0): Promise<VideoMetadata[]> {
    const query = `
      SELECT id, title, channel_name as "channelName", duration, accent,
             thumbnail_url as "thumbnailUrl", created_at as "createdAt",
             updated_at as "updatedAt"
      FROM videos
      WHERE accent = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(query, [accent, limit, offset]);
    return result.rows;
  }

  /**
   * Get video count by accent
   */
  async getCountByAccent(): Promise<Record<Accent, number>> {
    const query = `
      SELECT accent, COUNT(*) as count
      FROM videos
      GROUP BY accent
    `;

    const result = await this.pool.query(query);
    
    const counts: Record<Accent, number> = {
      ALL: 0,
      US: 0,
      UK: 0,
      AU: 0,
      CA: 0,
      OTHER: 0
    };

    result.rows.forEach((row: any) => {
      counts[row.accent as Accent] = parseInt(row.count);
    });

    // Calculate total for ALL
    counts.ALL = Object.values(counts).reduce((sum, count) => sum + count, 0) - counts.ALL;

    return counts;
  }

  /**
   * Check if video exists
   */
  async exists(id: string): Promise<boolean> {
    const query = 'SELECT 1 FROM videos WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows.length > 0;
  }

  /**
   * Get all videos with pagination
   */
  async findAll(limit = 20, offset = 0): Promise<VideoMetadata[]> {
    const query = `
      SELECT id, title, channel_name as "channelName", duration, accent,
             thumbnail_url as "thumbnailUrl", created_at as "createdAt",
             updated_at as "updatedAt"
      FROM videos
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Get total video count
   */
  async getTotalCount(): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM videos';
    const result = await this.pool.query(query);
    return parseInt(result.rows[0].count);
  }
}