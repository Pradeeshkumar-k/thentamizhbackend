"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const google_translate_api_x_1 = require("google-translate-api-x");
async function test() {
    try {
        console.log("Testing translation...");
        const res = await (0, google_translate_api_x_1.translate)('வணக்கம்', { to: 'en' });
        console.log("Original: வணக்கம்");
        console.log("Translated:", res.text);
    }
    catch (e) {
        console.error("Translation Error:", e);
    }
}
test();
