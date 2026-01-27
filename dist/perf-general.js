"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
async function testGeneralPerformance() {
    const logFile = 'perf-general-output.txt';
    const log = (msg) => {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    };
    fs.writeFileSync(logFile, 'Starting General Performance Test\n');
    const baseUrl = 'http://localhost:5000/api';
    // Test 1: Get Novels List
    const startList = Date.now();
    try {
        log("Fetching /novels list (limit=100)...");
        const res = await fetch(`${baseUrl}/novels?limit=100`);
        const endList = Date.now();
        log(`[List] Status: ${res.status}, Time: ${((endList - startList) / 1000).toFixed(2)}s`);
        if (res.ok) {
            const data = await res.json();
            const novels = data.novels || data;
            log(`[List] Count: ${novels.length}`);
            // Test 2: Get Single Novel (No Translation)
            if (novels.length > 0) {
                const novelId = novels[0].id || novels[0]._id;
                const startDetail = Date.now();
                log(`Fetching /novels/${novelId} (No Lang)...`);
                const resDetail = await fetch(`${baseUrl}/novels/${novelId}`);
                const endDetail = Date.now();
                log(`[Detail] Status: ${resDetail.status}, Time: ${((endDetail - startDetail) / 1000).toFixed(2)}s`);
                // Test 3: Get Chapter Content (Chapter 1 of the novel)
                // We need a chapter ID. Let's assume the novel detail response has chapters.
                const detailJson = await resDetail.json();
                const chapterId = detailJson.chapters?.[0]?.id || detailJson.novel?.chapters?.[0]?.id; // Handle both structures
                if (chapterId) {
                    log(`Fetching Chapter ${chapterId} (Cold)...`);
                    const startChap1 = Date.now();
                    await fetch(`${baseUrl}/chapters/${chapterId}?lang=english`);
                    const endChap1 = Date.now();
                    log(`[Chapter Cold] Time: ${((endChap1 - startChap1) / 1000).toFixed(2)}s`);
                    log(`Fetching Chapter ${chapterId} (Warm/Cached)...`);
                    const startChap2 = Date.now();
                    await fetch(`${baseUrl}/chapters/${chapterId}?lang=english`);
                    const endChap2 = Date.now();
                    log(`[Chapter Warm] Time: ${((endChap2 - startChap2) / 1000).toFixed(2)}s`);
                }
                else {
                    log("[Chapter] No chapters found to test.");
                }
            }
        }
    }
    catch (e) {
        log(`Test Failed: ${e.message}`);
    }
}
testGeneralPerformance();
