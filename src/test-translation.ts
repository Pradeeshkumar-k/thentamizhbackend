import { translate } from 'google-translate-api-x';

async function test() {
  try {
    console.log("Testing translation...");
    const res = await translate('வணக்கம்', { to: 'en' });
    console.log("Original: வணக்கம்");
    console.log("Translated:", res.text);
  } catch (e) {
    console.error("Translation Error:", e);
  }
}

test();
