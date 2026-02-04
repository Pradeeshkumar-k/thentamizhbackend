
const { Jimp, JimpMime } = require('jimp');

async function main() {
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const buffer = Buffer.from(b64, 'base64');
  
  try {
      const image = await Jimp.read(buffer);
      console.log('Original width:', image.width);
      
      // Test Resize
      image.resize(10, -1); // Try to resize (will likely fail logic on 1x1 but method should run)
      console.log('Resize called successfully');
      
      // Test getBuffer Promise
      console.log('Calling getBuffer with', JimpMime.jpeg);
      const result = image.getBuffer(JimpMime.jpeg);
      console.log('getBuffer result type:', typeof result);
      console.log('Is promise?', result instanceof Promise);
      
      if (result instanceof Promise) {
          const out = await result;
          console.log('Buffer length:', out.length);
      } else {
          // Try callback style
          image.getBuffer(JimpMime.jpeg, (err, out) => {
              if(err) console.error('Callback error:', err);
              else console.log('Callback success, length:', out.length);
          });
      }

  } catch (e) {
      console.error('Error:', e);
  }
}
main();
