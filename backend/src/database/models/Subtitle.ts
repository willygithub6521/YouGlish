import { Pool } from 'pg';

export interface Subtitle {
  id: number;
  videoId: string;
  startTime: number;
  endTime: number;
  text: string;
  createdAt: Date;
}

export interface CreateSubtitleData {
  videoId: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface UpdateSubtitleData {
  startTime?: number;
  endTime?: number;
  text?: string;
}

export interface SubtitleSearchOptions {
  videoId?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

export class SubtitleModel {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Create a new subtitle record
   */
  async create(data: CreateSubtitleData): Promise<Subtitle> {
    const query = `
      INSERT INTO subtitles (video_id, start_time, end_time, text)
      VALUES ($1, $2, $3, $4)
      RETURNING id, video_id as "videoId", start_time as "startTime", 
                end_time as "endTime", text, created_at as "createdAt"
    `;
    
    const values = [data.videoId, data.startTime, data.endTime, data.text];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Create multiple subtitle records in batch
   */
  async createBatch(subtitles: CreateSubtitleData[]): Promise<Subtitle[]> {
    if (subtitles.length === 0) {
      return [];
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results: Subtitle[] = [];
      
      for (const subtitle of subtitles) {
        const query = `
          INSERT INTO subtitles (video_id, start_time, end_time, text)
          VALUES ($1, $2, $3, $4)
          RETURNING id, video_id as "videoId", start_time as "startTime", 
                    end_time as "endTime", text, created_at as "createdAt"
        `;
        
        const values = [subtitle.videoId, subtitle.startTime, subtitle.endTime, subtitle.text];
        const result = await client.query(query, values);
        results.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find subtitle by ID
   */
  async findById(id: number): Promise<Subtitle | null> {
    const query = `
      SELECT id, video_id as "videoId", start_time as "startTime",
             end_time as "endTime", text, created_at as "createdAt"
      FROM subtitles
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find subtitles by video ID
   */
  async findByVideoId(videoId: string, limit = 100, offset = 0): Promise<Subtitle[]> {
    const query = `
      SELECT id, video_id as "videoId", start_time as "startTime",
             end_time as "endTime", text, created_at as "createdAt"
      FROM subtitles
      WHERE video_id = $1
      ORDER BY start_time ASC
      LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(query, [videoId, limit, offset]);
    return result.rows;
  }

  /**
   * Find subtitles within a time range
   */
  async findByTimeRange(
    videoId: string, 
    startTime: number, 
    endTime: number
  ): Promise<Subtitle[]> {
    const query = `
      SELECT id, video_id as "videoId", start_time as "startTime",
             end_time as "endTime", text, created_at as "createdAt"
      FROM subtitles
      WHERE video_id = $1 
        AND start_time >= $2 
        AND end_time <= $3
      ORDER BY start_time ASC
    `;

    const result = await this.pool.query(query, [videoId, startTime, endTime]);
    return result.rows;
  }

  /**
   * Find subtitle at specific time
   */
  async findAtTime(videoId: string, time: number): Promise<Subtitle | null> {
    const query = `
      SELECT id, video_id as "videoId", start_time as "startTime",
             end_time as "endTime", text, created_at as "createdAt"
      FROM subtitles
      WHERE video_id = $1 
        AND start_time <= $2 
        AND end_time >= $2
      ORDER BY start_time ASC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [videoId, time]);
    return result.rows[0] || null;
  }

  /**
   * Search subtitles by text content
   */
  async searchByText(
    searchText: string, 
    videoId?: string, 
    limit = 50, 
    offset = 0
  ): Promise<Subtitle[]> {
    let query = `
      SELECT id, video_id as "videoId", start_time as "startTime",
             end_time as "endTime", text, created_at as "createdAt"
      FROM subtitles
      WHERE to_tsvector('english', text) @@ plainto_tsquery('english', $1)
    `;
    
    const values: any[] = [searchText];
    
    if (videoId) {
      query += ' AND video_id = $2';
      values.push(videoId);
      query += ' ORDER BY start_time ASC LIMIT $3 OFFSET $4';
      values.push(limit, offset);
    } else {
      query += ' ORDER BY start_time ASC LIMIT $2 OFFSET $3';
      values.push(limit, offset);
    }

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  /**
   * Update subtitle by ID
   */
  async update(id: number, data: UpdateSubtitleData): Promise<Subtitle | null> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (data.startTime !== undefined) {
      fields.push(`start_time = $${paramCount++}`);
      values.push(data.startTime);
    }
    if (data.endTime !== undefined) {
      fields.push(`end_time = $${paramCount++}`);
      values.push(data.endTime);
    }
    if (data.text !== undefined) {
      fields.push(`text = $${paramCount++}`);
      values.push(data.text);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const query = `
      UPDATE subtitles 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, video_id as "videoId", start_time as "startTime",
                end_time as "endTime", text, created_at as "createdAt"
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete subtitle by ID
   */
  async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM subtitles WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Delete all subtitles for a video
   */
  async deleteByVideoId(videoId: string): Promise<number> {
    const query = 'DELETE FROM subtitles WHERE video_id = $1';
    const result = await this.pool.query(query, [videoId]);
    return result.rowCount;
  }

  /**
   * Get subtitle count for a video
   */
  async getCountByVideoId(videoId: string): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM subtitles WHERE video_id = $1';
    const result = await this.pool.query(query, [videoId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get total subtitle count
   */
  async getTotalCount(): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM subtitles';
    const result = await this.pool.query(query);
    return parseInt(result.rows[0].count);
  }

  /**
   * Find subtitles with context (previous and next subtitles)
   */
  async findWithContext(id: number): Promise<{
    current: Subtitle | null;
    previous: Subtitle | null;
    next: Subtitle | null;
  }> {
    const current = await this.findById(id);
    
    if (!current) {
      return { current: null, previous: null, next: null };
    }

    // Find previous subtitle
    const prevQuery = `
      SELECT id, video_id as "videoId", start_time as "startTime",
             end_time as "endTime", text, created_at as "createdAt"
      FROM subtitles
      WHERE video_id = $1 AND start_time < $2
      ORDER BY start_time DESC
      LIMIT 1
    `;
    const prevResult = await this.pool.query(prevQuery, [current.videoId, current.startTime]);
    const previous = prevResult.rows[0] || null;

    // Find next subtitle
    const nextQuery = `
      SELECT id, video_id as "videoId", start_time as "startTime",
             end_time as "endTime", text, created_at as "createdAt"
      FROM subtitles
      WHERE video_id = $1 AND start_time > $2
      ORDER BY start_time ASC
      LIMIT 1
    `;
    const nextResult = await this.pool.query(nextQuery, [current.videoId, current.startTime]);
    const next = nextResult.rows[0] || null;

    return { current, previous, next };
  }
}