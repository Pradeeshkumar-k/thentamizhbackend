import * as fs from 'fs';

async function testGeneralPerformance() {
    const logFile = 'perf-general-output.txt';
    const log = (msg: string) => {
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
            const data: any = await res.json();
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
    } else {
        log("[Chapter] No chapters found to test.");
    }
            }
        }
    } catch (e: any) {
        log(`Test Failed: ${e.message}`);
    }
}

testGeneralPerformance();
