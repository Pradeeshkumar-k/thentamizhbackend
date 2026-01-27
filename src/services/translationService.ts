import { OpenAI } from 'openai';
import { translate } from 'google-translate-api-x';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const logFile = path.join(__dirname, '../../translation_debug.log');
const log = (msg: string) => {
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, entry);
  console.log(msg);
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
      log(`OpenAI Error Details: ${openaiError?.message || openaiError}`);
      // Fall through to Google fallback
    }
  }

  // 2. Fallback to Google Translate (Free/Standard)
  try {
    log('Falling back to Google Translate...');
    const res = await translate(text, { 
      to, 
      forceBatch: false, 
      rejectOnPartialFail: false 
    });
    log('Google Translation Success');
    return res.text;
  } catch (googleError: any) {
    log(`Google Translation Error: ${googleError?.message || googleError}`);
    throw new Error('Translation failed in both AI and Standard modes.');
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
  }
};
