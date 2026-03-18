import { google, youtube_v3 } from 'googleapis';
import { createLogger } from '../utils/logger.js';
import type { YouTubeVideoData } from '../types/index.js';

const logger = createLogger();

export interface YouTubeApiServiceOptions {
  apiKey?: string;
}

/**
 * YouTubeApiService
 * Connects to the YouTube Data API v3 to fetch metadata.
 */
export class YouTubeApiService {
  private youtube: youtube_v3.Youtube;

  constructor(options: YouTubeApiServiceOptions = {}) {
    const apiKey = options.apiKey || process.env.YOUTUBE_API_KEY;
    
    if (!apiKey && process.env.NODE_ENV !== 'test') {
      logger.warn('YOUTUBE_API_KEY is not set. API calls will fail.');
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: apiKey || 'dummy-key-for-test'
    });
  }

  /**
   * Fetches metadata for a specific YouTube video ID.
   */
  async getVideoMetadata(videoId: string): Promise<YouTubeVideoData | null> {
    try {
      const response = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails'],
        id: [videoId]
      });

      const items = response.data.items;

      if (!items || items.length === 0) {
        return null; // Video not found
      }

      const item = items[0];
      
      // Map to our expected format
      return {
        id: item.id!,
        snippet: {
          title: item.snippet?.title || '',
          channelTitle: item.snippet?.channelTitle || '',
          thumbnails: {
            default: { url: item.snippet?.thumbnails?.default?.url || '' },
            medium: { url: item.snippet?.thumbnails?.medium?.url || '' },
            high: { url: item.snippet?.thumbnails?.high?.url || '' }
          }
        },
        contentDetails: {
          duration: item.contentDetails?.duration || ''
        }
      };

    } catch (err: unknown) {
      const error = err as Error;
      logger.error(`Error fetching video metadata for ${videoId}:`, error.message);
      throw new Error(`Failed to fetch YouTube API: ${error.message}`);
    }
  }

  /**
   * Parse ISO 8601 duration (e.g. PT1H2M10S) to seconds
   */
  public static parseISO8601Duration(duration: string): number {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    
    if (!match) return 0;
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    return hours * 3600 + minutes * 60 + seconds;
  }
}
