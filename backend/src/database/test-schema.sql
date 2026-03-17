-- Test script to validate the database schema
-- This script can be run manually to verify the schema is correct

-- Test 1: Verify videos table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'videos' 
ORDER BY ordinal_position;

-- Test 2: Verify subtitles table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'subtitles' 
ORDER BY ordinal_position;

-- Test 3: Verify indexes exist
SELECT 
    indexname, 
    tablename, 
    indexdef
FROM pg_indexes 
WHERE tablename IN ('videos', 'subtitles')
ORDER BY tablename, indexname;

-- Test 4: Verify foreign key constraints
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('videos', 'subtitles');

-- Test 5: Verify check constraints (accent values)
SELECT 
    constraint_name,
    table_name,
    check_clause
FROM information_schema.check_constraints
WHERE table_name = 'videos';

-- Test 6: Test sample data insertion (should work without errors)
BEGIN;

-- Insert test video
INSERT INTO videos (id, title, channel_name, duration, accent, thumbnail_url) 
VALUES ('TEST123', 'Test Video', 'Test Channel', 120, 'US', 'https://example.com/thumb.jpg')
ON CONFLICT (id) DO NOTHING;

-- Insert test subtitle
INSERT INTO subtitles (video_id, start_time, end_time, text)
VALUES ('TEST123', 0.0, 5.0, 'This is a test subtitle for pronunciation testing')
ON CONFLICT DO NOTHING;

-- Verify the data was inserted
SELECT COUNT(*) as video_count FROM videos WHERE id = 'TEST123';
SELECT COUNT(*) as subtitle_count FROM subtitles WHERE video_id = 'TEST123';

-- Clean up test data
DELETE FROM subtitles WHERE video_id = 'TEST123';
DELETE FROM videos WHERE id = 'TEST123';

ROLLBACK;