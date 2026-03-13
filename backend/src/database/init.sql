-- YouTube Pronunciation Search Database Schema
-- This script initializes the PostgreSQL database with required tables and indexes

-- Create extension for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
    id VARCHAR(20) PRIMARY KEY,
    title TEXT NOT NULL,
    channel_name VARCHAR(255) NOT NULL,
    duration INTEGER NOT NULL,
    accent VARCHAR(10) NOT NULL CHECK (accent IN ('ALL', 'US', 'UK', 'AU', 'CA', 'OTHER')),
    thumbnail_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create subtitles table
CREATE TABLE IF NOT EXISTS subtitles (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(20) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    start_time DECIMAL(10, 3) NOT NULL,
    end_time DECIMAL(10, 3) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_accent ON videos(accent);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_subtitles_video_id ON subtitles(video_id);
CREATE INDEX IF NOT EXISTS idx_subtitles_time ON subtitles(video_id, start_time);
CREATE INDEX IF NOT EXISTS idx_subtitles_text ON subtitles USING gin(to_tsvector('english', text));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_videos_updated_at 
    BEFORE UPDATE ON videos 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for development (optional)
-- This will be replaced with real data from YouTube API
INSERT INTO videos (id, title, channel_name, duration, accent, thumbnail_url) VALUES
('dQw4w9WgXcQ', 'Sample Video 1', 'Sample Channel', 212, 'US', 'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg'),
('oHg5SJYRHA0', 'Sample Video 2', 'Another Channel', 180, 'UK', 'https://img.youtube.com/vi/oHg5SJYRHA0/default.jpg')
ON CONFLICT (id) DO NOTHING;

INSERT INTO subtitles (video_id, start_time, end_time, text) VALUES
('dQw4w9WgXcQ', 0.0, 3.5, 'Hello everyone, welcome to this pronunciation example'),
('dQw4w9WgXcQ', 3.5, 7.2, 'Today we will learn how to pronounce difficult words'),
('oHg5SJYRHA0', 0.0, 4.1, 'This is another example of English pronunciation'),
('oHg5SJYRHA0', 4.1, 8.3, 'Notice the different accent in this video')
ON CONFLICT DO NOTHING;