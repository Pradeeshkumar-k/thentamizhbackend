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
async function debug() {
    const logFile = 'debug-output.txt';
    const log = (msg) => {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    };
    fs.writeFileSync(logFile, 'Starting Debug\n');
    try {
        const baseUrl = 'http://localhost:5000/api';
        log(`Checking API at ${baseUrl}...`);
        // 1. Get Novels
        const novelsRes = await fetch(`${baseUrl}/novels`);
        if (!novelsRes.ok)
            throw new Error(`Failed to fetch novels: ${novelsRes.status}`);
        const novelsData = await novelsRes.json();
        const novels = novelsData.novels || novelsData;
        if (novels.length === 0) {
            log("No novels found via API.");
            return;
        }
        const novel = novels[0];
        log(`Found Novel: ${novel.id} - ${novel.title}`);
        // 2. Get Chapters
        const chaptersRes = await fetch(`${baseUrl}/novels/${novel.id}/chapters`);
        if (!chaptersRes.ok)
            throw new Error(`Failed to fetch chapters: ${chaptersRes.status}`);
        const chaptersData = await chaptersRes.json();
        const chapters = chaptersData.chapters || chaptersData;
        if (chapters.length === 0) {
            log("No chapters found for this novel.");
            return;
        }
        const chapter = chapters[0];
        log(`Found Chapter: ${chapter.id} - ${chapter.title}`);
        // 3. Call Chapter API with English
        const url = `${baseUrl}/novels/${novel.id}/chapters/${chapter.id}?lang=english`;
        log(`Calling Translation API: ${url}`);
        const res = await fetch(url);
        log(`API Response Status: ${res.status}`);
        if (res.ok) {
            const data = await res.json();
            log(`API Response TitleEn: ${data.titleEn}`);
            log(`API Response ContentEn Length: ${data.contentEn?.length}`);
            log(`API Response Content Sample: ${data.contentEn ? data.contentEn.substring(0, 50) + '...' : 'NULL'}`);
        }
        else {
            log(`API Response Text: ${await res.text()}`);
        }
    }
    catch (e) {
        log(`Debug Script Error: ${e.message}`);
    }
}
debug();
