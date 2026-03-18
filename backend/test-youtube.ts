import { YouTubeApiService } from './src/services/YouTubeApiService.js';
import { YouTubeTranscriptService } from './src/services/YouTubeTranscriptService.js';
import dotenv from 'dotenv';

// Load environment variables for the API key
dotenv.config();

async function runTest() {
  console.log('Starting YouTube API Integration Test...');
  
  const videoId = 'dQw4w9WgXcQ'; // Never Gonna Give You Up (a classic test video)
  
  try {
    // 1. Test YouTube Data API (Metadata)
    console.log(`\n--- Fetching Metadata for Video ID: ${videoId} ---`);
    const apiService = new YouTubeApiService();
    const metadata = await apiService.getVideoMetadata(videoId);
    
    console.log('Metadata Fetched Successfully:');
    console.log(`Title: ${(metadata as any).title}`);
    console.log(`Channel: ${(metadata as any).channelName}`);
    console.log(`Duration: ${(metadata as any).duration} seconds`);
    console.log(`Thumbnail URL: ${(metadata as any).thumbnailUrl}`);
    console.log(`Published At: ${(metadata as any).publishedAt}`);
    
    // 2. Test YouTube Transcript API (Subtitles)
    console.log(`\n--- Fetching Transcript for Video ID: ${videoId} ---`);
    const transcriptService = new YouTubeTranscriptService();
    
    // Fetch raw transcript (we'll look for English 'en' first)
    const rawTranscript = await transcriptService.fetchTranscript(videoId);
    
    console.log(`Raw Transcript Fetched. Total segments: ${rawTranscript.length}`);
    
    // Parse into our subtitle format
    const subtitles = transcriptService.parseSubtitles(rawTranscript);
    
    console.log(`Parsed Subtitles. Total items: ${subtitles.length}`);
    
    if (subtitles.length > 0) {
      console.log('First 3 subtitles:');
      console.log(subtitles.slice(0, 3));
    }
    
    // 3. Test Accent Detection
    console.log('\n--- Testing Accent Detection ---');
    // Simulate some language codes
    const codesToTest = ['en-US', 'en-GB', 'en-AU', 'es', 'fr'];
    for (const code of codesToTest) {
       console.log(`Language code '${code}' maps to accent: ${transcriptService.detectAccent(code)}`);
    }

    console.log('\n✅ Integration Test Completed Successfully!');

  } catch (error: any) {
    console.error('\n❌ Integration Test Failed:', error.message);
  }
}

runTest();
