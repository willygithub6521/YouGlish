-- Migration 002: Performance indexes for subtitle search
-- Adds composite indexes to speed up the most common query patterns

-- 1. Full-text search index on subtitle text (PostgreSQL tsvector)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subtitles_text_search
  ON subtitles USING GIN (to_tsvector('english', text));

-- 2. Composite index for accent-filtered searches (most common filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subtitles_accent_video
  ON subtitles (accent, video_id);

-- 3. Index on video_id for fast join lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subtitles_video_id
  ON subtitles (video_id);

-- 4. Covering index for time-range queries (video player timestamp jump)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subtitles_video_time
  ON subtitles (video_id, start_time, end_time);

-- 5. Index on videos.accent for accent-count aggregations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_accent
  ON videos (accent);

-- 6. Partial index for non-ALL accent searches (avoid scanning ALL rows)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subtitles_accent_nonall
  ON subtitles (accent, start_time)
  WHERE accent != 'ALL';
