
const { Jimp, JimpMime } = require('jimp');

async function main() {
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const buffer = Buffer.from(b64, 'base64');
  
  try {
      const image = await Jimp.read(buffer);
      console.log('Read success');

      // Test Resize 1 arg
      try {
          console.log('Trying resize({ w: 10 })');
          image.resize({ w: 10 }); 
          console.log('resize({ w: 10 }) success');
      } catch(e) { console.log('resize({ w: 10 }) failed:', e.message); }

      // Test Resize 1 arg (number)
      try {
          console.log('Trying resize(10)');
          image.resize(10); 
          console.log('resize(10) success');
      } catch(e) { console.log('resize(10) failed:', e.message); }

      // Test getBuffer Promise
      try {
          console.log('Trying await getBuffer(mime)');
          const buf = await image.getBuffer(JimpMime.jpeg);
          console.log('await getBuffer success, len:', buf.length);
      } catch(e) { console.log('await getBuffer failed:', e.message); }

  } catch (e) {
      console.error('Fatal:', e);
  }
}
main();
