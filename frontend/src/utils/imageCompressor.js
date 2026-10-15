import Compressor from 'compressorjs';

/**
 * Compress an image file using compressorjs to ensure size is under maxKB (default 800KB).
 * @param {File} file - Original image file
 * @param {number} maxKB - Target maximum size in kilobytes
 * @returns {Promise<File>} - Resolves to compressed File object
 */
export const compressBannerImage = (file, maxKB = 800) => {
  return new Promise((resolve, reject) => {
    if (!file || !(file instanceof Blob)) {
      return reject(new Error('File gambar tidak valid'));
    }

    const targetBytes = maxKB * 1024;

    // Initial quality heuristic based on original file size
    let initialQuality = 0.85;
    if (file.size > 5 * 1024 * 1024) {
      initialQuality = 0.7;
    } else if (file.size > 2 * 1024 * 1024) {
      initialQuality = 0.78;
    }

    new Compressor(file, {
      quality: initialQuality,
      maxWidth: 1920,
      maxHeight: 1080,
      mimeType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
      convertSize: targetBytes,
      success(result) {
        // If still exceeds targetBytes, do a second compression pass with lower quality
        if (result.size > targetBytes) {
          new Compressor(result, {
            quality: 0.65,
            maxWidth: 1440,
            maxHeight: 810,
            mimeType: 'image/jpeg',
            success(secondResult) {
              const finalFile = new File([secondResult], file.name.replace(/\.[^/.]+$/, '') + '.jpg', {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(finalFile);
            },
            error(err) {
              reject(err);
            },
          });
        } else {
          const finalFile = new File([result], file.name, {
            type: result.type,
            lastModified: Date.now(),
          });
          resolve(finalFile);
        }
      },
      error(err) {
        reject(err);
      },
    });
  });
};
