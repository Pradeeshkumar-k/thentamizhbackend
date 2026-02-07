import { translateContent } from '../services/translationService';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log("Testing Translation Service...");
  console.log("OpenAI Key Present:", !!process.env.OPENAI_API_KEY);
  
  const text = "பூஞ்சோலை கிராமம் ஒரு அழகிய கிராமம்.";
  console.log(`Original: ${text}`);

  try {
    const result = await translateContent(text, 'en');
    console.log(`Translated: ${result}`);
  } catch (error) {
    console.error("Translation Failed:", error);
  }
}

test();
