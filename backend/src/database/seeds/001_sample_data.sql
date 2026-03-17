-- Seed file: Sample data for development
-- This file contains sample videos and subtitles for testing

-- Insert sample videos
INSERT INTO videos (id, title, channel_name, duration, accent, thumbnail_url) VALUES
('dQw4w9WgXcQ', 'English Pronunciation Guide - American Accent', 'English Learning Channel', 212, 'US', 'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg'),
('oHg5SJYRHA0', 'British English Pronunciation Examples', 'BBC Learning English', 180, 'UK', 'https://img.youtube.com/vi/oHg5SJYRHA0/default.jpg'),
('jNQXAC9IVRw', 'Australian English Accent Tutorial', 'Aussie English', 245, 'AU', 'https://img.youtube.com/vi/jNQXAC9IVRw/default.jpg'),
('y6120QOlsfU', 'Canadian English Pronunciation', 'Canadian English Academy', 198, 'CA', 'https://img.youtube.com/vi/y6120QOlsfU/default.jpg')
ON CONFLICT (id) DO NOTHING;

-- Insert sample subtitles for American English video
INSERT INTO subtitles (video_id, start_time, end_time, text) VALUES
('dQw4w9WgXcQ', 0.0, 3.5, 'Hello everyone, welcome to this pronunciation example'),
('dQw4w9WgXcQ', 3.5, 7.2, 'Today we will learn how to pronounce difficult words correctly'),
('dQw4w9WgXcQ', 7.2, 11.8, 'The word "pronunciation" itself can be tricky for many learners'),
('dQw4w9WgXcQ', 11.8, 15.4, 'Let me demonstrate the correct American pronunciation'),
('dQw4w9WgXcQ', 15.4, 19.1, 'Notice how the stress falls on the fourth syllable'),
('dQw4w9WgXcQ', 19.1, 23.7, 'Another challenging word is "comfortable" with three syllables'),
('dQw4w9WgXcQ', 23.7, 27.3, 'Many students incorrectly add an extra syllable'),
('dQw4w9WgXcQ', 27.3, 31.0, 'The correct pronunciation is "COMF-ter-ble"'),

-- Insert sample subtitles for British English video
('oHg5SJYRHA0', 0.0, 4.1, 'This is another example of English pronunciation with a British accent'),
('oHg5SJYRHA0', 4.1, 8.3, 'Notice the different accent and intonation patterns'),
('oHg5SJYRHA0', 8.3, 12.6, 'The word "schedule" is pronounced differently in British English'),
('oHg5SJYRHA0', 12.6, 16.2, 'We say "SHED-yool" rather than "SKED-yool"'),
('oHg5SJYRHA0', 16.2, 20.5, 'Similarly, "advertisement" has the stress on the second syllable'),
('oHg5SJYRHA0', 20.5, 24.8, 'The pronunciation is "ad-VER-tis-ment" in British English'),
('oHg5SJYRHA0', 24.8, 28.4, 'These differences are important for learners to understand'),

-- Insert sample subtitles for Australian English video
('jNQXAC9IVRw', 0.0, 4.2, 'G''day mate! Let''s explore Australian English pronunciation'),
('jNQXAC9IVRw', 4.2, 8.7, 'Australian English has some unique characteristics and vocabulary'),
('jNQXAC9IVRw', 8.7, 13.1, 'The word "dance" is pronounced with a broad "a" sound'),
('jNQXAC9IVRw', 13.1, 17.4, 'We also have the famous Australian "rising intonation"'),
('jNQXAC9IVRw', 17.4, 21.8, 'This makes statements sound like questions sometimes'),
('jNQXAC9IVRw', 21.8, 26.2, 'The word "about" becomes "aboot" in some Australian dialects'),

-- Insert sample subtitles for Canadian English video
('y6120QOlsfU', 0.0, 3.8, 'Welcome to Canadian English pronunciation, eh?'),
('y6120QOlsfU', 3.8, 8.1, 'Canadian English shares features with both American and British English'),
('y6120QOlsfU', 8.1, 12.4, 'The famous "about" pronunciation is often exaggerated'),
('y6120QOlsfU', 12.4, 16.7, 'Most Canadians actually say it quite similarly to Americans'),
('y6120QOlsfU', 16.7, 21.0, 'However, we do have some distinctive pronunciation patterns'),
('y6120QOlsfU', 21.0, 25.3, 'The word "process" can be pronounced two different ways')
ON CONFLICT DO NOTHING;