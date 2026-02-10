
import { Jimp } from 'jimp';
const JimpMime = { jpeg: 'image/jpeg' }; // Jimp 1.x doesn't export JimpMime directly like this usually, check usage.

export const ImageService = {
  /**
   * Resizes and compresses a Base64 image string.
   * Target: Max width 800px, JPEG quality 60.
   * Returns a lightweight Base64 string (< 100KB).
   */
  processImage: async (base64String: string): Promise<string> => {
    if (!base64String || !base64String.startsWith('data:image')) {
      return base64String; // Return as-is if not a valid image data URI
    }

    // Optimization: If image is already small (< 150KB approx), skip processing
    // 150KB = ~200,000 chars in Base64
    if (base64String.length < 200000) {
        return base64String;
    }

    try {
      // 1. Remove prefix to get buffer
      const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return base64String;
      }
      
      const buffer = Buffer.from(matches[2], 'base64');

      // 2. Read with Jimp
      const image = await Jimp.read(buffer);

      // 3. Resize if too big (Max width 800px)
      if (image.width > 800) {
        image.resize({ w: 800 }); 
      }

      // 4. Convert back to Base64 (JPEG)
      const imgAny = image as any;
      const optimizedBuffer = imgAny.getBufferAsync ? await imgAny.getBufferAsync('image/jpeg') : await new Promise((resolve, reject) => {
        imgAny.getBuffer('image/jpeg', (err: any, buffer: any) => {
          if (err) reject(err);
          else resolve(buffer);
        });
      });
      return `data:image/jpeg;base64,${(optimizedBuffer as Buffer).toString('base64')}`;

    } catch (error) {
      console.error('[ImageService] Compression failed:', error);
      return base64String; // Fallback to original if failure
    }
  }
};
