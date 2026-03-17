# Database Setup

This directory contains the PostgreSQL database schema, migrations, models, and seeding scripts for the YouTube Pronunciation Search platform.

## Structure

```
database/
├── migrations/          # Database migration files
├── seeds/              # Sample data for development
├── models/             # TypeScript models for database operations
├── connection.ts       # Database connection management
├── migrate.ts          # Migration runner
├── seed.ts            # Seeding utility
├── init.sql           # Initial schema (for development)
└── README.md          # This file
```

## Database Schema

### Videos Table

Stores YouTube video metadata with accent information.

```sql
CREATE TABLE videos (
  id VARCHAR(20) PRIMARY KEY,           -- YouTube video ID
  title TEXT NOT NULL,                  -- Video title
  channel_name VARCHAR(255) NOT NULL,   -- Channel name
  duration INTEGER NOT NULL,            -- Duration in seconds
  accent VARCHAR(10) NOT NULL,          -- Accent type (US, UK, AU, CA, OTHER)
  thumbnail_url TEXT NOT NULL,          -- Thumbnail image URL
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_videos_accent` - For accent filtering
- `idx_videos_created_at` - For chronological ordering

### Subtitles Table

Stores subtitle segments with timing information.

```sql
CREATE TABLE subtitles (
  id SERIAL PRIMARY KEY,                -- Auto-incrementing ID
  video_id VARCHAR(20) NOT NULL,       -- Foreign key to videos.id
  start_time DECIMAL(10, 3) NOT NULL,  -- Start time in seconds
  end_time DECIMAL(10, 3) NOT NULL,    -- End time in seconds
  text TEXT NOT NULL,                  -- Subtitle text
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_subtitles_video_id` - For video-based queries
- `idx_subtitles_time` - For time-based queries
- `idx_subtitles_text` - Full-text search index

**Foreign Keys:**
- `video_id` references `videos(id)` with CASCADE DELETE

## Usage

### Development Setup

1. **Start PostgreSQL** (using Docker Compose from project root):
   ```bash
   docker-compose up -d postgres
   ```

2. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

3. **Seed with sample data**:
   ```bash
   npm run db:seed
   ```

### Available Scripts

- `npm run db:migrate` - Run pending migrations
- `npm run db:migrate:status` - Check migration status
- `npm run db:seed` - Insert sample data
- `npm run db:seed:clear` - Clear all data
- `npm run db:seed:reset` - Clear and re-seed data

### Environment Variables

Set these in your `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=youtube_pronunciation
DB_USER=postgres
DB_PASSWORD=postgres
```

## Models

### VideoModel

Provides CRUD operations for video records:

```typescript
import { VideoModel } from './models/Video';

const videoModel = new VideoModel(pool);

// Create a video
const video = await videoModel.create({
  id: 'dQw4w9WgXcQ',
  title: 'Sample Video',
  channelName: 'Sample Channel',
  duration: 212,
  accent: 'US',
  thumbnailUrl: 'https://example.com/thumb.jpg'
});

// Find by ID
const video = await videoModel.findById('dQw4w9WgXcQ');

// Find by accent
const videos = await videoModel.findByAccent('US', 20, 0);
```

### SubtitleModel

Provides CRUD operations for subtitle records:

```typescript
import { SubtitleModel } from './models/Subtitle';

const subtitleModel = new SubtitleModel(pool);

// Create subtitles
const subtitle = await subtitleModel.create({
  videoId: 'dQw4w9WgXcQ',
  startTime: 0.0,
  endTime: 3.5,
  text: 'Hello everyone'
});

// Find by video
const subtitles = await subtitleModel.findByVideoId('dQw4w9WgXcQ');

// Search by text
const results = await subtitleModel.searchByText('pronunciation');
```

## Migrations

### Creating a New Migration

1. Create a new file in `migrations/` with format: `XXX_description.sql`
2. Write your SQL DDL statements
3. Run `npm run db:migrate`

### Migration Example

```sql
-- Migration 002: Add video categories
CREATE TABLE video_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);

ALTER TABLE videos ADD COLUMN category_id INTEGER REFERENCES video_categories(id);
```

## Performance Considerations

### Indexes

The schema includes several indexes for optimal query performance:

1. **Accent filtering**: `idx_videos_accent` enables fast filtering by accent type
2. **Time-based queries**: `idx_subtitles_time` supports efficient subtitle lookups by time range
3. **Full-text search**: `idx_subtitles_text` enables fast text search using PostgreSQL's GIN index
4. **Foreign key lookups**: `idx_subtitles_video_id` optimizes joins between videos and subtitles

### Query Optimization

- Use prepared statements for repeated queries
- Leverage the full-text search index for subtitle text searches
- Use LIMIT and OFFSET for pagination
- Consider connection pooling for high-concurrency scenarios

## Testing

The models include comprehensive methods for testing scenarios:

- Batch operations for bulk data insertion
- Transaction support for data consistency
- Context queries for subtitle navigation
- Count aggregations for UI display

## Production Considerations

1. **Backup Strategy**: Implement regular database backups
2. **Connection Pooling**: Configure appropriate pool sizes
3. **Monitoring**: Set up query performance monitoring
4. **Security**: Use environment variables for credentials
5. **SSL**: Enable SSL connections in production
6. **Migrations**: Always test migrations on staging first