import Compressor from 'compressorjs';

export const MAX_TOPUP_PROOF_SIZE = 400 * 1024; // 400 KB

export const formatBytes = (bytes, decimals = 1) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/**
 * Kompres file gambar menggunakan Compressor.js di browser
 * Memastikan ukuran gambar maksimum adalah 400 KB
 *
 * @param {File} file - File gambar asli yang dipilih user
 * @param {Object} [options]
 * @param {number} [options.maxSizeBytes=409600] - Batas maksimal ukuran file (default 400 KB)
 * @returns {Promise<{ file: File, previewUrl: string, originalSize: number, compressedSize: number, savedPercent: number }>}
 */
export const compressImage = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('File tidak ditemukan'));
    }

    if (!file.type.startsWith('image/')) {
      return reject(new Error('Hanya file gambar (JPG, PNG, WEBP) yang dapat diunggah'));
    }

    const targetSize = options.maxSizeBytes || MAX_TOPUP_PROOF_SIZE;

    // Tentukan parameter kompresi awal berdasarkan ukuran file asli
    let initialQuality = 0.8;
    let initialDimension = 1600;

    if (file.size > 5 * 1024 * 1024) {
      initialQuality = 0.6;
      initialDimension = 1280;
    } else if (file.size > 2 * 1024 * 1024) {
      initialQuality = 0.7;
      initialDimension = 1440;
    }

    const compressRecursive = (quality, maxDim, attempt = 1) => {
      new Compressor(file, {
        quality,
        maxWidth: maxDim,
        maxHeight: maxDim,
        convertSize: targetSize, // otomatis convert ke JPEG jika melebihi target
        mimeType: 'image/jpeg',
        checkOrientation: true,
        success(resultBlob) {
          // Jika ukuran masih melebihi target dan percobaan masih wajar, kurangi kualitas
          if (resultBlob.size > targetSize && attempt < 4 && quality > 0.3) {
            const nextQuality = Math.max(0.3, quality - 0.15);
            const nextDim = Math.max(800, maxDim - 300);
            compressRecursive(nextQuality, nextDim, attempt + 1);
            return;
          }

          // Generate file baru dari Blob dengan ekstensi .jpg
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const compressedFile = new File([resultBlob], `${baseName}.jpg`, {
            type: resultBlob.type || 'image/jpeg',
            lastModified: Date.now(),
          });

          const previewUrl = URL.createObjectURL(resultBlob);
          const originalSize = file.size;
          const compressedSize = compressedFile.size;
          const savedPercent = originalSize > compressedSize
            ? Math.round(((originalSize - compressedSize) / originalSize) * 100)
            : 0;

          resolve({
            file: compressedFile,
            previewUrl,
            originalSize,
            compressedSize,
            savedPercent,
          });
        },
        error(err) {
          reject(err);
        },
      });
    };

    compressRecursive(initialQuality, initialDimension);
  });
};
