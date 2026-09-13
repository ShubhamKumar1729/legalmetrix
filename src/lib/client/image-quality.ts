/**
 * Measures real quality metrics from the actual pixels of an image, in the browser,
 * before it is uploaded. Used for both camera captures and file uploads.
 */

export interface MeasuredQuality {
  width: number;
  height: number;
  /** 0 = black, 1 = white */
  brightness: number;
  /** 0 = sharp, 1 = very blurry */
  blurScore: number;
}

const ANALYSIS_MAX_EDGE = 640;

export async function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('This image could not be decoded. It may be corrupted.'));
      image.src = url;
    });
    return image;
  } finally {
    if (typeof source !== 'string') {
      // Revoke on the next tick so the image stays usable for drawing.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }
}

export function measureImageQuality(image: HTMLImageElement): MeasuredQuality {
  const scale = Math.min(1, ANALYSIS_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { width: image.naturalWidth, height: image.naturalHeight, brightness: 0.5, blurScore: 0 };
  }

  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  // Greyscale buffer.
  const grey = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const luma = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    grey[p] = luma;
    sum += luma;
  }
  const mean = sum / grey.length;

  // Variance of the Laplacian — a standard sharpness proxy.
  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const lap =
        4 * grey[idx] - grey[idx - 1] - grey[idx + 1] - grey[idx - width] - grey[idx + width];
      lapSum += lap;
      lapSqSum += lap * lap;
      count += 1;
    }
  }
  const lapMean = lapSum / Math.max(1, count);
  const lapVariance = lapSqSum / Math.max(1, count) - lapMean * lapMean;

  // A sharp label photo typically scores well above 100 on this scale.
  const blurScore = Math.max(0, Math.min(1, 1 - lapVariance / 400));
  // Penalise frames that are far too dark or blown out.
  const exposurePenalty = Math.min(Math.abs(mean - 0.55) * 1.4, 0.6);

  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    brightness: Math.round(mean * 100) / 100,
    blurScore: Math.round(Math.min(1, blurScore + exposurePenalty) * 100) / 100,
  };
}

export async function measureBlob(blob: Blob): Promise<MeasuredQuality> {
  const image = await loadImage(blob);
  return measureImageQuality(image);
}
