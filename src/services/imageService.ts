
import { Jimp, JimpMime } from 'jimp';

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
      const optimizedBuffer = await image.getBuffer(JimpMime.jpeg);
      return `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`;

    } catch (error) {
      console.error('[ImageService] Compression failed:', error);
      return base64String; // Fallback to original if failure
    }
  }
};
