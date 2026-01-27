import * as fs from 'fs';

async function debug() {
  const logFile = 'debug-output.txt';
  const log = (msg: string) => {
      console.log(msg);
      fs.appendFileSync(logFile, msg + '\n');
  };
  fs.writeFileSync(logFile, 'Starting Debug\n');

  try {
    const baseUrl = 'http://localhost:5000/api';
    log(`Checking API at ${baseUrl}...`);

    // 1. Get Novels
    const novelsRes = await fetch(`${baseUrl}/novels`);
    if (!novelsRes.ok) throw new Error(`Failed to fetch novels: ${novelsRes.status}`);
    const novelsData: any = await novelsRes.json();
    const novels = novelsData.novels || novelsData;
    
    if (novels.length === 0) {
        log("No novels found via API.");
        return;
    }
    
    const novel = novels[0];
    log(`Found Novel: ${novel.id} - ${novel.title}`);

    // 2. Get Chapters
    const chaptersRes = await fetch(`${baseUrl}/novels/${novel.id}/chapters`);
    if (!chaptersRes.ok) throw new Error(`Failed to fetch chapters: ${chaptersRes.status}`);
    const chaptersData: any = await chaptersRes.json();
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
        const data: any = await res.json();
        log(`API Response TitleEn: ${data.titleEn}`);
        log(`API Response ContentEn Length: ${data.contentEn?.length}`);
        log(`API Response Content Sample: ${data.contentEn ? data.contentEn.substring(0, 50) + '...' : 'NULL'}`);
    } else {
         log(`API Response Text: ${await res.text()}`);
    }

  } catch (e: any) {
    log(`Debug Script Error: ${e.message}`);
  }
}

debug();
