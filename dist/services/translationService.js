"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationService = exports.translateContent = void 0;
const openai_1 = require("openai");
const google_translate_api_x_1 = require("google-translate-api-x");
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logFile = path_1.default.join(__dirname, '../../translation_debug.log');
const log = (msg) => {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    fs_1.default.appendFileSync(logFile, entry);
    console.log(msg);
};
dotenv_1.default.config();
const openai = process.env.OPENAI_API_KEY
    ? new openai_1.OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;
/**
 * High-accuracy translation service
 * Prioritizes GPT-4 for literary context, falls back to Google if no key
 */
const translateContent = async (text, to = 'en') => {
    if (!text || text.trim() === '')
        return '';
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
        }
        catch (openaiError) {
            log(`OpenAI Error Details: ${openaiError?.message || openaiError}`);
            // Fall through to Google fallback
        }
    }
    // 2. Fallback to Google Translate (Free/Standard)
    try {
        log('Falling back to Google Translate...');
        const res = await (0, google_translate_api_x_1.translate)(text, { to });
        log('Google Translation Success');
        return res.text;
    }
    catch (googleError) {
        log(`Google Translation Error: ${googleError?.message || googleError}`);
        throw new Error('Translation failed in both AI and Standard modes.');
    }
};
exports.translateContent = translateContent;
exports.TranslationService = {
    translateTextOrNull: async (text) => {
        if (!text)
            return null;
        try {
            // Handle title objects if they exist
            const sourceText = typeof text === 'string' ? text : (text.tamil || text.english || '');
            if (!sourceText)
                return null;
            return await (0, exports.translateContent)(sourceText);
        }
        catch (e) {
            log(`translateTextOrNull Error: ${e}`);
            return null;
        }
    }
};
