
import { TranslationService } from './services/translationService';

async function testPerformance() {
    console.log("Starting Performance Test...");
    
    // Generate a Large Dummy Text (~5000 chars)
    const paragraphs = [];
    for (let i = 0; i < 20; i++) {
        paragraphs.push(`This is paragraph ${i + 1}. It contains some text to simulate a novel chapter. The sun was setting over the horizon, casting a golden glow over the village. Karthik looked at the train tracks and sighed. Life was not easy for him.`);
    }
    const text = paragraphs.join('\n\n');
    console.log(`Text Length: ${text.length} characters`);

    const start = Date.now();
    try {
        const result = await TranslationService.translateTextOrNull(text);
        const end = Date.now();
        console.log(`Translation Time: ${((end - start) / 1000).toFixed(2)}s`);
        console.log(`Result Length: ${result ? result.length : 'NULL'}`);
        if (!result) console.log("Translation returned NULL (Failed)");
    } catch (e) {
        console.error("Test Failed", e);
    }
}

testPerformance();
