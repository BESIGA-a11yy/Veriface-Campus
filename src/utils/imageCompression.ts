/**
 * Compresses an image or live video frame client-side to a max width of 800px
 * and 0.7 JPEG quality so Base64 strings stay lightweight in MongoDB.
 */
export function compressVideoFrame(
  video: HTMLVideoElement,
  maxWidth = 800,
  quality = 0.7
): string {
  const sourceWidth = video.videoWidth || 640;
  const sourceHeight = video.videoHeight || 480;

  const scale = sourceWidth > maxWidth ? maxWidth / sourceWidth : 1;
  const targetWidth = Math.round(sourceWidth * scale);
  const targetHeight = Math.round(sourceHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize canvas 2D context for image compression.');
  }

  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL('image/jpeg', quality);
}

export function compressImageFile(
  file: File,
  maxWidth = 800,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file selected.'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const targetWidth = Math.round(img.width * scale);
        const targetHeight = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable.'));
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function getBase64SizeKb(dataUrl: string): number {
  const base64Part = dataUrl.split(',')[1] || dataUrl;
  const bytes = Math.ceil((base64Part.length * 3) / 4);
  return Math.max(1, Math.round(bytes / 1024));
}
