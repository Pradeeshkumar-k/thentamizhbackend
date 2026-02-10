
import { Jimp } from 'jimp';
const JimpMime = { jpeg: 'image/jpeg' }; // Jimp 1.x doesn't export JimpMime directly like this usually, check usage.

export const ImageService = {
  /**
   * Resizes and compresses a Base64 image string.
   * Target: Max width 400px (ideal for thumbnails), JPEG quality 60.
   * Returns a lightweight Base64 string (< 50KB).
   */
  processImage: async (base64String: string): Promise<string> => {
    if (!base64String || !base64String.startsWith('data:image')) {
      return base64String;
    }

    // Optimization: If image is already small (< 50KB approx), skip processing
    // 50KB = ~68,000 chars in Base64
    if (base64String.length < 70000) {
        return base64String;
    }

    try {
      const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return base64String;
      }
      
      const buffer = Buffer.from(matches[2], 'base64');
      const image = await Jimp.read(buffer as any);

      // 3. Resize if too big (Max width 400px for covers/thumbnails)
      if (image.width > 400) {
        image.resize({ w: 400 }); 
      }

      // 4. Set Quality to 60 (Requires any cast for Jimp 1.6 types)
      if ((image as any).quality) {
        (image as any).quality(60);
      }

      // 4. Convert back to Base64 (WebP)
    const imgAny = image as any;
    const optimizedBuffer = imgAny.getBufferAsync ? await imgAny.getBufferAsync('image/webp') : await new Promise((resolve, reject) => {
      imgAny.getBuffer('image/webp', (err: any, buffer: any) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });
    return `data:image/webp;base64,${(optimizedBuffer as Buffer).toString('base64')}`;

    } catch (error) {
      console.error('[ImageService] Compression failed:', error);
      return base64String;
    }
  }
};
