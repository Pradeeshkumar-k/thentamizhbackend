import { TranslationService } from '../services/translationService';


export const addTranslationJob = async (type: 'novel' | 'chapter', id: string) => {
  console.log(`[QUEUE] Fire-and-forget translation for ${type}: ${id}`);
  
  // Fire and forget
  if (type === 'novel') {
    TranslationService.translateAndSaveNovel(id).catch(err => {
      console.error('[Translation Failure]', err);
    });
  } else if (type === 'chapter') {
    TranslationService.translateAndSaveChapter(id).catch(err => {
      console.error('[Translation Failure]', err);
    });
  }
};
