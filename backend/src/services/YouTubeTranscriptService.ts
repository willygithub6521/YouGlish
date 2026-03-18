import { YoutubeTranscript } from 'youtube-transcript';
import { createLogger } from '../utils/logger.js';
import type { Subtitle, Accent } from '../types/index.js';

const logger = createLogger();

export interface YouTubeTranscriptServiceOptions {
  defaultLang?: string;
}

/**
 * YouTubeTranscriptService
 * Connects to YouTube to fetch and parse video transcripts.
 */
export class YouTubeTranscriptService {
  private options: YouTubeTranscriptServiceOptions;

  constructor(options: YouTubeTranscriptServiceOptions = {}) {
    this.options = {
      defaultLang: 'en',
      ...options
    };
  }

  /**
   * Fetches transcript for a specific YouTube video ID.
   * Uses youtube-transcript which doesn't require an API key.
   */
  async fetchTranscript(videoId: string, lang?: string): Promise<any[]> {
    const targetLang = lang || this.options.defaultLang;
    try {
      // Provide lang as part of the config if the library supports it.
      // YoutubeTranscript.fetchTranscript prioritizes auto-generated if manual doesn't exist.
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: targetLang });
      return transcript;
    } catch (err: unknown) {
      const error = err as Error;
      logger.error(`Error fetching transcript for ${videoId}:`, error.message);
      throw new Error(`Failed to fetch YouTube transcript: ${error.message}`);
    }
  }

  /**
   * Normalizes the fetched transcript into our Subtitle format
   */
  parseSubtitles(transcriptData: any[], videoId: string): Omit<Subtitle, 'id' | 'createdAt'>[] {
    if (!Array.isArray(transcriptData)) {
      throw new Error('Invalid transcript data format');
    }

    return transcriptData.map((item) => {
      // Handle the format returned by youtube-transcript
      // Normally item has: text, duration, offset (start time)
      const startTime = item.offset || 0;
      const duration = item.duration || 0;
      
      return {
        videoId,
        startTime: Number(startTime),
        endTime: Number(startTime) + Number(duration),
        text: item.text ? this.decodeHTMLEntities(item.text) : ''
      };
    }).filter(sub => sub.text.trim().length > 0); // Remove empty subtitle entries
  }

  /**
   * Helper to decode HTML entities like &amp; &quot; &#39;
   */
  private decodeHTMLEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#xA;/g, '\n');
  }

  /**
   * Basic attempt to guess an accent type based on the content or metadata
   * (In a purely transcript-based solution this might return a default or 'ALL')
   */
  detectAccent(languageCode: string): Accent {
    const lang = languageCode.toLowerCase();
    if (lang.includes('us') || lang === 'en-us') return 'US';
    if (lang.includes('gb') || lang.includes('uk') || lang === 'en-gb') return 'UK';
    if (lang.includes('au')) return 'AU';
    if (lang.includes('ca')) return 'CA';
    
    // Default fallback if just 'en'
    if (lang === 'en') return 'US';
    
    return 'OTHER';
  }
}
