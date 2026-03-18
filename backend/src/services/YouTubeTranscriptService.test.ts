import { YouTubeTranscriptService } from './YouTubeTranscriptService';
import { YoutubeTranscript } from 'youtube-transcript';

// Mock the youtube-transcript library
jest.mock('youtube-transcript');

describe('YouTubeTranscriptService', () => {
  let service: YouTubeTranscriptService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new YouTubeTranscriptService();
  });

  describe('fetchTranscript', () => {
    it('should fetch transcript successfully', async () => {
      const mockData = [{ text: 'Hello', duration: 1000, offset: 0 }];
      (YoutubeTranscript.fetchTranscript as jest.Mock).mockResolvedValueOnce(mockData);

      const result = await service.fetchTranscript('test-id');
      expect(result).toBe(mockData);
      expect(YoutubeTranscript.fetchTranscript).toHaveBeenCalledWith('test-id', { lang: 'en' });
    });

    it('should handle parsing errors properly', async () => {
      (YoutubeTranscript.fetchTranscript as jest.Mock).mockRejectedValueOnce(new Error('Video unavailable'));

      await expect(service.fetchTranscript('error-id')).rejects.toThrow('Failed to fetch YouTube transcript: Video unavailable');
    });
  });

  describe('parseSubtitles', () => {
    it('should normalize and structure transcript data properly', () => {
      const rawTranscript = [
        { text: 'Hello world', duration: 2500, offset: 1000 },
        { text: 'How are you?', duration: 1500, offset: 3500 },
        { text: ' ', duration: 100, offset: 5000 } // empty should be filtered
      ];

      const result = service.parseSubtitles(rawTranscript, 'test-id');

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({
        videoId: 'test-id',
        startTime: 1000,
        endTime: 3500,
        text: 'Hello world'
      });
      expect(result[1]).toEqual({
        videoId: 'test-id',
        startTime: 3500,
        endTime: 5000,
        text: 'How are you?'
      });
    });

    it('should decode HTML entities', () => {
      const rawTranscript = [
        { text: 'It&#39;s an &quot;example&quot; &amp; test', duration: 1000, offset: 0 }
      ];

      const result = service.parseSubtitles(rawTranscript, 'test-vid');

      expect(result[0].text).toBe("It's an \"example\" & test");
    });

    it('should throw on invalid format', () => {
      expect(() => service.parseSubtitles(null as any, 'vid')).toThrow('Invalid transcript data format');
    });
  });

  describe('detectAccent', () => {
    it('should detect US from valid region descriptors', () => {
      expect(service.detectAccent('en-US')).toBe('US');
      expect(service.detectAccent('en')).toBe('US'); // default fallback
    });

    it('should detect UK from valid region descriptors', () => {
      expect(service.detectAccent('en-GB')).toBe('UK');
      expect(service.detectAccent('uk')).toBe('UK');
    });

    it('should handle OTHER', () => {
      expect(service.detectAccent('fr')).toBe('OTHER');
    });
  });
});
