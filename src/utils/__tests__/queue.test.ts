import { addTranslationJob } from '../queue';
import { TranslationService } from '../../services/translationService';

// Mock the TranslationService
jest.mock('../../services/translationService', () => ({
  TranslationService: {
    translateAndSaveNovel: jest.fn(),
    translateAndSaveChapter: jest.fn(),
  },
}));

// Mock console methods to avoid noise in test output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('addTranslationJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('novel translation', () => {
    it('should call translateAndSaveNovel for novel type', async () => {
      const mockTranslateNovel = TranslationService.translateAndSaveNovel as jest.MockedFunction<
        typeof TranslationService.translateAndSaveNovel
      >;
      mockTranslateNovel.mockResolvedValueOnce(undefined);

      await addTranslationJob('novel', 'novel-123');

      expect(mockConsoleLog).toHaveBeenCalledWith('[QUEUE] Fire-and-forget translation for novel: novel-123');
      expect(mockTranslateNovel).toHaveBeenCalledWith('novel-123');
      expect(TranslationService.translateAndSaveChapter).not.toHaveBeenCalled();
    });

    it('should handle errors from translateAndSaveNovel', async () => {
      const mockTranslateNovel = TranslationService.translateAndSaveNovel as jest.MockedFunction<
        typeof TranslationService.translateAndSaveNovel
      >;
      const testError = new Error('Novel translation failed');
      mockTranslateNovel.mockRejectedValueOnce(testError);

      await addTranslationJob('novel', 'novel-456');

      // Give the promise time to settle
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockConsoleLog).toHaveBeenCalledWith('[QUEUE] Fire-and-forget translation for novel: novel-456');
      expect(mockTranslateNovel).toHaveBeenCalledWith('novel-456');
      expect(mockConsoleError).toHaveBeenCalledWith('[Translation Failure]', testError);
    });

    it('should not throw when translateAndSaveNovel rejects', async () => {
      const mockTranslateNovel = TranslationService.translateAndSaveNovel as jest.MockedFunction<
        typeof TranslationService.translateAndSaveNovel
      >;
      mockTranslateNovel.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      await expect(addTranslationJob('novel', 'novel-789')).resolves.toBeUndefined();
    });

    it('should handle multiple novel translation jobs in parallel', async () => {
      const mockTranslateNovel = TranslationService.translateAndSaveNovel as jest.MockedFunction<
        typeof TranslationService.translateAndSaveNovel
      >;
      mockTranslateNovel.mockResolvedValue(undefined);

      await Promise.all([
        addTranslationJob('novel', 'novel-1'),
        addTranslationJob('novel', 'novel-2'),
        addTranslationJob('novel', 'novel-3'),
      ]);

      expect(mockTranslateNovel).toHaveBeenCalledTimes(3);
      expect(mockTranslateNovel).toHaveBeenCalledWith('novel-1');
      expect(mockTranslateNovel).toHaveBeenCalledWith('novel-2');
      expect(mockTranslateNovel).toHaveBeenCalledWith('novel-3');
    });
  });

  describe('chapter translation', () => {
    it('should call translateAndSaveChapter for chapter type', async () => {
      const mockTranslateChapter = TranslationService.translateAndSaveChapter as jest.MockedFunction<
        typeof TranslationService.translateAndSaveChapter
      >;
      mockTranslateChapter.mockResolvedValueOnce('translated content');

      await addTranslationJob('chapter', 'chapter-123');

      expect(mockConsoleLog).toHaveBeenCalledWith('[QUEUE] Fire-and-forget translation for chapter: chapter-123');
      expect(mockTranslateChapter).toHaveBeenCalledWith('chapter-123');
      expect(TranslationService.translateAndSaveNovel).not.toHaveBeenCalled();
    });

    it('should handle errors from translateAndSaveChapter', async () => {
      const mockTranslateChapter = TranslationService.translateAndSaveChapter as jest.MockedFunction<
        typeof TranslationService.translateAndSaveChapter
      >;
      const testError = new Error('Chapter translation failed');
      mockTranslateChapter.mockRejectedValueOnce(testError);

      await addTranslationJob('chapter', 'chapter-456');

      // Give the promise time to settle
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockConsoleLog).toHaveBeenCalledWith('[QUEUE] Fire-and-forget translation for chapter: chapter-456');
      expect(mockTranslateChapter).toHaveBeenCalledWith('chapter-456');
      expect(mockConsoleError).toHaveBeenCalledWith('[Translation Failure]', testError);
    });

    it('should not throw when translateAndSaveChapter rejects', async () => {
      const mockTranslateChapter = TranslationService.translateAndSaveChapter as jest.MockedFunction<
        typeof TranslationService.translateAndSaveChapter
      >;
      mockTranslateChapter.mockRejectedValueOnce(new Error('Database error'));

      // Should not throw
      await expect(addTranslationJob('chapter', 'chapter-789')).resolves.toBeUndefined();
    });

    it('should handle multiple chapter translation jobs in parallel', async () => {
      const mockTranslateChapter = TranslationService.translateAndSaveChapter as jest.MockedFunction<
        typeof TranslationService.translateAndSaveChapter
      >;
      mockTranslateChapter.mockResolvedValue('translated');

      await Promise.all([
        addTranslationJob('chapter', 'chapter-1'),
        addTranslationJob('chapter', 'chapter-2'),
        addTranslationJob('chapter', 'chapter-3'),
      ]);

      expect(mockTranslateChapter).toHaveBeenCalledTimes(3);
      expect(mockTranslateChapter).toHaveBeenCalledWith('chapter-1');
      expect(mockTranslateChapter).toHaveBeenCalledWith('chapter-2');
      expect(mockTranslateChapter).toHaveBeenCalledWith('chapter-3');
    });

    it('should handle chapter translation returning null', async () => {
      const mockTranslateChapter = TranslationService.translateAndSaveChapter as jest.MockedFunction<
        typeof TranslationService.translateAndSaveChapter
      >;
      mockTranslateChapter.mockResolvedValueOnce(null);

      await addTranslationJob('chapter', 'chapter-null');

      expect(mockTranslateChapter).toHaveBeenCalledWith('chapter-null');
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string IDs', async () => {
      const mockTranslateNovel = TranslationService.translateAndSaveNovel as jest.MockedFunction<
        typeof TranslationService.translateAndSaveNovel
      >;
      mockTranslateNovel.mockResolvedValueOnce(undefined);

      await addTranslationJob('novel', '');

      expect(mockConsoleLog).toHaveBeenCalledWith('[QUEUE] Fire-and-forget translation for novel: ');
      expect(mockTranslateNovel).toHaveBeenCalledWith('');
    });

    it('should handle special characters in IDs', async () => {
      const mockTranslateChapter = TranslationService.translateAndSaveChapter as jest.MockedFunction<
        typeof TranslationService.translateAndSaveChapter
      >;
      mockTranslateChapter.mockResolvedValueOnce('translated');

      const specialId = 'chapter-#@!$%^&*()';
      await addTranslationJob('chapter', specialId);

      expect(mockConsoleLog).toHaveBeenCalledWith(`[QUEUE] Fire-and-forget translation for chapter: ${specialId}`);
      expect(mockTranslateChapter).toHaveBeenCalledWith(specialId);
    });

    it('should handle very long IDs', async () => {
      const mockTranslateNovel = TranslationService.translateAndSaveNovel as jest.MockedFunction<
        typeof TranslationService.translateAndSaveNovel
      >;
      mockTranslateNovel.mockResolvedValueOnce(undefined);

      const longId = 'novel-' + 'a'.repeat(1000);
      await addTranslationJob('novel', longId);

      expect(mockTranslateNovel).toHaveBeenCalledWith(longId);
    });

    it('should not call any translation method for invalid type', async () => {
      // Cast to bypass TypeScript check for testing runtime behavior
      await addTranslationJob('invalid' as any, 'test-id');

      expect(TranslationService.translateAndSaveNovel).not.toHaveBeenCalled();
      expect(TranslationService.translateAndSaveChapter).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('[QUEUE] Fire-and-forget translation for invalid: test-id');
    });
  });

  describe('fire-and-forget behavior', () => {
    it('should return immediately without waiting for translation to complete', async () => {
      const mockTranslateNovel = TranslationService.translateAndSaveNovel as jest.MockedFunction<
        typeof TranslationService.translateAndSaveNovel
      >;

      // Create a promise that takes 100ms to resolve
      mockTranslateNovel.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(undefined), 100))
      );

      const start = Date.now();
      await addTranslationJob('novel', 'novel-slow');
      const elapsed = Date.now() - start;

      // Should return almost immediately (much less than 100ms)
      expect(elapsed).toBeLessThan(50);
      expect(mockTranslateNovel).toHaveBeenCalled();
    });

    it('should not propagate errors to caller', async () => {
      const mockTranslateChapter = TranslationService.translateAndSaveChapter as jest.MockedFunction<
        typeof TranslationService.translateAndSaveChapter
      >;
      mockTranslateChapter.mockRejectedValueOnce(new Error('Catastrophic failure'));

      // Should not throw even though the background promise rejects
      await expect(addTranslationJob('chapter', 'chapter-fail')).resolves.toBeUndefined();
    });
  });

  describe('mixed scenarios', () => {
    it('should handle alternating novel and chapter jobs', async () => {
      const mockTranslateNovel = TranslationService.translateAndSaveNovel as jest.MockedFunction<
        typeof TranslationService.translateAndSaveNovel
      >;
      const mockTranslateChapter = TranslationService.translateAndSaveChapter as jest.MockedFunction<
        typeof TranslationService.translateAndSaveChapter
      >;

      mockTranslateNovel.mockResolvedValue(undefined);
      mockTranslateChapter.mockResolvedValue('translated');

      await addTranslationJob('novel', 'novel-1');
      await addTranslationJob('chapter', 'chapter-1');
      await addTranslationJob('novel', 'novel-2');
      await addTranslationJob('chapter', 'chapter-2');

      expect(mockTranslateNovel).toHaveBeenCalledTimes(2);
      expect(mockTranslateChapter).toHaveBeenCalledTimes(2);
    });

    it('should handle some jobs succeeding and others failing', async () => {
      const mockTranslateNovel = TranslationService.translateAndSaveNovel as jest.MockedFunction<
        typeof TranslationService.translateAndSaveNovel
      >;

      mockTranslateNovel
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(undefined);

      await addTranslationJob('novel', 'novel-success-1');
      await addTranslationJob('novel', 'novel-fail');
      await addTranslationJob('novel', 'novel-success-2');

      // Give promises time to settle
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockTranslateNovel).toHaveBeenCalledTimes(3);
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
    });
  });

  describe('logging behavior', () => {
    it('should log with correct format for novel', async () => {
      const mockTranslateNovel = TranslationService.translateAndSaveNovel as jest.MockedFunction<
        typeof TranslationService.translateAndSaveNovel
      >;
      mockTranslateNovel.mockResolvedValueOnce(undefined);

      await addTranslationJob('novel', 'test-novel-id');

      expect(mockConsoleLog).toHaveBeenCalledWith('[QUEUE] Fire-and-forget translation for novel: test-novel-id');
    });

    it('should log with correct format for chapter', async () => {
      const mockTranslateChapter = TranslationService.translateAndSaveChapter as jest.MockedFunction<
        typeof TranslationService.translateAndSaveChapter
      >;
      mockTranslateChapter.mockResolvedValueOnce('translated');

      await addTranslationJob('chapter', 'test-chapter-id');

      expect(mockConsoleLog).toHaveBeenCalledWith('[QUEUE] Fire-and-forget translation for chapter: test-chapter-id');
    });

    it('should log errors with correct format', async () => {
      const mockTranslateNovel = TranslationService.translateAndSaveNovel as jest.MockedFunction<
        typeof TranslationService.translateAndSaveNovel
      >;
      const error = new Error('Test error');
      mockTranslateNovel.mockRejectedValueOnce(error);

      await addTranslationJob('novel', 'error-novel');

      // Give promise time to settle
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockConsoleError).toHaveBeenCalledWith('[Translation Failure]', error);
    });
  });
});