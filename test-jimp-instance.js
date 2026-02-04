
const { Jimp } = require('jimp');

async function main() {
  // Create a 1x1 buffer (PNG)
  // Transparent 1x1 pixel base64
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const buffer = Buffer.from(b64, 'base64');
  
  try {
      const image = await Jimp.read(buffer);
      console.log('Image keys:', Object.keys(image));
      console.log('Prototype keys:', Object.keys(Object.getPrototypeOf(image)));
      console.log('Has getWidth?', typeof image.getWidth);
      console.log('Has width?', typeof image.width);
      console.log('Has resize?', typeof image.resize);
      console.log('Has quality?', typeof image.quality);
      console.log('Has getBufferAsync?', typeof image.getBufferAsync);
      console.log('Has getBuffer?', typeof image.getBuffer);
      
      // Check resize signature length
      if (typeof image.resize === 'function') {
          console.log('Resize length:', image.resize.length);
      }
      
  } catch (e) {
      console.error(e);
  }
}
main();
