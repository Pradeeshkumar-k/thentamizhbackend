import { OpenAI } from 'openai';
import { translate } from 'google-translate-api-x';
import dotenv from 'dotenv';
import prisma from '../utils/prisma';
import { invalidateNovelCache } from '../controllers/novelController';

const log = (msg: string) => {
  console.log(`[Translation] ${msg}`);
};

dotenv.config();

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) 
  : null;

/**
 * High-accuracy translation service
 * Prioritizes GPT-4 for literary context, falls back to Google if no key
 */
export const translateContent = async (text: string, to: string = 'en'): Promise<string> => {
  if (!text || text.trim() === '') return '';

  // 1. Try OpenAI if key is available
  if (openai) {
    try {
      log('Using OpenAI for high-accuracy translation...');
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a professional literary translator. Translate the following Tamil novel content into natural, engaging, and accurate English prose. Maintain the emotional tone and stylistic nuances of the original text."
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.7,
      });

      const translated = response.choices[0]?.message?.content;
      if (translated) {
        log('OpenAI Translation Success');
        return translated.trim();
      }
    } catch (openaiError: any) {
      log(`OpenAI Error: ${openaiError?.message || openaiError}. Code: ${openaiError?.code || 'N/A'}`);
      // Fall through to Google fallback
    }
  }

  // 2. Fallback to Google Translate (Free/Standard)
  try {
    log(`Falling back to Google Translate for text: ${text.substring(0, 30)}...`);
    const res = await translate(text, { 
      to, 
      forceBatch: false, 
      rejectOnPartialFail: false 
    });
    log('Google Translation Success');
    return res.text;
  } catch (googleError: any) {
    const errorMsg = googleError?.message || googleError;
    log(`Google Translation Error: ${errorMsg}`);
    throw new Error(`Translation failed. OpenAI key: ${!!openai}. Google Error: ${errorMsg}`);
  }
};

export const TranslationService = {
  translateTextOrNull: async (text: string | { [key: string]: string }): Promise<string | null> => {
    if (!text) return null;
    try {
      // Handle title objects if they exist
      const sourceText = typeof text === 'string' ? text : (text.tamil || text.english || '');
      if (!sourceText) return null;
      return await translateContent(sourceText);
    } catch (e) {
      log(`translateTextOrNull Error: ${e}`);
      return null;
    }
  },

  translateAndSaveNovel: async (novelId: string): Promise<void> => {
    try {
      // 1. Check & Lock (Atomic-ish check)
      const novel = await prisma.novel.findUnique({ where: { id: novelId } });
      if (!novel) return;

      // If already done or in progress, skip
      // @ts-ignore: 'translationStatus' might not be in generated client yet until `prisma generate`
      if (novel.translationStatus === 'IN_PROGRESS' || novel.translationStatus === 'DONE') {
          // console.log(`[Background] Novel ${novelId} translation already in progress or done.`);
          return;
      }
      
      // If we are here, status is likely PENDING (or null/draft if old data)
      // Lock it now
      await prisma.novel.update({
          where: { id: novelId },
          data: { translationStatus: 'IN_PROGRESS' } as any 
      });

      let updates: any = {};
      let needsUpdate = false;

      // Helper for Timeout
      const promiseWithTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
          return Promise.race([
              promise,
              new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
          ]);
      };

      if (!novel.titleEn && novel.title) {
          try {
              const translatedTitle = await promiseWithTimeout(
                  TranslationService.translateTextOrNull(novel.title),
                  15000,
                  null
              );
              if (translatedTitle) {
                  updates.titleEn = translatedTitle;
                  needsUpdate = true;
              }
          } catch (e) {
              log(`[Background] Title translation failed for ${novelId}: ${e}`);
          }
      }

      if (!novel.descriptionEn && novel.description) {
          try {
              const translatedDesc = await promiseWithTimeout(
                   TranslationService.translateTextOrNull(novel.description),
                   15000,
                   null
              );
              if (translatedDesc) {
                  updates.descriptionEn = translatedDesc;
                  needsUpdate = true;
              }
          } catch (e) {
              log(`[Background] Description translation failed for ${novelId}: ${e}`);
          }
      }

      // Finish Up
      if (needsUpdate) {
          updates.translationStatus = 'DONE';
          await prisma.novel.update({
              where: { id: novelId },
              data: updates
          });
          log(`[Background] Auto-translated novel ${novelId} DONE and saved.`);
          
          try {
              invalidateNovelCache(); 
          } catch(e) { /* ignore circular dep warning */ }
      } else {
          // If no updates needed (already had data?), just mark DONE
          await prisma.novel.update({
              where: { id: novelId },
              data: { translationStatus: 'DONE' } as any
          });
      }

    } catch (err) {
      log(`translateAndSaveNovel Error: ${err}`);
      // Unlock on error so it can be retried
      try {
          await prisma.novel.update({
              where: { id: novelId },
              data: { translationStatus: 'PENDING' } as any
          });
      } catch (e) { /* ignore */ }
    }
  }
};
