import { YouTubeApiService } from './YouTubeApiService';

// Mock the googleapis module
const mockYoutubeList = jest.fn();
jest.mock('googleapis', () => ({
  google: {
    youtube: jest.fn().mockImplementation(() => ({
      videos: {
        list: mockYoutubeList
      }
    }))
  }
}));

describe('YouTubeApiService', () => {
  let apiService: YouTubeApiService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.YOUTUBE_API_KEY = 'test-api-key';
    apiService = new YouTubeApiService();
  });

  describe('getVideoMetadata', () => {
    it('should return null when video is not found', async () => {
      mockYoutubeList.mockResolvedValueOnce({
        data: { items: [] }
      });

      const result = await apiService.getVideoMetadata('not-found-id');
      expect(result).toBeNull();
      expect(mockYoutubeList).toHaveBeenCalledWith({
        part: ['snippet', 'contentDetails'],
        id: ['not-found-id']
      });
    });

    it('should map youtube api response correctly', async () => {
      mockYoutubeList.mockResolvedValueOnce({
        data: {
          items: [{
            id: 'valid-id',
            snippet: {
              title: 'Test Video',
              channelTitle: 'Test Channel',
              thumbnails: {
                default: { url: 'default.jpg' },
                medium: { url: 'medium.jpg' },
                high: { url: 'high.jpg' }
              }
            },
            contentDetails: {
              duration: 'PT1H2M10S'
            }
          }]
        }
      });

      const result = await apiService.getVideoMetadata('valid-id');
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe('valid-id');
      expect(result?.snippet.title).toBe('Test Video');
      expect(result?.contentDetails.duration).toBe('PT1H2M10S');
    });

    it('should handle API errors', async () => {
      mockYoutubeList.mockRejectedValueOnce(new Error('API quota exceeded'));

      await expect(apiService.getVideoMetadata('error-id')).rejects.toThrow('Failed to fetch YouTube API: API quota exceeded');
    });
  });

  describe('parseISO8601Duration', () => {
    it('should parse hours, minutes, and seconds properly', () => {
      expect(YouTubeApiService.parseISO8601Duration('PT1H2M10S')).toBe(3730);
    });

    it('should parse minutes and seconds', () => {
      expect(YouTubeApiService.parseISO8601Duration('PT5M30S')).toBe(330);
    });

    it('should handle missing components gracefully', () => {
      expect(YouTubeApiService.parseISO8601Duration('PT45S')).toBe(45);
      expect(YouTubeApiService.parseISO8601Duration('invalid-format')).toBe(0);
    });
  });
});
